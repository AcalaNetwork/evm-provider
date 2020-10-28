import { Provider, TransactionRequest } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Bytes } from "@ethersproject/bytes";
import { Deferrable, defineReadOnly } from "@ethersproject/properties";

export class EthSigner extends Signer {
  readonly address: string;

  constructor(address: string, provider?: Provider) {
    super();
    defineReadOnly(this, "address", address);
    defineReadOnly(this, "provider", provider || null);
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.address);
  }

  _fail(message: string, operation: string): Promise<any> {
    return Promise.resolve().then(() => {
      console.log("哈哈哈");
    });
  }

  signMessage(message: Bytes | string): Promise<string> {
    return this._fail("VoidSigner cannot sign messages", "signMessage");
  }

  signTransaction(
    transaction: Deferrable<TransactionRequest>
  ): Promise<string> {
    return this._fail("VoidSigner cannot sign transactions", "signTransaction");
  }

  connect(provider: Provider): EthSigner {
    return new EthSigner(this.address, provider);
  }
}
