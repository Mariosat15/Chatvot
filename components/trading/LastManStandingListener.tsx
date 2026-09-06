"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAppSettings } from "@/contexts/AppSettingsContext";

const LastManStandingPopup = dynamic(
  () => import("./LastManStandingPopup"),
  { ssr: false },
);

interface LastManStandingListenerProps {
  competitionId: string;
}

/**
 * Listens for the "lastManStanding" custom event dispatched by LiveRankingPanel.
 * When detected, shows a popup offering the player to claim early victory.
 * The popup auto-dismisses after 15 seconds; it can reappear on the next
 * polling cycle if the player still hasn't claimed.
 */
export default function LastManStandingListener({
  competitionId,
}: LastManStandingListenerProps) {
  const { settings } = useAppSettings();
  const currencySymbol = settings?.currency?.symbol || "€";
  const [showPopup, setShowPopup] = useState(false);
  const [prizePool, setPrizePool] = useState(0);
  const [popupKey, setPopupKey] = useState(0);

  const handleEvent = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.competitionId !== competitionId) return;

      setPrizePool(detail.prizePool || 0);
      setPopupKey((prev) => prev + 1);
      setShowPopup(true);
    },
    [competitionId],
  );

  useEffect(() => {
    window.addEventListener("lastManStanding", handleEvent);
    return () => window.removeEventListener("lastManStanding", handleEvent);
  }, [handleEvent]);

  if (!showPopup) return null;

  return (
    <LastManStandingPopup
      key={popupKey}
      competitionId={competitionId}
      prizePool={prizePool}
      currencySymbol={currencySymbol}
    />
  );
}
