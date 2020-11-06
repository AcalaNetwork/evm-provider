import { options } from "@acala-network/api";
import { WsProvider } from "@polkadot/api";
import testingPairs from "@polkadot/keyring/testingPairs";
import { Provider } from "../src/Provider";
import { Signer } from "../src/Signer";
import { addressToEvm, evmToAddress } from "@polkadot/util-crypto";

export function getProvider() {
  return new Provider(options({
    provider: new WsProvider('ws://192.168.1.165:9944'),
    types: {
      CallRequest: {
        from: "Option<H160>",
        to: "Option<H160>",
        gasPrice: "Option<Bytes>",
        gas: "Option<Bytes>",
        value: "Option<Bytes>",
        data: "Option<Bytes>",
        nonce: "Option<Bytes>",
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
}

export function getWallet() {

  const provider = getProvider()
  const pairs = testingPairs();

  return [new Signer(pairs.alice, provider), new Signer(pairs.bob, provider), new Signer(pairs.charlie, provider), new Signer(pairs.dave, provider), new Signer(pairs.eve, provider)]
}

export function transfer(api, signer, address) {
  return new Promise((resolve, reject) => {
    api.tx.balances.transfer(address, 100_000_000_000_000_000_000_000n).signAndSend(signer, (result) => {
      if (result.status.isFinalized || result.status.isInBlock) {
        resolve();
      } else if (result.isError) {
        reject();
      }
    })
  })
}

export async function initEVMBalance(api) {
  const pairs = testingPairs();
  await transfer(api, pairs.alice, evmToAddress(addressToEvm(pairs.alice.address)))
  await transfer(api, pairs.alice, evmToAddress(addressToEvm(pairs.bob.address)))
  await transfer(api, pairs.alice, evmToAddress(addressToEvm(pairs.charlie.address)))
  await transfer(api, pairs.alice, evmToAddress(addressToEvm(pairs.dave.address)))
  await transfer(api, pairs.alice, evmToAddress(addressToEvm(pairs.eve.address)))
  console.log('init success')
}


