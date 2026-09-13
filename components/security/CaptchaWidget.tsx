"use client";

import { useEffect, useRef, useState } from "react";

/**
 * CaptchaWidget
 *
 * Renders the configured registration challenge (Cloudflare Turnstile, hCaptcha,
 * or Google reCAPTCHA v2) and reports the resulting token via `onToken`. The
 * provider + public site key come from /api/security/challenge-config, so admins
 * control it entirely from the Fraud Settings panel. Server-side verification is
 * done in lib/services/captcha.service.ts.
 */

type Provider = "none" | "turnstile" | "hcaptcha" | "recaptcha";

interface ChallengeConfig {
  enabled: boolean;
  provider: Provider;
  siteKey: string;
}

interface CaptchaWidgetProps {
  onToken: (token: string) => void;
  /** Notifies the parent whether a challenge is required (so it can gate submit). */
  onEnabledChange?: (enabled: boolean) => void;
}

const SCRIPTS: Record<Exclude<Provider, "none">, string> = {
  turnstile:
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  hcaptcha: "https://js.hcaptcha.com/1/api.js?render=explicit",
  recaptcha: "https://www.google.com/recaptcha/api.js?render=explicit",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGlobal(provider: Exclude<Provider, "none">): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (provider === "turnstile") return w.turnstile;
  if (provider === "hcaptcha") return w.hcaptcha;
  return w.grecaptcha;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export default function CaptchaWidget({
  onToken,
  onEnabledChange,
}: CaptchaWidgetProps) {
  const [config, setConfig] = useState<ChallengeConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // 1. Fetch the public challenge config.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/security/challenge-config")
      .then((r) => r.json())
      .then((cfg: ChallengeConfig) => {
        if (cancelled) return;
        setConfig(cfg);
        onEnabledChange?.(!!cfg.enabled && cfg.provider !== "none");
      })
      .catch(() => {
        if (!cancelled) onEnabledChange?.(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Load the provider script and render the widget.
  useEffect(() => {
    if (!config?.enabled || config.provider === "none" || !config.siteKey) {
      return;
    }
    const provider = config.provider as Exclude<Provider, "none">;
    let poll: ReturnType<typeof setInterval> | null = null;

    // eslint-disable-next-line security/detect-object-injection -- provider is a fixed union ("turnstile" | "hcaptcha" | "recaptcha"), not user input
    loadScript(SCRIPTS[provider])
      .then(() => {
        // Provider globals initialize asynchronously — poll until ready.
        poll = setInterval(() => {
          const api = getGlobal(provider);
          if (!api || !containerRef.current || renderedRef.current) return;
          if (typeof api.render !== "function") return;
          if (poll) clearInterval(poll);
          renderedRef.current = true;

          api.render(containerRef.current, {
            sitekey: config.siteKey,
            callback: (token: string) => onToken(token),
            "expired-callback": () => onToken(""),
            "error-callback": () => onToken(""),
          });
        }, 200);
      })
      .catch(() => onEnabledChange?.(false));

    return () => {
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  if (!config?.enabled || config.provider === "none") return null;

  return <div ref={containerRef} className="my-2 flex justify-center" />;
}
