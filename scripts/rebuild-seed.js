const fs = require('fs');

// Process admin seed file
const adminFile = './apps/admin/lib/services/marketplace-seed.service.ts';
const lines = fs.readFileSync(adminFile, 'utf-8').split('\n');

// Cosmetics + Game Master: from "// COSMETIC AVATARS" header to end of GAMEMASTER_ELITE (};)
// These are at lines 1794-2383 (0-indexed: 1793-2382)
const cosmeticSection = lines.slice(1793, 2383).join('\n');

// Seed function + stats + getAvailableIndicatorTypes: from "// SEED FUNCTION" header to end
// This starts at line 2510 (0-indexed: 2509)
const seedSection = lines.slice(2509).join('\n');

// Build the new file
const header = `/**
 * Marketplace Seed Service
 *
 * Seeds marketplace items: cosmetic avatars and game master packages.
 * Indicators and strategies have been removed for one-by-one rebuild.
 */

import { connectToDatabase } from "@/database/mongoose";
import {
  MarketplaceItem,
  IMarketplaceItem,
} from "@/database/models/marketplace/marketplace-item.model";
import { readFile } from "fs/promises";
import path from "path";

// ============================================================================
// NOTE: All indicator and strategy definitions have been removed.
// They will be rebuilt one-by-one with proper testing.
// The indicator calculation functions in indicators.service.ts are preserved.
// ============================================================================

`;

const allItems = `
// ============================================================================
// ALL ITEMS - Cosmetics and Game Master Packages only
// (Indicators and strategies removed for one-by-one rebuild)
// ============================================================================

const ALL_ITEMS = [
  // Cosmetic Avatars
  AVATAR_SHADOW_TRADER,
  AVATAR_PHANTOM_OPERATIVE,
  AVATAR_CYBER_RONIN,
  AVATAR_CRYPTO_ORACLE,
  AVATAR_NEBULA_SNIPER,
  AVATAR_BLOOD_SHOGUN,
  AVATAR_VOID_HUNTER,
  AVATAR_INFERNO_LORD,
  AVATAR_ALCHEMIST_PRIME,
  AVATAR_STORM_CENTURION,
  AVATAR_QUANTUM_SAGE,
  AVATAR_DIGITAL_ASSASSIN,
  // Game Master Packages
  GAMEMASTER_STARTER_PACKAGE,
  GAMEMASTER_PRO_PACKAGE,
  GAMEMASTER_ELITE_PACKAGE,
];

`;

const newContent = header + cosmeticSection + '\n\n' + allItems + seedSection + '\n';

fs.writeFileSync(adminFile, newContent);
console.log('Admin seed file rebuilt. New line count:', newContent.split('\n').length);

// Also process main seed file (same structure)
const mainFile = './lib/services/marketplace-seed.service.ts';
const mainLines = fs.readFileSync(mainFile, 'utf-8').split('\n');

// Find the same markers in main file
let mainCosmeticIdx = -1;
let mainAllItemsIdx = -1;
let mainSeedIdx = -1;
let mainGameMasterEndIdx = -1;

for (let i = 0; i < mainLines.length; i++) {
  if (mainLines[i].includes('COSMETIC AVATARS') && mainCosmeticIdx === -1) mainCosmeticIdx = i;
  if (mainLines[i].includes('const ALL_ITEMS = [')) mainAllItemsIdx = i;
  if (mainLines[i].includes('// SEED FUNCTION') && mainLines[i-1] && mainLines[i-1].includes('===')) mainSeedIdx = i - 1;
}

// Find end of game master section (the }; before ALL_ITEMS)
for (let i = mainAllItemsIdx - 1; i >= 0; i--) {
  if (mainLines[i].trim() === '};') {
    mainGameMasterEndIdx = i + 1;
    break;
  }
}

console.log('Main file markers:', { mainCosmeticIdx, mainAllItemsIdx, mainSeedIdx, mainGameMasterEndIdx });

const mainCosmeticSection = mainLines.slice(mainCosmeticIdx, mainGameMasterEndIdx).join('\n');
const mainSeedSection = mainLines.slice(mainSeedIdx).join('\n');

const mainContent = header + mainCosmeticSection + '\n\n' + allItems + mainSeedSection + '\n';
fs.writeFileSync(mainFile, mainContent);
console.log('Main seed file rebuilt. New line count:', mainContent.split('\n').length);
