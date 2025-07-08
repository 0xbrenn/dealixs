// frontend/src/constants/contracts.ts
// Contract addresses from environment variables
export const ROUTER_ADDRESS = process.env.REACT_APP_ROUTER_ADDRESS || '0x5C4E8EC175A0E7d850f99296Bf25d15DE4aCd570';
export const FACTORY_ADDRESS = process.env.REACT_APP_FACTORY_ADDRESS || '0x6897FAb6F450Fc1C170e7cD4A51B524aC35dd74E';
export const WETH_ADDRESS = process.env.REACT_APP_WETH_ADDRESS || '0x4200000000000000000000000000000000000006';
export const DEALIX_ADDRESS = process.env.REACT_APP_DEALIX_ADDRESS || '0x33d7F3120E2E74202c338EF1A3A510d98B67A5aC';
export const LIQUIDITY_MANAGER_ADDRESS = process.env.REACT_APP_LIQUIDITY_MANAGER_ADDRESS || '0x6cDa4371868e1E94fd317F480b568C4121c3203A';

// Contract ABIs#===========================================

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)"
];

// Updated DEALIX_ABI with complete function signatures
// Updated DEALIX_ABI for the new DealixDEX contract
export const DEALIX_ABI = [
  // ERC721 Functions
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  
  // Core DealixDEX Functions
  "function createDealixID(address referrer) payable",
  "function mintingFee() view returns (uint256)",
  "function platformFee() view returns (uint256)",
  "function treasuryAddress() view returns (address)",
  "function guardian() view returns (address)",
  "function router() view returns (address)",
  "function factory() view returns (address)",
  
  // Profile Management
  "function userToDealixID(address user) view returns (uint256)",
  "function dealixIDs(uint256) view returns (uint256 tokenId, address owner, uint256 totalVolume, uint256 discountTier, uint256 badgeCount, uint256 liquidityProvided, uint256 discountsCreated, uint256 swapCount, uint256 socialPoints, uint256 lastActivityTimestamp, uint256 activityStreak, uint256 affiliateEarnings, uint256 volumeInCurrentBlock, uint256 lastVolumeUpdateBlock)",
  
  // Add the missing getDealixProfile function
  "function getDealixProfile(address user) view returns (uint256 dealixID, uint256 totalVolume, uint256 discountTier, uint256 badgeCount, uint256 liquidityProvided, uint256 discountsCreated, uint256 swapCount, uint256 socialPoints, uint256 activityStreak)",
  
  // Discount Pools
  "function createTokenDiscountPool(tuple(address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint256 discountPercentage, uint256 minTradeSize, uint256 duration)) returns (uint256)",
  "function getActiveDiscountPools(address tokenA, address tokenB) view returns (uint256[])",
  "function discountPools(uint256) view returns (uint256 id, address creator, address tokenA, address tokenB, uint256 reserveA, uint256 reserveB, uint256 discountPercentage, uint256 minTradeSize, uint256 maxDiscountPerTrade, uint256 totalVolumeGenerated, uint256 expirationTime, bool isActive, bool useTokenReserves, uint256 lpTokenAmount, address lpToken)",
  "function claimExpiredDiscountPool(uint256 poolId)",
  
  // Swap Functions
   "function swapWithDealix(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin, uint256[] discountPoolIDs, uint256 affiliateDiscountID)) payable returns (uint256)",
  "function swapWithoutDealix(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) payable returns (uint256)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable",
  
  // Badge System
  "function badges(uint256) view returns (string name, string description, uint256 requirement, uint8 badgeType, string imageURI, uint256 points, bool active)",
  "function getUserBadges(uint256 dealixID) view returns (uint256[])",
  "function badgeCount() view returns (uint256)",
  
  // Admin Functions
  "function pause()",
  "function unpause()",
  "function setTreasuryAddress(address _treasury)",
  "function setGuardian(address _guardian)",
  "function blacklistToken(address token, bool blacklisted)",
  
  // View Functions
  "function isBlacklistedToken(address token) view returns (bool)",
  "function paused() view returns (bool)",
  
  // Events
  "event DealixIDCreated(address indexed owner, uint256 indexed tokenId)",
  "event DiscountPoolCreated(uint256 indexed poolId, address indexed creator, address tokenA, address tokenB, uint256 discountPercentage)",
  "event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 discount)",
  "event BadgeAwarded(uint256 indexed dealixID, uint256 indexed badgeID)"
];

