import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Bytes, BytesLike } from "@ethersproject/bytes";
import { Logger } from "@ethersproject/logger";
import { utils } from "ethers";
import {
  Deferrable,
  defineReadOnly,
  resolveProperties,
  shallowCopy,
} from "@ethersproject/properties";
import { SubmittableResult } from "@polkadot/api";
import { SignerOptions, SubmittableExtrinsic } from "@polkadot/api/types";
import { KeyringPair } from "@polkadot/keyring/types";
import { Registry } from "@polkadot/types/types";
import {
  hexToBn,
  isHex,
  isU8a,
  u8aToBn,
  u8aToHex,
  isBuffer,
  bufferToU8a,
} from "@polkadot/util";
import { addressToEvm } from "@polkadot/util-crypto";
import BN from "bn.js";
import {
  BlockTag,
  Provider,
  TransactionRequest,
  TransactionResponse,
  TransactionReceipt,
} from "./Provider";

const logger = new Logger("signer");

const allowedTransactionKeys: Array<string> = [
  "chainId",
  "data",
  "from",
  "gasLimit",
  "gasPrice",
  "nonce",
  "to",
  "value",
];

const forwardErrors = [
  Logger.errors.INSUFFICIENT_FUNDS,
  Logger.errors.NONCE_EXPIRED,
  Logger.errors.REPLACEMENT_UNDERPRICED,
];

// EIP-712 Typed Data
// See: https://eips.ethereum.org/EIPS/eip-712

export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: BigNumberish;
  verifyingContract?: string;
  salt?: BytesLike;
}

export interface TypedDataField {
  name: string;
  type: string;
}

// Sub-classes of Signer may optionally extend this interface to indicate
// they have a private key available synchronously
export interface ExternallyOwnedAccount {
  readonly address: string;
  readonly privateKey: string;
}

// Sub-Class Notes:
//  - A Signer MUST always make sure, that if present, the "from" field
//    matches the Signer, before sending or signing a transaction
//  - A Signer SHOULD always wrap private information (such as a private
//    key or mnemonic) in a function, so that console.log does not leak
//    the data

// @TODO: This is a temporary measure to preserse backwards compatibility
//        In v6, the method on TypedDataSigner will be added to Signer
export interface TypedDataSigner {
  _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>
  ): Promise<string>;
}

const toBN = (bigNumberis: BigNumberish) => {
  if (isU8a(bigNumberis)) {
    return u8aToBn(bigNumberis);
  }
  if (isHex(bigNumberis)) {
    return hexToBn(bigNumberis);
  }

  if (BigNumber.isBigNumber(bigNumberis)) {
    return hexToBn(bigNumberis.toHexString());
  }

  return new BN(bigNumberis as any);
};

const dataToString = (bytes: BytesLike): string => {
  if (isBuffer(bytes)) {
    return u8aToHex(bufferToU8a(bytes));
  }
  if (isU8a(bytes)) {
    return u8aToHex(bytes);
  }
  if (Array.isArray(bytes)) {
    return u8aToHex(Buffer.from(bytes));
  }

  return bytes as string;
};

export class Signer {
  readonly provider?: Provider;
  readonly keyringPair: KeyringPair;

  readonly address: string;
  ///////////////////
  // Sub-classes MUST implement these

  // Returns the checksum address
  async getAddress(): Promise<string> {
    return Promise.resolve(utils.getAddress(u8aToHex(addressToEvm(this.keyringPair.address))));
  }

  // Returns the signed prefixed-message. This MUST treat:
  // - Bytes as a binary message
  // - string as a UTF8-message
  // i.e. "0x1234" is a SIX (6) byte string, NOT 2 bytes of data
  async signMessage(message: Bytes | string): Promise<string> {
    return this._fail("signMessage");
  }

  _fail(operation: string): Promise<any> {
    return Promise.resolve().then(() => {
      console.log(`Unsupport ${operation}`);
    });
  }

  // Signs a transaxction and returns the fully serialized, signed transaction.
  // The EXACT transaction MUST be signed, and NO additional properties to be added.
  // - This MAY throw if signing transactions is not supports, but if
  //   it does, sentTransaction MUST be overridden.
  async signTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<string> {
    throw new Error("Unsupported signTransaction");
  }

  // Returns a new instance of the Signer, connected to provider.
  // This MAY throw if changing providers is not supported.
  connect(provider: Provider): Signer {
    throw new Error("connect");
  }

  readonly _isSigner: boolean;

  ///////////////////
  // Sub-classes MUST call super
  constructor(keyringPair: KeyringPair, provider: Provider) {
    defineReadOnly(this, "_isSigner", true);
    defineReadOnly(this, "keyringPair", keyringPair);
    defineReadOnly(this, "address", utils.getAddress(u8aToHex(addressToEvm(keyringPair.address))));
    defineReadOnly(this, "keyringPair", keyringPair);
    defineReadOnly(this, "provider", provider || null);
  }

  ///////////////////
  // Sub-classes MAY override these

  async getBalance(blockTag?: BlockTag): Promise<BigNumber> {
    this._checkProvider("getBalance");
    return await this.provider.getBalance(this.getAddress(), blockTag);
  }

  async getTransactionCount(blockTag?: BlockTag): Promise<number> {
    this._checkProvider("getTransactionCount");
    return await this.provider.getTransactionCount(this.getAddress(), blockTag);
  }

  // Populates "from" if unspecified, and estimates the gas for the transation
  async estimateGas(
    transaction: Deferrable<TransactionRequest>
  ): Promise<BigNumber> {
    this._checkProvider("estimateGas");
    const check = this.checkTransaction(transaction);

    const tx = await resolveProperties(check);

    return await this.provider.estimateGas(tx);
  }

