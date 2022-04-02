// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CounterCall is AccessControl {
    // Роль моста
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    uint256 public counter;

    constructor() {
        _setupRole(DAO_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function incCounter() external onlyRole(DAO_ROLE) {
        counter++;
    }

    function makeApiCall() external pure returns (bytes memory) {
        return abi.encodeWithSignature("addProposal()");
    }
}
