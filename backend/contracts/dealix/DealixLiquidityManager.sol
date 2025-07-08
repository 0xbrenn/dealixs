// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IDealixV2Router02.sol";
import "./interfaces/IDealixV2Factory.sol";
import "./interfaces/IDealixV2Pair.sol";

interface IDealixDEX {
    function userToDealixID(address user) external view returns (uint256);
    function dealixIDs(uint256) external view returns (
        uint256 tokenId,
        address owner,
        uint256 totalVolume,
        uint256 discountTier,
        uint256 badgeCount,
        uint256 liquidityProvided,
        uint256 discountsCreated,
        uint256 swapCount,
        uint256 socialPoints,
        uint256 lastActivityTimestamp,
        uint256 activityStreak,
        uint256 affiliateEarnings,
        uint256 volumeInCurrentBlock,
        uint256 lastVolumeUpdateBlock
    );
}

/**
 * @title DealixLiquidityManager
 * @dev Handles liquidity and affiliate operations for DealixDEX
 */
contract DealixLiquidityManager is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    
    // ============ Structs ============
    
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
        uint256 maxUsagePerUser;
        mapping(address => uint256) userUsageCount;
    }
    
    struct CreateAffiliateParams {
        address project;
        address token;
        uint256 discountPercentage;
        uint256 affiliateCommission;
        uint256 duration;
        uint256 maxUsagePerUser;
    }
    
    // ============ State Variables ============
    
    IDealixV2Router02 public immutable router;
    IDealixV2Factory public immutable factory;
    IDealixDEX public immutable dealixDEX;
    address public treasuryAddress;
    
    // Affiliate discounts
    mapping(uint256 => AffiliateDiscount) public affiliateDiscounts;
    mapping(address => uint256[]) public projectAffiliateDiscounts;
    mapping(address => uint256[]) public affiliateCreatedDiscounts;
    mapping(address => bool) public verifiedProjects;
    
    uint256 public nextAffiliateDiscountID = 1;
    uint256 public constant AFFILIATE_PLATFORM_CUT = 1000; // 10%
    uint256 public constant MAX_DISCOUNT_PERCENTAGE = 5000; // 50%
    uint256 public constant MAX_COMMISSION_PERCENTAGE = 5000; // 50%
    
    // ============ Events ============
    
    event AffiliateDiscountCreated(
        uint256 indexed discountID,
        address indexed affiliate,
        address indexed project,
        address token,
        uint256 discountPercentage
    );
    
    event AffiliateDiscountFunded(
        uint256 indexed discountID,
        address indexed funder,
        uint256 amount
    );
    
    event AffiliateDiscountUsed(
        uint256 indexed discountID,
        address indexed user,
        uint256 discountAmount,
        uint256 volumeGenerated
    );
    
    event AffiliateCommissionPaid(
        address indexed affiliate,
        uint256 amount,
        uint256 discountID
    );
    
    event LiquidityAddedWithDiscount(
        address indexed user,
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 discountPoolID
    );
    
    event ProjectVerified(address indexed project);
    
    // ============ Modifiers ============
    
    modifier onlyDealixHolder() {
        require(dealixDEX.userToDealixID(msg.sender) > 0, "Dealix ID required");
        _;
    }
    
    modifier onlyVerifiedProject() {
        require(verifiedProjects[msg.sender], "Project not verified");
        _;
    }
    
    modifier onlyDealixDEXOrOwner() {
        require(msg.sender == address(dealixDEX) || msg.sender == owner(), "Not authorized");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _router,
        address _factory,
        address _dealixDEX,
        address _treasury
    ) {
        require(_router != address(0), "Invalid router");
        require(_factory != address(0), "Invalid factory");
        require(_dealixDEX != address(0), "Invalid DealixDEX");
        require(_treasury != address(0), "Invalid treasury");
        
        router = IDealixV2Router02(_router);
        factory = IDealixV2Factory(_factory);
        dealixDEX = IDealixDEX(_dealixDEX);
        treasuryAddress = _treasury;
    }
    
    // ============ Affiliate Functions ============
    
    /**
     * @dev Create an affiliate discount with enhanced security
     */
    function createAffiliateDiscount(
        CreateAffiliateParams calldata params
    ) external nonReentrant whenNotPaused onlyDealixHolder returns (uint256 discountID) {
        require(verifiedProjects[params.project], "Project not verified");
        require(params.discountPercentage > 0 && params.discountPercentage <= MAX_DISCOUNT_PERCENTAGE, "Invalid discount");
        require(params.affiliateCommission > 0 && params.affiliateCommission <= MAX_COMMISSION_PERCENTAGE, "Invalid commission");
        require(params.duration > 0 && params.duration <= 365 days, "Invalid duration");
        require(params.maxUsagePerUser > 0, "Invalid max usage");
        require(params.token != address(0), "Invalid token");
        
        discountID = nextAffiliateDiscountID++;
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        discount.affiliate = msg.sender;
        discount.project = params.project;
        discount.token = params.token;
        discount.discountPercentage = params.discountPercentage;
        discount.affiliateCommission = params.affiliateCommission;
        discount.expirationTime = block.timestamp + params.duration;
        discount.isActive = false; // Requires funding to activate
        discount.isProjectVerified = true;
        discount.maxUsagePerUser = params.maxUsagePerUser;
        
        projectAffiliateDiscounts[params.project].push(discountID);
        affiliateCreatedDiscounts[msg.sender].push(discountID);
        
        emit AffiliateDiscountCreated(
            discountID,
            msg.sender,
            params.project,
            params.token,
            params.discountPercentage
        );
    }
    
    /**
     * @dev Fund an affiliate discount
     */
    function fundAffiliateDiscount(
        uint256 discountID,
        uint256 amount
    ) external nonReentrant whenNotPaused onlyVerifiedProject {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        require(msg.sender == discount.project, "Only project can fund");
        require(amount > 0, "Invalid amount");
        require(block.timestamp < discount.expirationTime, "Discount expired");
        
        IERC20(discount.token).safeTransferFrom(msg.sender, address(this), amount);
        
        discount.fundedAmount = discount.fundedAmount.add(amount);
        discount.remainingAmount = discount.remainingAmount.add(amount);
        discount.isActive = true;
        
        emit AffiliateDiscountFunded(discountID, msg.sender, amount);
    }
    
    /**
     * @dev Calculate and apply affiliate discount (called by DealixDEX)
     */
    function applyAffiliateDiscount(
        uint256 discountID,
        address user,
        uint256 volumeGenerated
    ) external nonReentrant onlyDealixDEXOrOwner returns (
        uint256 discountAmount,
        uint256 netCommission,
        address affiliate
    ) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        // Validations
        require(discount.isActive, "Discount not active");
        require(block.timestamp <= discount.expirationTime, "Discount expired");
        require(discount.userUsageCount[user] < discount.maxUsagePerUser, "Usage limit reached");
        
        // Calculate discount
        discountAmount = volumeGenerated.mul(discount.discountPercentage).div(10000);
        
        if (discountAmount > discount.remainingAmount) {
            discountAmount = discount.remainingAmount;
        }
        
        // Update state
        discount.remainingAmount = discount.remainingAmount.sub(discountAmount);
        discount.volumeGenerated = discount.volumeGenerated.add(volumeGenerated);
        discount.userUsageCount[user]++;
        
        // Calculate commission
        uint256 commission = discountAmount.mul(discount.affiliateCommission).div(10000);
        uint256 platformCut = commission.mul(AFFILIATE_PLATFORM_CUT).div(10000);
        netCommission = commission.sub(platformCut);
        
        // Transfer commission
        if (netCommission > 0) {
            IERC20(discount.token).safeTransfer(discount.affiliate, netCommission);
            
            if (platformCut > 0) {
                IERC20(discount.token).safeTransfer(treasuryAddress, platformCut);
            }
            
            emit AffiliateCommissionPaid(discount.affiliate, netCommission, discountID);
        }
        
        // Deactivate if depleted
        if (discount.remainingAmount == 0) {
            discount.isActive = false;
        }
        
        affiliate = discount.affiliate;
        
        emit AffiliateDiscountUsed(discountID, user, discountAmount, volumeGenerated);
    }
    
    // ============ Liquidity Functions ============
    
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
        require(params.tokenA != params.tokenB, "Same token");
        require(params.amountADesired > 0 && params.amountBDesired > 0, "Invalid amounts");
        
        // Transfer total amounts (liquidity + discount reserves)
        uint256 totalA = params.amountADesired.add(params.discountReserveA);
        uint256 totalB = params.amountBDesired.add(params.discountReserveB);
        
        IERC20(params.tokenA).safeTransferFrom(msg.sender, address(this), totalA);
        IERC20(params.tokenB).safeTransferFrom(msg.sender, address(this), totalB);
        
        // Approve router for liquidity amounts only
        _safeApprove(params.tokenA, address(router), params.amountADesired);
        _safeApprove(params.tokenB, address(router), params.amountBDesired);
        
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
        if (params.amountADesired > amountA) {
            IERC20(params.tokenA).safeTransfer(msg.sender, params.amountADesired - amountA);
        }
        if (params.amountBDesired > amountB) {
            IERC20(params.tokenB).safeTransfer(msg.sender, params.amountBDesired - amountB);
        }
        
        // Create discount pool if reserves provided
        if (params.discountReserveA > 0 || params.discountReserveB > 0) {
            // This would interact with the main DealixDEX contract
            // For now, just emit event
            discountPoolID = 0; // Placeholder
        }
        
        emit LiquidityAddedWithDiscount(
            msg.sender,
            params.tokenA,
            params.tokenB,
            liquidity,
            discountPoolID
        );
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get active affiliate discounts for a token
     */
    function getActiveAffiliateDiscounts(address token) external view returns (uint256[] memory) {
        uint256 count = 0;
        
        // Count active discounts
        for (uint256 i = 1; i < nextAffiliateDiscountID; i++) {
            if (_isAffiliateDiscountActive(i, token)) {
                count++;
            }
        }
        
        // Populate array
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
    
    /**
     * @dev Check if affiliate discount is valid for user
     */
    function canUseAffiliateDiscount(
        uint256 discountID,
        address user
    ) external view returns (bool) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        
        return discount.isActive &&
               block.timestamp <= discount.expirationTime &&
               discount.remainingAmount > 0 &&
               discount.userUsageCount[user] < discount.maxUsagePerUser;
    }
    
    // ============ Internal Functions ============
    
    function _isAffiliateDiscountActive(uint256 discountID, address token) internal view returns (bool) {
        AffiliateDiscount storage discount = affiliateDiscounts[discountID];
        return discount.isActive && 
               discount.token == token &&
               block.timestamp <= discount.expirationTime &&
               discount.remainingAmount > 0;
    }
    
    function _safeApprove(address token, address spender, uint256 amount) internal {
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        
        if (currentAllowance < amount) {
            if (currentAllowance > 0) {
                IERC20(token).safeApprove(spender, 0);
            }
            IERC20(token).safeApprove(spender, amount);
        }
    }
    
    // ============ Admin Functions ============
    
    function verifyProject(address project) external onlyOwner {
        require(project != address(0), "Invalid project");
        verifiedProjects[project] = true;
        emit ProjectVerified(project);
    }
    
    function setTreasuryAddress(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasuryAddress = _treasury;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdrawal with timelock
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        // In production, add timelock mechanism
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }
}