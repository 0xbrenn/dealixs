// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IRewarder {
    function onReward(uint256 pid, address user, uint256 rewardAmount) external;
}

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
 * @title DealixMasterChef
 * @dev Secure farming contract with Dealix integration
 * Features:
 * - Non-mintable reward token model (must be pre-funded)
 * - Emergency withdrawal functionality
 * - Dealix ID boost system
 * - Multiple reward tokens per pool
 * - Anti-rug pull mechanisms
 * - Time-locked functions for critical operations
 */
contract DealixMasterChef is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user
    struct UserInfo {
        uint256 amount;          // LP tokens provided
        uint256 rewardDebt;      // Reward debt
        uint256 boostMultiplier; // Boost from Dealix ID (100 = 1x, 150 = 1.5x)
        uint256 lastDepositTime; // For lock tracking
    }

    // Info of each pool
    struct PoolInfo {
        IERC20 lpToken;           // LP token contract
        uint256 allocPoint;       // Allocation points
        uint256 lastRewardTime;   // Last timestamp rewards distributed
        uint256 accRewardPerShare; // Accumulated rewards per share
        uint256 totalBoostedShare; // Total boosted shares in pool
        IRewarder rewarder;       // Bonus rewarder contract
        uint256 depositFeeBP;     // Deposit fee in basis points
        uint256 harvestInterval;  // Harvest interval in seconds
        uint256 withdrawLockTime; // Lock time for withdrawals
    }

    // Reward token
    IERC20 public immutable rewardToken;
    
    // Dealix integration
    IDealixDEX public immutable dealixDEX;
    
    // Reward parameters
    uint256 public rewardPerSecond;
    uint256 public constant ACC_PRECISION = 1e18;
    
    // Fee parameters
    uint256 public constant MAX_DEPOSIT_FEE = 400; // 4%
    address public feeAddress;
    
    // Pool parameters
    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public totalAllocPoint = 0;
    uint256 public startTime;
    uint256 public endTime;
    
    // Security parameters
    mapping(address => bool) public poolExistence;
    mapping(address => bool) public isAuthorized;
    uint256 public constant TIMELOCK_DURATION = 2 days;
    mapping(bytes32 => uint256) public timelockQueue;
    
    // Boost parameters
    uint256 public constant MAX_BOOST = 300; // 3x max boost
    uint256 public constant BASE_BOOST = 100; // 1x base
    
    // Events
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
    event PoolAdded(uint256 indexed pid, uint256 allocPoint, address lpToken);
    event PoolSet(uint256 indexed pid, uint256 allocPoint);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event BoostUpdated(address indexed user, uint256 indexed pid, uint256 oldBoost, uint256 newBoost);
    event TimelockQueued(bytes32 indexed actionId, uint256 executeTime);
    event TimelockExecuted(bytes32 indexed actionId);
    
    modifier onlyAuthorized() {
        require(isAuthorized[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    modifier nonDuplicated(IERC20 _lpToken) {
        require(!poolExistence[address(_lpToken)], "Pool already exists");
        _;
    }
    
    modifier validatePoolId(uint256 _pid) {
        require(_pid < poolInfo.length, "Invalid pool ID");
        _;
    }
    
    constructor(
        IERC20 _rewardToken,
        IDealixDEX _dealixDEX,
        uint256 _rewardPerSecond,
        uint256 _startTime,
        address _feeAddress
    ) {
        require(address(_rewardToken) != address(0), "Invalid reward token");
        require(address(_dealixDEX) != address(0), "Invalid DealixDEX");
        require(_feeAddress != address(0), "Invalid fee address");
        require(_startTime > block.timestamp, "Invalid start time");
        
        rewardToken = _rewardToken;
        dealixDEX = _dealixDEX;
        rewardPerSecond = _rewardPerSecond;
        startTime = _startTime;
        feeAddress = _feeAddress;
        
        isAuthorized[msg.sender] = true;
    }
    
    // ============ Pool Management ============
    
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }
    
    function add(
        uint256 _allocPoint,
        IERC20 _lpToken,
        IRewarder _rewarder,
        uint256 _depositFeeBP,
        uint256 _harvestInterval,
        uint256 _withdrawLockTime,
        bool _withUpdate
    ) external onlyOwner nonDuplicated(_lpToken) {
        require(_depositFeeBP <= MAX_DEPOSIT_FEE, "Deposit fee too high");
        require(_harvestInterval <= 14 days, "Harvest interval too long");
        require(_withdrawLockTime <= 30 days, "Lock time too long");
        
        if (_withUpdate) {
            massUpdatePools();
        }
        
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardTime: lastRewardTime,
            accRewardPerShare: 0,
            totalBoostedShare: 0,
            rewarder: _rewarder,
            depositFeeBP: _depositFeeBP,
            harvestInterval: _harvestInterval,
            withdrawLockTime: _withdrawLockTime
        }));
        
        poolExistence[address(_lpToken)] = true;
        
        emit PoolAdded(poolInfo.length - 1, _allocPoint, address(_lpToken));
    }
    
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        IRewarder _rewarder,
        bool _withUpdate
    ) external onlyAuthorized validatePoolId(_pid) {
        if (_withUpdate) {
            massUpdatePools();
        }
        
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].rewarder = _rewarder;
        
        emit PoolSet(_pid, _allocPoint);
    }
    
    // ============ View Functions ============
    
    function pendingReward(uint256 _pid, address _user) 
        external 
        view 
        validatePoolId(_pid) 
        returns (uint256 pending) 
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        
        uint256 accRewardPerShare = pool.accRewardPerShare;
        
        if (block.timestamp > pool.lastRewardTime && pool.totalBoostedShare != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardTime, block.timestamp);
            uint256 reward = multiplier.mul(rewardPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
            accRewardPerShare = accRewardPerShare.add(reward.mul(ACC_PRECISION).div(pool.totalBoostedShare));
        }
        
        uint256 boostedAmount = user.amount.mul(user.boostMultiplier).div(BASE_BOOST);
        pending = boostedAmount.mul(accRewardPerShare).div(ACC_PRECISION).sub(user.rewardDebt);
    }
    
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= startTime || _from >= endTime) {
            return 0;
        }
        if (_from < startTime) {
            _from = startTime;
        }
        if (endTime > 0 && _to > endTime) {
            _to = endTime;
        }
        return _to.sub(_from);
    }
    
    function getUserBoost(address _user) public view returns (uint256) {
        uint256 dealixId = dealixDEX.userToDealixID(_user);
        if (dealixId == 0) {
            return BASE_BOOST;
        }
        
        (, , , uint256 discountTier, uint256 badgeCount, , , , , , , , , ) = dealixDEX.dealixIDs(dealixId);
        
        // Base boost + tier bonus + badge bonus
        uint256 boost = BASE_BOOST;
        boost = boost.add(discountTier.mul(10)); // +10% per tier
        boost = boost.add(badgeCount.mul(2)); // +2% per badge
        
        if (boost > MAX_BOOST) {
            boost = MAX_BOOST;
        }
        
        return boost;
    }
    
    // ============ Update Functions ============
    
    function updatePool(uint256 _pid) public validatePoolId(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        
        if (block.timestamp <= pool.lastRewardTime) {
            return;
        }
        
        if (pool.totalBoostedShare == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }
        
        uint256 multiplier = getMultiplier(pool.lastRewardTime, block.timestamp);
        uint256 reward = multiplier.mul(rewardPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
        
        pool.accRewardPerShare = pool.accRewardPerShare.add(
            reward.mul(ACC_PRECISION).div(pool.totalBoostedShare)
        );
        pool.lastRewardTime = block.timestamp;
    }
    
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }
    
    // ============ User Functions ============
    
    function deposit(uint256 _pid, uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
        validatePoolId(_pid) 
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        updatePool(_pid);
        updateUserBoost(msg.sender, _pid);
        
        if (user.amount > 0) {
            // Harvest existing rewards
            _harvest(_pid, msg.sender);
        }
        
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);
            
            if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, depositFee);
                _amount = _amount.sub(depositFee);
            }
            
            user.amount = user.amount.add(_amount);
            user.lastDepositTime = block.timestamp;
            
            // Update boosted amount
            pool.totalBoostedShare = pool.totalBoostedShare.add(
                _amount.mul(user.boostMultiplier).div(BASE_BOOST)
            );
        }
        
        user.rewardDebt = user.amount.mul(user.boostMultiplier).div(BASE_BOOST)
            .mul(pool.accRewardPerShare).div(ACC_PRECISION);
        
        emit Deposit(msg.sender, _pid, _amount);
    }
    
    function withdraw(uint256 _pid, uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
        validatePoolId(_pid) 
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        require(user.amount >= _amount, "Insufficient balance");
        require(
            block.timestamp >= user.lastDepositTime.add(pool.withdrawLockTime),
            "Still in lock period"
        );
        
        updatePool(_pid);
        updateUserBoost(msg.sender, _pid);
        
        // Harvest rewards
        _harvest(_pid, msg.sender);
        
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(msg.sender, _amount);
            
            // Update boosted amount
            pool.totalBoostedShare = pool.totalBoostedShare.sub(
                _amount.mul(user.boostMultiplier).div(BASE_BOOST)
            );
        }
        
        user.rewardDebt = user.amount.mul(user.boostMultiplier).div(BASE_BOOST)
            .mul(pool.accRewardPerShare).div(ACC_PRECISION);
        
        emit Withdraw(msg.sender, _pid, _amount);
    }
    
    function harvest(uint256 _pid) external nonReentrant whenNotPaused validatePoolId(_pid) {
        updatePool(_pid);
        updateUserBoost(msg.sender, _pid);
        _harvest(_pid, msg.sender);
    }
    
    function _harvest(uint256 _pid, address _user) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        
        uint256 boostedAmount = user.amount.mul(user.boostMultiplier).div(BASE_BOOST);
        uint256 accumulated = boostedAmount.mul(pool.accRewardPerShare).div(ACC_PRECISION);
        uint256 pending = accumulated.sub(user.rewardDebt);
        
        if (pending > 0) {
            safeRewardTransfer(_user, pending);
            
            // Call rewarder if set
            if (address(pool.rewarder) != address(0)) {
                pool.rewarder.onReward(_pid, _user, pending);
            }
        }
        
        user.rewardDebt = accumulated;
        
        emit Harvest(_user, _pid, pending);
    }
    
    function updateUserBoost(address _user, uint256 _pid) public {
        UserInfo storage user = userInfo[_pid][_user];
        PoolInfo storage pool = poolInfo[_pid];
        
        uint256 oldBoost = user.boostMultiplier;
        uint256 newBoost = getUserBoost(_user);
        
        if (oldBoost != newBoost) {
            // Update pool's total boosted share
            uint256 oldBoostedAmount = user.amount.mul(oldBoost).div(BASE_BOOST);
            uint256 newBoostedAmount = user.amount.mul(newBoost).div(BASE_BOOST);
            
            pool.totalBoostedShare = pool.totalBoostedShare.sub(oldBoostedAmount).add(newBoostedAmount);
            user.boostMultiplier = newBoost;
            
            emit BoostUpdated(_user, _pid, oldBoost, newBoost);
        }
    }
    
    // ============ Emergency Functions ============
    
    function emergencyWithdraw(uint256 _pid) external nonReentrant validatePoolId(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        uint256 amount = user.amount;
        
        // Update pool boosted share
        uint256 boostedAmount = amount.mul(user.boostMultiplier).div(BASE_BOOST);
        pool.totalBoostedShare = pool.totalBoostedShare.sub(boostedAmount);
        
        // Reset user
        user.amount = 0;
        user.rewardDebt = 0;
        user.boostMultiplier = BASE_BOOST;
        
        pool.lpToken.safeTransfer(msg.sender, amount);
        
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }
    
    function emergencyRewardWithdraw(uint256 _amount) external onlyOwner {
        require(block.timestamp >= endTime.add(30 days), "Too early for emergency withdrawal");
        safeRewardTransfer(msg.sender, _amount);
    }
    
    // ============ Admin Functions ============
    
    function setRewardPerSecond(uint256 _rewardPerSecond) external onlyOwner {
        massUpdatePools();
        
        uint256 oldRate = rewardPerSecond;
        rewardPerSecond = _rewardPerSecond;
        
        emit RewardRateUpdated(oldRate, _rewardPerSecond);
    }
    
    function setEndTime(uint256 _endTime) external onlyOwner {
        require(_endTime > block.timestamp, "Invalid end time");
        require(endTime == 0 || block.timestamp < endTime, "Farming already ended");
        
        endTime = _endTime;
    }
    
    function setFeeAddress(address _feeAddress) external onlyOwner {
        require(_feeAddress != address(0), "Invalid fee address");
        
        // Timelock for fee address change
        bytes32 actionId = keccak256(abi.encodePacked("setFeeAddress", _feeAddress));
        
        if (timelockQueue[actionId] == 0) {
            timelockQueue[actionId] = block.timestamp.add(TIMELOCK_DURATION);
            emit TimelockQueued(actionId, timelockQueue[actionId]);
        } else {
            require(block.timestamp >= timelockQueue[actionId], "Timelock not expired");
            feeAddress = _feeAddress;
            timelockQueue[actionId] = 0;
            emit TimelockExecuted(actionId);
        }
    }
    
    function setAuthorized(address _user, bool _authorized) external onlyOwner {
        isAuthorized[_user] = _authorized;
    }
    
    function pause() external onlyAuthorized {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Functions ============
    
    function safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 rewardBal = rewardToken.balanceOf(address(this));
        if (_amount > rewardBal) {
            rewardToken.safeTransfer(_to, rewardBal);
        } else {
            rewardToken.safeTransfer(_to, _amount);
        }
    }
}