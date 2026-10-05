import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Tenant isolation (system-design §6, §11): the raw database handle may only be
// obtained inside a repository or lib/. Everything else goes through a module service.
const rawDbMessage =
  "getDb() is for repositories only. Call the module's service.ts; repositories apply weddingId scoping.";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "@/lib/db", importNames: ["getDb"], message: rawDbMessage }],
          patterns: [{ group: ["**/lib/db"], importNames: ["getDb"], message: rawDbMessage }],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/repository.ts", "src/lib/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "docs/**"]),
]);
