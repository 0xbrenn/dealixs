// iopn-dex/frontend/src/services/SwapHandler.ts
import { ethers } from 'ethers';
import { Token } from '../types';
import { ROUTER_ADDRESS, ROUTER_ABI, ERC20_ABI, WETH_ADDRESS, WETH_ABI } from '../constants/contracts';

export class SwapHandler {
  private provider: ethers.providers.Web3Provider;
  private signer: ethers.Signer;
  private routerContract: ethers.Contract;

  constructor(walletProvider: any) {
    this.provider = new ethers.providers.Web3Provider(walletProvider);
    this.signer = this.provider.getSigner();
    this.routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.signer);
  }

  /**
   * Determines if a token is the native token (OPN)
   */
  private isNativeToken(address: string): boolean {
    return address === '0x0000000000000000000000000000000000000000';
  }

  /**
   * Gets the appropriate swap path considering native token wrapping
   */
  private getSwapPath(fromToken: Token, toToken: Token): string[] {
    const fromAddress = this.isNativeToken(fromToken.address) ? WETH_ADDRESS : fromToken.address;
    const toAddress = this.isNativeToken(toToken.address) ? WETH_ADDRESS : toToken.address;
    return [fromAddress, toAddress];
  }

  /**
   * Validates swap parameters
   */
  private validateSwapParams(fromToken: Token, toToken: Token, amount: string): void {
    if (!fromToken || !toToken) {
      throw new Error('Invalid tokens');
    }
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Invalid amount');
    }
    if (fromToken.address === toToken.address) {
      throw new Error('Cannot swap same token');
    }
  }

  /**
   * Handles token approval if needed
   */
  private async handleTokenApproval(
    tokenAddress: string, 
    amount: ethers.BigNumber,
    userAddress: string
  ): Promise<void> {
    // Native tokens don't need approval
    if (this.isNativeToken(tokenAddress)) return;

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const currentAllowance = await tokenContract.allowance(userAddress, ROUTER_ADDRESS);

    if (currentAllowance.lt(amount)) {
      // Always use MaxUint256 for better UX (no need for multiple approvals)
      const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      await approveTx.wait();
    }
  }

  /**
   * Calculates expected output for a swap
   */
  async calculateSwapOutput(
    fromToken: Token,
    toToken: Token,
    amountIn: string
  ): Promise<string> {
    try {
      this.validateSwapParams(fromToken, toToken, amountIn);

      // Special case: OPN to wOPN (1:1 wrap)
      if (this.isNativeToken(fromToken.address) && toToken.address === WETH_ADDRESS) {
        return amountIn;
      }

      // Special case: wOPN to OPN (1:1 unwrap)
      if (fromToken.address === WETH_ADDRESS && this.isNativeToken(toToken.address)) {
        return amountIn;
      }

      const path = this.getSwapPath(fromToken, toToken);
      const amountInWei = ethers.utils.parseUnits(amountIn, fromToken.decimals);

      try {
        const amounts = await this.routerContract.getAmountsOut(amountInWei, path);
        return ethers.utils.formatUnits(amounts[amounts.length - 1], toToken.decimals);
      } catch (error) {
        // If getAmountsOut fails, it might be a tax token
        // Return 0 and let the UI handle it
        console.warn('getAmountsOut failed - might be a tax token:', error);
        return '0';
      }
    } catch (error) {
      console.error('Error calculating swap output:', error);
      return '0';
    }
  }

  /**
   * Executes the swap with automatic fallback to tax token functions
   */
  async executeSwap(
    fromToken: Token,
    toToken: Token,
    fromAmount: string,
    minToAmount: string,
    userAddress: string,
    slippageTolerance: number = 0.5 // 0.5% default
  ): Promise<ethers.ContractReceipt> {
    this.validateSwapParams(fromToken, toToken, fromAmount);

    const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
    const minAmountOut = ethers.utils.parseUnits(minToAmount, toToken.decimals);
    
    // Apply slippage tolerance
    const slippageMultiplier = 10000 - Math.floor(slippageTolerance * 100);
    const minAmountOutWithSlippage = minAmountOut.mul(slippageMultiplier).div(10000);
    
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    // Case 1: Native OPN to wOPN (just wrap)
    if (this.isNativeToken(fromToken.address) && toToken.address === WETH_ADDRESS) {
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, this.signer);
      const tx = await wethContract.deposit({ value: amountIn });
      return await tx.wait();
    }
    
    // Case 2: wOPN to Native OPN (just unwrap)
    if (fromToken.address === WETH_ADDRESS && this.isNativeToken(toToken.address)) {
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, this.signer);
      const tx = await wethContract.withdraw(amountIn);
      return await tx.wait();
    }

    // For all other cases, try standard swap first, then fallback to tax token function
    try {
      let tx: ethers.ContractTransaction;

      // Case 3: Native OPN to Token
      if (this.isNativeToken(fromToken.address) && !this.isNativeToken(toToken.address)) {
        const path = [WETH_ADDRESS, toToken.address];
        tx = await this.routerContract.swapExactETHForTokens(
          minAmountOutWithSlippage,
          path,
          userAddress,
          deadline,
          { value: amountIn }
        );
      }
      // Case 4: Token to Native OPN
      else if (!this.isNativeToken(fromToken.address) && this.isNativeToken(toToken.address)) {
        await this.handleTokenApproval(fromToken.address, amountIn, userAddress);
        const path = [fromToken.address, WETH_ADDRESS];
        tx = await this.routerContract.swapExactTokensForETH(
          amountIn,
          minAmountOutWithSlippage,
          path,
          userAddress,
          deadline
        );
      }
      // Case 5: Token to Token
      else {
        await this.handleTokenApproval(fromToken.address, amountIn, userAddress);
        const path = this.getSwapPath(fromToken, toToken);
        tx = await this.routerContract.swapExactTokensForTokens(
          amountIn,
          minAmountOutWithSlippage,
          path,
          userAddress,
          deadline
        );
      }

      return await tx.wait();
    } catch (error: any) {
      // If the swap fails with K error, it's likely a tax token
      if (error.message?.includes('K') || error.message?.includes('INSUFFICIENT_INPUT_AMOUNT')) {
        console.log('Standard swap failed, trying tax token swap...');
        
        // Retry with tax token functions
        let tx: ethers.ContractTransaction;

        // Case 3: Native OPN to Token (Tax)
        if (this.isNativeToken(fromToken.address) && !this.isNativeToken(toToken.address)) {
          const path = [WETH_ADDRESS, toToken.address];
          tx = await this.routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
            minAmountOutWithSlippage,
            path,
            userAddress,
            deadline,
            { value: amountIn }
          );
        }
        // Case 4: Token to Native OPN (Tax)
        else if (!this.isNativeToken(fromToken.address) && this.isNativeToken(toToken.address)) {
          // Approval already done in first attempt
          const path = [fromToken.address, WETH_ADDRESS];
          tx = await this.routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            minAmountOutWithSlippage,
            path,
            userAddress,
            deadline
          );
        }
        // Case 5: Token to Token (Tax)
        else {
          // Approval already done in first attempt
          const path = this.getSwapPath(fromToken, toToken);
          tx = await this.routerContract.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            minAmountOutWithSlippage,
            path,
            userAddress,
            deadline
          );
        }

        return await tx.wait();
      } else {
        // If it's not a K error, throw the original error
        throw error;
      }
    }
  }

  /**
   * Gets the optimal path for multi-hop swaps
   */
  async getOptimalPath(fromToken: Token, toToken: Token): Promise<string[]> {
    // For now, return direct path
    // In production, implement path finding through liquidity pools
    return this.getSwapPath(fromToken, toToken);
  }

  /**
   * Estimates gas for a swap
   */
  async estimateSwapGas(
    fromToken: Token,
    toToken: Token,
    amount: string,
    userAddress: string
  ): Promise<ethers.BigNumber> {
    try {
      const amountIn = ethers.utils.parseUnits(amount, fromToken.decimals);
      const path = this.getSwapPath(fromToken, toToken);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      let gasEstimate: ethers.BigNumber;

      // Special cases for wrap/unwrap
      if (this.isNativeToken(fromToken.address) && toToken.address === WETH_ADDRESS) {
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, this.signer);
        gasEstimate = await wethContract.estimateGas.deposit({ value: amountIn });
      } else if (fromToken.address === WETH_ADDRESS && this.isNativeToken(toToken.address)) {
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, this.signer);
        gasEstimate = await wethContract.estimateGas.withdraw(amountIn);
      } else {
        // Try standard estimation first
        try {
          if (this.isNativeToken(fromToken.address)) {
            gasEstimate = await this.routerContract.estimateGas.swapExactETHForTokens(
              0,
              path,
              userAddress,
              deadline,
              { value: amountIn }
            );
          } else if (this.isNativeToken(toToken.address)) {
            gasEstimate = await this.routerContract.estimateGas.swapExactTokensForETH(
              amountIn,
              0,
              path,
              userAddress,
              deadline
            );
          } else {
            gasEstimate = await this.routerContract.estimateGas.swapExactTokensForTokens(
              amountIn,
              0,
              path,
              userAddress,
              deadline
            );
          }
        } catch {
          // If standard estimation fails, try tax token estimation
          if (this.isNativeToken(fromToken.address)) {
            gasEstimate = await this.routerContract.estimateGas.swapExactETHForTokensSupportingFeeOnTransferTokens(
              0,
              path,
              userAddress,
              deadline,
              { value: amountIn }
            );
          } else if (this.isNativeToken(toToken.address)) {
            gasEstimate = await this.routerContract.estimateGas.swapExactTokensForETHSupportingFeeOnTransferTokens(
              amountIn,
              0,
              path,
              userAddress,
              deadline
            );
          } else {
            gasEstimate = await this.routerContract.estimateGas.swapExactTokensForTokensSupportingFeeOnTransferTokens(
              amountIn,
              0,
              path,
              userAddress,
              deadline
            );
          }
        }
      }

      // Add 20% buffer for gas estimation
      return gasEstimate.mul(120).div(100);
    } catch (error) {
      console.error('Gas estimation failed:', error);
      // Return default gas limit
      return ethers.BigNumber.from('300000');
    }
  }
}