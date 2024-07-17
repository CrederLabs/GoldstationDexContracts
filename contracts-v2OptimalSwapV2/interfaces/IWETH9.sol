pragma solidity >=0.5.0;

interface IWETH9 {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
    function approve(address guy, uint wad) external returns (bool);
    function balanceOf(address owner) external view returns (uint);
}
