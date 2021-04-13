// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.2;

//mock upgraded token contract
contract upgradedToken {
    address public immutable oldToken;

    constructor(address _old) {
        oldToken = _old;
    }

    modifier onlyOldToken() {
        require(msg.sender == oldToken, "Can be called only from old contract");
        _;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function transferByLegacy(
        address from,
        address to,
        uint256 amount
    ) external onlyOldToken returns (bool) {
        emit Transfer(from, to, amount);
        return true;
    }

    function transferFromByLegacy(
        address spender,
        address from,
        address to,
        uint256 amount
    ) external onlyOldToken returns (bool) {
        emit Approval(from, spender, amount); //wrong numbers - only mock
        emit Transfer(from, to, amount);
        return true;
    }

    function approveByLegacy(
        address account,
        address spender,
        uint256 amount
    ) external onlyOldToken {
        emit Approval(account, spender, amount);
        return;
    }

    function balanceOf(address) external returns (uint256) {
        return 7777;
    }

    function allowance(address, address) external returns (uint256) {
        return 8888;
    }

    function totalSupply() external returns (uint256) {
        return 9999;
    }
}
