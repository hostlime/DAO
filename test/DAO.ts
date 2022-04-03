import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// Функция для получения timestamp блока
async function getTimestampBlock(bn: any) {
  return (await ethers.provider.getBlock(bn)).timestamp
}

describe("DAO", function () {
  let proposalAdr: SignerWithAddress;  // Председатель
  let daoMaker: SignerWithAddress; // Создает конракты
  let adr1: SignerWithAddress;
  let adr2: SignerWithAddress;
  let adr3: SignerWithAddress;
  const defaultUserBalance = ethers.utils.parseEther("100");

  let token: any;
  let DAO: any;
  let counterCall: any;

  const minimumQuorum = ethers.utils.parseEther("1");
  const debPerDuration = 3 * 24 * 60 * 60; // три дня

  const userDeposit = ethers.utils.parseEther("0.5");

  beforeEach(async () => {
    [proposalAdr, daoMaker, adr1, adr2, adr3] = await ethers.getSigners();

    // Деплоим контракт токена
    const Token = await ethers.getContractFactory("TokenDAO")
    token = await Token.connect(daoMaker).deploy("TokenDAO", "DAO")
    await token.connect(daoMaker).deployed()

    // Контракт DAO
    const DAO_ = await ethers.getContractFactory("DAO");
    DAO = await DAO_.connect(daoMaker).deploy(
      token.address,
      minimumQuorum,
      debPerDuration,
      proposalAdr.address
    );
    await DAO.connect(daoMaker).deployed();

    // Вызываемый конракт COUNTER для проверки вызова call
    const CounterCall = await ethers.getContractFactory("CounterCall");
    counterCall = await CounterCall.connect(daoMaker).deploy();
    await counterCall.connect(daoMaker).deployed();
    // Выдаем роль DAO_ROLE для конракта DAO
    let DAO_ROLE = await counterCall.connect(daoMaker).DAO_ROLE();
    await counterCall.grantRole(DAO_ROLE, DAO.address);

    // Отправляем пользователям токены 
    token.connect(daoMaker).transfer(adr1.address, defaultUserBalance)
    token.connect(daoMaker).transfer(adr2.address, defaultUserBalance)
    token.connect(daoMaker).transfer(adr3.address, defaultUserBalance)
    // Апрувим токены для контракта дао
    token.connect(adr1).approve(DAO.address, defaultUserBalance)
    token.connect(adr2).approve(DAO.address, defaultUserBalance)
    token.connect(adr3).approve(DAO.address, defaultUserBalance)
  });

  // Проверяем все контракты на деплой
  it('Checking that contract token is deployed', async () => {
    assert(token.address);
  });
  // Проверяем все контракты на деплой
  it('Checking that contract counterCall is deployed', async () => {
    assert(counterCall.address);
  });
  // Проверяем все контракты на деплой
  it('Checking that contract DAO is deployed', async () => {
    assert(DAO.address);
  });
  // проверка, что у DAO есть роль DAO_ROLE и контракт может минтить и сжигать токены
  it('Checking that DAO has role a DAO_ROLE', async () => {
    const DAO_ROLE = await counterCall.connect(daoMaker).DAO_ROLE();
    const result = await counterCall.hasRole(DAO_ROLE, DAO.address);
    expect(result).to.be.equal(true);
  });

  it('Checking that proposal has role a PROPOSAL_ROLE', async () => {
    const PROPOSAL_ROLE = await DAO.connect(daoMaker).PROPOSAL_ROLE();
    const result = await DAO.hasRole(PROPOSAL_ROLE, proposalAdr.address);
    expect(result).to.be.equal(true);
  });

  it('Checking function deposit()', async () => {
    const tx = await DAO.connect(adr1).deposit(userDeposit);

    // Проверяем баланс в массиве
    const partisipant = await DAO.connect(adr1).partisipants(adr1.address);
    expect(partisipant.amount).to.be.equal(userDeposit);

    // Проверяем эвент Deposit
    await expect(tx).to.emit(DAO, "Deposit")
      .withArgs(adr1.address, userDeposit);
  });
  it('Checking function withdraw()', async () => {
    const ballance = await token.balanceOf(adr1.address)
    await DAO.connect(adr1).deposit(userDeposit);

    // Проверили что токены ушли
    expect(await token.balanceOf(adr1.address))
      .to.be.equal(ballance.sub(userDeposit));

    // Проверяем что токены на контракте
    expect(await token.balanceOf(DAO.address))
      .to.be.equal(userDeposit);

    // Выводим токены
    const tx = await DAO.connect(adr1).withdraw();

    // Проверяем ЭМИТ
    await expect(tx).to.emit(DAO, "Withdraw")
      .withArgs(
        adr1.address,
        userDeposit
      );
    // Проверяем баланс контракта и юзера
    expect(await token.balanceOf(DAO.address))
      .to.be.equal(0);
    expect(await token.balanceOf(adr1.address))
      .to.be.equal(ballance);

    // Проверка onlyHasToken, пытаемсявывести еще раз
    await expect(DAO.connect(adr1).withdraw())
      .to.be.revertedWith(
        "DAO: You dont have tokens on DAO"
      );
  });
  it('Checking function withdraw() during and after proposal', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const description = "First Proposal";
    // Создаем предложение
    await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Заносим токены в DAO
    await DAO.connect(adr1).deposit(userDeposit);

    // голосуем ЗА
    await DAO.connect(adr1).vote(0, true)

    // Пытаемся вывести токены до завершения голосования
    await expect(DAO.connect(adr1).withdraw())
      .to.be.revertedWith(
        "DAO: Your tokens are reserved"
      );

    // Пропускаем три дня
    await ethers.provider.send("evm_increaseTime", [debPerDuration]);
    await ethers.provider.send("evm_mine", []);

    // Выводим токены
    const tx = await DAO.connect(adr1).withdraw();

    // Проверяем ЭМИТ
    await expect(tx).to.emit(DAO, "Withdraw")
      .withArgs(
        adr1.address,
        userDeposit
      );
  });
  it('Checking function addProposal()', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const description = "First Proposal";

    // Убеждаемся что только председатель может создавать предложения 
    await expect(DAO.connect(adr1)
      .addProposal(callData, adr1.address, description))
      .to.be.revertedWith(
        "AccessControl: account"
      );

    const tx = await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Проверяем предложение в маппинге
    const proposal = await DAO.proposals(0)
    expect(proposal.recipient).to.be.equal(counterCall.address)
    expect(proposal.description).to.be.equal(description)
    expect(proposal.voteSupport).to.be.equal(0)
    expect(proposal.voteAgainst).to.be.equal(0)
    expect(proposal.callData).to.be.equal(callData)
    // Проверяем время завершения аукциона
    const txTime = await getTimestampBlock(tx.blockNumber)
    expect(proposal.endTime).to.be.equal(txTime + debPerDuration)

    // Проверяем эвент AddProposal
    await expect(tx).to.emit(DAO, "AddProposal")
      .withArgs(
        0,
        proposalAdr.address,
        counterCall.address,
        txTime,
        txTime + debPerDuration,
        description
      );
  });

  it('Checking function vote()', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const description = "First Proposal";
    // Создаем предложение
    await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Заносим токены в DAO
    await DAO.connect(adr1).deposit(userDeposit);

    // Проверим что можно голосовать только за существующий ID
    await expect(DAO.connect(adr1)
      .vote(99, true))
      .to.be.revertedWith(
        "DAO: Proposal with this id doesn't exist"
      );

    // голосуем ЗА
    const tx = await DAO.connect(adr1).vote(0, true)
    // Проверяем ЕВЕНТ
    await expect(tx).to.emit(DAO, "Vote")
      .withArgs(
        0,
        adr1.address,
        true
      );
    // Проверяем данные в маппинге предложения
    const proposal = await DAO.proposals(0)
    expect(proposal.voteSupport).to.be.equal(userDeposit)
    expect(proposal.voteAgainst).to.be.equal(0)

    // Проверяем данные в маппинге пользователя
    const partisipant = await DAO.partisipants(adr1.address)
    expect(partisipant.amount).to.be.equal(userDeposit)
    // Получаем время блока
    const txTime = await getTimestampBlock(tx.blockNumber)
    expect(partisipant.timeLastProposalEnd).to.be.equal(txTime + debPerDuration)

    // Проверяем require повторного голосования
    await expect(DAO.connect(adr1)
      .vote(0, true))
      .to.be.revertedWith(
        "DAO: You are already vote"
      );
    // Проверяем require голосования после 3х суток
    await ethers.provider.send("evm_increaseTime", [debPerDuration]);
    await ethers.provider.send("evm_mine", []);

    // Проверяем require повторного голосования
    await expect(DAO.connect(adr1)
      .vote(0, true))
      .to.be.revertedWith(
        "DAO: The proposal is ended"
      );

  });
  it('Checking function finishProposal(id) vote > 50%', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const beforeCounter = await counterCall.connect(adr1).counter();


    const description = "First Proposal";
    // Создаем предложение
    await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Заносим токены в DAO
    await DAO.connect(adr1).deposit(userDeposit);
    // Заносим токены в DAO
    await DAO.connect(adr2).deposit(userDeposit);
    // Заносим токены в DAO
    await DAO.connect(adr3).deposit(userDeposit);

    // голосуем ЗА и против
    await DAO.connect(adr1).vote(0, true)
    await DAO.connect(adr2).vote(0, false)
    await DAO.connect(adr3).vote(0, true)

    // Проверяем require и пытаемся завершитьраньше времени
    await expect(DAO.connect(adr1)
      .finishProposal(0))
      .to.be.revertedWith(
        "DAO: The proposal is not ended"
      )

    // Проверяем require с несуществующим id
    await expect(DAO.connect(adr1)
      .finishProposal(99))
      .to.be.revertedWith(
        "DAO: Proposal with this id doesn't exist"
      )

    // Смещаем время на 3дня
    await ethers.provider.send("evm_increaseTime", [debPerDuration])
    await ethers.provider.send("evm_mine", [])

    // Завершаем предложение
    const tx = await DAO.connect(adr1).finishProposal(0)

    await expect(tx).to.emit(DAO, "FinishProposal")
      .withArgs(
        0,
        true
      )

    // Убеждаемся что колл был вызван 
    await expect(await counterCall.connect(adr1).counter()).to.be.equal(beforeCounter + 1)

    // Проверяем статус завершения предложения в маппинге
    const proposal = await DAO.proposals(0)
    expect(proposal.complete).to.be.equal(true)


    // Проверяем повторное завершение 
    await expect(DAO.connect(adr1)
      .finishProposal(0))
      .to.be.revertedWith(
        "DAO: The proposal already completed"
      )
  });
  it('Checking function finishProposal(id) vote < 50%', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const beforeCounter = await counterCall.connect(adr1).counter();


    const description = "First Proposal";
    // Создаем предложение
    await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Заносим токены в DAO
    await DAO.connect(adr1).deposit(userDeposit);
    // Заносим токены в DAO
    await DAO.connect(adr2).deposit(userDeposit);
    // Заносим токены в DAO
    await DAO.connect(adr3).deposit(userDeposit);

    // голосуем ЗА и против
    await DAO.connect(adr1).vote(0, true)
    await DAO.connect(adr2).vote(0, false)
    await DAO.connect(adr3).vote(0, false)

    // Смещаем время на 3дня
    await ethers.provider.send("evm_increaseTime", [debPerDuration])
    await ethers.provider.send("evm_mine", [])

    // Завершаем предложение
    const tx = await DAO.connect(adr1).finishProposal(0)

    await expect(tx).to.emit(DAO, "FinishProposal")
      .withArgs(
        0,
        false
      )

    // Убеждаемся что колл НЕ был вызван 
    await expect(await counterCall.connect(adr1).counter()).to.be.equal(beforeCounter)

    // Проверяем статус завершения предложения в маппинге
    const proposal = await DAO.proposals(0)
    expect(proposal.complete).to.be.equal(true)

    // Проверяем повторное завершение 
    await expect(DAO.connect(adr1)
      .finishProposal(0))
      .to.be.revertedWith(
        "DAO: The proposal already completed"
      )
  });

  it('Checking function finishProposal(id) vote < minimumQuorum', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const beforeCounter = await counterCall.connect(adr1).counter();


    const description = "First Proposal";
    // Создаем предложение
    await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Заносим токены в DAO
    await DAO.connect(adr1).deposit(userDeposit);

    // голосуем ЗА и против
    await DAO.connect(adr1).vote(0, false)

    // Смещаем время на 3дня
    await ethers.provider.send("evm_increaseTime", [debPerDuration])
    await ethers.provider.send("evm_mine", [])

    // Завершаем предложение
    const tx = await DAO.connect(adr1).finishProposal(0)

    await expect(tx).to.emit(DAO, "FinishProposal")
      .withArgs(
        0,
        false
      )

    // Убеждаемся что колл НЕ был вызван 
    await expect(await counterCall.connect(adr1).counter()).to.be.equal(beforeCounter)

    // Проверяем статус завершения предложения в маппинге
    const proposal = await DAO.proposals(0)
    expect(proposal.complete).to.be.equal(true)

    // Проверяем повторное завершение 
    await expect(DAO.connect(adr1)
      .finishProposal(0))
      .to.be.revertedWith(
        "DAO: The proposal already completed"
      )
  });
});
