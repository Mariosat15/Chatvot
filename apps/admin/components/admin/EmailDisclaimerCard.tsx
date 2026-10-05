"use client";

import { useEffect, useState } from "react";
import { FileWarning, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FALLBACK_ERROR = "Something went wrong. Please contact support.";

interface DisclaimerState {
  emailDisclaimer: string;
  showEmailDisclaimer: boolean;
  defaultDisclaimer: string;
}

/**
 * One platform-wide disclaimer, appended to every outgoing email by the
 * transporter's final pass - so it is edited here once rather than in each
 * template. Empty text means the built-in default wording.
 */
export default function EmailDisclaimerCard() {
  const [state, setState] = useState<DisclaimerState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/email-templates/disclaimer")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data?.success) {
          setState({
            emailDisclaimer: data.emailDisclaimer ?? "",
            showEmailDisclaimer: data.showEmailDisclaimer !== false,
            defaultDisclaimer: data.defaultDisclaimer ?? "",
          });
        } else {
          toast.error(data?.error || FALLBACK_ERROR);
        }
      })
      .catch(() => mounted && toast.error(FALLBACK_ERROR));
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!state) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email-templates/disclaimer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailDisclaimer: state.emailDisclaimer,
          showEmailDisclaimer: state.showEmailDisclaimer,
        }),
      });
      const data = await res.json();
      if (data?.success) toast.success(data.message || "Email disclaimer updated");
      else toast.error(data?.error || FALLBACK_ERROR);
    } catch {
      toast.error(FALLBACK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  if (!state) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="flex items-center gap-2 py-6 text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading email disclaimer…
        </CardContent>
      </Card>
    );
  }

  const preview = state.emailDisclaimer.trim() || state.defaultDisclaimer;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-yellow-500" />
          Email Disclaimer
        </CardTitle>
        <CardDescription>
          Added to the foot of every email the platform sends, including custom templates.
          Leave the text empty to use the default wording.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-email-disclaimer" className="text-gray-300">
            Show disclaimer on all emails
          </Label>
          <Switch
            id="show-email-disclaimer"
            checked={state.showEmailDisclaimer}
            onCheckedChange={(checked) => setState({ ...state, showEmailDisclaimer: checked })}
          />
        </div>
        <Textarea
          value={state.emailDisclaimer}
          onChange={(e) => setState({ ...state, emailDisclaimer: e.target.value })}
          placeholder={state.defaultDisclaimer}
          rows={4}
          maxLength={2000}
          className="bg-gray-800 border-gray-700 text-white"
        />
        <div
          className="rounded-lg border p-4 text-xs leading-relaxed"
          style={{ backgroundColor: "#030712", borderColor: "#0bbfe6", color: "#8fa3bb" }}
        >
          {state.showEmailDisclaimer ? preview : "The disclaimer is switched off - no email will carry it."}
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="bg-yellow-500 text-black hover:bg-yellow-400">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save disclaimer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
