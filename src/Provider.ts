
import { Provider as AbstractProvider } from "@ethersproject/abstract-provider";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import type { BytesLike } from "@ethersproject/bytes";
import { Deferrable } from "@ethersproject/properties";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { isHex, isNumber, hexToBn } from "@polkadot/util";
import { evmToAddress } from "@polkadot/util-crypto";
import eventemitter from "eventemitter3";

export type BlockTag = string | number;

export interface EventFilter {
  address?: string;
  topics?: Array<string | Array<string>>;
}

export interface Filter extends EventFilter {
  fromBlock?: BlockTag;
  toBlock?: BlockTag;
}

export interface FilterByBlockHash extends EventFilter {
  blockHash?: string;
}

export interface Log {
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;

  removed: boolean;

  address: string;
  data: string;

  topics: Array<string>;

  transactionHash: string;
  logIndex: number;
}

interface _Block {
  hash: string;
  parentHash: string;
  number: number;

  timestamp: number;
  nonce: string;
  difficulty: number;

  gasLimit: BigNumber;
  gasUsed: BigNumber;

  miner: string;
  extraData: string;
}

export interface Block extends _Block {
  transactions: Array<string>;
}

export interface BlockWithTransactions extends _Block {
  transactions: Array<TransactionResponse>;
}

export interface Transaction {
  hash?: string;
  to?: string;
  from?: string;
  nonce: number;
  gasLimit: BigNumber;
  gasPrice: BigNumber;
  data: string;
  value: BigNumber;
  chainId: number;
  r?: string;
  s?: string;
  v?: number;
}

export interface TransactionResponse extends Transaction {
  hash: string;

  // Only if a transaction has been mined
  blockNumber?: number;
  blockHash?: string;
  timestamp?: number;

  confirmations: number;

  // Not optional (as it is in Transaction)
  from: string;

  // The raw transaction
  raw?: string;

  // This function waits until the transaction has been mined
  wait: (confirmations?: number) => Promise<TransactionReceipt>;
}

export interface TransactionReceipt {
  to: string;
  from: string;
  contractAddress: string;
  transactionIndex: number;
  root?: string;
  gasUsed: BigNumber;
  logsBloom: string;
  blockHash: string;
  transactionHash: string;
  logs: Array<Log>;
  blockNumber: number;
  confirmations: number;
  cumulativeGasUsed: BigNumber;
  byzantium: boolean;
  status?: number;
}

export type TransactionRequest = {
  to?: string;
  from?: string;
  nonce?: BigNumberish;

  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;

  data?: BytesLike;
  value?: BigNumberish;
  chainId?: number;
};

// @ts-ignore EventType
export class Provider extends eventemitter implements AbstractProvider {
  readonly api: ApiPromise;
  readonly resolveApi: Promise<ApiPromise>;
  readonly _isProvider: boolean;

  constructor(options: any) {
    super();
    this.api = new ApiPromise(
      options
    );
    this.resolveApi = this.api.isReady;
    this._isProvider = true;
  }

  static isProvider(value: any) {
    return !!(value && value._isProvider);
  }

  async getNetwork() {
    await this.resolveApi;

    return {
      name: this.api.runtimeVersion.specName.toString(),
      chainId: 10042,
    };
  }

  async getBlockNumber() {
    await this.resolveApi;

    const r = await this.api.rpc.chain.getHeader();

    return r.number.toNumber();
  }

  async getGasPrice() {
    return BigNumber.from("100");
  }

  async getBalance(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ) {
    await this.resolveApi;

    const address = await this._resolveAddress(addressOrName);
    const blockHash = await this._resolveBlockHash(blockTag);

    const accountInfo = blockHash
      ? await this.api.query.system.account.at(blockHash, address)
      : await this.api.query.system.account(address);

    return BigNumber.from(accountInfo.data.free.toBn());
  }

