import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import securityPlugin from "eslint-plugin-security";

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "**/dist/**",
      "next-env.d.ts",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": tsPlugin,
      "react": reactPlugin,
      "react-hooks": reactHooksPlugin,
      "security": securityPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-require-imports": "off",

      // React hooks
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",

      // React rules
      "react/no-unescaped-entities": "warn",

      // Next.js specific
      "@next/next/no-html-link-for-pages": "warn",

      // Security rules — catch dangerous patterns
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-new-buffer": "warn",
      "security/detect-pseudoRandomBytes": "warn",

      // Games architecture — invariant 1 (X1, "External game plans/11" section 5).
      //
      // The contest engine must reach a game only through the registry. The moment it
      // imports one game's folder, that game stops being replaceable and the next game
      // silently fails to appear wherever the shortcut was taken — the same failure shape
      // as the trading-shaped services in matchmaking.service.ts, which keep working and
      // keep being wrong.
      //
      // Blocked by DEFAULT, with the public surface listed as exceptions. That direction
      // is deliberate: adding a game needs no change here (it is refused automatically),
      // while adding a public engine file to lib/games needs one line — which is the
      // decision that deserves review.
      "no-restricted-imports": ["error", {
        patterns: [{
          // Reason: matched against the literal import STRING, not the resolved path, so
          // the relative form needs its own coverage - "**/lib/games/*" does not match
          // "../games/trading". Probed: without the lib-less patterns that import passes.
          // Reason for the models and services exceptions: "**/games/*" matches ANY path
          // with a "games/" segment, not just the games code layer. It caught
          // "@/database/models/games/provider-game.model" when X2 added that folder, and
          // "@/lib/services/games/result-ingestion.service" when X3 added that one, and
          // "@/components/admin/games/GameProvidersSection" when X6 added that one. All
          // three read exactly like a real violation.
          //
          // THE WILDCARD IS KEPT DELIBERATELY, NOW THAT THE COST IS KNOWN. Anchoring it to
          // "**/lib/games/*" would end the collisions, but the rule matches the import
          // STRING and not the resolved path - so a nested file writing
          // "../../games/trading" would stop being caught. That trade is the wrong way
          // round for a guard: a false positive is noisy and fixed in a minute, while a
          // missed violation is silent and is the exact thing this rule exists to prevent.
          // Expect to add a negation each time a new "games/" directory appears.
          //
          // None of the exceptions weakens anything. Models are governed by invariant 2,
          // which bans them INSIDE game modules; importing one from the engine is ordinary.
          // lib/services/games IS engine code - the round and ingestion services own
          // contest-side lifecycle, not any one game's rules. And components/admin/games
          // is admin UI: a React screen is not a game module and has no scoring rules to
          // leak, so nothing can bypass the registry through it.
          group: [
            "**/games/*",
            "**/games/*/**",
            "!**/games/index",
            "!**/games/registry",
            "!**/games/types",
            "!**/games/settlement",
            "!**/tools/games/**",
            "!**/models/games/**",
            "!**/services/games/**",
            "!**/components/admin/games/**",
          ],
          message:
            "Invariant 1: the contest engine must not import a game folder directly. Import from '@/lib/games' and resolve the module through the registry.",
        }],
      }],
    },
  },
  {
    // The games layer itself is how modules are wired together, so it is exempt. The
    // registry importing './trading' is the one place that is supposed to know a game
    // exists; everywhere else resolves by the gameType stored on the contest.
    files: ["lib/games/**", "apps/admin/lib/games/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Games architecture — invariant 2 (X1, "External game plans/11" section 5).
    //
    // A game module scores its own game and nothing else: it is handed the data it needs
    // and hands back a number. The moment it reads or writes contest documents itself it
    // starts owning entry fees, participants and prize pools — which belong to the engine
    // — and it stops being a thing that can be swapped out.
    //
    // Scoped to `*/**`, one level BELOW the games layer, which is the whole point: this
    // matches the module folders (lib/games/trading/…) but not the layer's own public
    // files. `lib/games/index.ts` legitimately reads WhiteLabel for getEnabledGameTypes,
    // and must keep being allowed to.
    //
    // Placed after the invariant 1 exemption above so it wins — flat config is last-one-
    // wins per rule, and that exemption switches the whole rule off for lib/games/**.
    files: ["lib/games/*/**", "apps/admin/lib/games/*/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          // Reason: bans every model, not just the contest ones. A module needing any
          // document at all is already the design going wrong, and an allow-list of
          // "forbidden" models would silently permit the next one somebody adds.
          group: ["**/database/models/**", "**/database/mongoose"],
          message:
            "Invariant 2: a game module must not import contest models or the database. It receives a RankableParticipant from the engine and returns a value — data access belongs to the engine.",
        }],
      }],
    },
  },
  {
    // Tests and the golden-file tooling assert on the game modules directly — proving a
    // module behaves correctly requires importing it, which is not the engine reaching
    // past the registry.
    files: ["__tests__/**", "tools/games/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
