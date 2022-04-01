// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract DAO  is AccessControl {

    enum Status {
        active,
        finished
    }
    struct _Proposal {
        address recipient;      // Адрес смартконтракта, в котором будем вызывать функцию с сигнатурой callData
        string description;     // Описание предложения
        uint256 endTime;        // время завершения 
        uint256 voteSupport;    // Количество токенов ЗА
        uint256 voteAgainst;    // Количество токенов ПРОТИВ
        bytes callData;         // сигнатура функции
    }
    struct _Proposals {
        _Proposal proposal;
        mapping (address => bool) userVote;
    }

    struct _Partisipant {
        uint256 amount; 
        uint256 timeLastProposalEnd;   // Время заверения голосования для последнего предложения, в котором участвовал участник
    }

    bytes32 public constant PROPOSAL_ROLE = keccak256("PROPOSAL_ROLE");

    // Счетчик предложений для голосования
	using Counters for Counters.Counter;
    Counters.Counter private ProposalsCnt;

    uint256 private MinimumQuorum;      // Минимальное количество токенов
    uint256 private DebPerDuration;     // Длительность голосования (сек)
    uint256 private totalSupply;        // Общее количество токенов, которые занесены в ДАО

    address private _Token;             // Токен DAO

    mapping (uint256 => _Proposals) public Proposals;           // Предложения для голосования
    mapping (address => _Partisipant) public Partisipants;      // Участники голосования


    constructor (address _Token_, uint256 _minimumQuorum, uint256 _debPerDuration, address _chairPerson) {
        _Token = _Token_;
        MinimumQuorum   = _minimumQuorum;
        DebPerDuration  = _debPerDuration;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PROPOSAL_ROLE, _chairPerson);
    }

    function deposit(uint256 amount) external {
        // переводим на контракт
        IERC20(_Token).transferFrom(msg.sender, address(this), amount);
        // Учитываем количество внесенных токенов пользователем
        Partisipants[msg.sender].amount += amount;
        totalSupply += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw() external {
        require(Partisipants[msg.sender].amount > 0, "DAO: You dont have tokens on DAO");
        require(Partisipants[msg.sender].timeLastProposalEnd > block.timestamp, "DAO: Your tokens are reserved in voting");
        // Возвращаем пользовател его токены
        IERC20(_Token).transfer(msg.sender, Partisipants[msg.sender].amount);
        totalSupply -= Partisipants[msg.sender].amount;
        // Удаляем информацию о пользователе
        delete(Partisipants[msg.sender]);

        emit Withdraw(msg.sender, Partisipants[msg.sender].amount);
    }

    function addProposal(
        bytes calldata _callData, 
        address _recipient, 
        string memory _description
        ) external onlyRole(PROPOSAL_ROLE){

    	uint cnt = ProposalsCnt.current();
        
        Proposals[cnt].proposal = _Proposal({
            recipient: _recipient, 
            description: _description,
            endTime:  block.timestamp + DebPerDuration,
            voteSupport: 0,
            voteAgainst: 0,
            callData: _callData
        });

        ProposalsCnt.increment();  

        emit AddProposal(cnt, msg.sender, _recipient, block.timestamp, Proposals[cnt].proposal.endTime, _description);  
    }

    function vote(uint256 id, bool supportAgainst) external{
        require(id < ProposalsCnt.current(), "DAO: Proposal with this id does not exist");
    
        _Proposal storage Proposal = Proposals[id].proposal;
        _Partisipant storage Partisipant = Partisipants[msg.sender];

        require(Proposal.endTime > block.timestamp, "DAO: The proposal is ended");
        // устраняем повторные голосования
        require(Proposals[id].userVote[msg.sender] == false , "DAO: You are already vote");
        Proposals[id].userVote[msg.sender] = true;

        // учитываем голос за и против
        if(supportAgainst){
            Proposal.voteSupport += Partisipant.amount;
        }else{
            Proposal.voteAgainst += Partisipant.amount;
        }

        // Запоминаем время последнего голосования для пользователя, 
        // чтобы потом отдавать токены по завершению всех голосований
        Partisipant.timeLastProposalEnd = block.timestamp + DebPerDuration;

        emit Vote(id, msg.sender, supportAgainst);
    }

    function finishProposal(uint256 id) external {
        _Proposal memory Proposal = Proposals[id].proposal;
        // Предложение председателя истекло ?
        require(Proposal.endTime >= block.timestamp, "DAO: The proposal is not ended");
        // Суммартное количество токенов больше минимального порога?
        require((Proposal.voteSupport + Proposal.voteAgainst) >= MinimumQuorum, "DAO: Not enought votes for this proposal");
        // Количество токенов ЗА должно быть больше чем против
        require(Proposal.voteSupport > Proposal.voteAgainst, "DAO: Support less than against");

        // Вызываем наш колл с сигнатуров из callData
        (bool success, ) = Proposal.recipient.call(Proposal.callData);
        require(success,"DAO: ERROR call function");

        delete(Proposals[id]);
    }

    event AddProposal(
        uint256 indexed cnt, 
        address indexed sender, 
        address indexed recipient,
        uint256 startTime,
        uint256 endTime, 
        string description
        ); 
    event Deposit(address indexed partisipant, uint256 amount);
    event Vote(uint256 indexed  id,address indexed partisipant, bool indexed supportAgainst);
    event Withdraw(address indexed sender, uint256 amount);
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