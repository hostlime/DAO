import { task } from "hardhat/config";
import { ethers } from "hardhat";
import { Bytes } from "ethers";
import { string } from "hardhat/internal/core/params/argumentTypes";


// vote
// npx hardhat addProposal --contractaddress  0x7b42599B68C147F134A4c122109031443927Fd46 --id 0 --support 1 --network rinkeby
task("vote", "vote for proposal")
    .addParam("contractaddress", "The DAO contract address")
    .addParam("id", "id proposal")
    .addParam("support", "Support proposal or against")
    .setAction(async (taskArgs, hre) => {
        const contract = await hre.ethers.getContractAt("DAO", taskArgs.contractaddress)
        await contract.vote(taskArgs.id, taskArgs.support);
    });

// addProposal
// npx hardhat addProposal --contractaddress  0x7b42599B68C147F134A4c122109031443927Fd46 --calldata 0x22aacad5 --recipient 0xE4b87Cc4972Ae7c4cC4f37C6497709F47c665e0E --description hello --network rinkeby
task("addProposal", "deposit token")
    .addParam("contractaddress", "The DAO contract address")
    .addParam("calldata", "function hexcode")
    .addParam("recipient", "address contract whick will be call")
    .addParam("description", "description of proposal")
    .setAction(async (taskArgs, hre) => {
        const contract = await hre.ethers.getContractAt("DAO", taskArgs.contractaddress)
        await contract.addProposal(taskArgs.calldata, taskArgs.recipient, taskArgs.description);
    });

// finish
// npx hardhat addProposal--contractaddress  0x7b42599B68C147F134A4c122109031443927Fd46 --id 0  --network rinkeby
task("finish", "finish proposal")
    .addParam("contractaddress", "The DAO contract address")
    .addParam("id", "id proposal")
    .setAction(async (taskArgs, hre) => {
        const contract = await hre.ethers.getContractAt("DAO", taskArgs.contractaddress)
        await contract.finishProposal(taskArgs.id);
    });
// deposit
// npx hardhat deposit --contractaddress  0x7b42599B68C147F134A4c122109031443927Fd46 --amount 7 --network rinkeby
task("deposit", "deposit token")
    .addParam("contractaddress", "The DAO contract address")
    .addParam("amount", "amount")
    .setAction(async (taskArgs, hre) => {
        const contract = await hre.ethers.getContractAt("DAO", taskArgs.contractaddress)
        await contract.deposit(taskArgs.amount);
    });