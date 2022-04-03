// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DAO is AccessControl {
    struct Proposal {
        address recipient; // Адрес смартконтракта, в котором будем вызывать функцию с сигнатурой callData
        uint256 endTime; // время завершения
        uint256 voteSupport; // Количество токенов ЗА
        uint256 voteAgainst; // Количество токенов ПРОТИВ
        bytes callData; // Вызываемая сигнатура функции контракта recipient
        string description; // Описание предложения
        bool complete; // Флаг завершения голосования
    }

    // Структура данных о предложении председателя
    struct Proposals {
        Proposal proposal; // Данные о предложении председателя
        mapping(address => bool) userVote; // Маппинг адресов проголосовавших пользователей за предложение
    }
    // Структура данных о пользователе
    struct Partisipant {
        uint256 amount; // Количество токенов, которые занес Partisipant
        uint256 timeLastProposalEnd; // Время заверения голосования для последнего предложения, в котором участвовал участник
    }

    // Роль председателя ДАО
    bytes32 public constant PROPOSAL_ROLE = keccak256("PROPOSAL_ROLE");

    // Счетчик предложений для голосования
    using Counters for Counters.Counter;
    Counters.Counter private proposalsCnt;

    uint256 private _minimumQuorum; // Минимальное количество токенов
    uint256 private _debPerDuration; // Длительность голосования (сек)

    address private _token; // Токен DAO

    mapping(uint256 => Proposals) public proposals; // Предложения для голосования
    mapping(address => Partisipant) public partisipants; // Участники голосования

    event AddProposal(
        uint256 indexed cnt,
        address indexed sender,
        address indexed recipient,
        uint256 startTime,
        uint256 endTime,
        string description
    );
    event Deposit(address indexed partisipant, uint256 amount);
    event Vote(
        uint256 indexed id,
        address indexed partisipant,
        bool indexed supportAgainst
    );
    event Withdraw(address indexed sender, uint256 amount);
    event FinishProposal(uint256 indexed id, bool success);

    // Только существующие id
    modifier onlyIdExist(uint256 id) {
        require(
            id < proposalsCnt.current(),
            "DAO: Proposal with this id doesn't exist"
        );
        _;
    }
    // Есть токены у пользователя?
    modifier onlyHasToken() {
        require(
            partisipants[msg.sender].amount > 0,
            "DAO: You dont have tokens on DAO"
        );
        _;
    }

    constructor(
        address _token_,
        uint256 _minimumQuorum_,
        uint256 _debPerDuration_,
        address _chairPerson
    ) {
        _token = _token_;
        _minimumQuorum = _minimumQuorum_;
        _debPerDuration = _debPerDuration_;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(PROPOSAL_ROLE, _chairPerson);
    }

    function deposit(uint256 amount) external {
        // переводим на контракт
        IERC20(_token).transferFrom(msg.sender, address(this), amount);
        // Учитываем количество внесенных токенов пользователем
        partisipants[msg.sender].amount += amount;

        emit Deposit(msg.sender, amount);
    }

    function withdraw() external onlyHasToken {
        require(
            partisipants[msg.sender].timeLastProposalEnd < block.timestamp,
            "DAO: Your tokens are reserved"
        );
        // Возвращаем пользователю его токены
        IERC20(_token).transfer(msg.sender, partisipants[msg.sender].amount);

        emit Withdraw(msg.sender, partisipants[msg.sender].amount);

        // Зануляем баланс
        partisipants[msg.sender].amount = 0;
    }

    function addProposal(
        bytes calldata _callData,
        address _recipient,
        string memory _description
    ) external onlyRole(PROPOSAL_ROLE) {
        uint256 cnt = proposalsCnt.current();

        proposals[cnt].proposal = Proposal({
            recipient: _recipient,
            description: _description,
            endTime: block.timestamp + _debPerDuration,
            voteSupport: 0,
            voteAgainst: 0,
            callData: _callData,
            complete: false
        });

        proposalsCnt.increment();

        emit AddProposal(
            cnt,
            msg.sender,
            _recipient,
            block.timestamp,
            proposals[cnt].proposal.endTime,
            _description
        );
    }

    function vote(uint256 id, bool supportAgainst)
        external
        onlyIdExist(id)
        onlyHasToken
    {
        Proposal storage proposal = proposals[id].proposal;
        Partisipant storage partisipant = partisipants[msg.sender];
        // Предложение еще активно?
        require(
            proposal.endTime > block.timestamp,
            "DAO: The proposal is ended"
        );
        // устраняем повторные голосования
        require(
            proposals[id].userVote[msg.sender] == false,
            "DAO: You are already vote"
        );

        proposals[id].userVote[msg.sender] = true;

        // учитываем голос за и против
        if (supportAgainst) {
            proposal.voteSupport += partisipant.amount;
        } else {
            proposal.voteAgainst += partisipant.amount;
        }

        // Запоминаем время последнего голосования для пользователя,
        // чтобы потом отдавать токены по завершению всех голосований
        partisipant.timeLastProposalEnd = block.timestamp + _debPerDuration;

        emit Vote(id, msg.sender, supportAgainst);
    }

    function finishProposal(uint256 id) external onlyIdExist(id) {
        Proposal memory proposal = proposals[id].proposal;
        bool success;

        require(
            proposal.endTime < block.timestamp,
            "DAO: The proposal is not ended"
        );

        // Предложение председателя истекло ?
        require(
            proposal.complete == false,
            "DAO: The proposal already completed"
        );

        // Количество токенов ЗА должно быть больше чем против
        if (
            (proposal.voteSupport > proposal.voteAgainst) && // Больше голосов ЗА?
            ((proposal.voteSupport + proposal.voteAgainst) >= _minimumQuorum) // Общее кол-во голосов больше минимума?
        ) {
            // Вызываем наш колл с сигнатуров из callData
            (success, ) = proposal.recipient.call(proposal.callData);
        }
        // пишем в storage а не в proposal.complete
        proposals[id].proposal.complete = true; // выставляем флаг завершения предложения

        emit FinishProposal(id, success);
    }
}
