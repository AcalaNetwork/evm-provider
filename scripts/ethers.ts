import { ethers } from "ethers";
import erc20 from "../erc20.json";
import { Signer } from "../src/Signer";
import { Provider } from "../src/Provider";
import testingPairs from "@polkadot/keyring/testingPairs";
import { addressToEvm, evmToAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { Contract, ContractFactory } from "ethers";
import { options } from "@acala-network/api";
import { WsProvider } from "@polkadot/api";
async function run() {
  const provider = new Provider(options({
    provider: new WsProvider('ws://127.0.0.1:9944')
  }));

  const pairs = testingPairs();

  const signer = new Signer(pairs.alice, provider);
  const aliceEVMAddress = evmToAddress(addressToEvm(pairs.alice.address))

  await signer.provider.api.isReady

  await new Promise((resolve, reject) => {
    signer.provider.api.tx.balances.transfer(aliceEVMAddress, 100_000_000_000_000_000_000_000n).signAndSend(pairs.alice, (result) => {
      if (result.status.isFinalized || result.status.isInBlock) {
        resolve();
      } else if (result.isError) {
        reject();
      }
    })
  })

  const factory = new ContractFactory(erc20.abi, erc20.bytecode, signer);

  const contract = await factory.deploy("ricmoo.eth", "ABC");

  const result1 = await contract.approve(u8aToHex(addressToEvm('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty')), '1000000')
  console.log(result1)
  const result2 = await contract.transfer(u8aToHex(addressToEvm('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty')), '0')
  console.log(result2)

  console.log('哈哈哈')
}

run().catch((error) => {
  console.log(error);
});
