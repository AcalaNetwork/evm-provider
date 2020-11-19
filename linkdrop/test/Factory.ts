/* global describe, before, it */

import chai from 'chai'

import {
  solidity
} from 'ethereum-waffle'
import { getWallet, getProvider, initWallet } from '../src/getWallet'
import { deployContract } from '../src/deployContract'
import LinkdropFactory from '../build/LinkdropFactory.json'
import LinkdropMastercopy from '../build/LinkdropMastercopy.json'
import TokenMock from '../build/TokenMock.json'

import {
  computeProxyAddress,
  createLink,
  signReceiverAddress,
  computeBytecode
} from '../scripts/utils'

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

describe('Factory tests', () => {
  before(async () => {
    await provider.init()
    await initWallet(wallets)
    tokenInstance = await deployContract(linkdropMaster, TokenMock)
  })

  it('should deploy master copy of linkdrop implementation', async () => {
    masterCopy = await deployContract(linkdropMaster, LinkdropMastercopy, [], {
      gasLimit: 6000000
    })
    expect(masterCopy.address).to.not.eq(ethers.constants.AddressZero)
  })

  it('should deploy factory', async () => {
    bytecode = computeBytecode(masterCopy.address)
    factory = await deployContract(
      linkdropMaster,
      LinkdropFactory,
      [masterCopy.address, chainId],
      {
        gasLimit: 6000000
      }
    )

    expect(factory.address).to.not.eq(ethers.constants.AddressZero)
    let version = await factory.masterCopyVersion()
    expect(version).to.eq(1)
  })

  it('should deploy proxy with signing key and topup with ethers in single tx', async () => {
    // Compute next address with js function
    let expectedAddress = computeProxyAddress(
      factory.address,
      linkdropMaster.address,
      campaignId,
      initcode
    )

    const value = ethers.utils.parseEther('20') // wei

    await expect(
      factory.deployProxyWithSigner(campaignId, linkdropSigner.address, {
        value,
        gasLimit: 3_000_000_000
      })
    ).to.emit(factory, 'Deployed')

    console.log('哈哈哈')

    proxy = new ethers.Contract(
      expectedAddress,
      LinkdropMastercopy.abi,
      linkdropMaster
    )

    let linkdropMasterAddress = await proxy.linkdropMaster()
    expect(linkdropMasterAddress).to.eq(linkdropMaster.address)

    let version = await proxy.version()
    expect(version).to.eq(1)

    let owner = await proxy.owner()
    expect(owner).to.eq(factory.address)

    let isSigner = await proxy.isLinkdropSigner(linkdropSigner.address)
    expect(isSigner).to.eq(true)

    const balance = await provider.getBalance(proxy.address)
    expect(balance).to.eq(value)
  })
})
