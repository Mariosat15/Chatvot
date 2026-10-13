/**
 * Refund-to-original-payment-method rule (closed loop).
 *
 * When `requireOriginalPaymentMethod` is on, money that came in on a card must go back to a
 * card: a player whose latest completed deposit was card-funded cannot withdraw to a bank
 * account. A player whose deposit was bank-funded (SEPA, wire, bank transfer) may still be
 * paid by bank, because that IS their original method.
 *
 * Reason: `paymentMethod` on a deposit is free text - writers store "card", a Nuvei APM code
 * such as "apmgw_SEPA", or a display string like "Visa •••• 4242" - so the test recognises
 * the bank-funded shapes and treats everything else as a card. Unknown therefore means card,
 * which is the stricter answer for a closed-loop rule.
 *
 * Pure and model-free so the validator, the GET route and the tests share one definition.
 */

export type OriginalMethodCategory =
  | "bank_transfer"
  | "card_payout"
  | "card_refund"
  | "original_method"
  | "stripe_payout"
  | "stripe_refund";

const BANK_FUNDED_PATTERN = /sepa|bank|wire|iban|transfer|ach|swift/i;

export function isBankFundedPaymentMethod(paymentMethod: unknown): boolean {
  return typeof paymentMethod === "string" && BANK_FUNDED_PATTERN.test(paymentMethod);
}

export function isBankPayoutCategory(category: OriginalMethodCategory): boolean {
  return category === "bank_transfer" || category === "stripe_payout";
}

/**
 * True when the rule forbids this payout: the control is on, the player has a deposit, that
 * deposit was not bank-funded, and the payout goes to a bank account.
 */
export function originalMethodBlocksPayout(args: {
  required: boolean | undefined;
  lastDepositPaymentMethod: unknown;
  hasDeposit: boolean;
  payoutCategory: OriginalMethodCategory;
}): boolean {
  if (args.required !== true) return false;
  if (!args.hasDeposit) return false;
  if (!isBankPayoutCategory(args.payoutCategory)) return false;
  return !isBankFundedPaymentMethod(args.lastDepositPaymentMethod);
}

export const ORIGINAL_METHOD_REQUIRED_MESSAGE =
  "Withdrawals are returned to the payment method you deposited with. Please choose your card.";
