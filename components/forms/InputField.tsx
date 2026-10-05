"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputFieldProps extends FormInputProps {
  onFocus?: () => void;
  onBlur?: () => void;
  autoComplete?: string;
  /** Adds an eye button that reveals what was typed. Only used when `type="password"`. */
  showPasswordToggle?: boolean;
}

const InputField = ({
  name,
  label,
  placeholder,
  type = "text",
  register,
  error,
  validation,
  disabled,
  value,
  onFocus,
  onBlur,
  autoComplete,
  showPasswordToggle = false,
}: InputFieldProps) => {
  const [revealed, setRevealed] = useState(false);
  const hasToggle = showPasswordToggle && type === "password";
  const inputType = hasToggle && revealed ? "text" : type;

  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="form-label">
        {label}
      </Label>
      <div className="relative">
        <Input
          type={inputType}
          id={name}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          autoComplete={autoComplete}
          className={cn("form-input", {
            "opacity-50 cursor-not-allowed": disabled,
            "pr-11": hasToggle,
          })}
          onFocus={onFocus}
          onBlur={onBlur}
          {...register(name, validation)}
        />
        {hasToggle && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-cyan-100/60 hover:text-cyan-100"
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            disabled={disabled}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error.message}</p>}
    </div>
  );
};
export default InputField;
