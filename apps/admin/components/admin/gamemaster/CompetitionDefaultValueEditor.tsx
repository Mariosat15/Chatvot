"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CompetitionDefaultOption,
  PrizeShare,
} from "@/lib/services/gamemaster/competition-defaults";

interface Props {
  option: CompetitionDefaultOption;
  value: unknown;
  onChange: (value: unknown) => void;
}

function asPrizeList(value: unknown): PrizeShare[] {
  return Array.isArray(value)
    ? value.map((entry, index) => ({
        rank: index + 1,
        percentage: Number((entry as PrizeShare | null)?.percentage ?? 0),
      }))
    : [];
}

/** The input for one option's default, chosen by the option's kind. */
export default function CompetitionDefaultValueEditor({ option, value, onChange }: Props) {
  switch (option.kind) {
    case "number":
      return (
        <Input
          type="number"
          className="w-40"
          min={option.min}
          max={option.max}
          step={option.integer ? 1 : "any"}
          // Reason: the raw text is kept while typing, so clearing the box to type a new
          // number does not snap it back; the save check reports a value that is not a number.
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = Number(raw);
            onChange(raw.trim() !== "" && Number.isFinite(parsed) ? parsed : raw);
          }}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
          <span className="text-sm text-gray-300">{value === true ? "On" : "Off"}</span>
        </div>
      );
    case "choice":
      return (
        <Select value={typeof value === "string" ? value : undefined} onValueChange={onChange}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            {option.choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi": {
      const selected = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <div className="flex flex-wrap gap-4">
          {option.choices.map((choice) => (
            <label key={choice.value} className="flex items-center gap-2 text-sm text-gray-300">
              <Checkbox
                checked={selected.has(choice.value)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked === true) next.add(choice.value);
                  else next.delete(choice.value);
                  onChange([...next]);
                }}
              />
              {choice.label}
            </label>
          ))}
        </div>
      );
    }
    case "prizes": {
      const shares = asPrizeList(value);
      const total = shares.reduce((sum, share) => sum + share.percentage, 0);
      const update = (next: PrizeShare[]) =>
        onChange(next.map((share, index) => ({ rank: index + 1, percentage: share.percentage })));
      return (
        <div className="space-y-2">
          {shares.map((share, index) => (
            <div key={share.rank} className="flex items-center gap-2">
              <span className="w-12 text-sm text-gray-400">#{share.rank}</span>
              <Input
                type="number"
                className="w-28"
                min={0}
                max={100}
                step="any"
                value={share.percentage}
                onChange={(e) =>
                  update(
                    shares.map((s, i) =>
                      i === index ? { ...s, percentage: Number(e.target.value) } : s,
                    ),
                  )
                }
              />
              <span className="text-sm text-gray-400">%</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={shares.length <= 1}
                onClick={() => update(shares.filter((_, i) => i !== index))}
                aria-label={`Remove place ${share.rank}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update([...shares, { rank: shares.length + 1, percentage: 0 }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add place
            </Button>
            <span
              className={
                Math.abs(total - 100) > 0.01 ? "text-sm text-red-400" : "text-sm text-green-400"
              }
            >
              Total {Math.round(total * 100) / 100}%
            </span>
          </div>
        </div>
      );
    }
  }
}
