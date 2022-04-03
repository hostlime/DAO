import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deflateSync } from "zlib";
import { IERC20, IERC20__factory, TokenDAO } from "../typechain";

// Функция для получения timestamp блока
async function getTimestampBlock(bn: any) {
  return (await ethers.provider.getBlock(bn)).timestamp
}

describe.only("DAO", function () {
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

  it.only('Checking function addProposal()', async () => {

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

  it.only('Checking function vote()', async () => {

    const callData = counterCall.interface.encodeFunctionData("incCounter");
    const description = "First Proposal";
    // Создаем предложение
    await DAO.connect(proposalAdr)
      .addProposal(callData, counterCall.address, description)

    // Проверим что можно голосовать только за существующий ID
    await expect(DAO.connect(adr1)
      .vote(callData, adr1.address, description))
      .to.be.revertedWith(
        "AccessControl: account"
      );

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

});
