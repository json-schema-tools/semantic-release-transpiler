// Flat config (ESLint 9). Mirrors the old .eslintrc.js:
// eslint:recommended + @typescript-eslint eslint-recommended overrides + recommended,
// with relaxed rules for test files.
const eslintJs = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const globals = require("globals");

module.exports = [
  eslintJs.configs.recommended,
  tseslint.configs["flat/eslint-recommended"],
  ...tseslint.configs["flat/recommended"],
  {
    // Repo config files are plain CommonJS, not TypeScript.
    files: ["*.config.js"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  {
    ignores: ["build/**", "coverage/**", "testeroo/**"],
  },
];
