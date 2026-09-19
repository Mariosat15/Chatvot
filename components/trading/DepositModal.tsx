/* eslint-disable security/detect-unsafe-regex */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  CreditCard,
  Globe,
  Gem,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import ActionTermsDialog, {
  ACTION_TERM_SLUGS,
} from "@/components/ActionTermsDialog";
import { toast } from "sonner";

interface DepositModalProps {
  children: React.ReactNode;
}

interface PaymentProviders {
  stripe: {
    available: boolean;
    publishableKey: string;
    testMode: boolean;
  };
  paddle: {
    available: boolean;
    clientToken: string | null;
    environment: "sandbox" | "production";
    vendorId: string | null;
  };
  nuvei: {
    available: boolean;
    merchantId: string | null;
    siteId: string | null;
    testMode: boolean;
    sdkUrl: string;
  };
  atlas: {
    available: boolean;
    testMode: boolean;
  };
}

type PaymentProvider = "stripe" | "paddle" | "nuvei" | "atlas";

// Declare SafeCharge global type
declare global {
  interface Window {
    SafeCharge?: (config: {
      env: string;
      merchantId: string;
      merchantSiteId: string;
    }) => {
      fields: (options?: { fonts?: Array<{ cssUrl: string }> }) => {
        create: (
          type: string,
          options?: {
            style?: Record<string, unknown>;
            classes?: Record<string, string>;
          },
        ) => {
          attach: (element: string | HTMLElement | null) => void;
          on: (event: string, callback: (evt: unknown) => void) => void;
        };
      };
      createPayment: (
        options: {
          sessionToken: string;
          clientUniqueId?: string;
          cardHolderName?: string;
          paymentOption: unknown;
          // CRITICAL: userTokenId is required for UPO storage
          userTokenId?: string;
          // savePM enables saving the payment method as UPO
          savePM?: boolean;
          userDetails?: {
            firstName?: string;
            lastName?: string;
            email?: string;
            country?: string; // REQUIRED for 3DS2
            phone?: string;
            address?: string;
            city?: string;
            zip?: string;
          };
          billingAddress?: {
            firstName?: string;
            lastName?: string;
            email?: string;
            country?: string; // REQUIRED for 3DS2 - without this, error 1136
            address?: string;
            city?: string;
            zip?: string;
            phone?: string;
          };
        },
        callback: (result: {
          result: string;
          errCode: string;
          errorDescription?: string;
          reason?: string;
          transactionId?: string;
        }) => void,
      ) => void;
    };
  }
}

