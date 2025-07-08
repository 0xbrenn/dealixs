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
/**
 * @title DealixDEX - Security Enhanced Version
 * @dev Main contract for Dealix integration with enhanced security measures
 * @notice This version addresses all critical security vulnerabilities
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
        uint256 volumeInCurrentBlock; // Changed from epoch to block-based
        uint256 lastVolumeUpdateBlock; // Block-based tracking
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
        mapping(address => uint256) userClaims;
        mapping(address => uint256) lastClaimTimestamp;
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
    }
    
    // Struct to hold pending discount distributions
    struct PendingDiscounts {
        uint256 poolDiscountTotal;
        uint256 affiliateDiscountTotal;
        uint256 affiliateCommission;
        address affiliateAddress;
        address discountToken;
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
    
    // ============ State Variables ============
    
    // Security: Constants for validation
    uint256 private constant MAX_DISCOUNT_PERCENTAGE = 5000; // 50%
    uint256 private constant CLAIM_COOLDOWN = 1 minutes;
    uint256 private constant MAX_REFERRALS_PER_DAY = 10;
    uint256 private constant MAX_POOLS_PER_SWAP = 10; // DOS protection
    uint256 private constant MAX_VOLUME_PER_BLOCK = 1000000 * 10**18; // Flash loan protection
    uint256 private constant SWAP_COOLDOWN = 1 seconds; // Rate limiting
    
    // Core mappings
    mapping(uint256 => DealixID) public dealixIDs;
    mapping(address => uint256) public userToDealixID;
    mapping(uint256 => mapping(uint256 => bool)) public userBadges;
    mapping(uint256 => Badge) public badges;
    mapping(uint256 => DiscountPool) public discountPools;
    mapping(uint256 => AffiliateDiscount) public affiliateDiscounts;
    
    // Security mappings
    mapping(address => bool) public verifiedProjects;
    mapping(address => uint256) public lastReferralTimestamp;
    mapping(address => uint256) public dailyReferralCount;
    mapping(address => uint256) public lastSwapTimestamp; // Rate limiting
    mapping(address => bool) public blacklistedTokens; // Malicious token protection
    
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
    uint256 public affiliatePlatformCut = 1000; // 10% of affiliate commissions
    uint256 public mintingFee = 0.0005 ether;
    uint256 public maxDiscountPercentage = MAX_DISCOUNT_PERCENTAGE;
    uint256 public streakBonusPerDay = 5; // 0.05% per day
    uint256 public maxStreakBonus = 500; // 5% max
    
    // Contracts
IDealixV2Router02 public router;
IDealixV2Factory public factory;
    address public treasuryAddress;
    
    // Multi-sig for critical operations
    address public guardian; // Secondary admin for emergency functions
    
    // Pending admin actions (timelock)
    mapping(bytes32 => uint256) public pendingActions;
    uint256 public constant TIMELOCK_DURATION = 2 days;
    
    // ============ Events ============
    
    event DealixIDCreated(address indexed user, uint256 indexed dealixID);
    event BadgeAwarded(address indexed user, uint256 indexed dealixID, uint256 indexed badgeID, string badgeName);
    event DiscountPoolCreated(uint256 indexed poolID, address indexed creator, address tokenA, address tokenB, uint256 discountPercentage);
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
        
        _initializeBadges();
    }
    
    // ============ Main Functions ============
    
    /**
     * @dev Create a new Dealix ID NFT with enhanced anti-gaming measures
     */
    function createDealixID(address referrer) external payable nonReentrant whenNotPaused {
        require(msg.value >= mintingFee, "Insufficient minting fee");
        require(userToDealixID[msg.sender] == 0, "Already has Dealix ID");
        require(tx.origin == msg.sender, "No contract creation"); // Prevent bot spam
        
        uint256 newID = nextDealixID++;
        _mint(msg.sender, newID);
        
        _setupNewDealixID(newID, referrer);
        
        // Send minting fee to treasury
        (bool success, ) = treasuryAddress.call{value: msg.value}("");
        require(success, "Treasury transfer failed");
        
        emit DealixIDCreated(msg.sender, newID);
    }
    
    /**
     * @dev Create a discount pool with enhanced security
     */
    function createTokenDiscountPool(
        DiscountPoolParams calldata params
    ) external nonReentrant whenNotPaused onlyDealixHolder validDiscount(params.discountPercentage) returns (uint256 poolID) {
        require(params.amountA > 0 || params.amountB > 0, "Must provide tokens");
        require(params.duration > 0 && params.duration <= 365 days, "Invalid duration");
        require(params.tokenA != params.tokenB, "Same token");
        require(!blacklistedTokens[params.tokenA] && !blacklistedTokens[params.tokenB], "Blacklisted token");
        
        poolID = _createDiscountPool(params);
        
        // Transfer tokens to contract using SafeERC20
        if (params.amountA > 0) {
            IERC20(params.tokenA).safeTransferFrom(msg.sender, address(this), params.amountA);
        }
        if (params.amountB > 0) {
            IERC20(params.tokenB).safeTransferFrom(msg.sender, address(this), params.amountB);
        }
        
        _updateDiscountCreatorMetrics();
        
        emit DiscountPoolCreated(poolID, msg.sender, params.tokenA, params.tokenB, params.discountPercentage);
    }
    
    /**
     * @dev Swap with Dealix benefits - Security enhanced
     */
    function swapWithDealix(
        SwapParams calldata params
    ) external nonReentrant whenNotPaused rateLimited returns (uint256 amountOut) {
        // Input validation
        require(params.tokenIn != params.tokenOut, "Same token swap");
        require(params.amountIn > 0, "Zero amount");
        require(params.discountPoolIDs.length <= MAX_POOLS_PER_SWAP, "Too many pools");
        require(!blacklistedTokens[params.tokenIn] && !blacklistedTokens[params.tokenOut], "Blacklisted token");
        
        uint256 dealixID = userToDealixID[msg.sender];
        
        // Flash loan protection: Check volume limits
        if (dealixID > 0) {
            DealixID storage user = dealixIDs[dealixID];
            if (block.number != user.lastVolumeUpdateBlock) {
                user.volumeInCurrentBlock = 0;
                user.lastVolumeUpdateBlock = block.number;
            }
            require(user.volumeInCurrentBlock.add(params.amountIn) <= MAX_VOLUME_PER_BLOCK, "Volume limit exceeded");
        }
        
        // Calculate discounts BEFORE any transfers (reentrancy protection)
        PendingDiscounts memory pendingDiscounts = _calculateAllDiscounts(params, dealixID);
        
        // Update metrics BEFORE external calls
        if (dealixID > 0) {
            _updateDealixMetrics(dealixID, params.amountIn);
        }
        
        // Execute the swap
        amountOut = _executeSwap(params);
        
        // Validate discount doesn't exceed maximum
        uint256 totalDiscount = pendingDiscounts.poolDiscountTotal.add(pendingDiscounts.affiliateDiscountTotal);
        uint256 maxAllowedDiscount = amountOut.mul(maxDiscountPercentage).div(10000);
        if (totalDiscount > maxAllowedDiscount) {
            totalDiscount = maxAllowedDiscount;
            emit SuspiciousActivity(msg.sender, "Discount cap reached");
        }
        
        // Apply discounts and distribute tokens (all transfers at the end)
        if (totalDiscount > 0) {
            amountOut = amountOut.add(totalDiscount);
            _distributeDiscountsSecurely(pendingDiscounts, params.tokenOut);
        }
        
        // Final transfer to user
        IERC20(params.tokenOut).safeTransfer(msg.sender, amountOut);
        
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
    
    /**
     * @dev Calculate all discounts without any state changes or transfers
     */
    function _calculateAllDiscounts(
        SwapParams calldata params,
        uint256 dealixID
    ) internal view returns (PendingDiscounts memory pending) {
        if (dealixID == 0) return pending;
        
        // Calculate pool discounts
        for (uint i = 0; i < params.discountPoolIDs.length; i++) {
            uint256 poolDiscount = _calculatePoolDiscountView(
                params.discountPoolIDs[i],
                msg.sender,
                params.tokenIn,
                params.tokenOut,
                params.amountIn
            );
            pending.poolDiscountTotal = pending.poolDiscountTotal.add(poolDiscount);
        }
        
        // Calculate affiliate discount
        if (params.affiliateDiscountID > 0) {
            (uint256 affiliateDiscount, uint256 commission, address affiliate) = _calculateAffiliateDiscountView(
                params.affiliateDiscountID,
                params.tokenIn,
                params.amountIn
            );
            pending.affiliateDiscountTotal = affiliateDiscount;
            pending.affiliateCommission = commission;
            pending.affiliateAddress = affiliate;
        }
        
        // Add tier and streak bonuses
        pending.poolDiscountTotal = pending.poolDiscountTotal
            .add(_calculateTierBonus(dealixID, params.amountIn))
            .add(_calculateStreakBonus(dealixID, params.amountIn));
            
        pending.discountToken = params.tokenOut;
    }
    
    /**
     * @dev View function to calculate pool discount without state changes
     */
    function _calculatePoolDiscountView(
        uint256 poolID,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        DiscountPool storage pool = discountPools[poolID];
        
        if (!pool.isActive || block.timestamp > pool.expirationTime) return 0;
        if (amountIn < pool.minTradeSize) return 0;
        if (block.timestamp.sub(pool.lastClaimTimestamp[user]) < CLAIM_COOLDOWN) return 0;
        
        bool matchesTokens = (tokenIn == pool.tokenA && tokenOut == pool.tokenB) ||
                            (tokenIn == pool.tokenB && tokenOut == pool.tokenA);
        if (!matchesTokens) return 0;
        
        uint256 discountAmount = amountIn.mul(pool.discountPercentage).div(10000);
        
        // Check reserves
        if (pool.useTokenReserves) {
            if (tokenOut == pool.tokenA && discountAmount > pool.reserveA) {
                discountAmount = pool.reserveA;
            } else if (tokenOut == pool.tokenB && discountAmount > pool.reserveB) {
                discountAmount = pool.reserveB;
            }
        }
        
        // Apply max discount per trade
        if (pool.maxDiscountPerTrade > 0 && discountAmount > pool.maxDiscountPerTrade) {
            discountAmount = pool.maxDiscountPerTrade;
        }
        
        return discountAmount;
    }
    
    /**
     * @dev View function to calculate affiliate discount without state changes
     */
    function _calculateAffiliateDiscountView(
        uint256 discountID,
        address tokenIn,
        uint256 amountIn
    ) internal view returns (uint256 discountAmount, uint256 commission, address affiliate) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        if (!discount.isActive || block.timestamp > discount.expirationTime) return (0, 0, address(0));
        if (tokenIn != discount.token) return (0, 0, address(0));
        if (!discount.isProjectVerified) return (0, 0, address(0));
        
        discountAmount = amountIn.mul(discount.discountPercentage).div(10000);
        
        if (discountAmount > discount.remainingAmount) {
            discountAmount = discount.remainingAmount;
        }
        
        commission = discountAmount.mul(discount.affiliateCommission).div(10000);
        uint256 platformCut = commission.mul(affiliatePlatformCut).div(10000);
        commission = commission.sub(platformCut);
        affiliate = discount.affiliate;
    }
    
    /**
     * @dev Distribute discounts with all transfers at the end (reentrancy protection)
     */
    function _distributeDiscountsSecurely(
        PendingDiscounts memory pending,
        address tokenOut
    ) internal {
        // Transfer affiliate commission if applicable
        if (pending.affiliateCommission > 0 && pending.affiliateAddress != address(0)) {
            IERC20(tokenOut).safeTransfer(pending.affiliateAddress, pending.affiliateCommission);
            
            // Platform cut
            uint256 platformCut = pending.affiliateCommission.mul(affiliatePlatformCut).div(10000);
            if (platformCut > 0) {
                IERC20(tokenOut).safeTransfer(treasuryAddress, platformCut);
            }
            
            emit AffiliateCommissionPaid(pending.affiliateAddress, pending.affiliateCommission, 0);
        }
    }
    
    /**
     * @dev Update pool state after discount calculation
     */
    function _updatePoolState(
        uint256 poolID,
        address user,
        address tokenOut,
        uint256 discountAmount
    ) internal {
        DiscountPool storage pool = discountPools[poolID];
        
        // Update reserves
        if (pool.useTokenReserves) {
            if (tokenOut == pool.tokenA) {
                pool.reserveA = pool.reserveA.sub(discountAmount);
            } else if (tokenOut == pool.tokenB) {
                pool.reserveB = pool.reserveB.sub(discountAmount);
            }
        }
        
        // Update tracking
        pool.userClaims[user] = pool.userClaims[user].add(discountAmount);
        pool.lastClaimTimestamp[user] = block.timestamp;
        pool.totalVolumeGenerated = pool.totalVolumeGenerated.add(discountAmount);
        
        // Deactivate if depleted
        if (pool.useTokenReserves && pool.reserveA == 0 && pool.reserveB == 0) {
            pool.isActive = false;
            emit DiscountPoolDeactivated(poolID, "Reserves depleted");
        }
    }
    
    /**
     * @dev Update affiliate discount state
     */
    function _updateAffiliateState(uint256 discountID, uint256 discountAmount, uint256 volumeGenerated) internal {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        discount.remainingAmount = discount.remainingAmount.sub(discountAmount);
        discount.volumeGenerated = discount.volumeGenerated.add(volumeGenerated);
        
        if (discount.remainingAmount == 0) {
            discount.isActive = false;
        }
        
        // Update affiliate earnings
        uint256 affiliateID = userToDealixID[discount.affiliate];
        if (affiliateID > 0) {
            dealixIDs[affiliateID].affiliateEarnings = dealixIDs[affiliateID].affiliateEarnings.add(discountAmount);
        }
    }
    
    /**
     * @dev Execute swap with enhanced validation
     */
    function _executeSwap(SwapParams calldata params) internal returns (uint256) {
        // Transfer tokens from user
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        
        // Get current allowance
        uint256 currentAllowance = IERC20(params.tokenIn).allowance(address(this), address(router));
        
        // Only approve if needed
        if (currentAllowance < params.amountIn) {
            // Some tokens revert on approve from non-zero to non-zero
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
    
    /**
     * @dev Update metrics with block-based flash loan protection
     */
    function _updateDealixMetrics(uint256 dealixID, uint256 volume) internal {
        DealixID storage user = dealixIDs[dealixID];
        
        // Block-based volume tracking for flash loan protection
        if (block.number != user.lastVolumeUpdateBlock) {
            user.volumeInCurrentBlock = 0;
            user.lastVolumeUpdateBlock = block.number;
        }
        
        user.volumeInCurrentBlock = user.volumeInCurrentBlock.add(volume);
        user.totalVolume = user.totalVolume.add(volume);
        user.swapCount = user.swapCount.add(1);
        
        // Update activity streak
        uint256 daysSinceLastActivity = (block.timestamp - user.lastActivityTimestamp) / 1 days;
        if (daysSinceLastActivity <= 1) {
            user.activityStreak++;
        } else {
            user.activityStreak = 1;
        }
        user.lastActivityTimestamp = block.timestamp;
        
        // Update tier
        uint256 newTier = _calculateTier(user.totalVolume);
        if (newTier > user.discountTier) {
            user.discountTier = newTier;
            emit TierUpgrade(dealixID, newTier);
        }
        
        // Check badges
        _checkAndAwardBadge(user.owner, BadgeType.SWAP_COUNT, user.swapCount);
        _checkAndAwardBadge(user.owner, BadgeType.SWAP_VOLUME, user.totalVolume);
        _checkAndAwardBadge(user.owner, BadgeType.STREAK, user.activityStreak);
    }
    
    // ============ Emergency Functions ============
    
    /**
     * @dev Emergency pause by guardian or owner
     */
    function emergencyPause() external onlyGuardianOrOwner {
        _pause();
        emit EmergencyPause(msg.sender);
    }
    
    /**
     * @dev Blacklist malicious tokens
     */
    function setTokenBlacklist(address token, bool blacklisted) external onlyOwner {
        blacklistedTokens[token] = blacklisted;
        emit TokenBlacklisted(token, blacklisted);
    }
    
    /**
     * @dev Set guardian address with timelock
     */
    function setGuardian(address _guardian) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("setGuardian", _guardian));
        require(pendingActions[actionId] != 0 && block.timestamp >= pendingActions[actionId], "Timelock required");
        require(_guardian != address(0), "Invalid guardian");
        
        guardian = _guardian;
        pendingActions[actionId] = 0;
    }
    
    // ============ Internal Badge Functions ============
    
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
    
    // ============ View Functions ============
    
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
    
    // ============ Admin Functions ============
    
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
        revert("Direct ETH not accepted");
    }
}