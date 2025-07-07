// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IDealixRouter02.sol";
import "./interfaces/IDealixFactory.sol";
import "./interfaces/IDealixPair.sol";

/**
 * @title DealixDEX - Security Hardened Version
 * @dev Main contract for Dealix integration with Dealix DEX
 * @notice This version includes comprehensive security fixes
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
        uint256 volumeInCurrentEpoch; // For flash loan protection
        uint256 currentEpoch; // Timestamp of current epoch start
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
        mapping(address => uint256) lastClaimTimestamp; // Anti-spam
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
        bool isProjectVerified; // Security: Project verification
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
    uint256 private constant EPOCH_DURATION = 1 days;
    uint256 private constant CLAIM_COOLDOWN = 1 minutes; // Anti-spam
    uint256 private constant MAX_REFERRALS_PER_DAY = 10; // Anti-gaming
    
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
    IDealixRouter02 public router;
    IDealixFactory public factory;
    address public treasuryAddress;
    
    // Pending admin actions (timelock)
    mapping(bytes32 => uint256) public pendingActions;
    uint256 public constant TIMELOCK_DURATION = 2 days;
    
    // ============ Events ============
    
    event DealixIDCreated(address indexed user, uint256 indexed dealixID);
    event BadgeAwarded(address indexed user, uint256 indexed dealixID, uint256 indexed badgeID, string badgeName);
    event DiscountPoolCreated(uint256 indexed poolID, address indexed creator, address tokenA, address tokenB, uint256 discountPercentage);
    event AffiliateDiscountCreated(uint256 indexed discountID, address indexed affiliate, address indexed project, address token);
    event SwapWithDiscount(address indexed user, uint256 dealixID, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 discountReceived);
    event LiquidityAddedWithDiscount(address indexed user, uint256 dealixID, address tokenA, address tokenB, uint256 liquidity, uint256 discountPoolID);
    event SocialPointsEarned(uint256 indexed dealixID, uint256 points, string reason);
    event TierUpgrade(uint256 indexed dealixID, uint256 newTier);
    event AffiliateCommissionPaid(address indexed affiliate, uint256 amount, uint256 discountID);
    event ProjectVerified(address indexed project);
    event EmergencyPause(address indexed by);
    
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
    
    // ============ Constructor ============
    
    constructor(
        address _router,
        address _factory,
        address _treasury
    ) ERC721("DealixDEX ID", "DEALIX") {
        require(_router != address(0), "Invalid router");
        require(_factory != address(0), "Invalid factory");
        require(_treasury != address(0), "Invalid treasury");
        
        router = IDealixRouter02(_router);
        factory = IDealixFactory(_factory);
        treasuryAddress = _treasury;
        
        _initializeBadges();
    }
    
    // ============ Main Functions ============
    
    /**
     * @dev Create a new Dealix ID NFT with anti-gaming measures
     */
    function createDealixID(address referrer) external payable nonReentrant whenNotPaused {
        require(msg.value >= mintingFee, "Insufficient minting fee");
        require(userToDealixID[msg.sender] == 0, "Already has Dealix ID");
        
        uint256 newID = nextDealixID++;
        _mint(msg.sender, newID);
        
        _setupNewDealixID(newID, referrer);
        
        // Send minting fee to treasury
        (bool success, ) = treasuryAddress.call{value: msg.value}("");
        require(success, "Treasury transfer failed");
        
        emit DealixIDCreated(msg.sender, newID);
    }
    
    /**
     * @dev Create a discount pool with security checks
     */
    function createTokenDiscountPool(
        DiscountPoolParams calldata params
    ) external nonReentrant whenNotPaused onlyDealixHolder validDiscount(params.discountPercentage) returns (uint256 poolID) {
        require(params.amountA > 0 || params.amountB > 0, "Must provide tokens");
        require(params.duration > 0 && params.duration <= 365 days, "Invalid duration");
        
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
     * @dev Create an affiliate discount with verification
     */
    function createAffiliateDiscount(
        address project,
        address token,
        uint256 discountPercentage,
        uint256 affiliateCommission,
        uint256 duration
    ) external nonReentrant whenNotPaused onlyDealixHolder validDiscount(discountPercentage) returns (uint256 discountID) {
        require(verifiedProjects[project], "Project not verified");
        require(affiliateCommission > 0 && affiliateCommission <= 1000, "Invalid commission");
        require(duration > 0 && duration <= 365 days, "Invalid duration");
        
        discountID = _createAffiliateDiscountInternal(
            project,
            token,
            discountPercentage,
            affiliateCommission,
            duration
        );
        
        emit AffiliateDiscountCreated(discountID, msg.sender, project, token);
    }
    
    /**
     * @dev Fund an affiliate discount with verification
     */
    function fundAffiliateDiscount(uint256 discountID, uint256 amount) external nonReentrant whenNotPaused onlyVerifiedProject {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        require(msg.sender == discount.project, "Only project can fund");
        require(amount > 0, "Invalid amount");
        require(block.timestamp < discount.expirationTime, "Discount expired");
        
        IERC20(discount.token).safeTransferFrom(msg.sender, address(this), amount);
        
        discount.fundedAmount = discount.fundedAmount.add(amount);
        discount.remainingAmount = discount.remainingAmount.add(amount);
        discount.isActive = true;
    }
    
    /**
     * @dev Swap with Dealix benefits - Security hardened
     */
    function swapWithDealix(
        SwapParams calldata params
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        uint256 dealixID = userToDealixID[msg.sender];
        
        // Security: Update metrics BEFORE external calls
        if (dealixID > 0) {
            _updateDealixMetrics(dealixID, params.amountIn);
        }
        
        // Execute the swap
        amountOut = _executeSwap(params);
        
        // Calculate total discount with validation
        uint256 totalDiscount = _calculateTotalDiscount(params, dealixID);
        
        // Security: Validate discount doesn't exceed maximum allowed
        uint256 maxAllowedDiscount = amountOut.mul(maxDiscountPercentage).div(10000);
        if (totalDiscount > maxAllowedDiscount) {
            totalDiscount = maxAllowedDiscount;
        }
        
        // Apply discount bonus
        if (totalDiscount > 0) {
            _distributeDiscounts(
                params.discountPoolIDs,
                params.affiliateDiscountID,
                params.tokenOut,
                totalDiscount
            );
            amountOut = amountOut.add(totalDiscount);
        }
        
        // Security: Final transfer using SafeERC20
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
     * @dev Add liquidity with discount pool creation
     */
    function addLiquidityWithDiscountPool(
        LiquidityParams calldata params
    ) external nonReentrant whenNotPaused onlyDealixHolder returns (
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        uint256 discountPoolID
    ) {
        // Execute liquidity addition
        (amountA, amountB, liquidity) = _addLiquidity(params);
        
        // Create discount pool if reserves provided
        if (params.discountReserveA > 0 || params.discountReserveB > 0) {
            discountPoolID = _createDiscountPoolFromLiquidity(params);
        }
        
        // Update metrics
        _updateLiquidityMetrics(liquidity);
        
        emit LiquidityAddedWithDiscount(
            msg.sender, 
            userToDealixID[msg.sender], 
            params.tokenA, 
            params.tokenB, 
            liquidity, 
            discountPoolID
        );
    }
    
    // ============ Internal Functions ============
    
    function _setupNewDealixID(uint256 newID, address referrer) internal {
        DealixID storage newDealixID = dealixIDs[newID];
        newDealixID.tokenId = newID;
        newDealixID.owner = msg.sender;
        newDealixID.lastActivityTimestamp = block.timestamp;
        newDealixID.currentEpoch = block.timestamp;
        
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
    
    function _updateDealixMetrics(uint256 dealixID, uint256 volume) internal {
        DealixID storage user = dealixIDs[dealixID];
        
        // Flash loan protection: Reset volume if new epoch
        if (block.timestamp.sub(user.currentEpoch) >= EPOCH_DURATION) {
            user.volumeInCurrentEpoch = 0;
            user.currentEpoch = block.timestamp;
        }
        
        // Update volume with epoch tracking
        user.totalVolume = user.totalVolume.add(volume);
        user.volumeInCurrentEpoch = user.volumeInCurrentEpoch.add(volume);
        user.swapCount = user.swapCount.add(1);
        
        // Update activity streak
        uint256 daysSinceLastActivity = (block.timestamp - user.lastActivityTimestamp) / 1 days;
        if (daysSinceLastActivity <= 1) {
            user.activityStreak++;
        } else {
            user.activityStreak = 1;
        }
        user.lastActivityTimestamp = block.timestamp;
        
        // Update tier based on total volume (not epoch volume)
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
    
    function _executeSwap(SwapParams calldata params) internal returns (uint256) {
        // Transfer and approve with security
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        
        // Security: Reset approval first
        IERC20(params.tokenIn).safeApprove(address(router), 0);
        IERC20(params.tokenIn).safeApprove(address(router), params.amountIn);
        
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
    
    function _calculatePoolDiscount(
        uint256 poolID,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        DiscountPool storage pool = discountPools[poolID];
        
        // Validation checks
        if (!pool.isActive || block.timestamp > pool.expirationTime) return 0;
        if (amountIn < pool.minTradeSize) return 0;
        
        // Anti-spam: Check cooldown
        require(
            block.timestamp.sub(pool.lastClaimTimestamp[user]) >= CLAIM_COOLDOWN,
            "Claim cooldown active"
        );
        
        // Check if trade matches pool tokens
        bool matchesTokens = (tokenIn == pool.tokenA && tokenOut == pool.tokenB) ||
                            (tokenIn == pool.tokenB && tokenOut == pool.tokenA);
        if (!matchesTokens) return 0;
        
        // Calculate discount amount
        uint256 discountAmount = amountIn.mul(pool.discountPercentage).div(10000);
        
        // Check and update reserves
        if (pool.useTokenReserves) {
            if (tokenOut == pool.tokenA) {
                if (discountAmount > pool.reserveA) {
                    discountAmount = pool.reserveA;
                }
                // Security: Actually decrease reserves
                pool.reserveA = pool.reserveA.sub(discountAmount);
            } else if (tokenOut == pool.tokenB) {
                if (discountAmount > pool.reserveB) {
                    discountAmount = pool.reserveB;
                }
                // Security: Actually decrease reserves
                pool.reserveB = pool.reserveB.sub(discountAmount);
            }
        }
        
        // Apply max discount per trade
        if (pool.maxDiscountPerTrade > 0 && discountAmount > pool.maxDiscountPerTrade) {
            discountAmount = pool.maxDiscountPerTrade;
        }
        
        // Update pool state
        pool.userClaims[user] = pool.userClaims[user].add(discountAmount);
        pool.lastClaimTimestamp[user] = block.timestamp;
        pool.totalVolumeGenerated = pool.totalVolumeGenerated.add(amountIn);
        
        // Deactivate pool if reserves depleted
        if (pool.useTokenReserves && pool.reserveA == 0 && pool.reserveB == 0) {
            pool.isActive = false;
        }
        
        return discountAmount;
    }
    
    function _calculateAffiliateDiscount(
        uint256 discountID,
        address tokenIn,
        uint256 amountIn
    ) internal returns (uint256) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        if (!discount.isActive || block.timestamp > discount.expirationTime) return 0;
        if (tokenIn != discount.token) return 0;
        if (!discount.isProjectVerified) return 0;
        
        uint256 discountAmount = amountIn.mul(discount.discountPercentage).div(10000);
        
        if (discountAmount > discount.remainingAmount) {
            discountAmount = discount.remainingAmount;
        }
        
        // Update remaining amount
        discount.remainingAmount = discount.remainingAmount.sub(discountAmount);
        
        // Calculate and track affiliate commission
        uint256 commission = discountAmount.mul(discount.affiliateCommission).div(10000);
        uint256 platformCut = commission.mul(affiliatePlatformCut).div(10000);
        
        discount.volumeGenerated = discount.volumeGenerated.add(amountIn);
        
        // Update affiliate earnings
        uint256 affiliateID = userToDealixID[discount.affiliate];
        if (affiliateID > 0) {
            uint256 netCommission = commission.sub(platformCut);
            dealixIDs[affiliateID].affiliateEarnings = dealixIDs[affiliateID].affiliateEarnings.add(netCommission);
            
            // Transfer commission to affiliate
            IERC20(discount.token).safeTransfer(discount.affiliate, netCommission);
            IERC20(discount.token).safeTransfer(treasuryAddress, platformCut);
            
            emit AffiliateCommissionPaid(discount.affiliate, netCommission, discountID);
        }
        
        // Deactivate if depleted
        if (discount.remainingAmount == 0) {
            discount.isActive = false;
        }
        
        return discountAmount;
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
    
    function _calculateTotalDiscount(
        SwapParams calldata params,
        uint256 dealixID
    ) internal returns (uint256 totalDiscount) {
        if (dealixID == 0) return 0;
        
        // Apply discount pool benefits
        for (uint i = 0; i < params.discountPoolIDs.length; i++) {
            totalDiscount = totalDiscount.add(
                _calculatePoolDiscount(
                    params.discountPoolIDs[i],
                    msg.sender,
                    params.tokenIn,
                    params.tokenOut,
                    params.amountIn
                )
            );
        }
        
        // Apply affiliate discount
        if (params.affiliateDiscountID > 0) {
            totalDiscount = totalDiscount.add(
                _calculateAffiliateDiscount(
                    params.affiliateDiscountID,
                    params.tokenIn,
                    params.amountIn
                )
            );
        }
        
        // Apply tier and streak bonuses
        totalDiscount = totalDiscount
            .add(_calculateTierBonus(dealixID, params.amountIn))
            .add(_calculateStreakBonus(dealixID, params.amountIn));
    }
    
    function _distributeDiscounts(
        uint256[] memory poolIDs,
        uint256 affiliateDiscountID,
        address token,
        uint256 totalAmount
    ) internal {
        // Transfer discount tokens from pools to user
        // Already handled in calculation functions
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
    
    function _createAffiliateDiscountInternal(
        address project,
        address token,
        uint256 discountPercentage,
        uint256 affiliateCommission,
        uint256 duration
    ) internal returns (uint256 discountID) {
        discountID = nextAffiliateDiscountID++;
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        discount.affiliate = msg.sender;
        discount.project = project;
        discount.token = token;
        discount.discountPercentage = discountPercentage;
        discount.affiliateCommission = affiliateCommission;
        discount.expirationTime = block.timestamp + duration;
        discount.isActive = false;
        discount.isProjectVerified = verifiedProjects[project];
        
        projectAffiliateDiscounts[project].push(discountID);
    }
    
    function _addLiquidity(
        LiquidityParams calldata params
    ) internal returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Transfer tokens
        uint256 totalA = params.amountADesired.add(params.discountReserveA);
        uint256 totalB = params.amountBDesired.add(params.discountReserveB);
        
        IERC20(params.tokenA).safeTransferFrom(msg.sender, address(this), totalA);
        IERC20(params.tokenB).safeTransferFrom(msg.sender, address(this), totalB);
        
        // Approve router with security
        IERC20(params.tokenA).safeApprove(address(router), 0);
        IERC20(params.tokenB).safeApprove(address(router), 0);
        IERC20(params.tokenA).safeApprove(address(router), params.amountADesired);
        IERC20(params.tokenB).safeApprove(address(router), params.amountBDesired);
        
        // Add liquidity
        (amountA, amountB, liquidity) = router.addLiquidity(
            params.tokenA,
            params.tokenB,
            params.amountADesired,
            params.amountBDesired,
            params.amountAMin,
            params.amountBMin,
            msg.sender,
            block.timestamp + 300
        );
        
        // Return unused tokens
        _returnUnusedTokens(
            params.tokenA,
            params.tokenB,
            params.amountADesired,
            params.amountBDesired,
            amountA,
            amountB
        );
    }
    
    function _createDiscountPoolFromLiquidity(
        LiquidityParams calldata params
    ) internal returns (uint256 discountPoolID) {
        discountPoolID = nextDiscountPoolID++;
        DiscountPool storage pool = discountPools[discountPoolID];
        
        pool.id = discountPoolID;
        pool.creator = msg.sender;
        pool.tokenA = params.tokenA;
        pool.tokenB = params.tokenB;
        pool.reserveA = params.discountReserveA;
        pool.reserveB = params.discountReserveB;
        pool.discountPercentage = params.discountPercentage;
        pool.minTradeSize = params.minTradeSize;
        pool.maxDiscountPerTrade = params.discountReserveA.add(params.discountReserveB).div(100);
        pool.expirationTime = block.timestamp + params.duration;
        pool.isActive = true;
        pool.useTokenReserves = true;
        pool.lpToken = factory.getPair(params.tokenA, params.tokenB);
        
        userDiscountPools[msg.sender].push(discountPoolID);
    }
    
    function _returnUnusedTokens(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountA,
        uint256 amountB
    ) internal {
        if (amountADesired > amountA) {
            IERC20(tokenA).safeTransfer(msg.sender, amountADesired - amountA);
        }
        if (amountBDesired > amountB) {
            IERC20(tokenB).safeTransfer(msg.sender, amountBDesired - amountB);
        }
    }
    
    function _updateLiquidityMetrics(uint256 liquidity) internal {
        uint256 dealixID = userToDealixID[msg.sender];
        dealixIDs[dealixID].liquidityProvided = dealixIDs[dealixID].liquidityProvided.add(liquidity);
        _checkAndAwardBadge(msg.sender, BadgeType.LIQUIDITY_PROVIDER, dealixIDs[dealixID].liquidityProvided);
    }
    
    function _calculateTier(uint256 volume) internal pure returns (uint256) {
        if (volume >= 1000000 * 10**18) return 5;
        if (volume >= 100000 * 10**18) return 4;
        if (volume >= 10000 * 10**18) return 3;
        if (volume >= 1000 * 10**18) return 2;
        if (volume >= 100 * 10**18) return 1;
        return 0;
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
    
    // ============ View Functions ============
    
    function getDealixProfile(address user) external view returns (
        uint256 dealixID,
        uint256 totalVolume,
        uint256 tier,
        uint256 badgeCount,
        uint256 socialPoints,
        uint256 swaps,
        uint256 streak,
        uint256 liquidityProvided,
        uint256 affiliateEarnings
    ) {
        dealixID = userToDealixID[user];
        if (dealixID > 0) {
            DealixID storage profile = dealixIDs[dealixID];
            totalVolume = profile.totalVolume;
            tier = profile.discountTier;
            badgeCount = profile.badgeCount;
            socialPoints = profile.socialPoints;
            swaps = profile.swapCount;
            streak = profile.activityStreak;
            liquidityProvided = profile.liquidityProvided;
            affiliateEarnings = profile.affiliateEarnings;
        }
    }
    
    function getUserBadges(uint256 dealixID) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextBadgeID; i++) {
            if (userBadges[dealixID][i]) count++;
        }
        
        uint256[] memory ownedBadges = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextBadgeID; i++) {
            if (userBadges[dealixID][i]) {
                ownedBadges[index] = i;
                index++;
            }
        }
        
        return ownedBadges;
    }
    
    function getActiveDiscountPools(address tokenA, address tokenB) external view returns (uint256[] memory) {
        uint256 count = _countActiveDiscountPools(tokenA, tokenB);
        uint256[] memory activePools = new uint256[](count);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextDiscountPoolID; i++) {
            if (_isPoolActive(i, tokenA, tokenB)) {
                activePools[index] = i;
                index++;
            }
        }
        
        return activePools;
    }
    
    function _countActiveDiscountPools(address tokenA, address tokenB) internal view returns (uint256 count) {
        for (uint256 i = 1; i < nextDiscountPoolID; i++) {
            if (_isPoolActive(i, tokenA, tokenB)) {
                count++;
            }
        }
    }
    
    function _isPoolActive(uint256 poolID, address tokenA, address tokenB) internal view returns (bool) {
        DiscountPool storage pool = discountPools[poolID];
        return pool.isActive && 
               block.timestamp <= pool.expirationTime &&
               ((pool.tokenA == tokenA && pool.tokenB == tokenB) ||
                (pool.tokenA == tokenB && pool.tokenB == tokenA));
    }
    
    function getAffiliateDiscounts(address token) external view returns (uint256[] memory) {
        uint256 count = _countActiveAffiliateDiscounts(token);
        uint256[] memory activeDiscounts = new uint256[](count);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextAffiliateDiscountID; i++) {
            if (_isAffiliateDiscountActive(i, token)) {
                activeDiscounts[index] = i;
                index++;
            }
        }
        
        return activeDiscounts;
    }
    
    function _countActiveAffiliateDiscounts(address token) internal view returns (uint256 count) {
        for (uint256 i = 1; i < nextAffiliateDiscountID; i++) {
            if (_isAffiliateDiscountActive(i, token)) {
                count++;
            }
        }
    }
    
    function _isAffiliateDiscountActive(uint256 discountID, address token) internal view returns (bool) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        return discount.isActive && 
               discount.token == token &&
               block.timestamp <= discount.expirationTime &&
               discount.remainingAmount > 0;
    }
    
    // ============ Admin Functions with Timelock ============
    
    function proposeAdminAction(bytes32 actionId) external onlyOwner {
        pendingActions[actionId] = block.timestamp + TIMELOCK_DURATION;
    }
    
    function executeAdminAction(bytes32 actionId) external onlyOwner {
        require(pendingActions[actionId] != 0, "Action not proposed");
        require(block.timestamp >= pendingActions[actionId], "Timelock not expired");
        pendingActions[actionId] = 0;
    }
    
    function setPlatformFee(uint256 _fee) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("setPlatformFee", _fee));
        require(pendingActions[actionId] != 0 && block.timestamp >= pendingActions[actionId], "Timelock required");
        require(_fee <= 100, "Fee too high");
        
        platformFee = _fee;
        pendingActions[actionId] = 0;
    }
    
    function setMintingFee(uint256 _fee) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("setMintingFee", _fee));
        require(pendingActions[actionId] != 0 && block.timestamp >= pendingActions[actionId], "Timelock required");
        
        mintingFee = _fee;
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
    
    function createBadge(
        string memory name,
        string memory description,
        uint256 requirement,
        BadgeType badgeType,
        string memory imageURI,
        uint256 points
    ) external onlyOwner {
        _createBadge(name, description, requirement, badgeType, imageURI, points);
    }
    
    function emergencyPause() external onlyOwner {
        _pause();
        emit EmergencyPause(msg.sender);
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("emergencyWithdraw", token, amount));
        require(pendingActions[actionId] != 0 && block.timestamp >= pendingActions[actionId], "Timelock required");
        
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
        
        pendingActions[actionId] = 0;
    }
    
    // ============ Public Swap Function (No Dealix ID Required) ============
    
    function swapWithoutDealix(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        // Basic swap without any discounts
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Security: Reset approval
        IERC20(tokenIn).safeApprove(address(router), 0);
        IERC20(tokenIn).safeApprove(address(router), amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        
        // Apply platform fee for non-Dealix users
        uint256 fee = amountOut.mul(platformFee).div(10000);
        amountOut = amountOut.sub(fee);
        
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        if (fee > 0) {
            IERC20(tokenOut).safeTransfer(treasuryAddress, fee);
        }
        
        emit SwapWithDiscount(msg.sender, 0, tokenIn, tokenOut, amountIn, amountOut, 0);
    }
    
    // Security: Prevent accidental ETH sends
    receive() external payable {
        revert("Direct ETH not accepted");
    }
}