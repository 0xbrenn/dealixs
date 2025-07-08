// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IDealixV2Router02.sol";
import "./interfaces/IDealixV2Factory.sol";
import "./interfaces/IDealixV2Pair.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

/**
 * @title DealixDEX - Enhanced Version with All Fixes
 * @dev Main contract for Dealix with buy-only protection, ETH handling, and improved discounts
 */
contract DealixDEX is ERC721Enumerable, Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    
    // ============ Structs ============
    
    struct DealixID {
        uint256 tokenId;
        address owner;
        uint256 totalVolume;
        uint256 discountTier;
        uint256 badgeCount;
        uint256 liquidityProvided;
        uint256 discountsCreated;
        uint256 swapCount;
        uint256 socialPoints;
        uint256 lastActivityTimestamp;
        uint256 activityStreak;
        uint256 affiliateEarnings;
        uint256 volumeInCurrentBlock;
        uint256 lastVolumeUpdateBlock;
    }
    
    struct DiscountPool {
        uint256 id;
        address creator;
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 discountPercentage;
        uint256 minTradeSize;
        uint256 maxDiscountPerTrade;
        uint256 totalVolumeGenerated;
        uint256 expirationTime;
        bool isActive;
        bool useTokenReserves;
        uint256 lpTokenAmount;
        address lpToken;
        bool isBuyOnly;
        DiscountType discountType;
        mapping(address => uint256) userClaims;
        mapping(address => uint256) lastClaimTimestamp;
        mapping(address => bool) allowedBuyTokens;
    }
    
    struct Badge {
        string name;
        string description;
        uint256 requirement;
        BadgeType badgeType;
        string imageURI;
        uint256 points;
        bool active;
    }
    
    struct AffiliateDiscount {
        address affiliate;
        address project;
        address token;
        uint256 discountPercentage;
        uint256 affiliateCommission;
        uint256 fundedAmount;
        uint256 remainingAmount;
        uint256 volumeGenerated;
        uint256 expirationTime;
        bool isActive;
        bool isProjectVerified;
    }
    
    struct LiquidityParams {
        address tokenA;
        address tokenB;
        uint256 amountADesired;
        uint256 amountBDesired;
        uint256 amountAMin;
        uint256 amountBMin;
        uint256 discountReserveA;
        uint256 discountReserveB;
        uint256 discountPercentage;
        uint256 minTradeSize;
        uint256 duration;
    }
    
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        uint256[] discountPoolIDs;
        uint256 affiliateDiscountID;
    }
    
    struct DiscountPoolParams {
        address tokenA;
        address tokenB;
        uint256 amountA;
        uint256 amountB;
        uint256 discountPercentage;
        uint256 minTradeSize;
        uint256 duration;
        bool isBuyOnly;
        address[] allowedBuyTokens;
        DiscountType discountType;
    }
    
    struct PendingDiscounts {
        uint256 poolDiscountTotal;
        uint256 affiliateDiscountTotal;
        uint256 affiliateCommission;
        address affiliateAddress;
        address discountToken;
    }
    
    struct DiscountPoolInfo {
        uint256 id;
        address creator;
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 discountPercentage;
        uint256 minTradeSize;
        uint256 maxDiscountPerTrade;
        uint256 totalVolumeGenerated;
        uint256 expirationTime;
        bool isActive;
        bool useTokenReserves;
        bool isBuyOnly;
        DiscountType discountType;
    }
    
    enum BadgeType {
        SWAP_VOLUME,
        SWAP_COUNT,
        LIQUIDITY_PROVIDER,
        DISCOUNT_CREATOR,
        DISCOUNT_USER,
        EARLY_ADOPTER,
        REFERRER,
        STREAK,
        WHALE,
        AFFILIATE,
        COMMUNITY
    }
    
    enum DiscountType {
        PERCENTAGE_OF_INPUT,
        PERCENTAGE_OF_OUTPUT,
        FIXED_AMOUNT
    }
    
    // ============ State Variables ============
    
    // Constants
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    uint256 private constant MAX_DISCOUNT_PERCENTAGE = 5000; // 50%
    uint256 private constant CLAIM_COOLDOWN = 1 minutes;
    uint256 private constant MAX_REFERRALS_PER_DAY = 10;
    uint256 private constant MAX_POOLS_PER_SWAP = 10;
    uint256 private constant MAX_VOLUME_PER_BLOCK = 1000000 * 10**18;
    uint256 private constant SWAP_COOLDOWN = 1 seconds;
    
    // Core mappings
    mapping(uint256 => DealixID) public dealixIDs;
    mapping(address => uint256) public userToDealixID;
    mapping(uint256 => mapping(uint256 => bool)) public userBadges;
    mapping(uint256 => Badge) public badges;
    mapping(uint256 => DiscountPool) public discountPools;
    mapping(uint256 => AffiliateDiscount) public affiliateDiscounts;
    
    // Enhanced mappings
    mapping(address => bool) public approvedBuyTokens;
    mapping(address => mapping(address => uint256[])) public tokenPairDiscountPools;
    mapping(uint256 => bool) public isBuyOnlyPool;
    
    // Security mappings
    mapping(address => bool) public verifiedProjects;
    mapping(address => uint256) public lastReferralTimestamp;
    mapping(address => uint256) public dailyReferralCount;
    mapping(address => uint256) public lastSwapTimestamp;
    mapping(address => bool) public blacklistedTokens;
    
    // Tracking mappings
    mapping(address => uint256[]) public userDiscountPools;
    mapping(address => uint256[]) public projectAffiliateDiscounts;
    mapping(address => address) public referredBy;
    mapping(address => uint256) public referralCounts;
    
    // Counters
    uint256 public nextDealixID = 1;
    uint256 public nextBadgeID = 1;
    uint256 public nextDiscountPoolID = 1;
    uint256 public nextAffiliateDiscountID = 1;
    
    // Platform parameters
    uint256 public platformFee = 25; // 0.25%
    uint256 public affiliatePlatformCut = 1000; // 10%
    uint256 public mintingFee = 0.0005 ether;
    uint256 public maxDiscountPercentage = MAX_DISCOUNT_PERCENTAGE;
    uint256 public streakBonusPerDay = 5; // 0.05% per day
    uint256 public maxStreakBonus = 500; // 5% max
    
    // Contracts
    IDealixV2Router02 public router;
    IDealixV2Factory public factory;
    address public treasuryAddress;
    address public guardian;
    
    // Timelock
    mapping(bytes32 => uint256) public pendingActions;
    uint256 public constant TIMELOCK_DURATION = 2 days;
    
    // ============ Events ============
    
    event DealixIDCreated(address indexed user, uint256 indexed dealixID);
    event BadgeAwarded(address indexed user, uint256 indexed dealixID, uint256 indexed badgeID, string badgeName);
    event DiscountPoolCreated(uint256 indexed poolID, address indexed creator, address tokenA, address tokenB, uint256 discountPercentage, bool isBuyOnly);
    event DiscountPoolDeactivated(uint256 indexed poolID, string reason);
    event AffiliateDiscountCreated(uint256 indexed discountID, address indexed affiliate, address indexed project, address token);
    event SwapWithDiscount(address indexed user, uint256 dealixID, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 discountReceived);
    event LiquidityAddedWithDiscount(address indexed user, uint256 dealixID, address tokenA, address tokenB, uint256 liquidity, uint256 discountPoolID);
    event SocialPointsEarned(uint256 indexed dealixID, uint256 points, string reason);
    event TierUpgrade(uint256 indexed dealixID, uint256 newTier);
    event AffiliateCommissionPaid(address indexed affiliate, uint256 amount, uint256 discountID);
    event ProjectVerified(address indexed project);
    event EmergencyPause(address indexed by);
    event TokenBlacklisted(address indexed token, bool blacklisted);
    event SuspiciousActivity(address indexed user, string reason);
    event BuyTokenApproved(address indexed token, bool approved);
    event DiscountApplied(address indexed user, uint256 indexed poolId, uint256 discountAmount);
    event DiscountPoolUpdated(uint256 indexed poolId, uint256 newReserveA, uint256 newReserveB);
    
    // ============ Modifiers ============
    
    modifier onlyDealixHolder() {
        require(userToDealixID[msg.sender] > 0, "Dealix ID required");
        _;
    }
    
    modifier onlyVerifiedProject() {
        require(verifiedProjects[msg.sender], "Project not verified");
        _;
    }
    
    modifier validDiscount(uint256 percentage) {
        require(percentage > 0 && percentage <= maxDiscountPercentage, "Invalid discount percentage");
        _;
    }
    
    modifier rateLimited() {
        require(block.timestamp >= lastSwapTimestamp[msg.sender].add(SWAP_COOLDOWN), "Too frequent");
        lastSwapTimestamp[msg.sender] = block.timestamp;
        _;
    }
    
    modifier onlyGuardianOrOwner() {
        require(msg.sender == owner() || msg.sender == guardian, "Not authorized");
        _;
    }
    
    modifier notBlacklisted(address token) {
        require(!blacklistedTokens[token], "Token blacklisted");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _router,
        address _factory,
        address _treasury,
        address _guardian
    ) ERC721("DealixDEX ID", "DEALIX") {
        require(_router != address(0), "Invalid router");
        require(_factory != address(0), "Invalid factory");
        require(_treasury != address(0), "Invalid treasury");
        require(_guardian != address(0), "Invalid guardian");
        
        router = IDealixV2Router02(_router);
        factory = IDealixV2Factory(_factory);
        treasuryAddress = _treasury;
        guardian = _guardian;
        
        // Initialize approved buy tokens
        approvedBuyTokens[WETH] = true;
        approvedBuyTokens[0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913] = true; // USDC on Base
        approvedBuyTokens[0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb] = true; // DAI on Base
        
        emit BuyTokenApproved(WETH, true);
        emit BuyTokenApproved(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, true);
        emit BuyTokenApproved(0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb, true);
        
        _initializeBadges();
    }
    
    // ============ Main Functions ============
    
    /**
     * @dev Create a new Dealix ID NFT
     */
    function createDealixID(address referrer) external payable nonReentrant whenNotPaused {
        require(msg.value >= mintingFee, "Insufficient minting fee");
        require(userToDealixID[msg.sender] == 0, "Already has Dealix ID");
        require(tx.origin == msg.sender, "No contract creation");
        
        uint256 newID = nextDealixID++;
        _mint(msg.sender, newID);
        
        _setupNewDealixID(newID, referrer);
        
        (bool success, ) = treasuryAddress.call{value: msg.value}("");
        require(success, "Treasury transfer failed");
        
        emit DealixIDCreated(msg.sender, newID);
    }
    
    /**
     * @dev Create discount pool with buy-only protection and discount types
     */
    function createTokenDiscountPool(
        DiscountPoolParams calldata params
    ) external nonReentrant whenNotPaused onlyDealixHolder validDiscount(params.discountPercentage) returns (uint256 poolID) {
        // Convert ETH to WETH
        address tokenA = params.tokenA == address(0) ? WETH : params.tokenA;
        address tokenB = params.tokenB == address(0) ? WETH : params.tokenB;
        
        require(params.amountA > 0 || params.amountB > 0, "Must provide tokens");
        require(params.duration > 0 && params.duration <= 365 days, "Invalid duration");
        require(tokenA != tokenB, "Same token");
        require(!blacklistedTokens[tokenA] && !blacklistedTokens[tokenB], "Blacklisted token");
        
        // Validate buy-only configuration
        if (params.isBuyOnly) {
            require(
                params.allowedBuyTokens.length > 0 || 
                approvedBuyTokens[tokenA] || 
                approvedBuyTokens[tokenB], 
                "Must specify allowed buy tokens"
            );
        }
        
        poolID = nextDiscountPoolID++;
        DiscountPool storage pool = discountPools[poolID];
        
        pool.id = poolID;
        pool.creator = msg.sender;
        pool.tokenA = tokenA;
        pool.tokenB = tokenB;
        pool.reserveA = params.amountA;
        pool.reserveB = params.amountB;
        pool.discountPercentage = params.discountPercentage;
        pool.minTradeSize = params.minTradeSize;
        pool.maxDiscountPerTrade = params.amountA.add(params.amountB).div(100);
        pool.expirationTime = block.timestamp + params.duration;
        pool.isActive = true;
        pool.useTokenReserves = true;
        pool.isBuyOnly = params.isBuyOnly;
        pool.discountType = params.discountType;
        
        isBuyOnlyPool[poolID] = params.isBuyOnly;
        
        // Set allowed buy tokens
        if (params.isBuyOnly) {
            if (approvedBuyTokens[tokenA]) pool.allowedBuyTokens[tokenA] = true;
            if (approvedBuyTokens[tokenB]) pool.allowedBuyTokens[tokenB] = true;
            
            for (uint i = 0; i < params.allowedBuyTokens.length; i++) {
                address buyToken = params.allowedBuyTokens[i] == address(0) ? WETH : params.allowedBuyTokens[i];
                pool.allowedBuyTokens[buyToken] = true;
            }
        }
        
        // Track pools by token pairs
        tokenPairDiscountPools[tokenA][tokenB].push(poolID);
        tokenPairDiscountPools[tokenB][tokenA].push(poolID);
        userDiscountPools[msg.sender].push(poolID);
        
        // Transfer tokens
        if (params.amountA > 0) {
            IERC20(tokenA).safeTransferFrom(msg.sender, address(this), params.amountA);
        }
        if (params.amountB > 0) {
            IERC20(tokenB).safeTransferFrom(msg.sender, address(this), params.amountB);
        }
        
        _updateDiscountCreatorMetrics();
        
        emit DiscountPoolCreated(poolID, msg.sender, tokenA, tokenB, params.discountPercentage, params.isBuyOnly);
    }
    
    /**
     * @dev Swap with ETH handling and buy-only protection
     */
    function swapWithDealix(
        SwapParams calldata params
    ) external payable nonReentrant whenNotPaused rateLimited returns (uint256 amountOut) {
        // Convert ETH to WETH addresses
        address tokenIn = params.tokenIn == address(0) ? WETH : params.tokenIn;
        address tokenOut = params.tokenOut == address(0) ? WETH : params.tokenOut;
        
        // Handle ETH deposits
        if (params.tokenIn == address(0)) {
            require(msg.value == params.amountIn, "ETH amount mismatch");
            IWETH(WETH).deposit{value: msg.value}();
        } else {
            require(msg.value == 0, "ETH sent for token swap");
        }
        
        // Input validation
        require(tokenIn != tokenOut, "Same token swap");
        require(params.amountIn > 0, "Zero amount");
        require(params.discountPoolIDs.length <= MAX_POOLS_PER_SWAP, "Too many pools");
        require(!blacklistedTokens[tokenIn] && !blacklistedTokens[tokenOut], "Blacklisted token");
        
        uint256 dealixID = userToDealixID[msg.sender];
        
        // Flash loan protection
        if (dealixID > 0) {
            DealixID storage user = dealixIDs[dealixID];
            if (block.number != user.lastVolumeUpdateBlock) {
                user.volumeInCurrentBlock = 0;
                user.lastVolumeUpdateBlock = block.number;
            }
            require(user.volumeInCurrentBlock.add(params.amountIn) <= MAX_VOLUME_PER_BLOCK, "Volume limit exceeded");
        }
        
        // Check buy-only restrictions
        bool isBuy = approvedBuyTokens[tokenIn] || params.tokenIn == address(0);
        if (!isBuy && params.discountPoolIDs.length > 0) {
            for (uint i = 0; i < params.discountPoolIDs.length; i++) {
                require(!isBuyOnlyPool[params.discountPoolIDs[i]], "Pool is buy-only");
            }
        }
        
        // Calculate discounts
        SwapParams memory modifiedParams = SwapParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: params.amountIn,
            amountOutMin: params.amountOutMin,
            discountPoolIDs: params.discountPoolIDs,
            affiliateDiscountID: params.affiliateDiscountID
        });
        
        PendingDiscounts memory pendingDiscounts = _calculateAllDiscounts(modifiedParams, dealixID);
        
        // Update metrics
        if (dealixID > 0) {
            _updateDealixMetrics(dealixID, params.amountIn);
        }
        
        // Execute swap
        amountOut = _executeSwap(modifiedParams);
        
        // Apply discounts
        uint256 totalDiscount = pendingDiscounts.poolDiscountTotal.add(pendingDiscounts.affiliateDiscountTotal);
        uint256 maxAllowedDiscount = amountOut.mul(maxDiscountPercentage).div(10000);
        if (totalDiscount > maxAllowedDiscount) {
            totalDiscount = maxAllowedDiscount;
            emit SuspiciousActivity(msg.sender, "Discount cap reached");
        }
        
        if (totalDiscount > 0) {
            amountOut = amountOut.add(totalDiscount);
            _distributeDiscountsSecurely(pendingDiscounts, tokenOut);
        }
        
        // Handle output
        if (params.tokenOut == address(0)) {
            // Unwrap WETH to ETH
            IWETH(WETH).withdraw(amountOut);
            (bool success, ) = msg.sender.call{value: amountOut}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        }
        
        emit SwapWithDiscount(
            msg.sender,
            dealixID,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            totalDiscount
        );
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get active discount pools for a token pair
     */
    function getActiveDiscountPools(
        address tokenA,
        address tokenB
    ) external view returns (uint256[] memory activePools) {
        address lookupTokenA = tokenA == address(0) ? WETH : tokenA;
        address lookupTokenB = tokenB == address(0) ? WETH : tokenB;
        
        uint256[] memory poolIds = tokenPairDiscountPools[lookupTokenA][lookupTokenB];
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            if (_isPoolActive(poolIds[i])) {
                activeCount++;
            }
        }
        
        activePools = new uint256[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            if (_isPoolActive(poolIds[i])) {
                activePools[currentIndex] = poolIds[i];
                currentIndex++;
            }
        }
    }
    
    /**
     * @dev Get detailed pool information
     */
    function getDiscountPoolsInfo(uint256[] calldata poolIds) external view returns (
        DiscountPoolInfo[] memory poolsInfo
    ) {
        poolsInfo = new DiscountPoolInfo[](poolIds.length);
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            DiscountPool storage pool = discountPools[poolIds[i]];
            poolsInfo[i] = DiscountPoolInfo({
                id: pool.id,
                creator: pool.creator,
                tokenA: pool.tokenA,
                tokenB: pool.tokenB,
                reserveA: pool.reserveA,
                reserveB: pool.reserveB,
                discountPercentage: pool.discountPercentage,
                minTradeSize: pool.minTradeSize,
                maxDiscountPerTrade: pool.maxDiscountPerTrade,
                totalVolumeGenerated: pool.totalVolumeGenerated,
                expirationTime: pool.expirationTime,
                isActive: pool.isActive,
                useTokenReserves: pool.useTokenReserves,
                isBuyOnly: pool.isBuyOnly,
                discountType: pool.discountType
            });
        }
    }
    
    /**
     * @dev Check if user can use a discount pool
     */
    function canUseDiscountPool(
        uint256 poolId,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (bool canUse, string memory reason) {
        address checkTokenIn = tokenIn == address(0) ? WETH : tokenIn;
        address checkTokenOut = tokenOut == address(0) ? WETH : tokenOut;
        
        DiscountPool storage pool = discountPools[poolId];
        
        if (!pool.isActive) {
            return (false, "Pool not active");
        }
        
        if (block.timestamp > pool.expirationTime) {
            return (false, "Pool expired");
        }
        
        if (amountIn < pool.minTradeSize) {
            return (false, "Below minimum trade size");
        }
        
        if (block.timestamp.sub(pool.lastClaimTimestamp[user]) < CLAIM_COOLDOWN) {
            return (false, "Cooldown period active");
        }
        
        bool matchesTokens = (checkTokenIn == pool.tokenA && checkTokenOut == pool.tokenB) ||
                            (checkTokenIn == pool.tokenB && checkTokenOut == pool.tokenA);
        
        if (!matchesTokens) {
            return (false, "Token pair mismatch");
        }
        
        if (pool.isBuyOnly) {
            if (!pool.allowedBuyTokens[checkTokenIn] && !approvedBuyTokens[checkTokenIn]) {
                return (false, "Input token not allowed for buy-only pool");
            }
        }
        
        return (true, "");
    }
    
    /**
     * @dev Get user's discount pools
     */
    function getUserDiscountPools(address user) external view returns (
        uint256[] memory poolIds,
        bool[] memory isActive
    ) {
        poolIds = userDiscountPools[user];
        isActive = new bool[](poolIds.length);
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            isActive[i] = _isPoolActive(poolIds[i]);
        }
    }
    
    /**
     * @dev Estimate discount for a swap
     */
    function estimateDiscount(
        uint256[] calldata poolIds,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        uint256 totalDiscount,
        uint256[] memory individualDiscounts
    ) {
        address checkTokenIn = tokenIn == address(0) ? WETH : tokenIn;
        address checkTokenOut = tokenOut == address(0) ? WETH : tokenOut;
        
        individualDiscounts = new uint256[](poolIds.length);
        
        // Get expected output
        uint256 expectedOutput = _getExpectedOutputAmount(checkTokenIn, checkTokenOut, amountIn);
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            uint256 discount = _calculatePoolDiscountView(
                poolIds[i],
                user,
                checkTokenIn,
                checkTokenOut,
                amountIn,
                expectedOutput
            );
            individualDiscounts[i] = discount;
            totalDiscount = totalDiscount.add(discount);
        }
    }
    
    /**
     * @dev Check if token is approved for buying
     */
    function isApprovedBuyToken(address token) external view returns (bool) {
        address checkToken = token == address(0) ? WETH : token;
        return approvedBuyTokens[checkToken];
    }
    
    /**
     * @dev Get Dealix profile
     */
    function getDealixProfile(address user) external view returns (
        uint256 dealixID,
        uint256 totalVolume,
        uint256 discountTier,
        uint256 badgeCount,
        uint256 liquidityProvided,
        uint256 discountsCreated,
        uint256 swapCount,
        uint256 socialPoints,
        uint256 activityStreak
    ) {
        dealixID = userToDealixID[user];
        if (dealixID > 0) {
            DealixID storage profile = dealixIDs[dealixID];
            return (
                dealixID,
                profile.totalVolume,
                profile.discountTier,
                profile.badgeCount,
                profile.liquidityProvided,
                profile.discountsCreated,
                profile.swapCount,
                profile.socialPoints,
                profile.activityStreak
            );
        }
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Calculate all discounts with output-based calculation
     */
    function _calculateAllDiscounts(
        SwapParams memory params,
        uint256 dealixID
    ) internal view returns (PendingDiscounts memory pending) {
        if (dealixID == 0) return pending;
        
        // Get expected output
        uint256 expectedOutputAmount = _getExpectedOutputAmount(params.tokenIn, params.tokenOut, params.amountIn);
        
        // Calculate pool discounts
        for (uint i = 0; i < params.discountPoolIDs.length; i++) {
            uint256 poolDiscount = _calculatePoolDiscountView(
                params.discountPoolIDs[i],
                msg.sender,
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                expectedOutputAmount
            );
            pending.poolDiscountTotal = pending.poolDiscountTotal.add(poolDiscount);
        }
        
        // Calculate affiliate discount
        if (params.affiliateDiscountID > 0) {
            (uint256 affiliateDiscount, uint256 commission, address affiliate) = _calculateAffiliateDiscountView(
                params.affiliateDiscountID,
                params.tokenOut,
                expectedOutputAmount
            );
            pending.affiliateDiscountTotal = affiliateDiscount;
            pending.affiliateCommission = commission;
            pending.affiliateAddress = affiliate;
        }
        
        // Add tier and streak bonuses
        pending.poolDiscountTotal = pending.poolDiscountTotal
            .add(_calculateTierBonus(dealixID, expectedOutputAmount))
            .add(_calculateStreakBonus(dealixID, expectedOutputAmount));
            
        pending.discountToken = params.tokenOut;
    }
    
    /**
     * @dev Calculate pool discount with buy-only protection
     */
    function _calculatePoolDiscountView(
        uint256 poolID,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut
    ) internal view returns (uint256) {
        DiscountPool storage pool = discountPools[poolID];
        
        if (!pool.isActive || block.timestamp > pool.expirationTime) return 0;
        if (amountIn < pool.minTradeSize) return 0;
        if (block.timestamp.sub(pool.lastClaimTimestamp[user]) < CLAIM_COOLDOWN) return 0;
        
        bool matchesTokens = (tokenIn == pool.tokenA && tokenOut == pool.tokenB) ||
                            (tokenIn == pool.tokenB && tokenOut == pool.tokenA);
        if (!matchesTokens) return 0;
        
        // Buy-only protection
        if (pool.isBuyOnly) {
            if (!pool.allowedBuyTokens[tokenIn] && !approvedBuyTokens[tokenIn]) {
                return 0;
            }
            if (pool.allowedBuyTokens[tokenOut] || approvedBuyTokens[tokenOut]) {
                return 0;
            }
        }
        
        // Calculate discount based on type
        uint256 discountAmount = _calculateDiscountByType(pool, amountIn, expectedAmountOut);
        
        // Check reserves
        if (pool.useTokenReserves) {
            if (tokenOut == pool.tokenA && discountAmount > pool.reserveA) {
                discountAmount = pool.reserveA;
            } else if (tokenOut == pool.tokenB && discountAmount > pool.reserveB) {
                discountAmount = pool.reserveB;
            }
        }
        
        // Apply max discount
        if (pool.maxDiscountPerTrade > 0 && discountAmount > pool.maxDiscountPerTrade) {
            discountAmount = pool.maxDiscountPerTrade;
        }
        
        return discountAmount;
    }
    
    /**
     * @dev Calculate discount by type
     */
    function _calculateDiscountByType(
        DiscountPool storage pool,
        uint256 amountIn,
        uint256 expectedAmountOut
    ) internal view returns (uint256) {
        if (pool.discountType == DiscountType.PERCENTAGE_OF_INPUT) {
            return amountIn.mul(pool.discountPercentage).div(10000);
        } else if (pool.discountType == DiscountType.PERCENTAGE_OF_OUTPUT) {
            return expectedAmountOut.mul(pool.discountPercentage).div(10000);
        } else if (pool.discountType == DiscountType.FIXED_AMOUNT) {
            return pool.discountPercentage;
        }
        return 0;
    }
    
    /**
     * @dev Get expected output amount
     */
    function _getExpectedOutputAmount(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        try router.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }
    
    /**
     * @dev Check if pool is active
     */
    function _isPoolActive(uint256 poolId) internal view returns (bool) {
        DiscountPool storage pool = discountPools[poolId];
        return pool.isActive && block.timestamp <= pool.expirationTime;
    }
    
    /**
     * @dev Execute swap
     */
    function _executeSwap(SwapParams memory params) internal returns (uint256) {
        // Transfer tokens from user (or use wrapped ETH)
        if (params.tokenIn != WETH || msg.value == 0) {
            IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        }
        
        // Approve router
        uint256 currentAllowance = IERC20(params.tokenIn).allowance(address(this), address(router));
        if (currentAllowance < params.amountIn) {
            if (currentAllowance > 0) {
                IERC20(params.tokenIn).safeApprove(address(router), 0);
            }
            IERC20(params.tokenIn).safeApprove(address(router), params.amountIn);
        }
        
        address[] memory path = new address[](2);
        path[0] = params.tokenIn;
        path[1] = params.tokenOut;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            params.amountIn,
            params.amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );
        
        return amounts[1];
    }
    
    function _initializeBadges() internal {
        _createBadge("Early Bird", "First 1000 users", 0, BadgeType.EARLY_ADOPTER, "", 100);
        _createBadge("Minnow", "Complete 10 swaps", 10, BadgeType.SWAP_COUNT, "", 10);
        _createBadge("Dolphin", "Complete 100 swaps", 100, BadgeType.SWAP_COUNT, "", 50);
        _createBadge("Whale", "Complete 1000 swaps", 1000, BadgeType.SWAP_COUNT, "", 200);
        _createBadge("Trader", "$1K volume", 1000 * 10**18, BadgeType.SWAP_VOLUME, "", 25);
        _createBadge("Pro Trader", "$10K volume", 10000 * 10**18, BadgeType.SWAP_VOLUME, "", 100);
        _createBadge("Master Trader", "$100K volume", 100000 * 10**18, BadgeType.SWAP_VOLUME, "", 500);
        _createBadge("Liquidity Provider", "Provide any liquidity", 1, BadgeType.LIQUIDITY_PROVIDER, "", 30);
        _createBadge("Deep Liquidity", "Provide $10K liquidity", 10000 * 10**18, BadgeType.LIQUIDITY_PROVIDER, "", 150);
        _createBadge("Deal Maker", "Create 5 discount pools", 5, BadgeType.DISCOUNT_CREATOR, "", 75);
        _createBadge("Deal Hunter", "Use 10 discounts", 10, BadgeType.DISCOUNT_USER, "", 50);
        _createBadge("Influencer", "Create successful affiliate discount", 1, BadgeType.AFFILIATE, "", 100);
        _createBadge("Streak Master", "7 day activity streak", 7, BadgeType.STREAK, "", 50);
    }
    
    function _createBadge(
        string memory name,
        string memory description,
        uint256 requirement,
        BadgeType badgeType,
        string memory imageURI,
        uint256 points
    ) internal {
        badges[nextBadgeID] = Badge({
            name: name,
            description: description,
            requirement: requirement,
            badgeType: badgeType,
            imageURI: imageURI,
            points: points,
            active: true
        });
        nextBadgeID++;
    }
    
    function _checkAndAwardBadge(address user, BadgeType badgeType, uint256 value) internal {
        uint256 dealixID = userToDealixID[user];
        if (dealixID == 0) return;
        
        for (uint256 i = 1; i < nextBadgeID; i++) {
            Badge storage badge = badges[i];
            
            if (badge.active && 
                badge.badgeType == badgeType && 
                !userBadges[dealixID][i] && 
                value >= badge.requirement) {
                
                _awardBadge(dealixID, i);
            }
        }
    }
    
    function _awardBadge(uint256 dealixID, uint256 badgeID) internal {
        userBadges[dealixID][badgeID] = true;
        dealixIDs[dealixID].badgeCount++;
        dealixIDs[dealixID].socialPoints = dealixIDs[dealixID].socialPoints.add(badges[badgeID].points);
        
        emit BadgeAwarded(dealixIDs[dealixID].owner, dealixID, badgeID, badges[badgeID].name);
        emit SocialPointsEarned(dealixID, badges[badgeID].points, badges[badgeID].name);
    }
    
    // ============ Other Internal Functions ============
    
    function _setupNewDealixID(uint256 newID, address referrer) internal {
        DealixID storage newDealixID = dealixIDs[newID];
        newDealixID.tokenId = newID;
        newDealixID.owner = msg.sender;
        newDealixID.lastActivityTimestamp = block.timestamp;
        newDealixID.lastVolumeUpdateBlock = block.number;
        
        userToDealixID[msg.sender] = newID;
        
        // Handle referral with anti-gaming measures
        if (referrer != address(0) && userToDealixID[referrer] > 0 && referrer != msg.sender) {
            _processReferral(referrer);
        }
        
        // Award early adopter badge
        if (newID <= 1000) {
            _awardBadge(newID, 1);
        }
    }
    
    function _processReferral(address referrer) internal {
        // Anti-gaming: Check daily limit
        if (block.timestamp.sub(lastReferralTimestamp[referrer]) >= 1 days) {
            dailyReferralCount[referrer] = 0;
            lastReferralTimestamp[referrer] = block.timestamp;
        }
        
        require(dailyReferralCount[referrer] < MAX_REFERRALS_PER_DAY, "Daily referral limit reached");
        
        referredBy[msg.sender] = referrer;
        referralCounts[referrer]++;
        dailyReferralCount[referrer]++;
        
        uint256 referrerID = userToDealixID[referrer];
        dealixIDs[referrerID].socialPoints = dealixIDs[referrerID].socialPoints.add(100);
        
        _checkAndAwardBadge(referrer, BadgeType.REFERRER, referralCounts[referrer]);
    }
    
    function _calculateTier(uint256 volume) internal pure returns (uint256) {
        if (volume >= 1000000 * 10**18) return 5;
        if (volume >= 100000 * 10**18) return 4;
        if (volume >= 10000 * 10**18) return 3;
        if (volume >= 1000 * 10**18) return 2;
        if (volume >= 100 * 10**18) return 1;
        return 0;
    }
    
    function _calculateTierBonus(uint256 dealixID, uint256 amountIn) internal view returns (uint256) {
        uint256 tier = dealixIDs[dealixID].discountTier;
        return amountIn.mul(tier.mul(5)).div(10000); // 0.05% per tier
    }
    
    function _calculateStreakBonus(uint256 dealixID, uint256 amountIn) internal view returns (uint256) {
        uint256 streak = dealixIDs[dealixID].activityStreak;
        uint256 streakBonus = streak.mul(streakBonusPerDay);
        if (streakBonus > maxStreakBonus) {
            streakBonus = maxStreakBonus;
        }
        return amountIn.mul(streakBonus).div(10000);
    }
    
    function _createDiscountPool(DiscountPoolParams calldata params) internal returns (uint256 poolID) {
        poolID = nextDiscountPoolID++;
        DiscountPool storage pool = discountPools[poolID];
        
        pool.id = poolID;
        pool.creator = msg.sender;
        pool.tokenA = params.tokenA;
        pool.tokenB = params.tokenB;
        pool.reserveA = params.amountA;
        pool.reserveB = params.amountB;
        pool.discountPercentage = params.discountPercentage;
        pool.minTradeSize = params.minTradeSize;
        pool.maxDiscountPerTrade = params.amountA.add(params.amountB).div(100); // Max 1% per trade
        pool.expirationTime = block.timestamp + params.duration;
        pool.isActive = true;
        pool.useTokenReserves = true;
        
        userDiscountPools[msg.sender].push(poolID);
    }
    
    function _updateDiscountCreatorMetrics() internal {
        uint256 dealixID = userToDealixID[msg.sender];
        dealixIDs[dealixID].discountsCreated++;
        _checkAndAwardBadge(msg.sender, BadgeType.DISCOUNT_CREATOR, dealixIDs[dealixID].discountsCreated);
    }
    
    
    // ============ Admin Functions ============
    
    /**
     * @dev Set approved buy token
     */
    function setApprovedBuyToken(address token, bool approved) external onlyOwner {
        address approveToken = token == address(0) ? WETH : token;
        approvedBuyTokens[approveToken] = approved;
        emit BuyTokenApproved(approveToken, approved);
    }
    
    /**
     * @dev Batch approve buy tokens
     */
    function setApprovedBuyTokensBatch(
        address[] calldata tokens, 
        bool[] calldata approved
    ) external onlyOwner {
        require(tokens.length == approved.length, "Length mismatch");
        
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i] == address(0) ? WETH : tokens[i];
            approvedBuyTokens[token] = approved[i];
            emit BuyTokenApproved(token, approved[i]);
        }
    }

     function proposeAdminAction(bytes32 actionId) external onlyOwner {
        pendingActions[actionId] = block.timestamp + TIMELOCK_DURATION;
    }
    
    function setPlatformFee(uint256 _fee) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("setPlatformFee", _fee));
        require(pendingActions[actionId] != 0 && block.timestamp >= pendingActions[actionId], "Timelock required");
        require(_fee <= 100, "Fee too high"); // Max 1%
        
        platformFee = _fee;
        pendingActions[actionId] = 0;
    }
    
    function setTreasuryAddress(address _treasury) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("setTreasuryAddress", _treasury));
        require(pendingActions[actionId] != 0 && block.timestamp >= pendingActions[actionId], "Timelock required");
        require(_treasury != address(0), "Invalid treasury");
        
        treasuryAddress = _treasury;
        pendingActions[actionId] = 0;
    }
    
    function verifyProject(address project) external onlyOwner {
        require(project != address(0), "Invalid project");
        verifiedProjects[project] = true;
        emit ProjectVerified(project);
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    
    // Prevent accidental ETH sends
    receive() external payable {
        require(msg.sender == WETH, "Direct ETH not accepted");
    }
}