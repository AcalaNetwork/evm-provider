import { ethers } from "ethers";
import { Contract, ContractFactory } from "../contracts";
import erc20 from "../erc20.json";
import { EthSigner } from "../signer";

async function run() {
  const url = "http://127.0.0.1:7545";

  const provider = new ethers.providers.JsonRpcProvider(url);

  const signer = new EthSigner('0xd43593c715fdd31c61141abd04a99fd6822c8558', provider);

  const factory = new ContractFactory(erc20.abi, erc20.bytecode, signer);
  const contract = new Contract('0xc43593c715fdd31c61141abd04a99fd6822c8558', erc20.abi, signer);

  contract.transfer('0xe43593c715fdd31c61141abd04a99fd6822c8558', 1000)
  // const contract = await factory.deploy("ricmoo.eth", "ABC");
}

run().catch((error) => {
  console.log(error);
});
