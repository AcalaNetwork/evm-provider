import { options } from "@acala-network/api";
import { WsProvider } from "@polkadot/api";
import testingPairs from "@polkadot/keyring/testingPairs";
import { Provider } from "../src/Provider";
import { Wallet } from "../src/Wallet";
import { addressToEvm, evmToAddress } from "@polkadot/util-crypto";
import { Sequelize } from 'sequelize'
import { Op, SyncOptions } from 'sequelize';
import { getContractAddress } from "@ethersproject/address";

export function getProvider() {
  const db = new Sequelize('postgres://postgres:postgres@127.0.0.1:5432/postgres', {
    logging: false
  });

  return new Provider(options({
    provider: new WsProvider('ws://127.0.0.1:9944'),
    types: {
      EvmAddress: 'H160',
      CallRequest: {
        from: "Option<H160>",
        to: "Option<H160>",
        gasLimit: "Option<u32>",
        value: "Option<U256>",
        data: "Option<Bytes>",
      },
      ExitReason: {
        _enum: {
          Succeed: 'ExitSucceed',
          Error: 'ExitError',
          Revert: 'ExitRevert',
          Fatal: 'ExitFatal',
        }
      },
      ExitSucceed: {
        _enum: ['Stopped', 'Returned', 'Suicided']
      },
      ExitError: {
        _enum: {
          StackUnderflow: 'Null',
          StackOverflow: 'Null',
          InvalidJump: 'Null',
          InvalidRange: 'Null',
          DesignatedInvalid: 'Null',
          CallTooDeep: 'Null',
          CreateCollision: 'Null',
          CreateContractLimit: 'Null',
          OutOfOffset: 'Null',
          OutOfGas: 'Null',
          OutOfFund: 'Null',
          PCUnderflow: 'Null',
          CreateEmpty: 'Null',
          Other: 'Text',
        }
      },
      ExitRevert: {
        _enum: ['Reverted']
      },
      ExitFatal: {
        _enum: {
          NotSupported: 'Null',
          UnhandledInterrupt: 'Null',
          CallErrorAsFatal: 'ExitError',
          Other: 'Text',
        }
      }
    },
    rpc: {
      evm: {
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
          type: 'Raw'
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
          type: 'u256'
        },
      },
    }
  }), db);
}

export function getWallet() {

  const provider = getProvider()

  const wallets = [
    "0xaa397267eaee48b2262a973fdcab384a758f39a3ad8708025cfb675bb9effc20",
    "0x89a3bbcccd076b53051f391989b5fab75e8caee2d6a3faaf73be2fbedf3fa722",
    "0x62f1c70913a68196a469204786830589e37ca745c6d16fb7ac7199b4a94f6125",
    "0xafed3ffe3f9cc01db760ae859ca67880ab53cdfd9e00db695a9aab22f35b9a23",
    "0x285cedaa67b59620a031c37f395abe459dbdff4e12a45a89a69d6627cbfe9324",
    "0xcc0bec3f4f4d6e086e31c06838394d5c810d5e1923da76e0d2711ed01bc7db24",
    "0x54bfdf95b6a246d0be0ce5f3d79bba15b30916e1dd4c68ba0e2051ef3199e62b",
  ]



  return wallets.map((wallet) => {
    return new Wallet(wallet, provider)
  })
}

export function transfer(api, signer, address) {
  return new Promise((resolve, reject) => {
    api.tx.balances.transfer(address, 10_000_000_000_000_000_000_000n).signAndSend(signer, (result) => {
      if (result.status.isFinalized || result.status.isInBlock) {
        resolve();
      } else if (result.isError) {
        reject();
      }
    })
  })
}

export async function initWallet(wallets) {
  const pairs = testingPairs();
  const api = wallets[0].provider.api

  await api.isReady

  await transfer(api, pairs.alice, wallets[0].keyringPair.address)
  await transfer(api, pairs.alice, wallets[1].keyringPair.address)
  await transfer(api, pairs.alice, wallets[2].keyringPair.address)
  await transfer(api, pairs.alice, wallets[3].keyringPair.address)
  await transfer(api, pairs.alice, wallets[4].keyringPair.address)
  await transfer(api, pairs.alice, wallets[5].keyringPair.address)
  await wallets[0].claimEvmAccounts()
  await wallets[1].claimEvmAccounts()
  await wallets[2].claimEvmAccounts()
  await wallets[3].claimEvmAccounts()
  await wallets[4].claimEvmAccounts()
  await wallets[5].claimEvmAccounts()
  console.log('init success')
}


// async function run() {
//   const pairs = testingPairs();
//   const wallets = getWallet()

//   console.log(wallets[0].keyringPair.address, wallets[0].address)

//   await wallets[0].provider.api.isReady

//   await transfer(wallets[0].provider.api, pairs.bob, wallets[0].keyringPair.address)
//   console.log('claim')
//   await wallets[0].claimEvmAccounts()

// }

// run()

// async function run() {
//   // for(const i of [0,1,2,3,4,5,6,7,8]) {
//   //   const address = getContractAddress({
//   //     from: '0x1fCA3c75AC3EbfE39249e75564fED8D1Af5cc27A',
//   //     nonce: i
//   //   })
//   //   console.log('i:', i, ' address:', address)
//   // }
//   // getWallet()
// }

// run()