export default function DepositModal({ children }: DepositModalProps) {
  const { settings, eurToCredits } = useAppSettings();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Reason: On mobile, Nuvei payment happens via full-page redirect to /payment/nuvei.
  // When the user returns, the payment result is stored in sessionStorage.
  // This effect picks it up and shows a toast notification.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("nuvei-payment-result");
      if (!stored) return;
      sessionStorage.removeItem("nuvei-payment-result");
      // Also clean up the pending TX marker
      sessionStorage.removeItem("nuvei-pending-tx");

      const result = JSON.parse(stored) as {
        success: boolean;
        error?: string;
      };
      if (result.success) {
        toast.success("Payment successful! Credits added to your wallet.");
        // Refresh page data to reflect new balance
        router.refresh();
      } else if (result.error && result.error !== "cancelled") {
        toast.error(result.error || "Payment failed. Please try again.");
      }
    } catch {
      // Ignore parse errors — sessionStorage may be corrupted
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [amount, setAmount] = useState("50");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [paymentConfigured, setPaymentConfigured] = useState<boolean | null>(
    null,
  );
  const [checkingConfig, setCheckingConfig] = useState(true);
  const [processingFee, setProcessingFee] = useState(0);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatPercentage, setVatPercentage] = useState(0);

  // KYC requirement for deposits
  const [kycBlocksDeposit, setKycBlocksDeposit] = useState(false);

  // Multi-provider support
  const [providers, setProviders] = useState<PaymentProviders | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<PaymentProvider>("stripe");
  const [step, setStep] = useState<"amount" | "provider" | "payment">("amount");

  // Terms acceptance gate
  const [showTerms, setShowTerms] = useState(false);

  // SECURITY: Refs to prevent double-clicks and race conditions
  const isProcessingRef = useRef(false);
  const lastRequestIdRef = useRef<string | null>(null);

  // Nuvei popup window ref
  const nuveiPopupRef = useRef<Window | null>(null);
  const nuveiPopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minDeposit =
    (settings as { transactions?: { minimumDeposit?: number } })?.transactions
      ?.minimumDeposit || 10;
  const maxDeposit =
    (settings as { transactions?: { maximumDeposit?: number } })?.transactions
      ?.maximumDeposit || 10000;

  // Calculate VAT on the EUR amount
  const calculateVAT = (amountEur: number) => {
    if (!vatEnabled || vatPercentage <= 0) return 0;
    return amountEur * (vatPercentage / 100);
  };

  // Calculate platform fee on (credits + VAT) as per business requirement
  // Fee is charged on the total deposited amount INCLUDING VAT
  const calculatePlatformFee = (amountEur: number) => {
    if (processingFee <= 0) return 0;
    const vat = calculateVAT(amountEur);
    const subtotal = amountEur + vat; // Credits + VAT
    return subtotal * (processingFee / 100);
  };

  // Calculate total payment: Credits + VAT + Platform Fee (on credits+VAT)
  const calculateTotalPayment = (amountEur: number) => {
    const vat = calculateVAT(amountEur);
    const subtotal = amountEur + vat;
    const platformFee = subtotal * (processingFee / 100);
    return subtotal + platformFee;
  };

  // Check payment configuration on mount and RESET all state when modal opens
  useEffect(() => {
    async function checkPaymentConfig() {
      try {
        const response = await fetch("/api/payment-config");
        const config = await response.json();

        setPaymentConfigured(config.configured);
        setProcessingFee(config.processingFee || 0);
        setVatEnabled(config.vatEnabled || false);
        setVatPercentage(config.vatPercentage || 0);
        setProviders(config.providers || null);
        setKycBlocksDeposit(config.kycBlocksDeposit || false);

        // Determine default provider
        if (config.providers) {
          if (config.providers.stripe?.available) {
            setSelectedProvider("stripe");
            const stripe = loadStripe(config.providers.stripe.publishableKey);
            setStripePromise(stripe);
          } else if (config.providers.nuvei?.available) {
            setSelectedProvider("nuvei");
          } else if (config.providers.atlas?.available) {
            setSelectedProvider("atlas");
          } else if (config.providers.paddle?.available) {
            setSelectedProvider("paddle");
          }
        } else if (config.configured && config.publishableKey) {
          // Fallback to legacy config
          const stripe = loadStripe(config.publishableKey);
          setStripePromise(stripe);
        }
      } catch (error) {
        console.error("Error checking payment configuration:", error);
        setPaymentConfigured(false);
      } finally {
        setCheckingConfig(false);
      }
    }

    if (open) {
      // IMPORTANT: Reset ALL state when modal opens fresh
      // This prevents stale state from previous transactions causing issues
      setAmount("50");
      setClientSecret("");
      setError("");
      setLoading(false);
      setStep("amount");
      // Reset Nuvei state - but check if SDK is already loaded in browser
      setNuveiSessionToken("");
      setNuveiClientUniqueId("");
      setNuveiUserEmail("");
      setNuveiUserTokenId("");
      // FIX: Check if Nuvei SDK is already loaded in the window object
      // The Script onLoad only fires once, so if SDK is already loaded, set nuveiLoaded to true
      setNuveiLoaded(typeof window !== "undefined" && !!window.SafeCharge);

      // Now check payment config
      setCheckingConfig(true);
      checkPaymentConfig();
    }
  }, [open]);

  // Nuvei state
  const [nuveiLoaded, setNuveiLoaded] = useState(false);
  const [_nuveiSessionToken, setNuveiSessionToken] = useState("");
  const [nuveiClientUniqueId, setNuveiClientUniqueId] = useState("");
  const [_nuveiUserEmail, setNuveiUserEmail] = useState("");
  // CRITICAL: userTokenId is required for Nuvei to store UPOs (User Payment Options) for future card refunds
  const [_nuveiUserTokenId, setNuveiUserTokenId] = useState("");
  // Tracks whether a Nuvei popup is open
  const [nuveiPopupOpen, setNuveiPopupOpen] = useState(false);

  // Stripe pending transaction ID — used to cancel the pending transaction if user abandons payment
  const [stripeTransactionId, setStripeTransactionId] = useState("");

  // FIX: Sync nuveiLoaded with actual SDK state whenever we enter payment step
  useEffect(() => {
    if (step === "payment" && selectedProvider === "nuvei" && !nuveiLoaded) {
      // Check if SDK is already in window (from previous payment)
      if (typeof window !== "undefined" && window.SafeCharge) {
        setNuveiLoaded(true);
      }
    }
  }, [step, selectedProvider, nuveiLoaded]);

  // ── Nuvei popup message listener & close-polling ──────────────────────
  useEffect(() => {
    if (!nuveiPopupOpen) return;

    const handleMessage = (event: MessageEvent) => {
      // SECURITY: Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "nuvei-payment-result") return;

      // Clear popup polling
      if (nuveiPopupPollRef.current) {
        clearInterval(nuveiPopupPollRef.current);
        nuveiPopupPollRef.current = null;
      }

      if (event.data.success) {
        // Payment succeeded — close modal and refresh
        setOpen(false);
        resetModal(false); // Don't cancel — payment succeeded
        // Refresh the page data
        window.location.reload();
      } else if (event.data.error === "cancelled") {
        // User cancelled — cancel the pending transaction and go back
        cancelPendingDepositTransaction("User cancelled payment in popup");
        setNuveiPopupOpen(false);
        setLoading(false);
        setStep("provider");
      } else {
        // Reason: Card declined / payment failed. The Nuvei popup now shows a
        // terminal "Declined" screen whose only action is Close. We reset THIS
        // modal to a brand-new deposit (amount step) and drop the declined
        // session, so the only way forward is a fresh transaction (new order +
        // new session). No same-order retry → no race, no charged-but-uncredited.
        cancelPendingDepositTransaction("Payment failed");
        setNuveiPopupOpen(false);
        setLoading(false);
        setError("");
        setNuveiSessionToken("");
        setNuveiClientUniqueId("");
        setNuveiUserEmail("");
        setNuveiUserTokenId("");
        isProcessingRef.current = false;
        lastRequestIdRef.current = null;
        setStep("amount");
        toast.error(
          event.data.error ||
            "Your card was declined. Please start a new payment.",
        );
      }

      nuveiPopupRef.current = null;
    };

    window.addEventListener("message", handleMessage);

    // Poll to detect if popup was closed without completing payment
    nuveiPopupPollRef.current = setInterval(() => {
      if (nuveiPopupRef.current && nuveiPopupRef.current.closed) {
        // Popup was closed by user — cancel the pending transaction
        if (nuveiPopupPollRef.current) {
          clearInterval(nuveiPopupPollRef.current);
          nuveiPopupPollRef.current = null;
        }
        // Reason: If user closes the popup without completing, cancel the pending DB transaction
        // so it doesn't stay as "pending" forever.
        cancelPendingDepositTransaction("User closed payment popup window");
        setNuveiPopupOpen(false);
        setLoading(false);
        nuveiPopupRef.current = null;
      }
    }, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      if (nuveiPopupPollRef.current) {
        clearInterval(nuveiPopupPollRef.current);
        nuveiPopupPollRef.current = null;
      }
    };
  }, [nuveiPopupOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get available provider count
  const getAvailableProviders = () => {
    if (!providers) return [];
    const available: PaymentProvider[] = [];
    if (providers.stripe?.available) available.push("stripe");
    if (providers.nuvei?.available) available.push("nuvei");
    if (providers.atlas?.available) available.push("atlas");
    if (providers.paddle?.available) available.push("paddle");
    return available;
  };

  // Reason: Show terms dialog first. If user accepts, proceed to provider/payment step.
  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // SECURITY: Prevent double-submit
    if (loading || isProcessingRef.current) {
      return;
    }

    setError("");

    const amountNum = parseFloat(amount);
    const currencySymbol = settings?.currency?.symbol || "€";

    // SECURITY: Strict validation
    if (isNaN(amountNum) || amountNum < minDeposit) {
      setError(`Minimum is ${currencySymbol}${minDeposit}`);
      return;
    }

    if (amountNum > maxDeposit) {
      setError(`Maximum is ${currencySymbol}${maxDeposit.toLocaleString()}`);
      return;
    }

    // SECURITY: Ensure amount is a valid number with max 2 decimal places
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError("Invalid amount format");
      return;
    }

    // Show terms dialog before proceeding
    setShowTerms(true);
  };

  /** Called after user accepts terms — proceeds to provider selection or payment */
  const proceedAfterTerms = async () => {
    setShowTerms(false);

    const availableProviders = getAvailableProviders();

    // If multiple providers available, show provider selection
    if (availableProviders.length > 1) {
      setStep("provider");
    } else if (availableProviders.length === 1) {
      // Single provider - proceed directly
      setSelectedProvider(availableProviders[0]);
      await proceedWithProvider(availableProviders[0]);
    } else {
      setError("No payment provider configured");
    }
  };

  const proceedWithProvider = async (provider: PaymentProvider) => {
    // SECURITY: Prevent double-clicks and race conditions
    if (isProcessingRef.current || loading) {
      return;
    }

    // Generate unique request ID for this transaction
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    lastRequestIdRef.current = requestId;
    isProcessingRef.current = true;

    setLoading(true);
    setError("");

    try {
      const amountNum = parseFloat(amount);

      // SECURITY: Double-check amount validation client-side
      if (isNaN(amountNum) || amountNum < minDeposit || amountNum > maxDeposit) {
        throw new Error("Invalid amount");
      }

      const vatAmount = calculateVAT(amountNum);
      const platformFeeAmount = calculatePlatformFee(amountNum);
      const totalPayment = calculateTotalPayment(amountNum);

      // SECURITY: Check if this request is still valid (not superseded)
      if (lastRequestIdRef.current !== requestId) {
        return;
      }

      if (provider === "stripe") {
        // Create Stripe payment intent
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId, // For server-side idempotency
          },
          body: JSON.stringify({
            amount: amountNum,
            totalAmount: totalPayment,
            vatAmount,
            vatPercentage: vatEnabled ? vatPercentage : 0,
            platformFeeAmount,
            platformFeePercentage: processingFee,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create payment intent");
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
        // Reason: Store Stripe transaction ID so we can cancel it if the user abandons payment
        if (data.transactionId) {
          setStripeTransactionId(data.transactionId);
        }
        setStep("payment");
      } else if (provider === "nuvei") {
        // Reason: On mobile, window.open() is unreliable (blocked or opens as tab).
        // We detect mobile and use a full-page redirect instead.
        const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          ) || window.innerWidth < 768;

        // On DESKTOP, open popup immediately within user-gesture scope
        // (browsers block window.open() if called after async delay)
        let popup: Window | null = null;
        if (!isMobile) {
          const popupFeatures =
            "width=550,height=750,scrollbars=no,resizable=yes,left=200,top=100";
          popup = window.open("", "nuvei-3ds", popupFeatures);

          if (!popup) {
            throw new Error(
              "Your browser blocked the payment window. Please allow popups for this site and try again.",
            );
          }

          // Show a styled loading page in the blank popup while we fetch the session
          popup.document.write(
            `<!DOCTYPE html><html><head><title>Secure Payment</title></head>` +
              `<body style="margin:0;background:#111827;color:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">` +
              `<div style="text-align:center"><div style="width:40px;height:40px;border:3px solid #374151;border-top-color:#eab308;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>` +
              `<p style="font-size:18px;font-weight:600;margin:0 0 8px">Preparing Secure Payment...</p>` +
              `<p style="font-size:14px;color:#9ca3af;margin:0">Please wait</p></div>` +
              `<style>@keyframes spin{to{transform:rotate(360deg)}}</style></body></html>`,
          );

          nuveiPopupRef.current = popup;
        }

        // Create Nuvei session — send same fee breakdown as Stripe
        const response = await fetch("/api/nuvei/open-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
          body: JSON.stringify({
            amount: totalPayment,
            baseAmount: amountNum,
            currency: settings?.currency?.code || "EUR",
            vatAmount,
            vatPercentage: vatEnabled ? vatPercentage : 0,
            platformFeeAmount,
            platformFeePercentage: processingFee,
          }),
        });

        // Check if popup was closed while waiting for API (desktop only)
        if (popup && popup.closed) {
          throw new Error("Payment window was closed. Please try again.");
        }

        if (!response.ok) {
          const errData = await response.json();
          popup?.close();
          throw new Error(errData.error || "Failed to create Nuvei session");
        }

        const data = await response.json();

        // Store session data for cancellation if needed
        setNuveiSessionToken(data.sessionToken);
        setNuveiClientUniqueId(data.clientUniqueId);
        setNuveiUserEmail(data.userEmail || "");
        setNuveiUserTokenId(data.userTokenId || "");

        // Build payment data for the payment page
        const paymentData = {
          sessionToken: data.sessionToken,
          clientUniqueId: data.clientUniqueId,
          merchantId: providers?.nuvei?.merchantId || "",
          siteId: providers?.nuvei?.siteId || "",
          testMode: providers?.nuvei?.testMode ?? true,
          sdkUrl:
            providers?.nuvei?.sdkUrl ||
            "https://cdn.safecharge.com/safecharge_resources/v1/websdk/safecharge.js",
          amount: amountNum,
          totalAmount: totalPayment,
          vatAmount,
          vatPercentage: vatEnabled ? vatPercentage : 0,
          platformFeeAmount,
          platformFeePercentage: processingFee,
          userEmail: data.userEmail || "",
          userTokenId: data.userTokenId || "",
          currencySymbol: settings?.currency?.symbol || "€",
          creditsName: settings?.credits?.name || "Credits",
          creditsSymbol: settings?.credits?.symbol || "Credits",
          creditsDecimals: settings?.credits?.decimals || 2,
          creditsReceived: eurToCredits(amountNum),
          vatEnabled: vatEnabled && vatAmount > 0,
          // Reason: On mobile, the payment page needs to know where to redirect back
          ...(isMobile ? { returnUrl: window.location.pathname } : {}),
        };

        // Encode payment data (UTF-8 safe)
        const jsonStr = JSON.stringify(paymentData);
        const bytes = new TextEncoder().encode(jsonStr);
        const encoded = btoa(String.fromCharCode(...bytes));
        const paymentUrl = `/payment/nuvei?d=${encodeURIComponent(encoded)}`;

        if (isMobile) {
          // MOBILE: Full-page redirect — save pending TX for cleanup on return
          try {
            sessionStorage.setItem("nuvei-pending-tx", data.clientUniqueId);
          } catch {
            // sessionStorage may be unavailable
          }
          window.location.href = paymentUrl;
          return; // Navigation in progress — don't update state
        }

        // DESKTOP: Navigate popup to the Nuvei payment page
        popup!.location.href = paymentUrl;

        // Track popup state
        setNuveiPopupOpen(true);
        setStep("payment");
      } else if (provider === "paddle") {
        // Create Paddle checkout
        const response = await fetch("/api/paddle/create-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId, // For server-side idempotency
          },
          body: JSON.stringify({
            amount: amountNum,
            currency: settings?.currency?.code || "EUR",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create Paddle checkout");
        }

        const data = await response.json();

        // Paddle redirects to hosted checkout
        if (data.checkoutUrl) {
          // Validate URL is HTTPS before redirect (security check)
          try {
            const url = new URL(data.checkoutUrl);
            if (url.protocol !== "https:" && url.hostname !== "localhost") {
              throw new Error("Invalid checkout URL protocol");
            }
            window.location.href = data.checkoutUrl;
          } catch {
            throw new Error("Invalid checkout URL received from Paddle");
          }
        } else {
          throw new Error("No checkout URL received from Paddle");
        }
      } else if (provider === "atlas") {
        // Atlas: create a hosted-form payment, then full-page redirect.
        const response = await fetch("/api/atlas/open-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
          },
          body: JSON.stringify({
            amount: totalPayment,
            baseAmount: amountNum,
            currency: settings?.currency?.code || "EUR",
            vatPercentage: vatEnabled ? vatPercentage : 0,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to create Atlas payment");
        }

        if (data.paymentUrl) {
          // Validate URL is HTTPS before redirect (security check).
          try {
            const url = new URL(data.paymentUrl);
            if (url.protocol !== "https:" && url.hostname !== "localhost") {
              throw new Error("Invalid payment URL protocol");
            }
            window.location.href = data.paymentUrl;
          } catch {
            throw new Error("Invalid payment URL received from Atlas");
          }
        } else {
          throw new Error("No payment URL received from Atlas");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("amount");
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  // Reason: Generic cancel function — works for both Nuvei and Stripe pending transactions.
  // The /api/nuvei/cancel-order endpoint accepts `txn_[transactionId]` format
  // and finds the transaction by ID regardless of provider.
  const cancelPendingDepositTransaction = async (reason: string = "User cancelled payment") => {
    // Determine which clientUniqueId to use (Nuvei or Stripe)
    const clientId = nuveiClientUniqueId || (stripeTransactionId ? `txn_${stripeTransactionId}` : "");
    if (!clientId) return;
    try {
      await fetch("/api/nuvei/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientUniqueId: clientId,
          status: "cancelled",
          reason,
        }),
      });
    } catch (err) {
      console.error("Failed to cancel pending transaction:", err);
    }
  };

  const resetModal = async (cancelTransaction = true) => {
    // Reason: Cancel any pending transaction (Nuvei or Stripe) before resetting.
    // This ensures abandoned deposits don't stay as "pending" in the DB.
    if (cancelTransaction && step === "payment") {
      await cancelPendingDepositTransaction("User closed payment modal");
    }

    // Close any open Nuvei popup
    if (nuveiPopupRef.current && !nuveiPopupRef.current.closed) {
      nuveiPopupRef.current.close();
    }
    nuveiPopupRef.current = null;
    if (nuveiPopupPollRef.current) {
      clearInterval(nuveiPopupPollRef.current);
      nuveiPopupPollRef.current = null;
    }

    setAmount("50");
    setClientSecret("");
    setError("");
    setLoading(false);
    setStep("amount");
    // Reset Nuvei state - keep nuveiLoaded true if SDK already loaded
    setNuveiSessionToken("");
    setNuveiClientUniqueId("");
    setNuveiUserEmail("");
    setNuveiUserTokenId("");
    setNuveiPopupOpen(false);
    setStripeTransactionId("");
    // FIX: Don't reset nuveiLoaded to false if SDK is already in window
    // The Script onLoad only fires once per page load
    setNuveiLoaded(typeof window !== "undefined" && !!window.SafeCharge);

    // SECURITY: Reset processing refs to allow new transactions
    isProcessingRef.current = false;
    lastRequestIdRef.current = null;
  };

  const renderProviderIcon = (provider: PaymentProvider) => {
    switch (provider) {
      case "stripe":
        return <CreditCard className="h-5 w-5" />;
      case "nuvei":
        return <Gem className="h-5 w-5" />;
      case "atlas":
        return <Shield className="h-5 w-5" />;
      case "paddle":
        return <Globe className="h-5 w-5" />;
    }
  };

  const getProviderName = (provider: PaymentProvider) => {
    switch (provider) {
      case "stripe":
        return "Credit/Debit Card";
      case "nuvei":
        return "Nuvei Secure Payment";
      case "atlas":
        return "Atlas Secure Payment";
      case "paddle":
        return "Paddle (Global)";
    }
  };

  const getProviderDescription = (provider: PaymentProvider) => {
    switch (provider) {
      case "stripe":
        return "Pay securely with your card";
      case "nuvei":
        return "Fast & secure card payments";
      case "atlas":
        return "Secure card payment via Atlas";
      case "paddle":
        return "Multiple payment methods, taxes included";
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={async (isOpen) => {
        // Reason: Block closing while Nuvei popup payment is in progress.
        // The popup handles the payment — closing the modal here would orphan the flow.
        if (!isOpen && nuveiPopupOpen) {
          return;
        }
        if (!isOpen) {
          // Cancel pending transaction when closing the modal
          await resetModal(true);
        }
        setOpen(isOpen);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent
        className="bg-gray-900 border-gray-700 max-sm:border-0"
        fullScreenMobile
        size="default"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <Zap className="h-5 w-5 text-yellow-500" />
            Buy {settings?.credits.name || "Credits"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Purchase {settings?.credits.name || "credits"} to enter competitions
            and start trading
          </DialogDescription>
        </DialogHeader>

        {checkingConfig ? (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-500" />
            <p className="text-sm text-gray-400">Checking payment options...</p>
          </div>
        ) : !paymentConfigured ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">
                Payment System Not Configured
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                No payment provider is set up. Please contact the administrator.
              </p>
            </div>
          </div>
        ) : kycBlocksDeposit ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-100">
                Identity Verification Required
              </h3>
              <p className="text-sm text-gray-400 mt-2">
                You need to complete identity verification (KYC) before making
                deposits.
              </p>
              <Button
                variant="default"
                className="mt-4 bg-amber-600 hover:bg-amber-700"
                onClick={() => {
                  setOpen(false);
                  window.location.href = "/profile?tab=kyc";
                }}
              >
                <Shield className="h-4 w-4 mr-2" />
                Verify Identity
              </Button>
            </div>
            <Button
              onClick={() => setOpen(false)}
              variant="outline"
              className="mt-4"
            >
              Close
            </Button>
          </div>
        ) : step === "amount" ? (
          // Step 1: Enter Amount
          <form onSubmit={handleAmountSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-300">
                Amount ({settings?.currency?.code || "EUR"})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {settings?.currency?.symbol || "€"}
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min={minDeposit}
                  max={maxDeposit}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-700 text-gray-100"
                  placeholder="50.00"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                Minimum: {settings?.currency?.symbol || "€"}
                {minDeposit} • Maximum: {settings?.currency?.symbol || "€"}
                {maxDeposit.toLocaleString()}
              </p>
            </div>

            {/* Conversion Preview */}
            {amount &&
              !isNaN(parseFloat(amount)) &&
              settings &&
              (() => {
                const amountNum = parseFloat(amount);
                const vatAmount = calculateVAT(amountNum);
                const platformFeeAmount = calculatePlatformFee(amountNum);
                const totalPayment = calculateTotalPayment(amountNum);
                const creditsReceived = eurToCredits(amountNum);

                return (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-white">
                            {settings.currency.symbol}
                            {amountNum.toFixed(2)}
                          </span>
                        </div>
                        <ArrowRight className="h-5 w-5 text-yellow-500" />
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-yellow-500" />
                          <span className="text-2xl font-bold text-yellow-400">
                            {creditsReceived.toFixed(settings.credits.decimals)}{" "}
                            {settings.credits.symbol}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-yellow-500/20 space-y-1 text-sm">
                        <div className="flex justify-between text-gray-400">
                          <span>Credits Value:</span>
                          <span className="text-gray-300">
                            {settings.currency.symbol}
                            {amountNum.toFixed(2)}
                          </span>
                        </div>

                        {vatEnabled && vatAmount > 0 && (
                          <div className="flex justify-between text-gray-400">
                            <span>VAT ({vatPercentage}%):</span>
                            <span className="text-orange-400">
                              +{settings.currency.symbol}
                              {vatAmount.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {processingFee > 0 && (
                          <div className="flex justify-between text-gray-400">
                            <span>Platform Fee ({processingFee}%):</span>
                            <span className="text-orange-400">
                              +{settings.currency.symbol}
                              {platformFeeAmount.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {(vatEnabled || processingFee > 0) && (
                          <div className="flex justify-between font-semibold text-white pt-1 border-t border-yellow-500/20">
                            <span>Total to Pay:</span>
                            <span>
                              {settings.currency.symbol}
                              {totalPayment.toFixed(2)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between font-semibold text-yellow-400 pt-1 border-t border-yellow-500/20">
                          <span>You Receive:</span>
                          <span>
                            {creditsReceived.toFixed(settings.credits.decimals)}{" "}
                            {settings.credits.symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
                >
                  {settings?.currency?.symbol || "€"}
                  {preset}
                </Button>
              ))}
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue to Payment"
              )}
            </Button>
          </form>
        ) : step === "provider" ? (
          // Step 2: Select Payment Provider
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-gray-300">Select Payment Method</Label>

              {getAvailableProviders().map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(provider);
                    proceedWithProvider(provider);
                  }}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedProvider === provider
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                  } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        selectedProvider === provider
                          ? "bg-yellow-500/20 text-yellow-500"
                          : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {renderProviderIcon(provider)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-gray-100">
                        {getProviderName(provider)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {getProviderDescription(provider)}
                      </div>
                    </div>
                    {loading && selectedProvider === provider && (
                      <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total to Pay</span>
                <span className="text-lg font-bold text-white">
                  {settings?.currency?.symbol || "€"}
                  {calculateTotalPayment(parseFloat(amount)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-400">You Receive</span>
                <span className="text-yellow-400 font-bold flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  {eurToCredits(parseFloat(amount)).toFixed(
                    settings?.credits?.decimals || 2,
                  )}{" "}
                  {settings?.credits?.symbol || "Credits"}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("amount")}
              disabled={loading}
              className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
            >
              Back
            </Button>
          </div>
        ) : step === "payment" &&
          clientSecret &&
          stripePromise &&
          selectedProvider === "stripe" ? (
          // Step 3: Stripe Payment Form
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#EAB308",
                  colorBackground: "#1F2937",
                  colorText: "#F3F4F6",
                  colorDanger: "#EF4444",
                  borderRadius: "8px",
                },
              },
            }}
          >
            <PaymentForm
              amount={parseFloat(amount)}
              totalAmount={calculateTotalPayment(parseFloat(amount))}
              vatAmount={calculateVAT(parseFloat(amount))}
              vatEnabled={vatEnabled}
              vatPercentage={vatPercentage}
              platformFeeAmount={calculatePlatformFee(parseFloat(amount))}
              platformFeePercentage={processingFee}
              onSuccess={() => {
                setOpen(false);
                resetModal(false); // Don't cancel - payment succeeded
              }}
              onCancel={async () => {
                // Reason: Cancel the pending Stripe transaction when user clicks Back,
                // so it doesn't stay as "pending" in the DB.
                await cancelPendingDepositTransaction("User cancelled Stripe payment");
                setStripeTransactionId("");
                setClientSecret("");
                setStep("provider");
              }}
            />
          </Elements>
        ) : null}

        {/* Action Terms Dialog — shown before proceeding to payment */}
        <ActionTermsDialog
          slug={ACTION_TERM_SLUGS.CREDIT_PURCHASE}
          open={showTerms}
          onAccept={proceedAfterTerms}
          onDecline={() => setShowTerms(false)}
        />

        {/* Nuvei Popup Waiting State */}
        {step === "payment" &&
          selectedProvider === "nuvei" &&
          nuveiPopupOpen ? (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-100">
                Complete Payment in Popup
              </h3>
              <p className="text-sm text-gray-400">
                A secure payment window has opened. Please enter your card
                details and complete the payment there.
              </p>
              <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for payment...
              </div>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Re-focus the popup if it exists
                  if (nuveiPopupRef.current && !nuveiPopupRef.current.closed) {
                    nuveiPopupRef.current.focus();
                  } else {
                    // Popup was closed — let user know
                    setNuveiPopupOpen(false);
                    setLoading(false);
                    setError("Payment window was closed. Please try again.");
                  }
                }}
                className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
              >
                Bring Payment Window to Front
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  // Close popup and cancel
                  if (nuveiPopupRef.current && !nuveiPopupRef.current.closed) {
                    nuveiPopupRef.current.close();
                  }
                  nuveiPopupRef.current = null;
                  setNuveiPopupOpen(false);
                  setLoading(false);
                  await cancelPendingDepositTransaction("User cancelled Nuvei payment");
                  setStep("provider");
                }}
                className="w-full bg-red-900/30 border-red-800/50 hover:bg-red-900/50 text-red-300"
              >
                Cancel Payment
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              Don&apos;t see the window? Your browser may have blocked it.
              <br />
              Please allow popups for this site.
            </p>
          </div>
        ) : step === "payment" &&
          selectedProvider === "nuvei" &&
          !nuveiPopupOpen ? (
          // Reason: The payment window was closed / declined. We never reuse the
          // old Nuvei session (that caused charged-but-uncredited retries). The
          // only path forward is a brand-new deposit with a fresh order.
          <div className="py-8 text-center space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2 text-left">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
            <Button
              type="button"
              onClick={() => {
                setError("");
                setNuveiSessionToken("");
                setNuveiClientUniqueId("");
                setNuveiUserEmail("");
                setNuveiUserTokenId("");
                setStep("amount");
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
            >
              Start New Deposit
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Payment Form Component (inside Stripe Elements)
function PaymentForm({
  amount,
  totalAmount,
  vatAmount,
  vatEnabled,
  vatPercentage,
  platformFeeAmount,
  platformFeePercentage,
  onSuccess,
  onCancel,
}: {
  amount: number;
  totalAmount: number;
  vatAmount: number;
  vatEnabled: boolean;
  vatPercentage: number;
  platformFeeAmount: number;
  platformFeePercentage: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { settings, eurToCredits } = useAppSettings();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const creditsReceived = eurToCredits(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/wallet?payment=success`,
        },
        redirect: "if_required",
      });

      if (submitError) {
        setError(submitError.message || "Payment failed");
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.refresh();
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-100">
            Payment Successful!
          </h3>
          <p className="text-sm text-gray-400 mt-2">
            {creditsReceived.toFixed(settings?.credits?.decimals || 2)}{" "}
            {settings?.credits?.symbol || "Credits"} added to your wallet
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Credits Value</span>
          <span className="text-lg font-bold text-gray-100">
            {settings?.currency?.symbol || "€"}
            {amount.toFixed(2)}
          </span>
        </div>

        {vatEnabled && vatAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">VAT ({vatPercentage}%)</span>
            <span className="text-orange-400">
              +{settings?.currency?.symbol || "€"}
              {vatAmount.toFixed(2)}
            </span>
          </div>
        )}

        {platformFeePercentage > 0 && platformFeeAmount > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">
              Platform Fee ({platformFeePercentage}%)
            </span>
            <span className="text-orange-400">
              +{settings?.currency?.symbol || "€"}
              {platformFeeAmount.toFixed(2)}
            </span>
          </div>
        )}

        {(vatEnabled || platformFeePercentage > 0) && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-600">
            <span className="text-sm font-semibold text-gray-300">
              Total to Pay
            </span>
            <span className="text-lg font-bold text-white">
              {settings?.currency?.symbol || "€"}
              {totalAmount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="text-sm font-semibold text-gray-300">
            You Receive
          </span>
          <span className="text-yellow-400 font-bold flex items-center gap-1">
            <Zap className="h-4 w-4" />
            {creditsReceived.toFixed(settings?.credits?.decimals || 2)}{" "}
            {settings?.credits?.symbol || "Credits"}
          </span>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-100"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay ${settings?.currency?.symbol || "€"}${totalAmount.toFixed(2)}`
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Secured by Stripe • Your payment information is encrypted
      </p>
    </form>
  );
}

// Reason: NuveiPaymentForm was removed — the payment flow now opens
// in a popup window at /payment/nuvei to avoid Radix Dialog blocking the 3DS iframe.
