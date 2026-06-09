import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
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
