import * as path from "path";
import checkExists from "./checkExists";
import SemanticReleaseError from "./semanticReleaseError";
import JsonSchemaToTypes from "@etclabscore/json-schema-to-types";
import { camelCase, snakeCase, upperFirst } from "lodash";
import * as fs from "fs";
import { promisify } from "util";
import { CoreSchemaMetaSchema } from "@json-schema-tools/meta-schema";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const tsc = require("node-typescript-compiler"); // eslint-disable-line

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

type PluginFunction = (pluginConfig: PluginConfig, context: Context) => Promise<boolean>;

let verified = false;

export const verifyConditions: PluginFunction = async (pluginConfig): Promise<boolean> => {
  const cwd = process.cwd();

  if (pluginConfig.schemaLocation === undefined) {
    throw new SemanticReleaseError("You must provide a schema location", "123321", "json-schema-tools transpiler requires a schema");
  }

  const sPath = path.resolve(cwd, pluginConfig.schemaLocation);

  const exists = await checkExists(sPath);
  if (!exists) {
    throw new SemanticReleaseError("Cannot find schema", "404", `please check that your schemaLocation is properly set. received value was: ${sPath}`);
  }

  verified = true;
  return verified;
};

const generateTs = async (transpiler: JsonSchemaToTypes, schema: CoreSchemaMetaSchema, outpath: string): Promise<boolean> => {
  const indexTS = `${outpath}/src/index.ts`;
  const regularName = camelCase(schema.title);
  const ts = [
    `export const ${regularName} = ${JSON.stringify(schema)};`,
    `export default ${regularName}`
  ].join("\n");
  await writeFile(indexTS, ts)
  await tsc.compile({
    "target": "es6",
    "module": "commonjs",
    "lib": [
      "es2015",
    ],
    "declaration": true,
    "outDir": `${outpath}/build`,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
  }, [
    indexTS,
    `${outpath}/src/schema.json`
  ]);
  await writeFile(`${outpath}/build/index.d.ts`, transpiler.toTs());
  return true;
}

const generateGo = async (transpiler: JsonSchemaToTypes, schema: CoreSchemaMetaSchema, outpath: string): Promise<boolean> => {
  const packageName = snakeCase(schema.title);
  const exportName = `Raw${upperFirst(packageName)}`;
  const escapedS = JSON.stringify(schema).replace(/"/g, "\\\"");

  const go = [
    `package ${packageName}`,
    "",
    "",
    `const ${exportName} = "${escapedS}"`,
    "",
    transpiler.toGo(),
  ].join("\n");

  await writeFile(`${outpath}/${packageName}.go`, go);
  return true;
}

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

  const schemaString = await readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaString);

  await writeFile(`${outpath}/src/schema.json`, schemaString);

  if (!schema.title) {
    throw new SemanticReleaseError("The schema must have a title", "ENOTITLE", "Schema requires a title");
  }

  const transpiler = new JsonSchemaToTypes(schema);

  if (!pluginConfig.languages || pluginConfig.languages.ts) {
    await generateTs(transpiler, schema, outpath);
  }
  if (!pluginConfig.languages || pluginConfig.languages.go) {
    await generateGo(transpiler, schema, outpath);
  }
  if (!pluginConfig.languages || pluginConfig.languages.rs) {
    await writeFile(`${outpath}/index.rs`, transpiler.toRs());
  }
  if (!pluginConfig.languages || pluginConfig.languages.py) {
    await writeFile(`${outpath}/index.py`, transpiler.toPy());
  }

  return true;
};
