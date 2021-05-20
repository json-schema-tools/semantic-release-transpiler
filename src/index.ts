import * as path from "path";
import checkExists from "./checkExists";
import SemanticReleaseError from "./semanticReleaseError";
import Transpiler from "@json-schema-tools/transpiler";
import { camelCase, snakeCase, upperFirst } from "lodash";
import * as fs from "fs";
import { promisify } from "util";
import { JSONSchema, JSONSchemaObject } from "@json-schema-tools/meta-schema";
import Dereferencer from "@json-schema-tools/dereferencer";
import toml from "@iarna/toml";

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

const generateTs = async (transpiler: Transpiler, schema: JSONSchemaObject, outpath: string): Promise<boolean> => {
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
    "outDir": `${outpath}`,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
  }, [
    indexTS,
    `${outpath}/src/schema.json`
  ]);
  await writeFile(`${outpath}/index.d.ts`, transpiler.toTs());
  return true;
}

const generateGo = async (transpiler: Transpiler, schema: JSONSchemaObject, outpath: string): Promise<boolean> => {
  const packageName = snakeCase(schema.title);
  const exportName = `Raw${upperFirst(packageName)}`;
  const escapedS = JSON.stringify(schema).replace(/"/g, "\\\"");

  const go = [
    `package ${packageName}`,
    "",
    "",
    transpiler.toGo(),
    "",
    `const ${exportName} = "${escapedS}"`,
  ].join("\n");

  await writeFile(`${outpath}/${packageName}.go`, go);
  return true;
}

const generateRs = async (transpiler: Transpiler, schema: JSONSchemaObject, outpath: string, version: string): Promise<boolean> => {
  const crateName = snakeCase(schema.title);

  let cargotoml;

  try {
    cargotoml = toml.parse(await readFile("${outpath}/Cargo.toml", "utf8"));
    cargotoml.version = version;
  } catch (e) {
    cargotoml = {
      package: {
        name: crateName,
        version
      },
      dependencies: {
        serde: "1.0.125"
      }
    }
  }

  await writeFile(`${outpath}/Cargo.toml`, toml.stringify(cargotoml));
  await writeFile(`${outpath}/src/lib.rs`, transpiler.toRs());

  return true;
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

  const schemaString = await readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaString);

  await writeFile(`${outpath}/src/schema.json`, schemaString);

  if (!schema.title) {
    throw new SemanticReleaseError("The schema must have a title", "ENOTITLE", "Schema requires a title");
  }

  let dereffedSchema;
  try {
    const dereffer = new Dereferencer(schema);
    dereffedSchema = await dereffer.resolve();
  } catch (e) {
    throw new SemanticReleaseError(e.message);
  }

  const transpiler = new Transpiler(dereffedSchema);

  if (!pluginConfig.languages || pluginConfig.languages.ts) {
    await generateTs(transpiler, schema, outpath);
  }
  if (!pluginConfig.languages || pluginConfig.languages.go) {
    await generateGo(transpiler, schema, outpath);
  }
  if (!pluginConfig.languages || pluginConfig.languages.rs) {
    await generateRs(transpiler, schema, outpath, context.nextRelease.version)
  }
  if (!pluginConfig.languages || pluginConfig.languages.py) {
    await writeFile(`${outpath}/index.py`, transpiler.toPy());
  }

  return true;
};
