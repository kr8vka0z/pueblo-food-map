import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Leaflet stub: removed in #44; VenueMarker.tsx is rewritten in #45.
      // TODO(#45): remove this alias once VenueMarker no longer imports leaflet.
      "leaflet": path.resolve(__dirname, "./src/__mocks__/leaflet.ts"),
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
  },
});
