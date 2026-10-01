/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Country-code + national number input for registration.
 *
 * Stores two form fields: `phoneCountry` (ISO 3166-1 alpha-2) and `phoneNational`
 * (digits the user typed). The server re-parses both into E.164 before saving —
 * this component never writes the stored form itself.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Control,
  Controller,
  FieldError,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import countryList from "react-select-country-list";
import {
  dialCodeFor,
  listDialCountries,
  parsePhoneInput,
} from "@/lib/utils/phone";

type PhoneInputFieldProps = {
  control: Control<any>;
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
  countryError?: FieldError;
  nationalError?: FieldError;
  /** When the residence country changes and the dial country is still empty, follow it. */
  syncFromCountryField?: string;
  required?: boolean;
};

function flagEmoji(countryCode: string): string {
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0)),
  );
}

type DialOption = { value: string; label: string; dial: string };

export function PhoneInputField({
  control,
  register,
  setValue,
  watch,
  countryError,
  nationalError,
  syncFromCountryField = "country",
  required = true,
}: PhoneInputFieldProps) {
  const [open, setOpen] = useState(false);
  const phoneCountry = watch("phoneCountry") || "";
  const residenceCountry = syncFromCountryField
    ? watch(syncFromCountryField)
    : "";

  const options: DialOption[] = useMemo(() => {
    const names = new Map(
      countryList()
        .getData()
        .map((c: { value: string; label: string }) => [c.value, c.label]),
    );
    const dialable = new Set(listDialCountries());
    return Array.from(dialable)
      .map((code) => {
        const dial = dialCodeFor(code);
        if (!dial) return null;
        return {
          value: code,
          label: names.get(code) || code,
          dial,
        };
      })
      .filter((o): o is DialOption => o !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Reason: follow the residence country once, so picking Cyprus for "Country"
  // pre-fills +357 without fighting a later manual dial-code change.
  useEffect(() => {
    if (
      residenceCountry &&
      !phoneCountry &&
      dialCodeFor(residenceCountry)
    ) {
      setValue("phoneCountry", residenceCountry, { shouldValidate: false });
    }
  }, [residenceCountry, phoneCountry, setValue]);

  const selected = options.find((o) => o.value === phoneCountry);
  const dialPrefix = selected?.dial || dialCodeFor(phoneCountry) || "";

  return (
    <div className="space-y-2">
      <Label className="form-label">
        Phone number{required ? "" : " (optional)"}
      </Label>
      <div className="flex gap-2">
        <Controller
          name="phoneCountry"
          control={control}
          rules={{
            required: required ? "Select a country code" : false,
          }}
          render={({ field }) => (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="country-select-trigger w-[9.5rem] shrink-0 px-2"
                >
                  {field.value && dialCodeFor(field.value) ? (
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{flagEmoji(field.value)}</span>
                      <span className="font-mono text-sm">
                        {dialCodeFor(field.value)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Code</span>
                  )}
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[22rem] p-0 bg-gray-800 border-gray-600"
                align="start"
              >
                <Command className="bg-gray-800 border-gray-600">
                  <CommandInput
                    placeholder="Search country or code..."
                    className="country-select-input"
                  />
                  <CommandEmpty className="country-select-empty">
                    No country found.
                  </CommandEmpty>
                  <CommandList className="max-h-60 bg-gray-800 scrollbar-hide-default">
                    <CommandGroup className="bg-gray-800">
                      {options.map((opt) => (
                        <CommandItem
                          key={opt.value}
                          value={`${opt.label} ${opt.value} ${opt.dial}`}
                          onSelect={() => {
                            field.onChange(opt.value);
                            setOpen(false);
                          }}
                          className="country-select-item"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 text-yellow-500",
                              field.value === opt.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="flex items-center gap-2 min-w-0">
                            <span>{flagEmoji(opt.value)}</span>
                            <span className="truncate">{opt.label}</span>
                            <span className="ml-auto font-mono text-xs text-gray-400">
                              {opt.dial}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        />

        <div className="relative flex-1 min-w-0">
          <Input
            type="tel"
            id="phoneNational"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={
              dialPrefix ? `Number without ${dialPrefix}` : "Phone number"
            }
            className="form-input"
            {...register("phoneNational", {
              required: required ? "Phone number is required" : false,
              validate: (value: string) => {
                if (!required && !(value || "").trim()) return true;
                const country = watch("phoneCountry");
                if (!country) return "Select a country code first";
                const result = parsePhoneInput(value, country);
                return result.ok || result.error;
              },
            })}
          />
        </div>
      </div>
      {(countryError || nationalError) && (
        <p className="text-sm text-red-500">
          {nationalError?.message || countryError?.message}
        </p>
      )}
    </div>
  );
}
