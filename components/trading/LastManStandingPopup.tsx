"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Timer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LastManStandingPopupProps {
  competitionId: string;
  prizePool: number;
  currencySymbol: string;
}

const COUNTDOWN_SECONDS = 15;

export default function LastManStandingPopup({
  competitionId,
  prizePool,
  currencySymbol,
}: LastManStandingPopupProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (dismissed || claiming) return;

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dismissed, claiming]);

  // Reason: When countdown hits 0 and user hasn't acted, auto-dismiss.
  // The popup will reappear on the next ranking poll cycle (15s).
  useEffect(() => {
    if (countdown === 0 && !claiming) {
      setVisible(false);
    }
  }, [countdown, claiming]);

  const handleClaimVictory = useCallback(async () => {
    setClaiming(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const response = await fetch(
        `/api/competitions/${competitionId}/claim-early-end`,
        { method: "POST" },
      );
      const data = await response.json();

      if (data.success) {
        toast.success("Competition ended! You are the winner!");
        setVisible(false);
        setTimeout(() => {
          router.push(`/competitions/${competitionId}`);
        }, 1500);
      } else {
        toast.error(data.error || "Failed to end competition");
        setClaiming(false);
      }
    } catch {
      toast.error("Something went wrong. Please contact support.");
      setClaiming(false);
    }
  }, [competitionId, router]);

  const handleContinue = useCallback(() => {
    setDismissed(true);
    setVisible(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  if (dismissed || !visible) return null;

  const progressPct = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-[90vw] max-w-md mx-4"
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/30 via-amber-500/20 to-yellow-500/30 rounded-2xl blur-xl animate-pulse" />

            <div className="relative bg-gradient-to-br from-dark-200 via-dark-300 to-dark-200 rounded-2xl border border-yellow-500/30 shadow-2xl shadow-yellow-500/10 overflow-hidden">
              {/* Countdown progress bar */}
              <div className="h-1 bg-dark-500/50 w-full">
                <motion.div
                  className="h-full bg-gradient-to-r from-yellow-400 to-amber-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5, ease: "linear" }}
                />
              </div>

              <div className="p-6 md:p-8 text-center space-y-5">
                {/* Crown icon */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="flex justify-center"
                >
                  <div className="relative">
                    <div className="absolute -inset-3 bg-yellow-400/20 rounded-full blur-lg" />
                    <Crown className="h-14 w-14 text-yellow-400 relative" />
                  </div>
                </motion.div>

                {/* Title */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300">
                    Last Man Standing!
                  </h2>
                  <p className="mt-2 text-sm md:text-base text-gray-300 leading-relaxed">
                    The remaining player is just you. End the competition now
                    and claim your winnings, or continue trading until the
                    competition ends.
                  </p>
                </div>

                {/* Prize pool */}
                {prizePool > 0 && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                    <span className="text-lg font-bold text-yellow-400">
                      {currencySymbol}{prizePool.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400">Prize Pool</span>
                  </div>
                )}

                {/* Countdown */}
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Timer className="h-4 w-4" />
                  <span className="text-sm tabular-nums">
                    Auto-dismiss in{" "}
                    <span className="font-bold text-yellow-400">{countdown}s</span>
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleClaimVictory}
                    disabled={claiming}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-dark-100 font-bold py-3 text-base shadow-lg shadow-yellow-500/20 transition-all"
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Ending...
                      </>
                    ) : (
                      <>
                        <Trophy className="h-4 w-4 mr-2" />
                        End Now & Claim
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleContinue}
                    disabled={claiming}
                    variant="outline"
                    className="flex-1 border-dark-400 text-gray-300 hover:bg-dark-400/50 hover:text-gray-100 font-semibold py-3 text-base transition-all"
                  >
                    Continue Trading
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
