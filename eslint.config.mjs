import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 元画像のまま保存・表示する仕様（Phase 1 で決定）のため、<img> を許可する。
      // 画像最適化（リサイズ web/next/image）は将来の課題。
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // サードパーティのスクリプトを含むツール領域
    ".opencode/**",
    ".impeccable/**",
  ]),
]);

export default eslintConfig;
