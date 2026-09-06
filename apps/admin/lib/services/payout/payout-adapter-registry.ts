/**
 * Payout Adapter Registry.
 *
 * Maps a provider id to its payout adapter. To add a new payout provider:
 *   1. Create an adapter in ./adapters/<provider>.payout-adapter.ts
 *   2. Add it to PAYOUT_ADAPTERS below
 *   3. Add the provider to lib/services/payout/payout-providers.ts
 * The withdrawal-processing route automatically picks it up.
 */

import type { PayoutAdapter } from "./payout-adapter";
import { nuveiPayoutAdapter } from "./adapters/nuvei.payout-adapter";

const PAYOUT_ADAPTERS: Record<string, PayoutAdapter> = {
  [nuveiPayoutAdapter.id]: nuveiPayoutAdapter,
};

export function getPayoutAdapter(id?: string | null): PayoutAdapter | null {
  if (!id) return null;
  // eslint-disable-next-line security/detect-object-injection -- id is matched against our own static adapter map keys
  return PAYOUT_ADAPTERS[id] || null;
}
