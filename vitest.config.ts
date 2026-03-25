import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const parentRoot = path.resolve(repoRoot, "..");

let pluginSdkSubpaths: string[] = [];
try {
  const mod = await import(path.join(parentRoot, "scripts", "lib", "plugin-sdk-entries.mjs"));
  pluginSdkSubpaths = mod.pluginSdkSubpaths ?? [];
} catch {
  pluginSdkSubpaths = [
    "plugin-entry",
    "provider-web-search",
  ];
}

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "openclaw/extension-api",
        replacement: path.join(parentRoot, "src", "extensionAPI.ts"),
      },
      ...pluginSdkSubpaths.map((subpath) => ({
        find: `openclaw/plugin-sdk/${subpath}`,
        replacement: path.join(parentRoot, "src", "plugin-sdk", `${subpath}.ts`),
      })),
      {
        find: "openclaw/plugin-sdk",
        replacement: path.join(parentRoot, "src", "plugin-sdk", "index.ts"),
      },
    ],
  },
  test: {
    testTimeout: 30_000,
    pool: "forks",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
