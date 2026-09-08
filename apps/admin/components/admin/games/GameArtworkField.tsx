"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * One image slot on a game title: upload, preview, or clear.
 *
 * Uploading stores the file and returns a URL; it does NOT write the URL onto the title. The
 * caller holds it in the draft and the Save button persists it. Two steps because an upload
 * that saved the file and then failed to attach it would leave the operator with no way to
 * find the image again, whereas this way the URL is still in the form to retry with.
 *
 * The preview uses a plain `<img>` rather than `next/image` on purpose: the URL is served by
 * an API route with a database fallback, so it is not a statically analysable asset, and the
 * optimiser would 500 on the one path that matters - the second web server, where the file
 * is only in the database.
 */

interface Props {
  providerKey: string;
  gameCode: string;
  slot: "logo" | "banner";
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
}

export default function GameArtworkField({
  providerKey,
  gameCode,
  slot,
  label,
  hint,
  value,
  onChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("gameCode", gameCode);
      form.append("slot", slot);

      const response = await fetch(
        `/api/games/providers/${providerKey}/games/artwork`,
        { method: "POST", body: form },
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "The image could not be uploaded.");
        return;
      }

      onChange(data.url);
      toast.success(`${label} uploaded. Press Save content to attach it.`);
    } catch {
      toast.error("The image could not be uploaded.");
    } finally {
      setUploading(false);
      // Reason: cleared so that choosing the SAME file again still fires a change event,
      // which is the normal way an operator retries after a failed upload.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30 ${
          slot === "logo" ? "aspect-square" : "aspect-[3/1]"
        }`}
      >
        {value ? (
          // Served by an API route with a database fallback, so it is not a statically
          // analysable asset and `next/image`'s optimiser cannot fetch it; see the note above.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={`${label} preview`} className="h-full w-full object-cover" />
        ) : (
          <span className="px-3 text-center text-xs text-white/30">Nothing uploaded</span>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-5 w-5 animate-spin text-white/70" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/50 hover:text-red-300"
            disabled={uploading}
            onClick={() => onChange("")}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // Reason: SVG is excluded here as well as on the server. It is a document that can
        // carry a script and it would be served from our own origin.
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <p className="text-xs text-white/50">{hint}</p>
    </div>
  );
}
