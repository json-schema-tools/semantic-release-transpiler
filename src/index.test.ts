import { prepare, verifyConditions } from "./index";
import SemanticReleaseError from "./semanticReleaseError";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";

const readFile = util.promisify(fs.readFile);


describe("json-schema-tools semantic-release plugin", () => {
  afterEach(() => fs.rmdirSync("./testeroo", { recursive: true }));

  describe("verifyConditions", () => {
    it("can error on verifyConditions", () => {
      return verifyConditions({ outpath: "./testeroo", schemaLocation: "./src/test.json", languages: { ts: true } }, {}).catch((e: SemanticReleaseError) => {
        expect(e.message).toContain("Missing json schema document file.");
      });
    });
    it("can pass verifyConditions", () => {
      return verifyConditions({ outpath: "./testeroo", schemaLocation: "./src/test-schema.json", languages: { ts: true } }, {}).then((valid: boolean) => {
        expect(valid).toEqual(true);
      });
    });
  });

  describe("prepare", () => {
    it("can fail if no next release version", () => {
      return prepare({ outpath: "./testeroo", schemaLocation: "./src/test-schema.json", languages: { ts: true } }, {}).catch((e: SemanticReleaseError) => {
        expect(e.message).toContain("No nextRelease version");
      });
    });
    it("can pass prepare and set the version", async () => {
      return prepare({ outpath: "./testeroo", schemaLocation: "./src/test-schema.json", languages: { ts: true } }, { nextRelease: { version: "1.0.0" } })
        .then(async (prepared: boolean) => {
          const file = await readFile("./testeroo/src/generated-typings.ts", "utf8");
          expect(typeof file).toEqual("string");
        });
    });
  });

});