// Alias for backward compatibility if needed
export const DEALIX_DEX_ABI = DEALIX_ABI;

// Liquidity Manager ABI
export const LIQUIDITY_MANAGER_ABI = [
  // Core Functions
  "function router() view returns (address)",
  "function factory() view returns (address)",
  "function dealixDEX() view returns (address)",
  "function treasuryAddress() view returns (address)",
  
  // Affiliate Discount Functions
  "function createAffiliateDiscount(tuple(address project, address token, uint256 discountPercentage, uint256 affiliateCommission, uint256 duration, uint256 maxUsagePerUser)) returns (uint256)",
  "function fundAffiliateDiscount(uint256 discountID, uint256 amount)",
  "function applyAffiliateDiscount(uint256 discountID, address user, uint256 volumeGenerated) returns (uint256 discountAmount, uint256 netCommission, address affiliate)",
  "function affiliateDiscounts(uint256) view returns (address affiliate, address project, address token, uint256 discountPercentage, uint256 affiliateCommission, uint256 fundedAmount, uint256 remainingAmount, uint256 volumeGenerated, uint256 expirationTime, bool isActive, bool isProjectVerified, uint256 maxUsagePerUser)",
  "function getActiveAffiliateDiscounts(address token) view returns (uint256[])",
  "function canUseAffiliateDiscount(uint256 discountID, address user) view returns (bool)",
  "function projectAffiliateDiscounts(address project, uint256 index) view returns (uint256)",
  "function affiliateCreatedDiscounts(address affiliate, uint256 index) view returns (uint256)",
  
  // Liquidity Functions
  "function addLiquidityWithDiscountPool(tuple(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, uint256 discountReserveA, uint256 discountReserveB, uint256 discountPercentage, uint256 minTradeSize, uint256 duration)) returns (uint256 amountA, uint256 amountB, uint256 liquidity, uint256 discountPoolID)",
  
  // Project Management
  "function verifiedProjects(address project) view returns (bool)",
  "function verifyProject(address project)",
  "function unverifyProject(address project)",
  
  // Admin Functions
  "function pause()",
  "function unpause()",
  "function setTreasuryAddress(address _treasury)",
  "function paused() view returns (bool)",
  
  // Constants
  "function AFFILIATE_PLATFORM_CUT() view returns (uint256)",
  "function MAX_DISCOUNT_PERCENTAGE() view returns (uint256)",
  "function MAX_COMMISSION_PERCENTAGE() view returns (uint256)",
  "function nextAffiliateDiscountID() view returns (uint256)",
  
  // Events
  "event AffiliateDiscountCreated(uint256 indexed discountID, address indexed affiliate, address indexed project, address token, uint256 discountPercentage)",
  "event AffiliateDiscountFunded(uint256 indexed discountID, address indexed funder, uint256 amount)",
  "event AffiliateDiscountUsed(uint256 indexed discountID, address indexed user, uint256 discountAmount, uint256 volumeGenerated)",
  "event AffiliateCommissionPaid(address indexed affiliate, uint256 amount, uint256 discountID)",
  "event LiquidityAddedWithDiscount(address indexed user, address tokenA, address tokenB, uint256 liquidity, uint256 discountPoolID)",
  "event ProjectVerified(address indexed project)"
];

export const WETH_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function totalSupply() view returns (uint256)"
];

export const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)"
];

export const ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)",
  "function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)",
  "function factory() external view returns (address)",
  "function WETH() external view returns (address)",
  "function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)"
];

export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function createPair(address tokenA, address tokenB) external returns (address pair)",
  "function allPairs(uint) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)",
  "function feeTo() external view returns (address)",
  "function feeToSetter() external view returns (address)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];



export const MASTERCHEF_ABI = [
  "function poolLength() external view returns (uint256)",
  "function poolInfo(uint256) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accRewardPerShare, uint256 depositFee)",
  "function userInfo(uint256, address) external view returns (uint256 amount, uint256 rewardDebt)",
  "function pendingReward(uint256 _pid, address _user) external view returns (uint256)",
  "function deposit(uint256 _pid, uint256 _amount) external",
  "function withdraw(uint256 _pid, uint256 _amount) external",
  "function emergencyWithdraw(uint256 _pid) external",
  "function rewardPerBlock() external view returns (uint256)",
  "function totalAllocPoint() external view returns (uint256)"
];