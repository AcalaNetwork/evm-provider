import { ethers } from "ethers";
import erc20 from "../erc20.json";
import { Signer } from "../src/Signer";
import { Provider } from "../src/Provider";
import testingPairs from "@polkadot/keyring/testingPairs";
import { addressToEvm } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { Contract, ContractFactory } from "ethers";

async function run() {
  const url = "http://127.0.0.1:7545";

  const provider = new Provider();
  const pairs = testingPairs();

  const signer = new Signer(pairs.alice, provider);

  const factory = new ContractFactory(erc20.abi, erc20.bytecode, signer);

  const contract = await factory.deploy("ricmoo.eth", "ABC");

  console.log(contract)

  await contract.approve(u8aToHex(addressToEvm('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty')), '1000000')
  await contract.transfer(u8aToHex(addressToEvm('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty')), '0')
  console.log('哈哈哈')
}

run().catch((error) => {
  console.log(error);
});
