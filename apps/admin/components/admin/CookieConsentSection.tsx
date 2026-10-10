"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cookie,
  Save,
  Loader2,
  Plus,
  Trash2,
  Shield,
  Eye,
  RefreshCw,
  ExternalLink,
  GripVertical,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  defaultEnabled: boolean;
}

interface CookieConsentSettings {
  enabled: boolean;
  title: string;
  message: string;
  acceptAllText: string;
  rejectAllText: string;
  customizeText: string;
  savePreferencesText: string;
  categories: CookieCategory[];
  cookiePolicyUrl: string;
  privacyPolicyUrl: string;
  position: "bottom" | "bottom-left" | "bottom-right";
  showDeclineButton: boolean;
  showCustomizeButton: boolean;
  backdropEnabled: boolean;
  autoExpireDays: number;
}

const DEFAULT_SETTINGS: CookieConsentSettings = {
  enabled: true,
  title: "We Value Your Privacy",
  message:
    'We use cookies to enhance your experience, analyse site traffic, and for security and fraud prevention. Some cookies are strictly necessary for the platform to function. By clicking "Accept All", you consent to our use of all cookies.',
  acceptAllText: "Accept All",
  rejectAllText: "Reject Non-Essential",
  customizeText: "Manage Preferences",
  savePreferencesText: "Save Preferences",
  categories: [
    {
      id: "necessary",
      name: "Strictly Necessary",
      description: "Essential cookies for platform operation.",
      required: true,
      defaultEnabled: true,
    },
  ],
  cookiePolicyUrl: "/cookie-policy",
  privacyPolicyUrl: "/privacy",
  position: "bottom",
  showDeclineButton: true,
  showCustomizeButton: true,
  backdropEnabled: false,
  autoExpireDays: 365,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CookieConsentSection() {
  const [settings, setSettings] =
    useState<CookieConsentSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch settings ──────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/cookie-consent");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to load cookie consent settings:", error);
      toast.error("Failed to load cookie consent settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Save settings ───────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/cookie-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Cookie consent settings saved!");
        if (data.settings) setSettings(data.settings);
      } else {
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save cookie consent settings");
    } finally {
      setSaving(false);
    }
  };

  // ── Field updaters ──────────────────────────────────────────────────
  const updateField = <K extends keyof CookieConsentSettings>(
    key: K,
    value: CookieConsentSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateCategory = (
    index: number,
    field: keyof CookieCategory,
    value: string | boolean,
  ) => {
    setSettings((prev) => {
      const current = prev.categories.at(index);
      if (!current) return prev;

      // Reason: explicit field assignment avoids object-injection lint false positives.
      switch (field) {
        case "id":
          if (typeof value === "string") current.id = value;
          break;
        case "name":
          if (typeof value === "string") current.name = value;
          break;
        case "description":
          if (typeof value === "string") current.description = value;
          break;
        case "required":
          if (typeof value === "boolean") current.required = value;
          break;
        case "defaultEnabled":
          if (typeof value === "boolean") current.defaultEnabled = value;
          break;
        default:
          break;
      }
      const cats = prev.categories.map((cat, catIndex) =>
        catIndex === index ? current : cat,
      );
      return { ...prev, categories: cats };
    });
  };

  const addCategory = () => {
    const newId = `custom_${Date.now()}`;
    setSettings((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        {
          id: newId,
          name: "New Category",
          description: "",
          required: false,
          defaultEnabled: false,
        },
      ],
    }));
  };

  const removeCategory = (index: number) => {
    const category = settings.categories.at(index);
    if (category?.required) {
      toast.error("Cannot remove a required cookie category");
      return;
    }
    setSettings((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }));
  };

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cookie className="h-7 w-7 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">
              Cookie Consent Banner
            </h2>
            <p className="text-gray-400 text-sm">
              Configure the cookie consent popup shown to visitors on the
              landing page and across the site
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettings}
            className="border-gray-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Enable Toggle */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="font-medium text-white">
                  Enable Cookie Consent Banner
                </p>
                <p className="text-sm text-gray-400">
                  When enabled, visitors will see the cookie consent popup until
                  they accept or decline
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => updateField("enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banner Copy */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Banner Content
            </CardTitle>
            <CardDescription>
              Customise the text shown in the cookie consent popup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-300">Title</Label>
              <Input
                value={settings.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="bg-gray-900 border-gray-600 text-white mt-1"
                placeholder="We Value Your Privacy"
              />
            </div>
            <div>
              <Label className="text-gray-300">Message</Label>
              <Textarea
                value={settings.message}
                onChange={(e) => updateField("message", e.target.value)}
                className="bg-gray-900 border-gray-600 text-white mt-1 min-h-[120px]"
                placeholder="Cookie consent message..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs">
                  Accept All Button
                </Label>
                <Input
                  value={settings.acceptAllText}
                  onChange={(e) =>
                    updateField("acceptAllText", e.target.value)
                  }
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">
                  Reject Button
                </Label>
                <Input
                  value={settings.rejectAllText}
                  onChange={(e) =>
                    updateField("rejectAllText", e.target.value)
                  }
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">
                  Customize Button
                </Label>
                <Input
                  value={settings.customizeText}
                  onChange={(e) =>
                    updateField("customizeText", e.target.value)
                  }
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">
                  Save Preferences Button
                </Label>
                <Input
                  value={settings.savePreferencesText}
                  onChange={(e) =>
                    updateField("savePreferencesText", e.target.value)
                  }
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance & Behaviour */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Appearance & Behaviour
            </CardTitle>
            <CardDescription>
              Control how and where the banner appears
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-300">Position</Label>
              <Select
                value={settings.position}
                onValueChange={(v) =>
                  updateField(
                    "position",
                    v as CookieConsentSettings["position"],
                  )
                }
              >
                <SelectTrigger className="bg-gray-900 border-gray-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">Full Width Bottom Bar</SelectItem>
                  <SelectItem value="bottom-left">
                    Bottom Left Card
                  </SelectItem>
                  <SelectItem value="bottom-right">
                    Bottom Right Card
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-xs">
                  Cookie Policy URL
                </Label>
                <Input
                  value={settings.cookiePolicyUrl}
                  onChange={(e) =>
                    updateField("cookiePolicyUrl", e.target.value)
                  }
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="/cookie-policy"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-xs">
                  Privacy Policy URL
                </Label>
                <Input
                  value={settings.privacyPolicyUrl}
                  onChange={(e) =>
                    updateField("privacyPolicyUrl", e.target.value)
                  }
                  className="bg-gray-900 border-gray-600 text-white mt-1"
                  placeholder="/privacy"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 text-xs">
                Auto-Expire Days
              </Label>
              <p className="text-xs text-gray-500 mb-1">
                How many days before re-asking consent after a user accepts
              </p>
              <Input
                type="number"
                min={1}
                max={730}
                value={settings.autoExpireDays}
                onChange={(e) =>
                  updateField("autoExpireDays", Number(e.target.value) || 365)
                }
                className="bg-gray-900 border-gray-600 text-white"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Show Decline Button</p>
                  <p className="text-xs text-gray-500">
                    Allow users to reject non-essential cookies
                  </p>
                </div>
                <Switch
                  checked={settings.showDeclineButton}
                  onCheckedChange={(v) =>
                    updateField("showDeclineButton", v)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">
                    Show Customize Button
                  </p>
                  <p className="text-xs text-gray-500">
                    Let users pick individual cookie categories
                  </p>
                </div>
                <Switch
                  checked={settings.showCustomizeButton}
                  onCheckedChange={(v) =>
                    updateField("showCustomizeButton", v)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Background Overlay</p>
                  <p className="text-xs text-gray-500">
                    Dim the page behind the cookie banner
                  </p>
                </div>
                <Switch
                  checked={settings.backdropEnabled}
                  onCheckedChange={(v) =>
                    updateField("backdropEnabled", v)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cookie Categories */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <GripVertical className="h-5 w-5" />
                Cookie Categories
              </CardTitle>
              <CardDescription>
                Define the cookie categories users can choose from. Required
                categories cannot be disabled by users.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addCategory}
              className="border-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {settings.categories.map((cat, i) => (
              <div
                key={cat.id}
                className={`border rounded-lg p-4 ${
                  cat.required
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-gray-700 bg-gray-900/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400 text-xs">
                        Category ID
                      </Label>
                      <Input
                        value={cat.id}
                        onChange={(e) =>
                          updateCategory(i, "id", e.target.value)
                        }
                        className="bg-gray-800 border-gray-600 text-white mt-1 font-mono text-xs"
                        disabled={cat.required}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Name</Label>
                      <Input
                        value={cat.name}
                        onChange={(e) =>
                          updateCategory(i, "name", e.target.value)
                        }
                        className="bg-gray-800 border-gray-600 text-white mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-gray-400 text-xs">
                        Description
                      </Label>
                      <Textarea
                        value={cat.description}
                        onChange={(e) =>
                          updateCategory(i, "description", e.target.value)
                        }
                        className="bg-gray-800 border-gray-600 text-white mt-1 min-h-[60px]"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cat.required}
                          onCheckedChange={(v) =>
                            updateCategory(i, "required", v)
                          }
                          disabled={
                            cat.id === "necessary" || cat.id === "security"
                          }
                        />
                        <span className="text-sm text-gray-300 flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Required
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cat.defaultEnabled}
                          onCheckedChange={(v) =>
                            updateCategory(i, "defaultEnabled", v)
                          }
                        />
                        <span className="text-sm text-gray-300">
                          Enabled by Default
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {cat.required && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                        Required
                      </Badge>
                    )}
                    {!cat.required && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCategory(i)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview & Info */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-purple-400 flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Preview & Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700">
            <h4 className="text-sm font-semibold text-white mb-2">
              How it works
            </h4>
            <ul className="text-sm text-gray-400 space-y-1.5">
              <li>
                • The cookie banner appears at the{" "}
                <strong className="text-white">{settings.position}</strong>{" "}
                of the page for all visitors
              </li>
              <li>
                • Once a user clicks Accept, Reject, or saves preferences, the
                banner is hidden and their choice is saved in{" "}
                <code className="text-cyan-400">localStorage</code>
              </li>
              <li>
                • The consent expires after{" "}
                <strong className="text-white">
                  {settings.autoExpireDays} days
                </strong>
                , after which the banner will re-appear
              </li>
              <li>
                • Required cookie categories (Strictly Necessary, Security)
                cannot be declined by users
              </li>
              <li>
                • The banner links to your{" "}
                <strong className="text-yellow-400">
                  Cookie Policy ({settings.cookiePolicyUrl})
                </strong>{" "}
                page — make sure it exists
              </li>
            </ul>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-1">
              GDPR / ePrivacy Compliance Note
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              This cookie consent mechanism is designed to comply with the EU
              ePrivacy Directive (2002/58/EC), GDPR (Art. 6 &amp; 7), and UK
              PECR 2003. Strictly necessary cookies do not require consent
              under the ePrivacy Directive Art. 5(3) exemption. Ensure your
              Cookie Policy page describes each cookie category, its purpose,
              retention period, and third-party access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
