// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;


import "@openzeppelin/contracts/access/AccessControl.sol";


contract CounterCall is AccessControl {

    // Роль моста
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    // Счетчик предложений для голосования
    uint256 [] public Proposal;

    constructor(){
        _setupRole(DAO_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function addProposal(uint256 id) onlyRole(DAO_ROLE) external {
        Proposal.push(id);
    }
}
