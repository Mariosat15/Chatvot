import path from "path";

/**
 * Directories the Image Optimizer scans.
 *
 * Production paths are absolute; development paths are relative to `apps/admin`
 * (`../../public/...` reaches the monorepo root). Both lists are tried so a
 * deploy whose cwd is `apps/admin` still finds uploads under `/var/www/.../public`.
 *
 * Game / trading artwork lives in `public/assets/images` (see `game-artwork-storage.ts`).
 * Hero and profile uploads are sibling folders under `public/uploads`. Those were missing
 * until now, so Scan Images only ever reported marketplace cosmetics.
 */

export type ImageDirectorySpec = { path: string; label: string };

const PRODUCTION_ROOT = "/var/www/chartvolt";
/** Some deploys use a hyphenated folder name; both are listed so either works. */
const PRODUCTION_ROOT_ALT = "/var/www/chart-volt";

function productionDirs(root: string): ImageDirectorySpec[] {
  return [
    {
      path: `${root}/public/uploads/marketplace`,
      label: "Marketplace Uploads",
    },
    {
      path: `${root}/public/assets/images`,
      label: "Game & Branding Artwork",
    },
    {
      path: `${root}/public/uploads/hero`,
      label: "Hero Uploads",
    },
    {
      path: `${root}/public/uploads/profiles`,
      label: "Profile Uploads",
    },
    {
      path: `${root}/public/uploads/avatars`,
      label: "Avatar Uploads",
    },
    {
      path: `${root}/public/assets/avatars`,
      label: "Default Avatars",
    },
    // Reason: `public/assets/neon` is git-tracked kit art with fingerprinted names.
    // Optimizing it would rename or rewrite files the lobby tests assert exist by path.
    { path: `${root}/public/uploads/cosmetics`, label: "Cosmetics" },
    { path: `${root}/public/uploads/indicators`, label: "Indicators" },
    { path: `${root}/public/uploads/strategies`, label: "Strategies" },
    { path: `${root}/public/uploads/gamemaster`, label: "Game Master" },
    { path: `${root}/public/uploads`, label: "General Uploads" },
  ];
}

function monorepoPublic(...segments: string[]): string {
  return path.join(process.cwd(), "..", "..", "public", ...segments);
}

function adminPublic(...segments: string[]): string {
  return path.join(process.cwd(), "public", ...segments);
}

export const IMAGE_DIRECTORIES: {
  production: ImageDirectorySpec[];
  development: ImageDirectorySpec[];
} = {
  production: [
    ...productionDirs(PRODUCTION_ROOT),
    ...productionDirs(PRODUCTION_ROOT_ALT),
  ],
  development: [
    { path: monorepoPublic("uploads", "marketplace"), label: "Marketplace Uploads" },
    {
      path: monorepoPublic("assets", "images"),
      label: "Game & Branding Artwork",
    },
    { path: monorepoPublic("uploads", "hero"), label: "Hero Uploads" },
    { path: monorepoPublic("uploads", "profiles"), label: "Profile Uploads" },
    { path: monorepoPublic("uploads", "avatars"), label: "Avatar Uploads" },
    { path: monorepoPublic("assets", "avatars"), label: "Default Avatars" },
    { path: monorepoPublic("uploads", "cosmetics"), label: "Cosmetics" },
    { path: monorepoPublic("uploads", "indicators"), label: "Indicators" },
    { path: monorepoPublic("uploads", "strategies"), label: "Strategies" },
    { path: monorepoPublic("uploads", "gamemaster"), label: "Game Master" },
    { path: monorepoPublic("uploads"), label: "General Uploads" },
    {
      path: adminPublic("uploads", "marketplace"),
      label: "Admin Marketplace",
    },
    { path: adminPublic("assets", "images"), label: "Admin Game Artwork" },
    { path: adminPublic("uploads"), label: "Admin Uploads" },
  ],
};