  // Populates "from" if unspecified, and calls with the transation
  async call(
    transaction: Deferrable<TransactionRequest>,
    blockTag?: BlockTag
  ): Promise<string> {
    this._checkProvider("call");
    const tx = await resolveProperties(this.checkTransaction(transaction));
    return await this.provider.call(tx, blockTag);
  }

  // Populates all fields in a transaction, signs it and sends it to the network
  sendTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionResponse> {
    this._checkProvider("sendTransaction");
    return this.populateTransaction(transaction).then((tx) => {
      let extrinsic: SubmittableExtrinsic<"promise">;
      // @TODO create contract
      if (!tx.to) {
        extrinsic = this.provider.api.tx.evm.create(
          tx.from,
          tx.data,
          toBN(tx.value) || "0",
          toBN(tx.gasLimit),
          toBN(tx.gasPrice),
          toBN(tx.nonce) || null
        );
      } else {
        console.log('hhhh')
        extrinsic = this.provider.api.tx.evm.call(
          tx.from,
          tx.to,
          tx.data,
          toBN(tx.value) || "0",
          toBN(tx.gasLimit),
          toBN(tx.gasPrice),
          toBN(tx.nonce) || null
        );
      }

      return new Promise((resolve, reject) => {
        extrinsic.signAndSend(this.keyringPair, (result: SubmittableResult) => {
          if (result.status.isFinalized || result.status.isInBlock) {
            resolve({
              hash: extrinsic.hash.toHex(),
              from: tx.from,
              confirmations: 10,
              nonce: toBN(tx.nonce).toNumber(),
              gasLimit: BigNumber.from(100000000),
              gasPrice: BigNumber.from(100),
              data: dataToString(tx.data),
              value: BigNumber.from(100),
              chainId: 1024,
              wait: (confirmations?: number): Promise<TransactionReceipt> => {
                return Promise.resolve({} as any);
              },
            });
            return;
          } else if (result.isError) {
            reject(result.dispatchError);
            return;
          }
        });
      });
    });
  }

  async getChainId(): Promise<number> {
    this._checkProvider("getChainId");
    const network = await this.provider.getNetwork();
    return network.chainId;
  }

  async getGasPrice(): Promise<BigNumber> {
    this._checkProvider("getGasPrice");
    return await this.provider.getGasPrice();
  }

  async resolveName(name: string): Promise<string> {
    this._checkProvider("resolveName");
    return await this.provider.resolveName(name);
  }

  // Checks a transaction does not contain invalid keys and if
  // no "from" is provided, populates it.
  // - does NOT require a provider
  // - adds "from" is not present
  // - returns a COPY (safe to mutate the result)
  // By default called from: (overriding these prevents it)
  //   - call
  //   - estimateGas
  //   - populateTransaction (and therefor sendTransaction)
  checkTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Deferrable<TransactionRequest> {
    for (const key in transaction) {
      if (allowedTransactionKeys.indexOf(key) === -1) {
        logger.throwArgumentError(
          "invalid transaction key: " + key,
          "transaction",
          transaction
        );
      }
    }

    const tx = shallowCopy(transaction);

    if (tx.from == null) {
      tx.from = this.getAddress();
    } else {
      // Make sure any provided address matches this signer
      tx.from = Promise.all([Promise.resolve(tx.from), this.getAddress()]).then(
        (result) => {
          if (result[0] !== result[1]) {
            logger.throwArgumentError(
              "from address mismatch",
              "transaction",
              transaction
            );
          }
          return result[0];
        }
      );
    }

    return tx;
  }

  // Populates ALL keys for a transaction and checks that "from" matches
  // this Signer. Should be used by sendTransaction but NOT by signTransaction.
  // By default called from: (overriding these prevents it)
  //   - sendTransaction
  async populateTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<TransactionRequest> {
    const tx: Deferrable<TransactionRequest> = await resolveProperties(
      this.checkTransaction(transaction)
    );

    if (tx.to != null) {
      tx.to = Promise.resolve(tx.to).then((to) => this.resolveName(to));
    }
    if (tx.gasPrice == null) {
      tx.gasPrice = this.getGasPrice();
    }
    if (tx.nonce == null) {
      tx.nonce = this.getTransactionCount("pending");
    }

    if (tx.gasLimit == null) {
      tx.gasLimit = this.estimateGas(tx).catch((error) => {
        if (forwardErrors.indexOf(error.code) >= 0) {
          throw error;
        }

        return logger.throwError(
          "cannot estimate gas; transaction may fail or may require manual gas limit",
          Logger.errors.UNPREDICTABLE_GAS_LIMIT,
          {
            error: error,
            tx: tx,
          }
        );
      });
    }

    if (tx.chainId == null) {
      tx.chainId = this.getChainId();
    } else {
      tx.chainId = Promise.all([
        Promise.resolve(tx.chainId),
        this.getChainId(),
      ]).then((results) => {
        if (results[1] !== 0 && results[0] !== results[1]) {
          logger.throwArgumentError(
            "chainId address mismatch",
            "transaction",
            transaction
          );
        }
        return results[0];
      });
    }

    return await resolveProperties(tx);
  }

  ///////////////////
  // Sub-classes SHOULD leave these alone

  _checkProvider(operation?: string): void {
    if (!this.provider) {
      logger.throwError(
        "missing provider",
        Logger.errors.UNSUPPORTED_OPERATION,
        {
          operation: operation || "_checkProvider",
        }
      );
    }
  }

  static isSigner(value: any): value is Signer {
    return !!(value && value._isSigner);
  }
}
