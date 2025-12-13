import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Downgrade to warning - codebase is gradually being typed
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars with underscore prefix
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      // Allow require() imports in scripts
      "@typescript-eslint/no-require-imports": "off",
      // React hooks - keep as warning
      "react-hooks/exhaustive-deps": "warn",
      // Downgrade unescaped entities to warning - common in help/docs pages
      "react/no-unescaped-entities": "warn",
      // Allow <a> tags in admin wiki/docs (external links may need it)
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default eslintConfig;
