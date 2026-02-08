"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Server,
  MemoryStick,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Terminal,
  Loader2,
  Zap,
} from "lucide-react";

const NODE_HEAP_ENV = "NODE_OPTIONS=--max-old-space-size=4096";
const NODE_HEAP_VALUE = "--max-old-space-size=4096";

export default function ServerOptionsSection() {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const applyHeapNow = async () => {
    setApplying(true);
    try {
      const res = await fetch("/api/server-options/apply-heap", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || data.error || "Failed to apply");
        return;
      }
      toast.success(data.message || "Heap applied and admin app restarted.");
    } catch (e) {
      toast.error("Request failed. Check console.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server className="h-7 w-7 text-lime-400" />
          Server Options
        </h2>
        <p className="text-gray-400 mt-1">
          Configure server and process options (memory, heap). Use together with{" "}
          <strong className="text-gray-300">Server Monitor</strong> to reduce
          restarts and OOM during load testing.
        </p>
      </div>

      {/* Increase Node.js heap (admin app) */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <MemoryStick className="h-5 w-5 text-amber-400" />
            Increase Node.js heap (admin app)
          </CardTitle>
          <CardDescription className="text-gray-400">
            When Server Monitor shows <strong>high heap usage</strong> (e.g.
            &gt;90%) and <strong>many restarts</strong>, raise the V8 heap limit
            so the admin app can use more RAM and avoid &quot;JavaScript heap
            out of memory&quot; crashes during Performance Simulator or load
            tests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-900/80 border border-gray-600 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-gray-300 text-sm font-medium">
                Environment variable
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => copyToClipboard(NODE_HEAP_ENV, "Env var")}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="ml-1">Copy</span>
              </Button>
            </div>
            <code className="block text-sm text-amber-200 font-mono break-all">
              {NODE_HEAP_ENV}
            </code>
            <p className="text-xs text-gray-500">
              Allows the Node process to use up to 4 GB heap. Use{" "}
              <code className="text-gray-400">2048</code> for 2 GB if the host
              has less RAM.
            </p>
          </div>

          <div className="rounded-lg bg-gray-900/80 border border-gray-600 p-4 space-y-3">
            <Label className="text-gray-300 text-sm font-medium flex items-center gap-1">
              <Terminal className="h-4 w-4" />
              PM2 (restart chartvolt-admin)
            </Label>
            <p className="text-xs text-gray-400">
              Heap is set in <code className="text-gray-300">ecosystem.config.js</code> and <code className="text-gray-300">package.json</code>. To apply without redeploy:
            </p>
            <code className="block text-sm text-amber-200 font-mono break-all">
              pm2 restart chartvolt-admin
            </code>
            <Button
              onClick={applyHeapNow}
              disabled={applying}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Restart admin (applies 4 GB heap from config)
            </Button>
            <p className="text-xs text-amber-200/80">
              Runs <code className="text-amber-100">pm2 restart chartvolt-admin</code>. Heap is set in <code className="text-amber-100">ecosystem.config.js</code> and <code className="text-amber-100">package.json</code>. This tab may disconnect briefly.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
            <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/90">
              <strong>Package.json</strong> in this repo already sets{" "}
              <code className="text-amber-100">{NODE_HEAP_VALUE}</code> in the{" "}
              <code className="text-amber-100">start</code> and{" "}
              <code className="text-amber-100">start:network</code> scripts. If
              you deploy with <code className="text-amber-100">npm run start</code>,
              the admin app will use a 4 GB heap after redeploy. On the host,
              ensure the instance has enough RAM (e.g. 2–4 GB for the admin app
              on a 16 GB server).
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-gray-700/50 border border-gray-600 p-3">
            <AlertTriangle className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400">
              If restarts continue after increasing heap, check host logs for{" "}
              <code className="text-gray-300">JavaScript heap out of memory</code>,{" "}
              <code className="text-gray-300">killed</code>, or exit code{" "}
              <code className="text-gray-300">137</code>. See{" "}
              <strong className="text-gray-300">Docs/ADMIN_MEMORY_AND_LOAD_TESTING.md</strong> for
              full guidance.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