  async getTransactionCount(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ) {
    await this.resolveApi;

    const resolvedBlockTag = await blockTag;
    const address = await this._resolveAddress(addressOrName);

    if (resolvedBlockTag === "pending") {
      const nextIndex = await this.api.rpc.system.accountNextIndex(address);

      return nextIndex.toNumber();
    }

    const blockHash = await this._resolveBlockHash(blockTag);

    console.log(address, blockHash);

    const accountInfo = blockHash
      ? await this.api.query.system.account.at(blockHash, address)
      : await this.api.query.system.account(address);

    return accountInfo.nonce.toNumber();
  }

  async getCode(
    addressOrName: string | Promise<string>,
    blockTag?: BlockTag | Promise<BlockTag>
  ) {
    await this.resolveApi;

    const address = await this._resolveEvmAddress(addressOrName);
    const blockHash = await this._resolveBlockHash(blockTag);

    const code = blockHash
      ? await this.api.query.evm.accountCodes.at(blockHash, address)
      : await this.api.query.evm.accountCodes(address);

    return code.toHex();
  }

  async getStorageAt(
    addressOrName: string | Promise<string>,
    position: BigNumberish | Promise<BigNumberish>,
    blockTag?: BlockTag | Promise<BlockTag>
  ) {
    await this.resolveApi;

    const address = await this._resolveEvmAddress(addressOrName);
    const blockHash = await this._resolveBlockHash(blockTag);

    const code = blockHash
      ? await this.api.query.evm.accountStorages.at(blockHash, address)
      : await this.api.query.evm.accountStorages(address);

    return code.toHex();
  }

  async sendTransaction(
    signedTransaction: string | Promise<string>
  ): Promise<TransactionResponse> {
    console.log(signedTransaction);
    return this._fail("sendTransaction");
  }

  async call(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    return this._fail("call");
  }
  async estimateGas(
    transaction: Deferrable<TransactionRequest>
  ): Promise<BigNumber> {
    return BigNumber.from(
      this.api.consts.system.maximumBlockWeight.muln(64).divn(100000).toString()
    );
  }

  async getBlock(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<Block> {
    return this._fail("getBlock");
  }

  async getBlockWithTransactions(
    blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>
  ): Promise<BlockWithTransactions> {
    return this._fail("getBlockWithTransactions");
  }

  async getTransaction(transactionHash: string): Promise<TransactionResponse> {
    return this._fail("getTransaction");
  }

  async getTransactionReceipt(
    transactionHash: string
  ): Promise<TransactionReceipt> {
    return this._fail("getTransactionReceipt");
  }

  async resolveName(name: string | Promise<string>) {
    return name;
  }

  async lookupAddress(address: string | Promise<string>) {
    return address;
  }

  async waitForTransaction(
    transactionHash: string,
    confirmations?: number,
    timeout?: number
  ): Promise<TransactionReceipt> {
    return this._fail("waitForTransaction");
  }

  async getLogs(filter: Filter): Promise<Array<Log>> {
    return this._fail("getLogs");
  }

  _fail(operation: string): Promise<any> {
    return Promise.resolve().then(() => {
      console.log(`Unsupport ${operation}`);
    });
  }

  async _resolveBlockHash(blockTag?: BlockTag | Promise<BlockTag>) {
    await this.resolveApi;

    if (!blockTag) return undefined;

    const resolvedBlockHash = await blockTag;

    if (resolvedBlockHash === "pending") {
      throw new Error("Unsupport Block Pending");
    }

    if (resolvedBlockHash === "latest") {
      const hash = await this.api.query.system.blockHash();
      return hash.toString();
    }

    if (resolvedBlockHash === "earliest") {
      return this.api.query.system.blockHash(0);
    }

    if (isHex(resolvedBlockHash)) {
      return resolvedBlockHash;
    }

    const hash = await this.api.query.system.blockHash(resolvedBlockHash);

    return hash.toString();
  }

  async _resolveAddress(addressOrName: string | Promise<string>) {
    const resolved = await addressOrName;
    return evmToAddress(resolved);
  }

  async _resolveEvmAddress(addressOrName: string | Promise<string>) {
    return await addressOrName;
  }
}
