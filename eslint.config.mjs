import { fixupConfigRules } from "@eslint/compat";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next@16 bundles eslint-plugin-react / -import / -jsx-a11y
// releases that still call context.getFilename(), removed in ESLint 10.
// fixupConfigRules() re-adds the deprecated context methods so those legacy
// rules run under ESLint 10. Drop the wrapper once eslint-config-next ships
// native ESLint 10 support.
const eslintConfig = [
  ...fixupConfigRules(coreWebVitals),
  ...fixupConfigRules(typescript),
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      "node_modules/**",
      "supabase/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
