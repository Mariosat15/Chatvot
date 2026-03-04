"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Globe,
  Mail,
  Key,
  Database,
  Shield,
  AlertCircle,
  Server,
  Brain,
  Sparkles,
  Fingerprint,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function EnvironmentSection() {
  const [formData, setFormData] = useState({
    // General
    nodeEnv: "development",
    nextPublicAppUrl: "",
    nextPublicBaseUrl: "",

    // Email
    nodemailerEmail: "",
    nodemailerPassword: "",

    // API Keys & URLs
    massiveApiKey: "",
    nextPublicMassiveApiKey: "",

    // OpenAI Configuration
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    openaiEnabled: false,
    openaiForEmails: false,

    // Database
    mongodbUri: "",

    // Authentication
    betterAuthSecret: "",
    betterAuthUrl: "",
    adminJwtSecret: "",

    // KYC / Veriff
    veriffApiKey: "",
    veriffApiSecret: "",
    veriffBaseUrl: "",

    // Pexels (Landing Pages)
    pexelsApiKey: "",

    // Infrastructure
    isPrimary: "true",
    serverId: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    nodemailerPassword: false,
    massiveApiKey: false,
    nextPublicMassiveApiKey: false,
    openaiApiKey: false,
    mongodbUri: false,
    betterAuthSecret: false,
    adminJwtSecret: false,
    veriffApiKey: false,
    veriffApiSecret: false,
    pexelsApiKey: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsFetching(true);
    try {
      const response = await fetch("/api/environment");
      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, ...data }));
      } else {
        const errData = await response.json().catch(() => null);
        toast.error(errData?.error || "Failed to load settings");
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/environment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Environment variables updated successfully");
        toast.info(data.message || "Changes saved to database and .env file");
      } else {
        toast.error(data.error || "Update failed");
      }
    } catch {
      toast.error("An error occurred while saving");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => {
      const next = { ...prev };
      const key = field as keyof typeof next;
      // eslint-disable-next-line security/detect-object-injection
      next[key] = !next[key];
      return next;
    });
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => {
      const next = { ...prev };
      const key = field as keyof typeof next;
      // eslint-disable-next-line security/detect-object-injection
      next[key] = value as never;
      return next;
    });
  };

  if (isFetching) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                Environment Variables
              </h2>
              <p className="text-blue-100 mt-1">
                Configure all application settings, API keys, and integrations.
                Changes are saved to both the database and the{" "}
                <code className="bg-blue-700/50 px-1.5 py-0.5 rounded text-xs">
                  .env
                </code>{" "}
                file.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form with Tabs */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <div className="bg-gray-800/50 border-b border-gray-700 px-6 pt-6">
              <TabsList className="bg-transparent w-full justify-start gap-2 flex-wrap">
                <TabsTrigger
                  value="general"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="email"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </TabsTrigger>
                <TabsTrigger
                  value="apis"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </TabsTrigger>
                <TabsTrigger
                  value="database"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Database
                </TabsTrigger>
                <TabsTrigger
                  value="auth"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Auth
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  AI
                </TabsTrigger>
                <TabsTrigger
                  value="kyc"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <Fingerprint className="h-4 w-4 mr-2" />
                  KYC
                </TabsTrigger>
                <TabsTrigger
                  value="pexels"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=inactive]:text-gray-400"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Pexels
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-8">
              {/* ─── General Tab ─── */}
              <TabsContent value="general" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-green-400" />
                      General Settings
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Settings className="h-4 w-4 text-green-400" />
                          Node Environment
                        </Label>
                        <Select
                          value={formData.nodeEnv}
                          onValueChange={(v) => updateField("nodeEnv", v)}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="development">
                              Development
                            </SelectItem>
                            <SelectItem value="production">
                              Production
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-green-400" />
                          App URL (NEXT_PUBLIC_APP_URL)
                        </Label>
                        <Input
                          type="url"
                          value={formData.nextPublicAppUrl}
                          onChange={(e) =>
                            updateField("nextPublicAppUrl", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="https://yourdomain.com"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          The primary public URL of your application
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-green-400" />
                          Base URL (NEXT_PUBLIC_BASE_URL)
                        </Label>
                        <Input
                          type="url"
                          value={formData.nextPublicBaseUrl}
                          onChange={(e) =>
                            updateField("nextPublicBaseUrl", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="https://yourdomain.com"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Base URL for API calls and internal links
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Infrastructure */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Server className="h-5 w-5 text-green-400" />
                      Infrastructure
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Server className="h-4 w-4 text-green-400" />
                          IS_PRIMARY
                        </Label>
                        <Select
                          value={formData.isPrimary}
                          onValueChange={(v) => updateField("isPrimary", v)}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">true</SelectItem>
                            <SelectItem value="false">false</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-2">
                          Whether this is the primary server instance
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Server className="h-4 w-4 text-green-400" />
                          SERVER_ID
                        </Label>
                        <Input
                          value={formData.serverId}
                          onChange={(e) =>
                            updateField("serverId", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="auto-generated or hostname"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Unique identifier for this server in the fleet
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── Email Tab ─── */}
              <TabsContent value="email" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-purple-400" />
                      Email Configuration (Nodemailer)
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-purple-400" />
                          Email Address
                        </Label>
                        <Input
                          type="email"
                          value={formData.nodemailerEmail}
                          onChange={(e) =>
                            updateField("nodemailerEmail", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="your-email@gmail.com"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Gmail account for sending emails
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-purple-400" />
                          App Password
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.nodemailerPassword
                                ? "text"
                                : "password"
                            }
                            value={formData.nodemailerPassword}
                            onChange={(e) =>
                              updateField(
                                "nodemailerPassword",
                                e.target.value,
                              )
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Gmail app-specific password"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("nodemailerPassword")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.nodemailerPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Generate this in Google Account settings → Security →
                          App passwords
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── API Keys Tab ─── */}
              <TabsContent value="apis" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Key className="h-5 w-5 text-orange-400" />
                      Massive.com API Keys
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-orange-400" />
                          MASSIVE_API_KEY
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.massiveApiKey ? "text" : "password"
                            }
                            value={formData.massiveApiKey}
                            onChange={(e) =>
                              updateField("massiveApiKey", e.target.value)
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Server-side API key"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("massiveApiKey")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.massiveApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-orange-400" />
                          NEXT_PUBLIC_MASSIVE_API_KEY
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.nextPublicMassiveApiKey
                                ? "text"
                                : "password"
                            }
                            value={formData.nextPublicMassiveApiKey}
                            onChange={(e) =>
                              updateField(
                                "nextPublicMassiveApiKey",
                                e.target.value,
                              )
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Public (client-side) API key"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility(
                                "nextPublicMassiveApiKey",
                              )
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.nextPublicMassiveApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">
                      Real-time Forex data from{" "}
                      <a
                        href="https://massive.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-300"
                      >
                        massive.com
                      </a>
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* ─── Database Tab ─── */}
              <TabsContent value="database" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Database className="h-5 w-5 text-cyan-400" />
                      MongoDB Configuration
                    </h3>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-cyan-400" />
                        MongoDB Connection String
                      </Label>
                      <div className="relative">
                        <Input
                          type={showPasswords.mongodbUri ? "text" : "password"}
                          value={formData.mongodbUri}
                          onChange={(e) =>
                            updateField("mongodbUri", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                          placeholder="mongodb+srv://username:password@cluster.mongodb.net/dbname"
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility("mongodbUri")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showPasswords.mongodbUri ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Your MongoDB Atlas connection string
                      </p>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-400 mb-1">
                        Caution
                      </h4>
                      <p className="text-sm text-gray-300">
                        Changing the MongoDB URI requires an application restart
                        and affects all database connections. Make sure the new
                        URI is correct before saving.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── Auth Tab ─── */}
              <TabsContent value="auth" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-400" />
                      Better Auth Configuration
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-red-400" />
                          BETTER_AUTH_SECRET
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.betterAuthSecret
                                ? "text"
                                : "password"
                            }
                            value={formData.betterAuthSecret}
                            onChange={(e) =>
                              updateField("betterAuthSecret", e.target.value)
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Random secret string for user authentication"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("betterAuthSecret")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.betterAuthSecret ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-red-400" />
                          BETTER_AUTH_URL
                        </Label>
                        <Input
                          type="url"
                          value={formData.betterAuthUrl}
                          onChange={(e) =>
                            updateField("betterAuthUrl", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="https://yourdomain.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Admin JWT Secret */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-400" />
                      Admin Panel Authentication
                    </h3>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4 text-red-400" />
                        ADMIN_JWT_SECRET
                      </Label>
                      <div className="relative">
                        <Input
                          type={
                            showPasswords.adminJwtSecret ? "text" : "password"
                          }
                          value={formData.adminJwtSecret}
                          onChange={(e) =>
                            updateField("adminJwtSecret", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                          placeholder="Secret for admin panel JWT tokens"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            togglePasswordVisibility("adminJwtSecret")
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showPasswords.adminJwtSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Generate with:{" "}
                        <code className="bg-gray-800 px-2 py-0.5 rounded text-xs">
                          openssl rand -hex 32
                        </code>
                      </p>
                    </div>
                  </div>

                  {/* Auth warning */}
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-400 mb-1">
                        Security Warning
                      </h4>
                      <p className="text-sm text-gray-300">
                        Changing auth secrets will invalidate all existing user
                        sessions. Users will need to log in again. Make sure
                        this is intentional.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── AI Tab ─── */}
              <TabsContent value="ai" className="mt-0">
                <div className="space-y-6">
                  {/* AI Feature Toggles */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-violet-400" />
                      AI Features
                    </h3>
                    <div className="space-y-6">
                      {/* Main AI Toggle */}
                      <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <div>
                          <Label className="text-gray-100 font-medium">
                            Enable AI Features
                          </Label>
                          <p className="text-sm text-gray-400 mt-1">
                            Master toggle for all AI-powered features
                          </p>
                        </div>
                        <Switch
                          checked={formData.openaiEnabled}
                          onCheckedChange={(checked) =>
                            updateField("openaiEnabled", checked)
                          }
                        />
                      </div>

                      {/* AI for Emails Toggle */}
                      <div
                        className={`flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700 ${!formData.openaiEnabled ? "opacity-50" : ""}`}
                      >
                        <div>
                          <Label className="text-gray-100 font-medium">
                            AI for Email Personalization
                          </Label>
                          <p className="text-sm text-gray-400 mt-1">
                            Use AI to generate personalized welcome emails
                          </p>
                        </div>
                        <Switch
                          checked={formData.openaiForEmails}
                          onCheckedChange={(checked) =>
                            updateField("openaiForEmails", checked)
                          }
                          disabled={!formData.openaiEnabled}
                        />
                      </div>
                    </div>
                  </div>

                  {/* OpenAI Configuration */}
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Brain className="h-5 w-5 text-violet-400" />
                      OpenAI Configuration
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-violet-400" />
                          OPENAI_API_KEY
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.openaiApiKey ? "text" : "password"
                            }
                            value={formData.openaiApiKey}
                            onChange={(e) =>
                              updateField("openaiApiKey", e.target.value)
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="sk-..."
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("openaiApiKey")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.openaiApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Get your API key from{" "}
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300"
                          >
                            platform.openai.com/api-keys
                          </a>
                        </p>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Settings className="h-4 w-4 text-violet-400" />
                          AI Model
                        </Label>
                        <Select
                          value={formData.openaiModel}
                          onValueChange={(v) => updateField("openaiModel", v)}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-gray-100 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o Mini (Fast & Cheap)
                            </SelectItem>
                            <SelectItem value="gpt-4o">
                              GPT-4o (Smart & Fast)
                            </SelectItem>
                            <SelectItem value="gpt-4-turbo">
                              GPT-4 Turbo (High Quality)
                            </SelectItem>
                            <SelectItem value="gpt-3.5-turbo">
                              GPT-3.5 Turbo (Legacy)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-2">
                          Recommended: <strong>GPT-4o Mini</strong> for best
                          balance of speed and cost
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Usage Info */}
                  <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Brain className="h-5 w-5 text-violet-400 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-violet-400">
                          AI Features Include
                        </h4>
                        <ul className="text-xs text-gray-400 mt-2 space-y-1 list-disc list-inside">
                          <li>
                            Performance Simulator Analysis — AI-powered test
                            result analysis
                          </li>
                          <li>
                            Email Personalization — Personalized welcome emails
                          </li>
                          <li>
                            Future: Trading pattern analysis, fraud detection
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── KYC Tab ─── */}
              <TabsContent value="kyc" className="mt-0">
                <div className="space-y-6">
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                      <Fingerprint className="h-5 w-5 text-teal-400" />
                      Veriff KYC Configuration
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-teal-400" />
                          VERIFF_API_KEY
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.veriffApiKey ? "text" : "password"
                            }
                            value={formData.veriffApiKey}
                            onChange={(e) =>
                              updateField("veriffApiKey", e.target.value)
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Veriff API key"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("veriffApiKey")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.veriffApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-teal-400" />
                          VERIFF_API_SECRET
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.veriffApiSecret
                                ? "text"
                                : "password"
                            }
                            value={formData.veriffApiSecret}
                            onChange={(e) =>
                              updateField("veriffApiSecret", e.target.value)
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Veriff API secret"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("veriffApiSecret")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.veriffApiSecret ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-teal-400" />
                          VERIFF_BASE_URL
                        </Label>
                        <Input
                          type="url"
                          value={formData.veriffBaseUrl}
                          onChange={(e) =>
                            updateField("veriffBaseUrl", e.target.value)
                          }
                          className="bg-gray-800 border-gray-600 text-gray-100 h-11"
                          placeholder="https://stationapi.veriff.com"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Veriff Station API base URL
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 flex items-start gap-3">
                    <Fingerprint className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-teal-400">
                        Multi-Server Note
                      </h4>
                      <p className="text-sm text-gray-300">
                        Veriff API keys and secrets{" "}
                        <strong>must be identical</strong> across all servers in
                        a multi-server deployment to ensure webhook signatures
                        validate correctly.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── Pexels Tab ─── */}
              <TabsContent value="pexels" className="mt-0">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-cyan-400" />
                      Pexels API Configuration
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Pexels provides free stock images for landing pages.{" "}
                      <a
                        href="https://www.pexels.com/api/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline"
                      >
                        Get your API key →
                      </a>
                    </p>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label className="text-gray-300 flex items-center gap-2 mb-2">
                          <Key className="h-4 w-4 text-cyan-400" />
                          PEXELS_API_KEY
                        </Label>
                        <div className="relative">
                          <Input
                            type={
                              showPasswords.pexelsApiKey ? "text" : "password"
                            }
                            value={formData.pexelsApiKey}
                            onChange={(e) =>
                              updateField("pexelsApiKey", e.target.value)
                            }
                            className="bg-gray-800 border-gray-600 text-gray-100 h-11 pr-10"
                            placeholder="Pexels API key"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              togglePasswordVisibility("pexelsApiKey")
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {showPasswords.pexelsApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Used for fetching stock images when creating landing
                          pages. The key is also saved to the database for
                          runtime access.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>

            {/* Warning & Save Button */}
            <div className="p-8 bg-gray-800/30 border-t border-gray-700 space-y-6">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-400">
                      Important
                    </h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Settings are saved to both the database and the{" "}
                      <code className="bg-gray-800 px-1.5 py-0.5 rounded">
                        .env
                      </code>{" "}
                      file. Most changes take effect immediately, but{" "}
                      <code className="bg-gray-800 px-1.5 py-0.5 rounded">
                        NEXT_PUBLIC_*
                      </code>{" "}
                      variables, auth secrets, and the MongoDB URI require an
                      application restart.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchSettings}
                  disabled={isLoading}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold h-14 text-lg shadow-lg shadow-blue-500/50"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {isLoading
                    ? "Saving Changes..."
                    : "Save All Environment Variables"}
                </Button>
              </div>
            </div>
          </Tabs>
        </form>
      </div>
    </div>
  );
}
