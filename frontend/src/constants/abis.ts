// Additional ABIs not in contracts.ts

export const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) external returns (uint256 blockNumber, bytes[] returnData)"
];

export const WETH_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 amount) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

