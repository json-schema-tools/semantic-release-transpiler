import { prepare, verifyConditions } from "./index";
import SemanticReleaseError from "./semanticReleaseError";
import * as fs from "fs";
import * as util from "util";

const readFile = util.promisify(fs.readFile);


describe("json-schema-tools semantic-release plugin", () => {
  afterEach(() => fs.rmdirSync("./testeroo", { recursive: true }));

  describe("verifyConditions", () => {
    it("can error on verifyConditions", () => {
      return verifyConditions({ outpath: "./testeroo", schemaLocation: "./src/test.json", languages: { ts: true } }, {}).catch((e: SemanticReleaseError) => {
        expect(e.message).toContain("Cannot find schema");
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
      return prepare({ outpath: "./testeroo", schemaLocation: "./src/test-schema.json", languages: { ts: true } }, {})
        .catch((e: SemanticReleaseError) => {
          expect(e.message).toContain("No nextRelease version");
        });
    });
    it("can pass prepare and set the version", async () => {
      return prepare(
        {
          outpath: "./testeroo",
          schemaLocation: "./src/test-schema.json",
          languages: { ts: true, go: true }
        },
        { nextRelease: { version: "1.0.0" } }
      ).then(async () => {
        const tsFile = await readFile("./testeroo/index.d.ts", "utf8");
        expect(typeof tsFile).toEqual("string");

        const goFile = await readFile("./testeroo/foobar.go", "utf8");
        expect(typeof goFile).toBe("string");

        const exported = require('../testeroo/index.js'); // eslint-disable-line
        expect(exported.default.default).toBe(true);
        expect(exported.default.type).toBe("string");
      });
    }, 10000);
  });

});
