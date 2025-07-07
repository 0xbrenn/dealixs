// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../interfaces/IIOPNRouter02.sol";
import "../interfaces/IIOPNFactory.sol";
import "../interfaces/IIOPNPair.sol";

/**
 * @title DealixDEX
 * @dev Main contract for Dealix integration with IOPN DEX
 * Combines discount mechanisms, social features, and NFT-based identity
 */
contract DealixDEX is ERC721Enumerable, Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    
    // ============ Structs ============
    
    struct DealixID {
        uint256 tokenId;
        address owner;
        uint256 totalVolume;
        uint256 discountTier; // 0-5 tiers
        uint256 badgeCount;
        uint256 liquidityProvided;
        uint256 discountsCreated;
        uint256 swapCount;
        uint256 socialPoints;
        uint256 lastActivityTimestamp;
        uint256 activityStreak;
        uint256 affiliateEarnings;
    }
    
    struct DiscountPool {
        uint256 id;
        address creator;
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 discountPercentage; // basis points (100 = 1%)
        uint256 minTradeSize;
        uint256 maxDiscountPerTrade;
        uint256 totalVolumeGenerated;
        uint256 expirationTime;
        bool isActive;
        bool useTokenReserves; // true = token reserves, false = LP fee based
        uint256 lpTokenAmount; // if fee based
        address lpToken; // if fee based
        mapping(address => uint256) userClaims;
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
        uint256 affiliateCommission; // basis points
        uint256 fundedAmount;
        uint256 remainingAmount;
        uint256 volumeGenerated;
        uint256 expirationTime;
        bool isActive;
    }
    
    // ============ Enums ============
    
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
    
    // Core mappings
    mapping(uint256 => DealixID) public dealixIDs;
    mapping(address => uint256) public userToDealixID;
    mapping(uint256 => mapping(uint256 => bool)) public userBadges;
    mapping(uint256 => Badge) public badges;
    mapping(uint256 => DiscountPool) public discountPools;
    mapping(uint256 => AffiliateDiscount) public affiliateDiscounts;
    
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
    uint256 public mintingFee = 0.05 ether;
    uint256 public maxDiscountPercentage = 5000; // 50%
    uint256 public streakBonusPerDay = 5; // 0.05% per day
    
    // Contracts
    IIOPNRouter02 public router;
    IIOPNFactory public factory;
    address public treasuryAddress;
    
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
    
    // ============ Constructor ============
    
    constructor(
        address _router,
        address _factory,
        address _treasury
    ) ERC721("DealixDEX ID", "DEALIX") {
        router = IIOPNRouter02(_router);
        factory = IIOPNFactory(_factory);
        treasuryAddress = _treasury;
        
        _initializeBadges();
    }
    
    // ============ Main Functions ============
    
    /**
     * @dev Create a new Dealix ID NFT
     * @param referrer Address of the referrer (optional)
     */
    function createDealixID(address referrer) external payable nonReentrant {
        require(msg.value >= mintingFee, "Insufficient minting fee");
        require(userToDealixID[msg.sender] == 0, "Already has Dealix ID");
        
        uint256 newID = nextDealixID++;
        _mint(msg.sender, newID);
        
        DealixID storage newDealixID = dealixIDs[newID];
        newDealixID.tokenId = newID;
        newDealixID.owner = msg.sender;
        newDealixID.lastActivityTimestamp = block.timestamp;
        
        userToDealixID[msg.sender] = newID;
        
        // Handle referral
        if (referrer != address(0) && userToDealixID[referrer] > 0) {
            referredBy[msg.sender] = referrer;
            referralCounts[referrer]++;
            
            // Award referrer bonus
            uint256 referrerID = userToDealixID[referrer];
            dealixIDs[referrerID].socialPoints = dealixIDs[referrerID].socialPoints.add(100);
            
            _checkAndAwardBadge(referrer, BadgeType.REFERRER, referralCounts[referrer]);
        }
        
        // Award early adopter badge
        if (newID <= 1000) {
            _awardBadge(newID, 1); // Assuming badge 1 is early adopter
        }
        
        // Send minting fee to treasury
        payable(treasuryAddress).transfer(msg.value);
        
        emit DealixIDCreated(msg.sender, newID);
    }
    
    /**
     * @dev Create a discount pool with token reserves
     */
    function createTokenDiscountPool(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 discountPercentage,
        uint256 minTradeSize,
        uint256 duration
    ) external nonReentrant returns (uint256 poolID) {
        require(userToDealixID[msg.sender] > 0, "Dealix ID required");
        require(discountPercentage > 0 && discountPercentage <= maxDiscountPercentage, "Invalid discount percentage");
        require(amountA > 0 || amountB > 0, "Must provide tokens");
        
        poolID = nextDiscountPoolID++;
        DiscountPool storage pool = discountPools[poolID];
        
        pool.id = poolID;
        pool.creator = msg.sender;
        pool.tokenA = tokenA;
        pool.tokenB = tokenB;
        pool.reserveA = amountA;
        pool.reserveB = amountB;
        pool.discountPercentage = discountPercentage;
        pool.minTradeSize = minTradeSize;
        pool.expirationTime = block.timestamp + duration;
        pool.isActive = true;
        pool.useTokenReserves = true;
        
        // Transfer tokens to contract
        if (amountA > 0) {
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        }
        if (amountB > 0) {
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);
        }
        
        userDiscountPools[msg.sender].push(poolID);
        
        // Update creator metrics
        uint256 dealixID = userToDealixID[msg.sender];
        dealixIDs[dealixID].discountsCreated++;
        
        _checkAndAwardBadge(msg.sender, BadgeType.DISCOUNT_CREATOR, dealixIDs[dealixID].discountsCreated);
        
        emit DiscountPoolCreated(poolID, msg.sender, tokenA, tokenB, discountPercentage);
    }
    
    /**
     * @dev Create an affiliate discount (Traditional Dealix model)
     */
    function createAffiliateDiscount(
        address project,
        address token,
        uint256 discountPercentage,
        uint256 affiliateCommission,
        uint256 duration
    ) external nonReentrant returns (uint256 discountID) {
        require(userToDealixID[msg.sender] > 0, "Dealix ID required");
        require(discountPercentage > 0 && discountPercentage <= maxDiscountPercentage, "Invalid discount");
        require(affiliateCommission > 0 && affiliateCommission <= 1000, "Invalid commission"); // Max 10%
        
        discountID = nextAffiliateDiscountID++;
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        discount.affiliate = msg.sender;
        discount.project = project;
        discount.token = token;
        discount.discountPercentage = discountPercentage;
        discount.affiliateCommission = affiliateCommission;
        discount.expirationTime = block.timestamp + duration;
        discount.isActive = false; // Not active until funded
        
        projectAffiliateDiscounts[project].push(discountID);
        
        emit AffiliateDiscountCreated(discountID, msg.sender, project, token);
    }
    
    /**
     * @dev Fund an affiliate discount (called by project)
     */
    function fundAffiliateDiscount(uint256 discountID, uint256 amount) external nonReentrant {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        require(msg.sender == discount.project, "Only project can fund");
        require(amount > 0, "Invalid amount");
        require(block.timestamp < discount.expirationTime, "Discount expired");
        
        IERC20(discount.token).transferFrom(msg.sender, address(this), amount);
        
        discount.fundedAmount = discount.fundedAmount.add(amount);
        discount.remainingAmount = discount.remainingAmount.add(amount);
        discount.isActive = true;
    }
    
    /**
     * @dev Swap with Dealix benefits
     */
    function swapWithDealix(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256[] calldata discountPoolIDs,
        uint256 affiliateDiscountID
    ) external nonReentrant returns (uint256 amountOut) {
        uint256 dealixID = userToDealixID[msg.sender];
        uint256 totalDiscount = 0;
        
        // Calculate discounts if user has Dealix ID
        if (dealixID > 0) {
            // Apply discount pool benefits
            for (uint i = 0; i < discountPoolIDs.length; i++) {
                uint256 discount = _calculatePoolDiscount(
                    discountPoolIDs[i],
                    msg.sender,
                    tokenIn,
                    tokenOut,
                    amountIn
                );
                totalDiscount = totalDiscount.add(discount);
            }
            
            // Apply affiliate discount
            if (affiliateDiscountID > 0) {
                uint256 affiliateDisc = _calculateAffiliateDiscount(
                    affiliateDiscountID,
                    msg.sender,
                    tokenIn,
                    amountIn
                );
                totalDiscount = totalDiscount.add(affiliateDisc);
            }
            
            // Apply tier and streak bonuses
            uint256 tierBonus = _calculateTierBonus(dealixID, amountIn);
            uint256 streakBonus = _calculateStreakBonus(dealixID, amountIn);
            totalDiscount = totalDiscount.add(tierBonus).add(streakBonus);
        }
        
        // Perform the swap
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(router), amountIn);
        
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
        
        // Apply discount bonus
        if (totalDiscount > 0) {
            // Transfer discount from appropriate pools
            _distributeDiscounts(
                discountPoolIDs,
                affiliateDiscountID,
                tokenOut,
                totalDiscount
            );
            amountOut = amountOut.add(totalDiscount);
        }
        
        // Transfer final amount to user
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        // Update metrics if user has Dealix ID
        if (dealixID > 0) {
            _updateDealixMetrics(dealixID, amountIn);
        }
        
        emit SwapWithDiscount(
            msg.sender,
            dealixID,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            totalDiscount
        );
    }
    
    /**
     * @dev Add liquidity with discount pool creation
     */
    function addLiquidityWithDiscountPool(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 discountReserveA,
        uint256 discountReserveB,
        uint256 discountPercentage,
        uint256 minTradeSize,
        uint256 duration
    ) external nonReentrant returns (
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        uint256 discountPoolID
    ) {
        require(userToDealixID[msg.sender] > 0, "Dealix ID required");
        
        // Transfer tokens for liquidity
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired.add(discountReserveA));
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired.add(discountReserveB));
        
        // Approve router for liquidity
        IERC20(tokenA).approve(address(router), amountADesired);
        IERC20(tokenB).approve(address(router), amountBDesired);
        
        // Add liquidity
        (amountA, amountB, liquidity) = router.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            msg.sender,
            block.timestamp + 300
        );
        
        // Create discount pool with reserves
        if (discountReserveA > 0 || discountReserveB > 0) {
            discountPoolID = nextDiscountPoolID++;
            DiscountPool storage pool = discountPools[discountPoolID];
            
            pool.id = discountPoolID;
            pool.creator = msg.sender;
            pool.tokenA = tokenA;
            pool.tokenB = tokenB;
            pool.reserveA = discountReserveA;
            pool.reserveB = discountReserveB;
            pool.discountPercentage = discountPercentage;
            pool.minTradeSize = minTradeSize;
            pool.expirationTime = block.timestamp + duration;
            pool.isActive = true;
            pool.useTokenReserves = true;
            pool.lpToken = factory.getPair(tokenA, tokenB);
            
            userDiscountPools[msg.sender].push(discountPoolID);
        }
        
        // Return unused tokens
        if (amountADesired > amountA) {
            IERC20(tokenA).transfer(msg.sender, amountADesired - amountA);
        }
        if (amountBDesired > amountB) {
            IERC20(tokenB).transfer(msg.sender, amountBDesired - amountB);
        }
        
        // Update metrics
        uint256 dealixID = userToDealixID[msg.sender];
        dealixIDs[dealixID].liquidityProvided = dealixIDs[dealixID].liquidityProvided.add(liquidity);
        
        _checkAndAwardBadge(msg.sender, BadgeType.LIQUIDITY_PROVIDER, dealixIDs[dealixID].liquidityProvided);
        
        emit LiquidityAddedWithDiscount(msg.sender, dealixID, tokenA, tokenB, liquidity, discountPoolID);
    }
    
    // ============ Internal Functions ============
    
    function _updateDealixMetrics(uint256 dealixID, uint256 volume) internal {
        DealixID storage user = dealixIDs[dealixID];
        
        // Update volume and swap count
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
    
    function _calculateTier(uint256 volume) internal pure returns (uint256) {
        if (volume >= 1000000 * 10**18) return 5; // Whale
        if (volume >= 100000 * 10**18) return 4;
        if (volume >= 10000 * 10**18) return 3;
        if (volume >= 1000 * 10**18) return 2;
        if (volume >= 100 * 10**18) return 1;
        return 0;
    }
    
    function _calculatePoolDiscount(
        uint256 poolID,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        DiscountPool storage pool = discountPools[poolID];
        
        if (!pool.isActive || block.timestamp > pool.expirationTime) return 0;
        if (amountIn < pool.minTradeSize) return 0;
        
        // Check if trade matches pool tokens
        bool matchesTokens = (tokenIn == pool.tokenA && tokenOut == pool.tokenB) ||
                            (tokenIn == pool.tokenB && tokenOut == pool.tokenA);
        if (!matchesTokens) return 0;
        
        // Calculate discount amount
        uint256 discountAmount = amountIn.mul(pool.discountPercentage).div(10000);
        
        // Check available reserves
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
        
        // Update pool state
        pool.userClaims[user] = pool.userClaims[user].add(discountAmount);
        pool.totalVolumeGenerated = pool.totalVolumeGenerated.add(amountIn);
        
        return discountAmount;
    }
    
    function _calculateAffiliateDiscount(
        uint256 discountID,
        address user,
        address tokenIn,
        uint256 amountIn
    ) internal returns (uint256) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        if (!discount.isActive || block.timestamp > discount.expirationTime) return 0;
        if (tokenIn != discount.token) return 0;
        
        uint256 discountAmount = amountIn.mul(discount.discountPercentage).div(10000);
        
        if (discountAmount > discount.remainingAmount) {
            discountAmount = discount.remainingAmount;
        }
        
        // Calculate and track affiliate commission
        uint256 commission = discountAmount.mul(discount.affiliateCommission).div(10000);
        uint256 platformCut = commission.mul(affiliatePlatformCut).div(10000);
        
        discount.volumeGenerated = discount.volumeGenerated.add(amountIn);
        
        // Update affiliate earnings
        uint256 affiliateID = userToDealixID[discount.affiliate];
        if (affiliateID > 0) {
            dealixIDs[affiliateID].affiliateEarnings = dealixIDs[affiliateID].affiliateEarnings.add(commission.sub(platformCut));
        }
        
        return discountAmount;
    }
    
    function _calculateTierBonus(uint256 dealixID, uint256 amountIn) internal view returns (uint256) {
        uint256 tier = dealixIDs[dealixID].discountTier;
        return amountIn.mul(tier.mul(5)).div(10000); // 0.05% per tier
    }
    
    function _calculateStreakBonus(uint256 dealixID, uint256 amountIn) internal view returns (uint256) {
        uint256 streak = dealixIDs[dealixID].activityStreak;
        return amountIn.mul(streak.mul(streakBonusPerDay)).div(10000);
    }
    
    function _distributeDiscounts(
        uint256[] memory poolIDs,
        uint256 affiliateDiscountID,
        address token,
        uint256 totalAmount
    ) internal {
        // Implementation for actually transferring discount tokens
        // This would deduct from pools and affiliate discount reserves
        // For brevity, simplified here
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
        uint256 badges,
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
            badges = profile.badgeCount;
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
        uint256 count = 0;
        for (uint256 i = 1; i < nextDiscountPoolID; i++) {
            DiscountPool storage pool = discountPools[i];
            if (pool.isActive && 
                block.timestamp <= pool.expirationTime &&
                ((pool.tokenA == tokenA && pool.tokenB == tokenB) ||
                 (pool.tokenA == tokenB && pool.tokenB == tokenA))) {
                count++;
            }
        }
        
        uint256[] memory activePools = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextDiscountPoolID; i++) {
            DiscountPool storage pool = discountPools[i];
            if (pool.isActive && 
                block.timestamp <= pool.expirationTime &&
                ((pool.tokenA == tokenA && pool.tokenB == tokenB) ||
                 (pool.tokenA == tokenB && pool.tokenB == tokenA))) {
                activePools[index] = i;
                index++;
            }
        }
        
        return activePools;
    }
    
    function getAffiliateDiscounts(address token) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextAffiliateDiscountID; i++) {
            AffiliateDiscount storage discount = affiliateDiscounts[i];
            if (discount.isActive && 
                discount.token == token &&
                block.timestamp <= discount.expirationTime &&
                discount.remainingAmount > 0) {
                count++;
            }
        }
        
        uint256[] memory activeDiscounts = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextAffiliateDiscountID; i++) {
            AffiliateDiscount storage discount = affiliateDiscounts[i];
            if (discount.isActive && 
                discount.token == token &&
                block.timestamp <= discount.expirationTime &&
                discount.remainingAmount > 0) {
                activeDiscounts[index] = i;
                index++;
            }
        }
        
        return activeDiscounts;
    }
    
    // ============ Admin Functions ============
    
    function setPlatformFee(uint256 _fee) external onlyOwner {
        require(_fee <= 100, "Fee too high"); // Max 1%
        platformFee = _fee;
    }
    
    function setMintingFee(uint256 _fee) external onlyOwner {
        mintingFee = _fee;
    }
    
    function setTreasuryAddress(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
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
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
    
    // ============ Public Swap Function (No Dealix ID Required) ============
    
    function swapWithoutDealix(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external nonReentrant returns (uint256 amountOut) {
        // Basic swap without any discounts
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(router), amountIn);
        
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
        
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        if (fee > 0) {
            IERC20(tokenOut).transfer(treasuryAddress, fee);
        }
        
        emit SwapWithDiscount(msg.sender, 0, tokenIn, tokenOut, amountIn, amountOut, 0);
    }
}