import * as path from "path";
import checkExists from "./checkExists";
import SemanticReleaseError from "./semanticReleaseError";
import errors from "./definitions/errors";
import JsonSchemaToTypes from "@etclabscore/json-schema-to-types";
import { camelCase, capitalize } from "lodash";
import * as fs from "fs";
import { promisify } from "util";
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const cp = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

const tsc = require("node-typescript-compiler");//eslint-disable-line

interface PluginConfig {
  outpath: string;
  schemaLocation: string;
  languages?: {
    ts?: boolean;
    go?: boolean;
    rs?: boolean;
    py?: boolean;
  };
}

interface Context {
  nextRelease?: {
    version?: string;
  };
}

type PluginFunction = (pluginConfig: PluginConfig, context: Context) => any;

let verified = false;

export const verifyConditions: PluginFunction = async (pluginConfig, context): Promise<boolean> => {
  const cwd = process.cwd();

  if (pluginConfig.schemaLocation === undefined) {
    throw new SemanticReleaseError("You must provide a schema location", "123321", "json-schema-tools transpiler requires a schema");
  }

  const sPath = path.resolve(cwd, pluginConfig.schemaLocation);

  const exists = await checkExists(sPath);
  if (!exists) {
    const noDocumentError = errors.ENODOCUMENT();
    throw new SemanticReleaseError(noDocumentError.message, noDocumentError.code, noDocumentError.details);
  }

  verified = true;
  return verified;
};

export const prepare: PluginFunction = async (pluginConfig, context): Promise<boolean> => {
  if (!verified) {
    throw new SemanticReleaseError("Not verified", "ENOTVERIFIED", "Something went wrong and the schemas were not able to be verified."); //tslint:disable-line
  }
  if (!context || !context.nextRelease || !context.nextRelease.version) {
    throw new SemanticReleaseError("No nextRelease version", "ENOVERSION", "Something went wrong and there is no next release version"); //tslint:disable-line
  }

  const outpath = pluginConfig.outpath || process.cwd();
  await mkdir(`./${outpath}/src`, { recursive: true });

  const schemaPath = path.resolve(process.cwd(), pluginConfig.schemaLocation);

  const schema = JSON.parse(await readFile(schemaPath, "utf8"));

  await writeFile(`${outpath}/src/schema.json`, JSON.stringify(schema));

  if (!schema.title) {
    throw new SemanticReleaseError("The schema must have a title", "ENOTITLE", "Schema requires a title");
  }

  const transpiler = new JsonSchemaToTypes(schema);
  const outTS = `${outpath}/src/index.d.ts`;

  if (!pluginConfig.languages || pluginConfig.languages.ts) {
    await writeFile(`${outTS}.ts`, transpiler.toTs());

    const indexTS = `${outpath}/src/index.ts`;
    const regularName = camelCase(schema.title);
    const ts = [
      `import schema from "./schema.json";`,
      `export const ${regularName} = schema;`,
    ].join("\n");
    await writeFile(indexTS, ts)
    await tsc.compile({
      "target": "es6",
      "module": "commonjs",
      "lib": [
        "es2015",
      ],
      "declaration": true,
      "outDir": "./build",
      "strict": true,
      "esModuleInterop": true,
      "resolveJsonModule": true
    });
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
