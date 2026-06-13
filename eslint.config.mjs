import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts and scratch files — not part of production bundle
    "scripts/**",
    "scratch/**",
    "prisma/check_avatar.ts",
    // Config files that use require()
    "proxy.ts",
  ]),
  {
    rules: {
      // Downgrade to warn: widespread pre-existing usage throughout codebase.
      // TODO: gradually replace `any` with proper types.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",

      // React rules — downgrade to warn
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // React Compiler / hooks rules — pre-existing patterns
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",

      // Next.js rules
      "@next/next/no-sync-scripts": "warn",
    },
  },
]);

export default eslintConfig;
