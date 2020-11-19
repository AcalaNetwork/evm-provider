import { ethers } from 'ethers';
import LinkdropFactory from './build/LinkdropFactory.json';
import LinkdropMastercopy from './build/LinkdropMastercopy.json';
import TokenMock from './build/TokenMock.json';
import {
  computeProxyAddress,
  createLink, signReceiverAddress
} from './scripts/utils';
import { deployContract } from './src/deployContract';
import { getWallet, initWallet } from './src/getWallet';
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

    tokenAmount = 100
    weiAmount = 0
    tokenAddress = tokenInstance.address
    tokenAmount = 100
    expirationTime = 11234234223
    version = 1

    await linkdropMaster.sendTransaction({
      to: proxy.address,
      value: ethers.utils.parseEther('2')
    })

    await proxy.addSigner(linkdropSigner.address, { gasLimit: 500000 })

    await factory.addRelayer(relayer.address)

    factory = factory.connect(relayer)

    console.log(relayer.address, relayer.keyringPair.address)
    console.log(factory.address)
    await tokenInstance.approve(proxy.address, tokenAmount)

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

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    let approverBalanceBefore = await tokenInstance.balanceOf(
      linkdropMaster.address
    )

    console.log('approverBalanceBefore:', approverBalanceBefore)

    await factory.claim(
      weiAmount,
      tokenAddress,
      tokenAmount,
      expirationTime,
      link.linkId,
      linkdropMaster.address,
      campaignId,
      link.linkdropSignerSignature,
      receiverAddress,
      receiverSignature,
      { gasLimit: 800000 }
    )

    let approverBalanceAfter = await tokenInstance.balanceOf(
      linkdropMaster.address
    )
    console.log('approverBalanceAfter:', approverBalanceAfter)

  // expect(approverBalanceAfter).to.eq(approverBalanceBefore.sub(tokenAmount))

  // let receiverTokenBalance = await tokenInstance.balanceOf(receiverAddress)
  // expect(receiverTokenBalance).to.eq(tokenAmount)
}

run()
