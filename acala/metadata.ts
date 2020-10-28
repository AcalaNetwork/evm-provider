import Metadata from "@polkadot/metadata/Metadata";
import { TypeRegistry } from "@polkadot/types";
import metadataStatic from "./metadataHex";
import fs from "fs";

const registry = new TypeRegistry();

const metadata = new Metadata(registry, metadataStatic);

// hack
const str = metadata.asLatest.toString();

fs.writeFileSync('./acala/metadata.json', str)
