import { ethers } from "ethers";
import erc20 from "../build/BasicToken.json";
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
    provider: new WsProvider('ws://192.168.1.165:9944'),
    types: {
      CallRequest: {
        from: "Option<H160>",
        to: "Option<H160>",
        gasPrice: "Option<U256>",
        gas: "Option<U256>",
        value: "Option<U256>",
        data: "Option<Bytes>",
        nonce: "Option<U256>",
      }
    },
    rpc: {
      eth: {
        call: {
          description: 'eth call',
          params: [
            {
              name: 'data',
              type: 'CallRequest'
            },
            {
              name: 'at',
              type: 'BlockHash',
              isHistoric: true,
              isOptional: true
            }
          ],
          type: 'Bytes'
        },
        estimateGas: {
          description: 'eth estimateGas',
          params: [
            {
              name: 'data',
              type: 'CallRequest'
            },
            {
              name: 'at',
              type: 'BlockHash',
              isHistoric: true,
              isOptional: true
            }
          ],
          type: 'Bytes'
        },
      },
    }
  }));

  const pairs = testingPairs();

  const signer = new Signer(pairs.alice, provider);
  const aliceEVMAddress = evmToAddress(addressToEvm(pairs.alice.address))

  await signer.provider.api.isReady

  const factory = new ContractFactory(erc20.abi, erc20.bytecode, signer);

  const contract = await factory.deploy(1000);
  contract.address
  const signerAddress = u8aToHex(addressToEvm(pairs.alice.address))
  const ethAddress = u8aToHex(addressToEvm('5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty'))

  const result1 = await contract.approve(ethAddress, '1000000')
  console.log(result1)
  const result2 = await contract.transfer(ethAddress, '100')
  console.log(result2)
  const balance = await contract.balanceOf(ethAddress)

  console.log('哈哈哈')
}

run().catch((error) => {
  console.log(error);
});
