// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MasterChefSecure is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Info of each user
    struct UserInfo {
        uint256 amount;         // How many LP tokens the user has provided
        uint256 rewardDebt;     // Reward debt
        uint256 lastDepositTime; // For lock features if needed
    }

    // Info of each pool
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract
        uint256 allocPoint;       // How many allocation points assigned to this pool
        uint256 lastRewardBlock;  // Last block number that rewards distribution occurs
        uint256 accRewardPerShare; // Accumulated rewards per share, times 1e18 for precision
        uint256 depositFee;       // Deposit fee in basis points
        uint256 totalDeposited;   // Total amount deposited (tracks actual deposits)
        bool isActive;            // Pool status
    }

    // Constants for security
    uint256 public constant MAX_DEPOSIT_FEE = 500; // 5% maximum deposit fee
    uint256 public constant PRECISION = 1e18; // Increased precision
    
    // The reward token
    IERC20 public immutable rewardToken;
    
    // Reward tokens created per block
    uint256 public rewardPerBlock;

    // Info of each pool
    PoolInfo[] public poolInfo;
    
    // Track which LP tokens have pools to prevent duplicates
    mapping(address => bool) public poolExists;
    
    // Info of each user that stakes LP tokens
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    
    // Total allocation points. Must be the sum of all allocation points in all pools
    uint256 public totalAllocPoint = 0;
    
    // The block number when mining starts
    uint256 public immutable startBlock;
    
    // The block number when mining ends
    uint256 public endBlock;
    
    // Fee receiver
    address public feeReceiver;
    
    // Timelock for critical functions
    mapping(bytes32 => uint256) public timelock;
    uint256 public constant TIMELOCK_DURATION = 2 days;

    // Events
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, uint256 depositFee);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardPerBlockUpdated(uint256 oldRate, uint256 newRate);
    event PoolAdded(uint256 indexed pid, address indexed lpToken, uint256 allocPoint);
    event PoolUpdated(uint256 indexed pid, uint256 allocPoint, uint256 depositFee);
    event FeeReceiverUpdated(address oldReceiver, address newReceiver);
    event ActionQueued(bytes32 actionId, uint256 executeTime);

    constructor(
        IERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _endBlock,
        address _feeReceiver
    ) {
        require(address(_rewardToken) != address(0), "Invalid reward token");
        require(_feeReceiver != address(0), "Invalid fee receiver");
        require(_endBlock > _startBlock, "Invalid block range");
        require(_startBlock >= block.number, "Start block must be future");
        
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
        endBlock = _endBlock;
        feeReceiver = _feeReceiver;
    }

    modifier onlyActivePool(uint256 _pid) {
        require(_pid < poolInfo.length, "Pool does not exist");
        require(poolInfo[_pid].isActive, "Pool is not active");
        _;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new LP to the pool with security checks
    function add(
        uint256 _allocPoint, 
        IERC20 _lpToken, 
        uint256 _depositFee, 
        bool _withUpdate
    ) external onlyOwner {
        require(address(_lpToken) != address(0), "Invalid LP token");
        require(!poolExists[address(_lpToken)], "Pool already exists");
        require(_depositFee <= MAX_DEPOSIT_FEE, "Deposit fee too high");
        
        if (_withUpdate) {
            massUpdatePools();
        }
        
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        
        poolExists[address(_lpToken)] = true;
        
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accRewardPerShare: 0,
            depositFee: _depositFee,
            totalDeposited: 0,
            isActive: true
        }));
        
        uint256 pid = poolInfo.length - 1;
        emit PoolAdded(pid, address(_lpToken), _allocPoint);
    }

    // Update pool allocation points with timelock
    function set(
        uint256 _pid, 
        uint256 _allocPoint, 
        uint256 _depositFee, 
        bool _withUpdate
    ) external onlyOwner onlyActivePool(_pid) {
        require(_depositFee <= MAX_DEPOSIT_FEE, "Deposit fee too high");
        
        // For significant changes, require timelock
        if (_depositFee > poolInfo[_pid].depositFee) {
            bytes32 actionId = keccak256(abi.encodePacked("set", _pid, _allocPoint, _depositFee));
            
            if (timelock[actionId] == 0) {
                timelock[actionId] = block.timestamp + TIMELOCK_DURATION;
                emit ActionQueued(actionId, timelock[actionId]);
                return;
            }
            
            require(block.timestamp >= timelock[actionId], "Timelock not expired");
            timelock[actionId] = 0;
        }
        
        if (_withUpdate) {
            massUpdatePools();
        }
        
        totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].depositFee = _depositFee;
        
        emit PoolUpdated(_pid, _allocPoint, _depositFee);
    }

    // Deactivate a pool
    function deactivatePool(uint256 _pid) external onlyOwner onlyActivePool(_pid) {
        updatePool(_pid);
        poolInfo[_pid].isActive = false;
    }

    // Return reward multiplier over the given _from to _to block
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= endBlock) {
            return _to - _from;
        } else if (_from >= endBlock) {
            return 0;
        } else {
            return endBlock - _from;
        }
    }

    // View function to see pending rewards on frontend
    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        if (_pid >= poolInfo.length) return 0;
        
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = pool.totalDeposited;
        
        if (block.number > pool.lastRewardBlock && lpSupply != 0 && pool.isActive) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 reward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare = accRewardPerShare + (reward * PRECISION / lpSupply);
        }
        
        return (user.amount * accRewardPerShare / PRECISION) - user.rewardDebt;
    }

    // Update reward variables for all pools
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            if (poolInfo[pid].isActive) {
                updatePool(pid);
            }
        }
    }

    // Update reward variables of the given pool
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        
        uint256 lpSupply = pool.totalDeposited;
        if (lpSupply == 0 || pool.allocPoint == 0 || !pool.isActive) {
            pool.lastRewardBlock = block.number;
            return;
        }
        
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 reward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
        
        // Ensure contract has enough rewards
        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        if (reward > rewardBalance) {
            reward = rewardBalance;
        }
        
        pool.accRewardPerShare = pool.accRewardPerShare + (reward * PRECISION / lpSupply);
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant whenNotPaused onlyActivePool(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        updatePool(_pid);
        
        // Harvest existing rewards
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accRewardPerShare / PRECISION) - user.rewardDebt;
            if (pending > 0) {
                safeRewardTransfer(msg.sender, pending);
            }
        }
        
        if (_amount > 0) {
            // Transfer tokens with safety checks
            uint256 balanceBefore = pool.lpToken.balanceOf(address(this));
            pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);
            uint256 actualAmount = pool.lpToken.balanceOf(address(this)) - balanceBefore;
            
            uint256 depositFeeAmount = 0;
            if (pool.depositFee > 0) {
                depositFeeAmount = (actualAmount * pool.depositFee) / 10000;
                pool.lpToken.safeTransfer(feeReceiver, depositFeeAmount);
                actualAmount = actualAmount - depositFeeAmount;
            }
            
            user.amount = user.amount + actualAmount;
            pool.totalDeposited = pool.totalDeposited + actualAmount;
            user.lastDepositTime = block.timestamp;
            
            emit Deposit(msg.sender, _pid, actualAmount, depositFeeAmount);
        }
        
        user.rewardDebt = user.amount * pool.accRewardPerShare / PRECISION;
    }

    // Withdraw LP tokens from MasterChef
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant onlyActivePool(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "Insufficient balance");
        
        updatePool(_pid);
        
        // Harvest rewards
        uint256 pending = (user.amount * pool.accRewardPerShare / PRECISION) - user.rewardDebt;
        if (pending > 0) {
            safeRewardTransfer(msg.sender, pending);
        }
        
        if (_amount > 0) {
            user.amount = user.amount - _amount;
            pool.totalDeposited = pool.totalDeposited - _amount;
            pool.lpToken.safeTransfer(msg.sender, _amount);
        }
        
        user.rewardDebt = user.amount * pool.accRewardPerShare / PRECISION;
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY
    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        require(_pid < poolInfo.length, "Pool does not exist");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        uint256 amount = user.amount;
        
        // Reset user state
        user.amount = 0;
        user.rewardDebt = 0;
        
        // Update pool state
        if (amount > 0) {
            pool.totalDeposited = pool.totalDeposited - amount;
            pool.lpToken.safeTransfer(msg.sender, amount);
        }
        
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe reward transfer function
    function safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 rewardBal = rewardToken.balanceOf(address(this));
        if (_amount > rewardBal) {
            rewardToken.safeTransfer(_to, rewardBal);
        } else {
            rewardToken.safeTransfer(_to, _amount);
        }
    }

    // Update reward per block with timelock
    function updateRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        bytes32 actionId = keccak256(abi.encodePacked("updateRewardPerBlock", _rewardPerBlock));
        
        if (timelock[actionId] == 0) {
            timelock[actionId] = block.timestamp + TIMELOCK_DURATION;
            emit ActionQueued(actionId, timelock[actionId]);
            return;
        }
        
        require(block.timestamp >= timelock[actionId], "Timelock not expired");
        timelock[actionId] = 0;
        
        massUpdatePools();
        
        uint256 oldRate = rewardPerBlock;
        rewardPerBlock = _rewardPerBlock;
        
        emit RewardPerBlockUpdated(oldRate, _rewardPerBlock);
    }
    
    // Update end block
    function updateEndBlock(uint256 _endBlock) external onlyOwner {
        require(_endBlock > block.number, "End block must be future");
        require(_endBlock > startBlock, "End block must be after start");
        endBlock = _endBlock;
    }
    
    // Update fee receiver
    function updateFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "Invalid fee receiver");
        address oldReceiver = feeReceiver;
        feeReceiver = _feeReceiver;
        emit FeeReceiverUpdated(oldReceiver, _feeReceiver);
    }
    
    // Emergency pause
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Recover wrong tokens sent to contract
    function recoverWrongTokens(address _tokenAddress, uint256 _tokenAmount) external onlyOwner {
        require(_tokenAddress != address(rewardToken), "Cannot recover reward token");
        
        // Check it's not an active staking token
        for (uint256 pid = 0; pid < poolInfo.length; ++pid) {
            require(address(poolInfo[pid].lpToken) != _tokenAddress, "Cannot recover staking token");
        }
        
        IERC20(_tokenAddress).safeTransfer(msg.sender, _tokenAmount);
    }
}