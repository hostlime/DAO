import { expect, assert } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deflateSync } from "zlib";
import { IERC20, IERC20__factory, TokenDAO } from "../typechain";


describe.only("DAO", function () {
  let proposal: SignerWithAddress;  // Председатель
  let daoMaker: SignerWithAddress; // Создает конракты
  let adr1: SignerWithAddress;
  let adr2: SignerWithAddress;
  let adr3: SignerWithAddress;
  const defaultUserBalance = ethers.utils.parseEther("100");

  let token: IERC20;
  let DAO: any;
  let counterCall: any;

  const minimumQuorum = ethers.utils.parseEther("1");
  const debPerDuration = 3 * 24 * 60 * 60; // три дня

  beforeEach(async () => {
    [proposal, daoMaker, adr1, adr2, adr3] = await ethers.getSigners();

    // Деплоим контракт токена
    const Token = await ethers.getContractFactory("TokenDAO") as IERC20__factory
    token = await Token.connect(daoMaker).deploy("TokenDAO", "DAO") as TokenDAO
    await token.connect(daoMaker).deployed()
    // Отправляем пользователям токены 
    token.connect(daoMaker).transfer(adr1.address, defaultUserBalance)

    // Контракт DAO
    const DAO_ = await ethers.getContractFactory("DAO");
    DAO = await DAO_.connect(daoMaker).deploy(
      token.address,
      minimumQuorum,
      debPerDuration,
      proposal.address
    );
    await DAO.connect(daoMaker).deployed();

    // Вызываемый конракт COUNTER для проверки вызова call
    const CounterCall = await ethers.getContractFactory("CounterCall");
    counterCall = await CounterCall.connect(daoMaker).deploy();
    await counterCall.connect(daoMaker).deployed();
    // Выдаем роль DAO_ROLE для конракта DAO
    let DAO_ROLE = await counterCall.connect(daoMaker).DAO_ROLE();
    await counterCall.grantRole(DAO_ROLE, DAO.address);

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
  // проверка, что у DAO есть роль BRIDGE_ROLE и контракт может минтить и сжигать токены
  it('Checking that DAO has role a DAO_ROLE', async () => {
    const DAO_ROLE = await counterCall.connect(daoMaker).DAO_ROLE();
    const result = await counterCall.hasRole(DAO_ROLE, DAO.address);
    expect(result).to.be.equal(true);
  });
});
