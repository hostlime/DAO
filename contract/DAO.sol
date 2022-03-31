// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TokenDao.sol";



contract DAO  is AccessControl {

    enum Status {
        active,
        finished
    }
    struct _Proposal {
        address recipient; 
        string description;
        uint256 endTime;        // время завершения 
        uint256 quorum;         // Количество проголовавших
        uint256 voteSupport;    // Количество токенов ЗА
        uint256 voteAgainst;    // Количество токенов ПРОТИВ
        bytes callData;
    }
    struct _Proposals {
        _Proposal proposal;
        mapping (address => bool) userVote;
    }

    struct _Partisipant {
        uint256 amount; 
        uint256[] votingProposal;
    }

    bytes32 public constant PROPOSAL_ROLE = keccak256("PROPOSAL_ROLE");

    // Счетчик nonce для уникализации подписей
	using Counters for Counters.Counter;
    Counters.Counter private ProposalsCnt;

    uint256 private MinimumQuorum;
    uint256 private DebPerDuration;
    uint256 private RequisiteMajority;
    
    TokenDAO public Token;

    mapping (uint256 => _Proposals) public Proposals;           // Предложения для голосования
    mapping (address => _Partisipant) public Partisipants;      // Участники голосования


    constructor (address _Token, uint256 _minimumQuorum, uint256 _debPerDuration, uint256 _requisiteMajority) {
        Token = TokenDAO(_Token);
        MinimumQuorum   = _minimumQuorum;
        DebPerDuration  = _debPerDuration;
        RequisiteMajority   = _requisiteMajority;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function deposit(uint256 amount) external {
        Token.transferFrom(msg.sender, address(this), amount);
        Partisipants[msg.sender].amount += amount;
    }

    function addProposal(
        bytes calldata _callData, 
        address _recipient, 
        string memory _description
        ) external onlyRole(PROPOSAL_ROLE){
    	uint cnt = ProposalsCnt.current();
        
        _Proposal storage Proposal = Proposals[cnt].proposal;
        Proposal = _Proposal({
            callData: _callData, 
            recipient: _recipient, 
            endTime:  block.timestamp + DebPerDuration,
            quorum: 0,
            voteSupport: 0,
            voteAgainst: 0,
            description: _description
        });

        ProposalsCnt.increment();    
    }

    function vote(uint256 id, bool supportAgainst) external{
        //require(Proposals[id].userVote[msg.sender] == true , "You are not proposal");
        _Proposal storage Proposal = Proposals[id].proposal;
        require(Proposal.endTime > block.timestamp, "The proposal is ended");
        require(Proposals[id].userVote[msg.sender] == false , "You are already vote");

        Proposals[id].userVote[msg.sender] = true;

        Proposal.quorum++;
        if(supportAgainst){
            Proposal.voteSupport += Partisipants[msg.sender].amount;
        }else{
            Proposal.voteAgainst += Partisipants[msg.sender].amount;
        }
    }

    function finishProposal(uint256 id) external{
        require(Proposals[id].endTime >= block.timestamp, "The proposal is not ended");
        //require(
    
    }

}

/*
Необходимы реализовать смарт контракт, который будет вызывать сигнатуру функции 
посредством голосования пользователей.
-Написать контракт DAO
-Написать полноценные тесты к контракту
-Написать скрипт деплоя
-Задеплоить в тестовую сеть
-Написать таск на vote, addProposal, finish, deposit.
-Верифицировать контракт
Требования
-Для участия в голосовании пользователям необходимо внести  токены для голосования. 
-Вывести токены с DAO, пользователи могут только после окончания всех голосований, 
в которых они участвовали. 
-Голосование может предложить только председатель.
-Для участия в голосовании пользователю необходимо внести депозит, один токен один голос. 
-Пользователь может участвовать в голосовании одними и теми же токенами, 
то есть пользователь внес 100 токенов он может участвовать в голосовании №1 всеми 100 токенами 
и в голосовании №2 тоже всеми 100 токенами.
-Финишировать голосование может любой пользователь по прошествии определенного количества 
времени установленном в конструкторе.
Ссылки:
презентация:
https://docs.google.com/presentation/d/1U9iOUNTx2kMJzoPa_v3LnVbf0EGK0Lbrvoa9aewNvLg/edit?usp=sharing 
WEB3 
https://web3js.readthedocs.io/en/v1.2.11/web3-eth-abi.html 
ethers
https://docs.ethers.io/v5/api/utils/abi/coder/ 
*/