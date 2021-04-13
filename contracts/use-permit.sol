// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.2;

// token interface
abstract contract permitToken {
    function permit(
        address user,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external virtual;

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external virtual returns (bool);
}

//contract that use one call to send permit data and do transfer on token
contract usePermit {
    constructor() {}

    function transferByPermit(
        address token,
        address user,
        address spender,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool) {
        require(spender == address(this), "Need appove this contract");
        permitToken(token).permit(user, spender, value, deadline, v, r, s);
        return permitToken(token).transferFrom(user, to, value);
    }
}
