"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FieldError,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from "react-hook-form";

type Props<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel";
  register: UseFormRegister<T>;
  error?: FieldError;
  validation?: RegisterOptions<T, Path<T>>;
  icon?: "mail" | "lock" | "none";
  showPasswordToggle?: boolean;
  onFocus?: () => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
};

function resolveIcon(icon: "mail" | "lock" | "none"): LucideIcon | null {
  if (icon === "mail") return Mail;
  if (icon === "lock") return Lock;
  return null;
}

export default function MobileAuthInput<T extends FieldValues>({
  name,
  label,
  placeholder,
  type = "text",
  register,
  error,
  validation,
  icon = "none",
  showPasswordToggle = false,
  onFocus,
  inputMode,
  autoComplete,
}: Props<T>) {
  const [visible, setVisible] = useState(false);
  const Icon = resolveIcon(icon);
  const inputType =
    showPasswordToggle && type === "password"
      ? visible
        ? "text"
        : "password"
      : type;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={String(name)}
        className="text-[11px] font-semibold uppercase tracking-wide text-cyan-100/75"
      >
        {label}
      </label>
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70"
            aria-hidden
          />
        ) : null}
        <input
          id={String(name)}
          type={inputType}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className={cn(
            "h-14 w-full rounded-xl border border-cyan-400/25 bg-[#06101e] text-[16px] text-white placeholder:text-cyan-100/35 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30",
            Icon ? "pl-11" : "px-3.5",
            showPasswordToggle ? "pr-11" : Icon ? "pr-3.5" : "",
          )}
          {...register(name, {
            ...validation,
            onFocus: (e) => {
              onFocus?.();
              const fromRules = validation?.onFocus;
              if (typeof fromRules === "function") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (fromRules as any)(e);
              }
            },
          })}
        />
        {showPasswordToggle ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-200/70 hover:text-cyan-100"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-400">{error.message}</p>
      ) : null}
    </div>
  );
}
