// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";

async function main() {
  /*
  Посследовательность деплоя и верификации:
  npx hardhat run--network rinkeby scripts / deploy.ts
    Token deployed to: 0xa49Ff59952215Fc8371b874e901eded363f25a80
    CounterCall deployed to: 0xE4b87Cc4972Ae7c4cC4f37C6497709F47c665e0E
    DAO deployed to: 0x7b42599B68C147F134A4c122109031443927Fd46

  npx hardhat verify--network rinkeby 
      0xa49Ff59952215Fc8371b874e901eded363f25a80 
      TokenDao 
      DAO
  npx hardhat verify--network rinkeby 
  0xE4b87Cc4972Ae7c4cC4f37C6497709F47c665e0E
  npx hardhat verify  --network rinkeby 
      0x7b42599B68C147F134A4c122109031443927Fd46 
      0xa49Ff59952215Fc8371b874e901eded363f25a80 
      1000000000000000000 
      259200 
      0xC263718b809ab3EF9C816d7A2313ef0CA0Bb58a1
*/
  const minimumQuorum = ethers.utils.parseEther("1");
  const debPerDuration = 3 * 24 * 60 * 60; // три дня
  const chairPerson = "0xC263718b809ab3EF9C816d7A2313ef0CA0Bb58a1";


  // npx hardhat verify  --network rinkeby 0x7F4CFd978A36D83bA77F4c567b297e6C36e4149a TokenDao DAO
  // https://rinkeby.etherscan.io/address/0x7F4CFd978A36D83bA77F4c567b297e6C36e4149a#code

  const TokenDAO = await ethers.getContractFactory("TokenDAO");
  const token = await TokenDAO.deploy("TokenDao", "DAO") as any;
  await token.deployed();
  console.log("Token deployed to:", token.address);

  // npx hardhat verify  --network rinkeby 0xb7c22Bb7372315D5ee744d64F61A4dE9CFbbEdC6
  // https://rinkeby.etherscan.io/address/0xb7c22Bb7372315D5ee744d64F61A4dE9CFbbEdC6#code
  const CounterCall = await ethers.getContractFactory("CounterCall");
  const сounter = await CounterCall.deploy() as any;
  await сounter.deployed();
  console.log("CounterCall deployed to:", сounter.address);

  // npx hardhat verify  --network rinkeby 0xAd70666B3C86D935bdBA41812f89b1A10B310dcE 0x7F4CFd978A36D83bA77F4c567b297e6C36e4149a 100000000000000000 0xC263718b809ab3EF9C816d7A2313ef0CA0Bb58a1
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(
    token.address,
    minimumQuorum,
    debPerDuration,
    chairPerson) as any;
  await dao.deployed();
  console.log("DAO deployed to:", dao.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
