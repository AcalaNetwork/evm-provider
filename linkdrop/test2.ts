/* global describe, before, it */

import chai from 'chai'
import {
  solidity
} from 'ethereum-waffle'
import LinkdropFactory from './build/LinkdropFactory.json'
import LinkdropMastercopy from './build/LinkdropMastercopy.json'
import TokenMock from './build/TokenMock.json'
import { deployContract } from './src/deployContract'
import { getProvider, getWallet, initWallet } from './src/getWallet'


const ethers = require('ethers')

// Turn off annoying warnings
// ethers.errors.setLogLevel('error')

chai.use(solidity)
const { expect } = chai

let provider = getProvider()

const wallets = getWallet()

let [linkdropMaster, linkdropSigner, relayer] = wallets

let masterCopy
let factory
let proxy
let proxyAddress
let tokenInstance

let link
let receiverAddress
let receiverSignature
let weiAmount
let tokenAddress
let tokenAmount
let expirationTime
let version
let bytecode

const campaignId = 0

const initcode = '0x6352c7420d6000526103ff60206004601c335afa6040516060f3'
const chainId = 4 // Rinkeby


async function run() {
  await provider.init()
  await initWallet(wallets)
  tokenInstance = await deployContract(linkdropMaster, TokenMock)
  masterCopy = await deployContract(linkdropMaster, LinkdropMastercopy, [], {
    gasLimit: 6000000
  })
  factory = await deployContract(
    linkdropMaster,
    LinkdropFactory,
    [masterCopy.address, chainId],
    {
      gasLimit: 6000000
    }
  )

  await factory.deployProxyWithSigner(campaignId, linkdropSigner.address, {
    value: ethers.utils.parseEther('10'),
    gasLimit: 3_000_000_000
  })
}

run().catch(error => {
  console.log(error)
})
