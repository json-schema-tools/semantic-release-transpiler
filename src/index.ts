import * as path from "path";
import checkExists from "./checkExists";
import SemanticReleaseError from "./semanticReleaseError";
import errors from "./definitions/errors";
import JsonSchemaToTypes from "@etclabscore/json-schema-to-types";
import * as fs from "fs";
import { promisify } from "util";
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);


interface IPluginConfig {
  schemaLocation: string | string[];
  outputName?: string;
  languages?: {
    ts: boolean;
    go: boolean;
    rs: boolean;
    py: boolean;
  };
}

interface IContext {
  nextRelease?: {
    version?: string;
  };
}

type PluginFunction = (pluginConfig: IPluginConfig, context: IContext) => any;

let verified: boolean = false;

export const verifyConditions: PluginFunction = async (pluginConfig, context): Promise<boolean> => {
  const cwd = process.cwd();
  const config: IPluginConfig = {
    schemaLocation: pluginConfig.schemaLocation,
  };

  const paths = [];
  if (config.schemaLocation === undefined) {
    throw new SemanticReleaseError("You must provide a schema location", "123321", "json-schema-tools transpiler requires a schema");
  } else if (config.schemaLocation instanceof Array) {
    config.schemaLocation.forEach((loc) => paths.push(path.resolve(cwd, loc)))
  } else {
    paths.push(path.resolve(cwd, config.schemaLocation))
  }


  paths.forEach(async (p) => {
    const exists = await checkExists(p);
    if (!exists) {
      const noDocumentError = errors.ENODOCUMENT();
      throw new SemanticReleaseError(noDocumentError.message, noDocumentError.code, noDocumentError.details);
    }
  });

  verified = true;
  return verified;
};

export const prepare: PluginFunction = async (pluginConfig, context): Promise<boolean> => {
  if (!verified) {
    throw new SemanticReleaseError("Not verified", "ENOTVERIFIED", "Something went wrong and the openrpc.json was not able to be verified."); //tslint:disable-line
  }
  if (!context || !context.nextRelease || !context.nextRelease.version) {
    throw new SemanticReleaseError("No nextRelease version", "ENOVERSION", "Something went wrong and there is no next release version"); //tslint:disable-line
  }

  const cwd = process.cwd();
  const schemas = [];
  if (pluginConfig.schemaLocation instanceof Array) {
    pluginConfig.schemaLocation.forEach(async (loc) => schemas.push(JSON.parse(await readFile(path.resolve(cwd, loc), "utf8"))));
  } else {
    schemas.push(JSON.parse(await readFile(path.resolve(cwd, pluginConfig.schemaLocation), "utf8")))
  }

  const transpiler = new JsonSchemaToTypes(schemas);
  const outTS = path.resolve(cwd, pluginConfig.outputName || "generated-typings");

  if (!pluginConfig.languages || pluginConfig.languages.ts) {
    await writeFile(`${outTS}.ts`, transpiler.toTs());
  }
  if (!pluginConfig.languages || pluginConfig.languages.go) {
    await writeFile(`${outTS}.go`, transpiler.toGo());
  }
  if (!pluginConfig.languages || pluginConfig.languages.rs) {
    await writeFile(`${outTS}.rs`, transpiler.toRs());
  }
  if (!pluginConfig.languages || pluginConfig.languages.py) {
    await writeFile(`${outTS}.py`, transpiler.toPy());
  }

  return true;
};
