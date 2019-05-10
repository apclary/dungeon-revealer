"use strict";

module.exports = {
  root: true,
  extends: ["eslint:recommended", "react-app", "prettier"],
  rules: {
    "prefer-const": ["error"],
    "no-var": ["error"],
    eqeqeq: ["error"],
    camelcase: ["error"],
    "no-console": ["off"]
  },
  parserOptions: {
    ecmaVersion: 2017
  },
  overrides: [
    {
      env: {
        node: true
      },
      parserOptions: {
        sourceType: "script"
      },
      files: ["*/**.js", "!src/**/*.js"],
      rules: {
        strict: ["error", "global"]
      }
    },
    {
      files: ["src/**/*.js"],
      env: {
        browser: true
      },
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      }
    }
  ]
};
