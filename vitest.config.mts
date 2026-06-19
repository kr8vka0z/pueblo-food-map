import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.claude/**",
      "**/dist/**",
    ],
    coverage: {
      // Reporting only — no global thresholds. A global floor on a solo project
      // rewards junk tests; real coverage lives in required tests per subsystem.
      // See issue #161 (2.3) for the required test areas:
      //   filter/search pipeline, hours logic, 3 API routes, i18n, axe/a11y.
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/__tests__/**",
        "src/**/vitest.setup.ts",
      ],
    },
  },
});
