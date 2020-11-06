import { providers, ContractFactory } from 'ethers';
import { ContractJSON, isStandard, hasByteCode } from './ContractJSON';
import { Signer } from './Signer'
const defaultDeployOptions = {
  gasLimit: 100000000,
  gasPrice: 100
};

export async function deployContract(
  signer: Signer,
  contractJSON: ContractJSON,
  args: any[] = [],
  overrideOptions: providers.TransactionRequest = {}
) {
  const bytecode = isStandard(contractJSON) ? contractJSON.evm.bytecode : contractJSON.bytecode;
  if (!hasByteCode(bytecode)) {
    throw new Error('Cannot deploy contract with empty bytecode');
  }
  const factory = new ContractFactory(
    contractJSON.abi,
    bytecode,
    signer
  );
  const contract = await factory.deploy(...args, {
    ...defaultDeployOptions,
    ...overrideOptions
  });
  await contract.deployed();
  return contract;
}