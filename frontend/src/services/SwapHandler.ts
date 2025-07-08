// iopn-dex/frontend/src/services/SwapHandler.ts
import { ethers } from 'ethers';
import { Token } from '../types';
import { ROUTER_ADDRESS, ROUTER_ABI, ERC20_ABI, WETH_ADDRESS, WETH_ABI } from '../constants/contracts';

// Add Dealix imports
const DEALIX_ADDRESS = process.env.REACT_APP_DEALIX_ADDRESS || '';
const DEALIX_ABI = [
  "function swapWithDealix((address,address,uint256,uint256,uint256[],uint256)) returns (uint256)",
  "function swapWithoutDealix(address,address,uint256,uint256) returns (uint256)",
  "function userToDealixID(address) view returns (uint256)"
];

export class SwapHandler {
  private provider: ethers.providers.Web3Provider;
  private signer: ethers.Signer;
  private routerContract: ethers.Contract;
  private dealixContract: ethers.Contract | null;

  constructor(walletProvider: any) {
    this.provider = new ethers.providers.Web3Provider(walletProvider);
    this.signer = this.provider.getSigner();
    this.routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.signer);
    
    // Initialize Dealix contract if address is available
    if (DEALIX_ADDRESS) {
      this.dealixContract = new ethers.Contract(DEALIX_ADDRESS, DEALIX_ABI, this.signer);
    } else {
      this.dealixContract = null;
    }
  }

  /**
   * Determines if a token is the native token (ETH on Base)
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
    spender: string,
    userAddress: string
  ): Promise<void> {
    // Native tokens don't need approval
    if (this.isNativeToken(tokenAddress)) return;

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const currentAllowance = await tokenContract.allowance(userAddress, spender);

    if (currentAllowance.lt(amount)) {
      // Always use MaxUint256 for better UX (no need for multiple approvals)
      const approveTx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
      await approveTx.wait();
    }
  }

  /**
   * Checks if user has Dealix ID
   */
  async hasDealixId(userAddress: string): Promise<boolean> {
    if (!this.dealixContract) return false;
    
    try {
      const dealixId = await this.dealixContract.userToDealixID(userAddress);
      return dealixId.toNumber() > 0;
    } catch (error) {
      console.error('Error checking Dealix ID:', error);
      return false;
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

      // Special case: ETH to WETH (1:1 wrap)
      if (this.isNativeToken(fromToken.address) && toToken.address === WETH_ADDRESS) {
        return amountIn;
      }

      // Special case: WETH to ETH (1:1 unwrap)
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
   * Executes swap through Dealix if user has ID and discounts, otherwise direct swap
   */
  async executeSwap(
  fromToken: Token,
  toToken: Token,
  fromAmount: string,
  minToAmount: string,
  userAddress: string,
  slippageTolerance: number,
  // Add these new parameters
  hasDealixId: boolean = false,
  discountPoolIds: number[] = [],
  affiliateDiscountId: number | null = null
): Promise<ethers.ContractReceipt> {
  console.log('=== SWAP HANDLER DEBUG ===');
  console.log('Has Dealix ID:', hasDealixId);
  console.log('Discount Pool IDs:', discountPoolIds);
  console.log('Affiliate Discount:', affiliateDiscountId);
  console.log('Dealix Contract exists:', !!this.dealixContract);
  console.log('DEALIX_ADDRESS:', DEALIX_ADDRESS);
  this.validateSwapParams(fromToken, toToken, fromAmount);

  const minAmountOut = ethers.utils.parseUnits(minToAmount, toToken.decimals);
  const minAmountOutWithSlippage = minAmountOut.mul(10000 - slippageTolerance * 100).div(10000);

  // Check if we should use Dealix
  const shouldUseDealix = this.dealixContract && (hasDealixId || discountPoolIds.length > 0);
  
  if (shouldUseDealix && hasDealixId && discountPoolIds.length > 0) {
    // Use Dealix swap with discounts
    console.log('Executing Dealix swap with discounts:', discountPoolIds);
    return await this.executeSwapWithDealix(
      fromToken,
      toToken,
      fromAmount,
      minAmountOutWithSlippage,
      discountPoolIds,
      affiliateDiscountId
    );
  } else if (shouldUseDealix && !hasDealixId) {
    // Use Dealix's swapWithoutDealix for non-ID holders
    console.log('Executing Dealix swap without ID');
    return await this.executeSwapWithoutDealix(
      fromToken,
      toToken,
      fromAmount,
      minAmountOutWithSlippage
    );
  } else {
    // Fallback to regular router swap
    console.log('Executing regular router swap');
    return await this.executeRegularSwap(
      fromToken,
      toToken,
      fromAmount,
      minAmountOutWithSlippage,
      userAddress
    );
  }
}

  /**
   * Execute swap through Dealix with discounts
   */
  // In SwapHandler.ts, update the executeSwapWithDealix function:

private async executeSwapWithDealix(
  fromToken: Token,
  toToken: Token,
  fromAmount: string,
  minAmountOut: ethers.BigNumber,
  discountPoolIds: number[],
  affiliateDiscountId: number | null
): Promise<ethers.ContractReceipt> {
   console.log('=== DEALIX SWAP EXECUTION ===');
  console.log('Discount Pool IDs being sent:', discountPoolIds);
  if (!this.dealixContract) throw new Error('Dealix contract not initialized');

  const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
  const userAddress = await this.signer.getAddress();

  // Handle approvals for Dealix contract
  if (!this.isNativeToken(fromToken.address)) {
    await this.handleTokenApproval(fromToken.address, amountIn, DEALIX_ADDRESS, userAddress);
  }

  // IMPORTANT: Always use WETH for ETH in the swap params
  // The contract expects WETH address, not zero address
  const tokenIn = this.isNativeToken(fromToken.address) ? WETH_ADDRESS : fromToken.address;
  const tokenOut = this.isNativeToken(toToken.address) ? WETH_ADDRESS : toToken.address;

  // Prepare swap params for Dealix
  const swapParams = {
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    amountIn: amountIn,
    amountOutMin: minAmountOut,
    discountPoolIDs: discountPoolIds,
    affiliateDiscountID: affiliateDiscountId || 0
  };

  console.log('Executing Dealix swap with params:', {
    tokenIn,
    tokenOut,
    amountIn: amountIn.toString(),
    discountPoolIds,
    fromTokenOriginal: fromToken.address,
    toTokenOriginal: toToken.address
  });

  // Execute swap through Dealix
  // Send ETH value if swapping from ETH
  const value = this.isNativeToken(fromToken.address) ? amountIn : 0;
  const tx = await this.dealixContract.swapWithDealix(swapParams, { value });
  
  return await tx.wait();
}

  /**
   * Execute swap through Dealix without ID (platform fee applies)
   */
  private async executeSwapWithoutDealix(
    fromToken: Token,
    toToken: Token,
    fromAmount: string,
    minAmountOut: ethers.BigNumber
  ): Promise<ethers.ContractReceipt> {
    if (!this.dealixContract) throw new Error('Dealix contract not initialized');

    const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
    const userAddress = await this.signer.getAddress();

    // Handle approvals for Dealix contract
    if (!this.isNativeToken(fromToken.address)) {
      await this.handleTokenApproval(fromToken.address, amountIn, DEALIX_ADDRESS, userAddress);
    }

    // Execute swap through Dealix (without discounts, but platform fee applies)
    const tokenIn = this.isNativeToken(fromToken.address) ? WETH_ADDRESS : fromToken.address;
    const tokenOut = this.isNativeToken(toToken.address) ? WETH_ADDRESS : toToken.address;
    const value = this.isNativeToken(fromToken.address) ? amountIn : 0;
    
    const tx = await this.dealixContract.swapWithoutDealix(
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      { value }
    );
    
    return await tx.wait();
  }

  /**
   * Execute regular swap through router (fallback)
   */
  private async executeRegularSwap(
    fromToken: Token,
    toToken: Token,
    fromAmount: string,
    minAmountOut: ethers.BigNumber,
    userAddress: string
  ): Promise<ethers.ContractReceipt> {
    const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    // Try standard swap first, then fallback to tax token function
    try {
      let tx: ethers.ContractTransaction;

      // Case 3: Native ETH to Token
      if (this.isNativeToken(fromToken.address) && !this.isNativeToken(toToken.address)) {
        const path = [WETH_ADDRESS, toToken.address];
        tx = await this.routerContract.swapExactETHForTokens(
          minAmountOut,
          path,
          userAddress,
          deadline,
          { value: amountIn }
        );
      }
      // Case 4: Token to Native ETH
      else if (!this.isNativeToken(fromToken.address) && this.isNativeToken(toToken.address)) {
        await this.handleTokenApproval(fromToken.address, amountIn, ROUTER_ADDRESS, userAddress);
        const path = [fromToken.address, WETH_ADDRESS];
        tx = await this.routerContract.swapExactTokensForETH(
          amountIn,
          minAmountOut,
          path,
          userAddress,
          deadline
        );
      }
      // Case 5: Token to Token
      else {
        await this.handleTokenApproval(fromToken.address, amountIn, ROUTER_ADDRESS, userAddress);
        const path = this.getSwapPath(fromToken, toToken);
        tx = await this.routerContract.swapExactTokensForTokens(
          amountIn,
          minAmountOut,
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

        // Case 3: Native ETH to Token (Tax)
        if (this.isNativeToken(fromToken.address) && !this.isNativeToken(toToken.address)) {
          const path = [WETH_ADDRESS, toToken.address];
          tx = await this.routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
            minAmountOut,
            path,
            userAddress,
            deadline,
            { value: amountIn }
          );
        }
        // Case 4: Token to Native ETH (Tax)
        else if (!this.isNativeToken(fromToken.address) && this.isNativeToken(toToken.address)) {
          // Approval already done in first attempt
          const path = [fromToken.address, WETH_ADDRESS];
          tx = await this.routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            minAmountOut,
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
            minAmountOut,
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
    userAddress: string,
    discountPoolIds: number[] = [],
    affiliateDiscountId: number | null = null
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
        // Check if we should estimate through Dealix
        const hasDealixId = await this.hasDealixId(userAddress);
        const hasDiscounts = discountPoolIds.length > 0 || affiliateDiscountId !== null;
        
        if (this.dealixContract && (hasDealixId || !hasDealixId)) {
          // Estimate through Dealix
          if (hasDealixId && hasDiscounts) {
            // With discounts
            const swapParams = {
              tokenIn: this.isNativeToken(fromToken.address) ? WETH_ADDRESS : fromToken.address,
              tokenOut: this.isNativeToken(toToken.address) ? WETH_ADDRESS : toToken.address,
              amountIn: amountIn,
              amountOutMin: 0,
              discountPoolIDs: discountPoolIds,
              affiliateDiscountID: affiliateDiscountId || 0
            };
            const value = this.isNativeToken(fromToken.address) ? amountIn : 0;
            gasEstimate = await this.dealixContract.estimateGas.swapWithDealix(swapParams, { value });
          } else {
            // Without ID (platform fee)
            const tokenIn = this.isNativeToken(fromToken.address) ? WETH_ADDRESS : fromToken.address;
            const tokenOut = this.isNativeToken(toToken.address) ? WETH_ADDRESS : toToken.address;
            const value = this.isNativeToken(fromToken.address) ? amountIn : 0;
            gasEstimate = await this.dealixContract.estimateGas.swapWithoutDealix(
              tokenIn,
              tokenOut,
              amountIn,
              0,
              { value }
            );
          }
        } else {
          // Fallback to regular router estimation
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