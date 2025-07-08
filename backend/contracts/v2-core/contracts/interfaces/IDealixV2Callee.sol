pragma solidity >=0.5.0;

interface IDealixV2Callee {
    function DealixV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external;
}
