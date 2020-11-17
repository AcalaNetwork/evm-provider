
import { Provider as AbstractProvider } from "@ethersproject/abstract-provider";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import type { BytesLike } from "@ethersproject/bytes";
import { Deferrable } from "@ethersproject/properties";
import initDB from '@open-web3/indexer/models';
import { ApiPromise } from "@polkadot/api";
import { isHex, isNumber, numberToHex } from "@polkadot/util";
import eventemitter from "eventemitter3";
import { Op, Sequelize } from 'sequelize';

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
  readonly db: Sequelize;

  constructor(options: any, db: Sequelize) {
    super();
    this.api = new ApiPromise(
      options
    );

    this.resolveApi = this.api.isReady;
    this._isProvider = true;

    this.db = db
  }

  static isProvider(value: any) {
    return !!(value && value._isProvider);
  }

  async init() {
    await this.db.authenticate()
    initDB(this.db);
    await this.api.isReady
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
    return BigNumber.from("1");
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

    const address = await this._resolveEvmAddress(addressOrName);
    if (resolvedBlockTag === "pending") {
      const nonce = await this.api.query.evm.accountNonces(address);

      return (nonce as any).toNumber()
    }

    const blockHash = await this._resolveBlockHash(blockTag);

    const nonce = blockHash
      ? await this.api.query.evm.accountNonces.at(blockHash, address)
      : await this.api.query.evm.accountNonces(address);

    return (nonce as any).toNumber();
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
    return this._fail("sendTransaction");
  }

  async call(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag>
  ): Promise<string> {
    const resolved = await this._resolveTransaction(transaction)
    console.log("call:", resolved)
    const result = await (this.api.rpc as any).evm.call(resolved)
    console.log("result:", result.toHex())

    return result.toHex()
  }

  async estimateGas(
    transaction: Deferrable<TransactionRequest>
  ): Promise<BigNumber> {

    const resolved = await this._resolveTransaction(transaction)

    const result = await (this.api.rpc as any).evm.estimateGas(resolved)
    return result.toHex()
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
    txHash: string
  ): Promise<TransactionReceipt> {
    initDB(this.db)
    const Extrinsic = this.db.model('Extrinsic')
    const Events = this.db.model('Events')

    await new Promise((resolve) => setTimeout(() => {
      resolve()
    }, 1000))

    const { blockNumber, blockHash, index: transactionIndex, hash: transactionHash, args } = await Extrinsic.findOne({
      attributes: ['blockNumber', 'blockHash', 'index', 'hash', 'args'],
      where: {
        hash: txHash
      },
      raw: true
    }) as any

    const from = args.source

    const events = await Events.findAll({
      attributes: ['section', 'method', 'args'],

      where: {
        phaseIndex: transactionIndex,
        blockHash: blockHash
      },
      raw: true
    }) as any

    const findCreated = events.find(x => x.section.toUpperCase() === 'EVM' && x.method.toUpperCase() === 'CREATED')
    const findExecuted = events.find(x => x.section.toUpperCase() === 'EVM' && x.method.toUpperCase() === 'EXECUTED')
    const result = events.find(x => x.section.toUpperCase() === 'SYSTEM' && x.method.toUpperCase() === 'EXTRINSICSUCCESS')

    const status = !!(findCreated || findExecuted) ? 1 : 0

    const contractAddress = findCreated ? findCreated.args[0] : null

    const to = findExecuted ? findExecuted.args[0] : null

    const logs = await this.getLogs({
      // @ts-ignore
      transactionHash,
    })

    const gasUsed = BigNumber.from(result.args[0].weight)

    return {
      to,
      from,
      contractAddress,
      transactionIndex,
      gasUsed,
      logsBloom: '0x',
      blockHash,
      transactionHash,
      logs,
      blockNumber,
      confirmations: 4,
      cumulativeGasUsed: gasUsed,
      byzantium: false,
      status,
    }
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
    const condition = []

    if ((filter as any).transactionHash) {
      condition.push({
        transactionHash: (filter as any).transactionHash
      })
    }

    if ((filter as FilterByBlockHash).blockHash) {
      condition.push({
        blockHash: (filter as FilterByBlockHash).blockHash
      })
    } else if (filter.fromBlock || filter.toBlock) {
      const blockNumberFilter = {}
      if (filter.fromBlock) {
        const from = await this._resolveBlockNumber(filter.fromBlock)
        blockNumberFilter[Op.gte] = from
      }
      if (filter.toBlock) {
        const to = await this._resolveBlockNumber(filter.toBlock)
        blockNumberFilter[Op.lte] = to
      }
      condition.push({
        blockNumber: blockNumberFilter
      })
    }

    if (filter.address) {
      condition.push({
        address: filter.address
      })
    }

    if (filter.topics) {
      condition.push({
        [Op.contains]: {
          topics: [].concat(filter.topics) as String[]
        }
      })
    }

    const model = this.db.model('EvmLogs')

    const data = await model.findAll({
      attributes: [
        "blockNumber",
        "blockHash",
        "transactionIndex",
        "removed",
        "address",
        "data",
        "topics",
        "transactionHash",
        "logIndex"
      ],
      where: {
        [Op.and]: condition
      },
      raw: true,
    })

    return data as any
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

  async _resolveBlockNumber(blockTag?: BlockTag | Promise<BlockTag>) {
    await this.resolveApi;

    if (!blockTag) return undefined;

    const resolvedBlockNumber = await blockTag;

    if (resolvedBlockNumber === "pending") {
      throw new Error("Unsupport Block Pending");
    }

    if (resolvedBlockNumber === "latest") {
      const header = await this.api.rpc.chain.getHeader();
      return header.number.toNumber();
    }

    if (resolvedBlockNumber === "earliest") {
      return 0;
    }

    if (isNumber(resolvedBlockNumber)) {
      return resolvedBlockNumber;
    } else {
      throw new Error("Expect blockHash to be a number or tag");
    }
  }

  async _resolveAddress(addressOrName: string | Promise<string>) {
    const resolved = await addressOrName;
    const result = await this.api.query.evmAccounts.accounts(resolved)
    return result.toString()
  }

  async _resolveEvmAddress(addressOrName: string | Promise<string>) {
    const resolved = await addressOrName;
    if(resolved.length === 42) {
      return resolved
    }
    const result = await this.api.query.evmAccounts.evmAddresses(resolved)
    return result.toString()
  }

  async _resolveTransaction(transaction: Deferrable<TransactionRequest>) {
    const tx = await transaction
    for (const key of ['gasLimit', 'value']) {
      if (tx[key]) {
        if ((BigNumber.isBigNumber(tx[key]))) {
          tx[key] = tx[key].toHexString()
        } else if (isNumber(tx[key])) {
          tx[key] = numberToHex(tx[key])
        }
      }
    }

    delete tx.nonce
    delete tx.gasPrice
    delete tx.chainId

    return tx
  }
}
