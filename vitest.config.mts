import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `server-only` throws when imported outside a React server build; tests run in plain Node.
      "server-only": fromRoot("./test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests talk to a real, shared database and include repeated transaction races,
    // so a slow round trip must not look like a failure. Unit tests keep the strict default.
    ...(process.env.INTEGRATION === "1" ? { testTimeout: 30_000, hookTimeout: 30_000 } : {}),
  },
});
