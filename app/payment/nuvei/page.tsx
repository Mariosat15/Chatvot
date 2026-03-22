 
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

// ── SafeCharge SDK type declarations ────────────────────────────────────────
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
          userTokenId?: string;
          savePM?: boolean;
          userDetails?: {
            firstName?: string;
            lastName?: string;
            email?: string;
            country?: string;
            phone?: string;
            address?: string;
            city?: string;
            zip?: string;
          };
          billingAddress?: {
            firstName?: string;
            lastName?: string;
            email?: string;
            country?: string;
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

// ── Payment data structure passed via URL ───────────────────────────────────
interface PaymentData {
  sessionToken: string;
  clientUniqueId: string;
  merchantId: string;
  siteId: string;
  testMode: boolean;
  sdkUrl: string;
  amount: number;
  totalAmount: number;
  vatAmount: number;
  vatPercentage: number;
  platformFeeAmount: number;
  platformFeePercentage: number;
  userEmail: string;
  userTokenId: string;
  currencySymbol: string;
  creditsName: string;
  creditsSymbol: string;
  creditsDecimals: number;
  creditsReceived: number;
  vatEnabled: boolean;
}

// ── Icons (inline SVGs to avoid heavy imports) ──────────────────────────────
function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className || ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// ── Main payment content ────────────────────────────────────────────────────
function NuveiPaymentContent() {
  const searchParams = useSearchParams();

  // Parse payment data from URL
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    try {
      const encoded = searchParams.get("d");
      if (!encoded) {
        setParseError("No payment data found. Please close this window and try again.");
        return;
      }
      // Reason: Decode UTF-8 safe base64 — reverse of TextEncoder + btoa in DepositModal
      const binaryStr = atob(decodeURIComponent(encoded));
      const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
      const decoded = JSON.parse(new TextDecoder().decode(bytes)) as PaymentData;
      if (!decoded.sessionToken || !decoded.merchantId || !decoded.siteId) {
        setParseError("Invalid payment data. Please close this window and try again.");
        return;
      }
      setPaymentData(decoded);
    } catch {
      setParseError("Failed to load payment data. Please close this window and try again.");
    }
  }, [searchParams]);

  if (parseError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <XIcon className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-100">Payment Error</h2>
          <p className="text-gray-400">{parseError}</p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoaderIcon className="h-8 w-8 text-yellow-500 mx-auto" />
          <p className="text-gray-400">Loading payment data...</p>
        </div>
      </div>
    );
  }

  return <NuveiPaymentForm data={paymentData} />;
}

