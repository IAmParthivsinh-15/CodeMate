import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "engine/**", "coverage/**"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_|^next$|^req$|^res$", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
