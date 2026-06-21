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
    // Worktree build artifacts and generated files:
    ".claude/**",
    // Cloudflare Workers / OpenNext build output.
    // WHY: `wrangler dev` and `opennextjs-cloudflare build` write generated
    // JS into .wrangler/ and .open-next/ respectively. These aren't source
    // files — linting them produces hundreds of false positives and slows CI.
    ".wrangler/**",
    ".open-next/**",
  ]),
]);

export default eslintConfig;