// ── Nuvei Payment Form ──────────────────────────────────────────────────────
function NuveiPaymentForm({ data }: { data: PaymentData }) {
  const cardFieldRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sfcRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scard, setScard] = useState<any>(null);
  const [sfcInitialized, setSfcInitialized] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cardHolderName, setCardHolderName] = useState("");
  const [email, setEmail] = useState(data.userEmail || "");
  const [cardFieldReady, setCardFieldReady] = useState(false);

  // Ref to prevent double-clicks
  const isSubmittingRef = useRef(false);

  // ── Send result back to parent window ─────────────────────────────────
  const sendResultToParent = (result: {
    success: boolean;
    error?: string;
    transactionId?: string;
  }) => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "nuvei-payment-result", ...result },
          window.location.origin,
        );
      }
    } catch (e) {
      console.error("Failed to send result to parent:", e);
    }
  };

  // ── Initialize Nuvei SDK when loaded ──────────────────────────────────
  useEffect(() => {
    if (!sdkLoaded || !window.SafeCharge || sfcInitialized || !cardFieldRef.current) {
      return;
    }

    try {
      const sfc = window.SafeCharge({
        env: data.testMode ? "int" : "prod",
        merchantId: data.merchantId,
        merchantSiteId: data.siteId,
      });

      sfcRef.current = sfc;

      const ScFields = sfc.fields({
        fonts: [{ cssUrl: "https://fonts.googleapis.com/css?family=Inter" }],
      });

      const style = {
        base: {
          color: "#F3F4F6",
          fontWeight: "500",
          fontFamily: "Inter, sans-serif",
          fontSize: "16px",
          fontSmoothing: "antialiased",
          "::placeholder": { color: "#9CA3AF" },
        },
        invalid: {
          color: "#EF4444",
          "::placeholder": { color: "#FCA5A5" },
        },
      };

      const cardField = ScFields.create("card", { style });
      cardField.attach(cardFieldRef.current);
      cardField.on("ready", () => setCardFieldReady(true));
      cardField.on("error", (evt: unknown) => console.error("Card field error:", evt));

      setScard(cardField);
      setSfcInitialized(true);
    } catch (err) {
      console.error("Failed to initialize Nuvei:", err);
      setError("Failed to initialize payment form. Please close and try again.");
    }
  }, [sdkLoaded, data.merchantId, data.siteId, data.testMode, sfcInitialized]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    const cardEl = cardFieldRef.current;
    return () => {
      if (cardEl) cardEl.innerHTML = "";
      sfcRef.current = null;
    };
  }, []);

  // ── Handle payment submission ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || loading) return;

    if (!scard || !window.SafeCharge) {
      setError("Payment form not ready. Please wait or refresh.");
      return;
    }

    // Validate cardholder name
    const sanitizedName = cardHolderName.trim().replace(/[<>]/g, "");
    if (!sanitizedName || sanitizedName.length < 2 || sanitizedName.length > 100) {
      setError("Please enter a valid cardholder name (2-100 characters)");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const sfc = sfcRef.current;
      if (!sfc) {
        throw new Error("Payment system not initialized");
      }

      const nameParts = cardHolderName.trim().split(" ");
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(" ") || "Customer";

      // Reason: In this popup window, the 3DS challenge renders naturally
      // without any Radix Dialog overlay blocking it.
      sfc.createPayment(
        {
          sessionToken: data.sessionToken,
          clientUniqueId: data.clientUniqueId,
          cardHolderName: cardHolderName.trim(),
          paymentOption: scard,
          userTokenId: data.userTokenId || undefined,
          savePM: true,
          userDetails: {
            firstName,
            lastName,
            email: email.trim(),
            phone: "",
            country: "CY",
          },
          billingAddress: {
            firstName,
            lastName,
            email: email.trim(),
            phone: "",
            country: "CY",
            address: "N/A",
            city: "Nicosia",
            zip: "1000",
          },
        },
        async (result: {
          result: string;
          errCode: string;
          errorDescription?: string;
          reason?: string;
          transactionId?: string;
        }) => {
          if (result.result === "APPROVED" && result.errCode === "0") {
            // Verify payment on server
            try {
              const verifyResponse = await fetch("/api/nuvei/payment-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionToken: data.sessionToken,
                  clientUniqueId: data.clientUniqueId,
                }),
              });

              const verifyData = await verifyResponse.json();

              if (verifyData.success || verifyData.status === "APPROVED") {
                setSuccess(true);
                isSubmittingRef.current = false;
                sendResultToParent({
                  success: true,
                  transactionId: result.transactionId,
                });
                // Auto-close popup after 3 seconds
                setTimeout(() => {
                  window.close();
                }, 3000);
              } else {
                const errMsg = verifyData.reason || "Payment verification failed";
                setError(errMsg);
                setLoading(false);
                isSubmittingRef.current = false;
                sendResultToParent({ success: false, error: errMsg });
              }
            } catch {
              setError("Payment verification failed. Please check your wallet.");
              setLoading(false);
              isSubmittingRef.current = false;
              sendResultToParent({ success: false, error: "Verification failed" });
            }
          } else {
            // Payment failed
            const failReason =
              result.errorDescription || result.reason || result.result || "Payment failed";

            // Notify server
            try {
              await fetch("/api/nuvei/cancel-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientUniqueId: data.clientUniqueId,
                  status: "failed",
                  reason: failReason,
                  errorCode: result.errCode,
                  errorDescription: result.errorDescription,
                }),
              });
            } catch (cancelErr) {
              console.error("Failed to notify server:", cancelErr);
            }

            // User-friendly error messages
            let userError = failReason;
            if (failReason.toLowerCase().includes("3d") || failReason.toLowerCase().includes("authentication")) {
              userError = "3D Secure authentication failed. Please try a different card.";
            } else if (failReason.toLowerCase().includes("declined")) {
              userError = "Your card was declined. Please try a different card.";
            } else if (failReason.toLowerCase().includes("system error")) {
              userError = "Payment system temporarily unavailable. Please try again.";
            }

            setError(userError);
            setLoading(false);
            isSubmittingRef.current = false;
            sendResultToParent({ success: false, error: userError });
          }
        },
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Payment failed";

      try {
        await fetch("/api/nuvei/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientUniqueId: data.clientUniqueId,
            status: "failed",
            reason: errorMsg,
          }),
        });
      } catch (cancelErr) {
        console.error("Failed to notify server:", cancelErr);
      }

      setError(errorMsg);
      setLoading(false);
      isSubmittingRef.current = false;
      sendResultToParent({ success: false, error: errorMsg });
    }
  };

  // ── Handle cancel / close ─────────────────────────────────────────────
  const handleCancel = async () => {
    if (data.clientUniqueId && !success) {
      try {
        await fetch("/api/nuvei/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientUniqueId: data.clientUniqueId,
            status: "cancelled",
            reason: "User closed payment window",
          }),
        });
      } catch {
        // Ignore cancel errors
      }
    }
    sendResultToParent({ success: false, error: "cancelled" });
    window.close();
  };

  // ── Success screen ────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckIcon className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-100">Payment Successful!</h2>
          <p className="text-gray-400">
            {data.creditsReceived.toFixed(data.creditsDecimals)} {data.creditsSymbol} added
            to your wallet
          </p>
          <p className="text-sm text-gray-500">This window will close automatically...</p>
        </div>
      </div>
    );
  }

  // ── Payment form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      {/* Load Nuvei SDK */}
      <Script
        src={data.sdkUrl}
        onLoad={() => setSdkLoaded(true)}
        onReady={() => {
          if (window.SafeCharge && !sdkLoaded) setSdkLoaded(true);
        }}
        onError={() => setError("Failed to load payment SDK. Please close and try again.")}
        strategy="afterInteractive"
      />

      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
            <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-100">Secure Payment</h1>
          <p className="text-sm text-gray-400">Complete your purchase securely</p>
        </div>

        {/* Order Summary */}
        <div className="rounded-xl bg-gray-800/60 border border-gray-700 p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Credits Value</span>
            <span className="text-lg font-bold text-gray-100">
              {data.currencySymbol}{data.amount.toFixed(2)}
            </span>
          </div>

          {data.vatEnabled && data.vatAmount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">VAT ({data.vatPercentage}%)</span>
              <span className="text-orange-400">
                +{data.currencySymbol}{data.vatAmount.toFixed(2)}
              </span>
            </div>
          )}

          {data.platformFeePercentage > 0 && data.platformFeeAmount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">
                Platform Fee ({data.platformFeePercentage}%)
              </span>
              <span className="text-orange-400">
                +{data.currencySymbol}{data.platformFeeAmount.toFixed(2)}
              </span>
            </div>
          )}

          {(data.vatEnabled || data.platformFeePercentage > 0) && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-600">
              <span className="text-sm font-semibold text-gray-300">Total</span>
              <span className="text-lg font-bold text-white">
                {data.currencySymbol}{data.totalAmount.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-gray-700">
            <span className="text-sm font-semibold text-gray-300">You Receive</span>
            <span className="text-yellow-400 font-bold">
              ⚡ {data.creditsReceived.toFixed(data.creditsDecimals)} {data.creditsSymbol}
            </span>
          </div>
        </div>

        {/* Card Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cardholder Name */}
          <div className="space-y-1.5">
            <label htmlFor="cardHolderName" className="text-sm font-medium text-gray-300">
              Cardholder Name
            </label>
            <input
              id="cardHolderName"
              type="text"
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
              placeholder="John Smith"
              required
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-gray-300">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
              placeholder="john@example.com"
              required
              disabled={loading}
            />
          </div>

          {/* Nuvei Card Field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">Card Details</label>
            <div
              ref={cardFieldRef}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 min-h-[50px] relative"
            >
              {!cardFieldReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg">
                  <LoaderIcon className="h-5 w-5 text-gray-400" />
                  <span className="ml-2 text-sm text-gray-400">Loading card form...</span>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
              <XIcon className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !sfcInitialized}
              className="flex-1 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoaderIcon className="h-4 w-4" />
                  Processing...
                </>
              ) : (
                `Pay ${data.currencySymbol}${data.totalAmount.toFixed(2)}`
              )}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 pt-1">
            🔒 Secured by Nuvei • Your payment information is encrypted
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Page component with Suspense boundary for useSearchParams ───────────────
export default function NuveiPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center space-y-4">
            <LoaderIcon className="h-8 w-8 text-yellow-500 mx-auto" />
            <p className="text-gray-400">Preparing secure payment...</p>
          </div>
        </div>
      }
    >
      <NuveiPaymentContent />
    </Suspense>
  );
}
