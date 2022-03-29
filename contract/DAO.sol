// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TokenDao.sol";



contract DAO  is AccessControl {

    struct Proposal {
        address recipient; 
        string description;
        uint256 startTime;
        bytes callData;
    }
    
	using Counters for Counters.Counter;
    Counters.Counter private ProposalsCnt;

    uint256 private MinimumQuorum;
    uint256 private DebPerDuration;
    uint256 private RequisiteMajority;
    
    TokenDAO public Token;

    mapping (uint256 => Proposal) public Proposals;
    constructor (address _Token, uint256 _minimumQuorum, uint256 _debPerDuration, uint256 _requisiteMajority) {
        Token = TokenDAO(_Token);
        MinimumQuorum   = _minimumQuorum;
        DebPerDuration  = _debPerDuration;
        RequisiteMajority   = _requisiteMajority;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deposit(uint256 amount) external {

    }

    function addProposal(
        bytes calldata _callData, 
        address _recipient, 
        string memory _description
        ) external onlyRole(DEFAULT_ADMIN_ROLE){
    	uint cnt = ProposalsCnt.current();

        Proposals[cnt] = Proposal({
            callData: _callData, 
            recipient: _recipient, 
            startTime:  block.timestamp,
            description: _description
        });

        ProposalsCnt.increment();    
    }

    function vote(uint256 id, uint256 supportAgainst) external{

    }

    function finishProposal(uint256 id) external{

    }

}