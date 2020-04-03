import { prepare, verifyConditions } from "./index";
import SemanticReleaseError from "./semanticReleaseError";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";

const appendFile = util.promisify(fs.appendFile);
const readFile = util.promisify(fs.readFile);

const p = path.resolve(process.cwd(), "./openrpc.json");


describe("openrpc plugin", () => {
  describe("verifyConditions", () => {
    it("can error on verifyConditions", () => {
      return verifyConditions({ schemaLocation: "./src/test.json", languages: { ts: true } }, {}).catch((e: SemanticReleaseError) => {
        expect(e.message).toContain("Missing json schema document file.");
      });
    });
    it("can pass verifyConditions", () => {
      return verifyConditions({ schemaLocation: "./src/test-schema.json", languages: { ts: true } }, {}).then((valid: boolean) => {
        expect(valid).toEqual(true);
      });
    });
  });

  describe("prepare", () => {
    it("can fail if no next release version", () => {
      return prepare({ schemaLocation: "./src/test-schema.json", languages: { ts: true } }, {}).catch((e: SemanticReleaseError) => {
        expect(e.message).toContain("No nextRelease version");
      });
    });
    it("can pass prepare and set the version", async () => {
      return prepare({ schemaLocation: "./src/test-schema.json", languages: { ts: true } }, { nextRelease: { version: "1.0.0" } })
        .then(async (prepared: boolean) => {
          const file = await readFile("./generated-typings.ts", "utf8");
          expect(typeof file).toEqual("string");
          fs.unlinkSync("./generated-typings.ts");
        });
    });
  });

});
