// contracts/dealix/SimpleBonusRewarder.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMasterChef {
    function userInfo(uint256 pid, address user) external view returns (uint256 amount, uint256 rewardDebt, uint256 boostMultiplier, uint256 lastDepositTime);
}

/**
 * @title SimpleBonusRewarder
 * @dev Simple rewarder that gives bonus tokens on top of MasterChef rewards
 */
contract SimpleBonusRewarder is Ownable {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable bonusToken;
    IMasterChef public immutable masterChef;
    uint256 public immutable pid;
    uint256 public bonusMultiplier = 100; // 1:1 bonus ratio by default
    
    mapping(address => uint256) public userBonusDebt;
    uint256 public accBonusPerShare;
    uint256 public lastRewardTime;
    uint256 public bonusPerSecond;
    
    event BonusReward(address indexed user, uint256 amount);
    
    constructor(
        IERC20 _bonusToken,
        IMasterChef _masterChef,
        uint256 _pid,
        uint256 _bonusPerSecond
    ) {
        bonusToken = _bonusToken;
        masterChef = _masterChef;
        pid = _pid;
        bonusPerSecond = _bonusPerSecond;
        lastRewardTime = block.timestamp;
    }
    
    function onReward(uint256 _pid, address _user, uint256 _rewardAmount) external {
        require(msg.sender == address(masterChef), "Only MasterChef");
        require(_pid == pid, "Wrong pool");
        
        uint256 bonusAmount = _rewardAmount.mul(bonusMultiplier).div(100);
        
        if (bonusAmount > 0) {
            uint256 balance = bonusToken.balanceOf(address(this));
            if (bonusAmount > balance) {
                bonusAmount = balance;
            }
            
            if (bonusAmount > 0) {
                bonusToken.safeTransfer(_user, bonusAmount);
                emit BonusReward(_user, bonusAmount);
            }
        }
    }
    
    function setBonusMultiplier(uint256 _multiplier) external onlyOwner {
        require(_multiplier <= 1000, "Too high"); // Max 10x
        bonusMultiplier = _multiplier;
    }
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = bonusToken.balanceOf(address(this));
        bonusToken.safeTransfer(owner(), balance);
    }
}