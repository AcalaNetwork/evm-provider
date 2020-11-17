import LinkdropFactory from './build/LinkdropFactory.json';
import LinkdropMastercopy from './build/LinkdropMastercopy.json';
import TokenMock from './build/TokenMock.json';
import {
  computeProxyAddress,
  createLink
} from './scripts/utils';
import { deployContract } from './src/deployContract';
import { getWallet, initWallet } from './src/getWallet';
import {ethers} from 'ethers'

const wallets = getWallet()
let [linkdropMaster, receiver, nonsender, linkdropSigner, relayer] = wallets

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
let standardFee

const initcode = '0x6352c7420d6000526103ff60206004601c335afa6040516060f3'
const chainId = 4 // Rinkeby

async function run() {
  const wallets = getWallet()

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
  proxyAddress = computeProxyAddress(
    factory.address,
    linkdropMaster.address,
    campaignId,
    initcode
  )

  await factory.deployProxy(campaignId, {
    gasLimit: 6000000
  })


  proxy = new ethers.Contract(
    proxyAddress,
    LinkdropMastercopy.abi,
    linkdropMaster
  )

  let linkdropMasterAddress = await proxy.linkdropMaster()
  console.log('linkdropMasterAddress:', linkdropMasterAddress)

  weiAmount = 0
  tokenAddress = tokenInstance.address
  tokenAmount = 100
  expirationTime = 11234234223
  version = 1
  link = await createLink(
    linkdropSigner,
    weiAmount,
    tokenAddress,
    tokenAmount,
    expirationTime,
    version,
    chainId,
    proxyAddress
  )

  link = await createLink(
    linkdropSigner,
    weiAmount,
    tokenAddress,
    tokenAmount,
    expirationTime,
    version,
    chainId,
    proxyAddress
  )

  await proxy.addSigner(linkdropSigner.address, { gasLimit: 500000 })
  const isSigner = await proxy.isLinkdropSigner(linkdropSigner.address)

  console.log('isSigner:', isSigner)


  const result = await proxy.verifyLinkdropSignerSignature(
    weiAmount,
    tokenAddress,
    tokenAmount,
    expirationTime,
    link.linkId,
    link.linkdropSignerSignature
  )

  console.log('verifyLinkdropSignerSignature: ', result)
}

run()
