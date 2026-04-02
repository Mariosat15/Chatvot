"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Trash2, Edit, Sparkles, Megaphone, Clock, History,
  LayoutTemplate, AlertTriangle, Info, Wrench, Zap, Gift, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type AType = "maintenance" | "info" | "warning" | "critical" | "update" | "promotion";
type AStatus = "active" | "scheduled" | "expired" | "draft";

interface Announcement {
  _id: string; title: string; message: string; type: AType; status: AStatus;
  isActive: boolean; scheduledStart?: string; scheduledEnd?: string;
  dismissible: boolean; showCountdown: boolean;
  createdBy: string; createdByEmail: string; createdAt: string; updatedAt: string;
}

interface Template {
  _id: string; name: string; title: string; message: string; type: AType; isDefault: boolean;
}

interface FormState {
  title: string; message: string; type: AType; dismissible: boolean;
  showCountdown: boolean; scheduledStart: string; scheduledEnd: string; activateNow: boolean;
}

const TYPE_CFG: Record<AType, { color: string; icon: typeof Info }> = {
  maintenance: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Wrench },
  info: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Info },
  warning: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: AlertTriangle },
  critical: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: Zap },
  update: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: RefreshCw },
  promotion: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: Gift },
};
const STATUS_CLR: Record<AStatus, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  expired: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  draft: "bg-gray-500/20 text-gray-500 border-gray-600/30",
};
const EMPTY: FormState = {
  title: "", message: "", type: "info", dismissible: true,
  showCountdown: false, scheduledStart: "", scheduledEnd: "", activateNow: false,
};
const TYPES = Object.keys(TYPE_CFG) as AType[];
const FILTERS: ("all" | AStatus)[] = ["all", "active", "scheduled", "draft", "expired"];

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function toLocal(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}

export default function SystemAnnouncementsSection() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [tpls, setTpls] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | AStatus>("all");
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [tplDlg, setTplDlg] = useState(false);
  const [tplForm, setTplForm] = useState({ name: "", title: "", message: "", type: "info" as AType });

  const load = useCallback(async () => {
    try {
      const [aRes, tRes] = await Promise.all([
        fetch("/api/announcements?status=all"), fetch("/api/announcements/templates"),
      ]);
      const [aData, tData] = await Promise.all([aRes.json(), tRes.json()]);
      if (aData.success) setItems(aData.announcements);
      if (tData.success) setTpls(tData.templates);
    } catch { toast.error("Failed to load data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => items.filter((a) => filter === "all" || a.status === filter), [items, filter]);
  const history = useMemo(
    () => items.filter((a) => a.status === "expired" || (!a.isActive && a.status !== "draft"))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [items],
  );

  const openCreate = useCallback((pre?: Partial<FormState>) => {
    setEditId(null); setForm({ ...EMPTY, ...pre }); setAiPrompt(""); setDlgOpen(true);
  }, []);
  const openEdit = useCallback((a: Announcement) => {
    setEditId(a._id);
    setForm({ title: a.title, message: a.message, type: a.type, dismissible: a.dismissible,
      showCountdown: a.showCountdown, scheduledStart: toLocal(a.scheduledStart),
      scheduledEnd: toLocal(a.scheduledEnd), activateNow: false });
    setAiPrompt(""); setDlgOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error("Title and message are required."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title, message: form.message, type: form.type,
        dismissible: form.dismissible, showCountdown: form.showCountdown, activateNow: form.activateNow,
      };
      if (form.scheduledStart) body.scheduledStart = new Date(form.scheduledStart).toISOString();
      if (form.scheduledEnd) body.scheduledEnd = new Date(form.scheduledEnd).toISOString();
      const url = editId ? `/api/announcements/${editId}` : "/api/announcements";
      const res = await fetch(url, { method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(editId ? "Announcement updated." : "Announcement created.");
      setDlgOpen(false); await load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to save."); }
    finally { setSaving(false); }
  }, [form, editId, load]);

  const toggle = useCallback(async (a: Announcement) => {
    try {
      const res = await fetch(`/api/announcements/${a._id}`, { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !a.isActive, status: !a.isActive ? "active" : "draft" }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(a.isActive ? "Deactivated." : "Activated."); await load();
    } catch { toast.error("Failed to toggle."); }
  }, [load]);

  const del = useCallback(async (id: string) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      const d = await res.json(); if (!d.success) throw new Error(d.error);
      toast.success("Deleted."); await load();
    } catch { toast.error("Failed to delete."); }
  }, [load]);

  const aiGen = useCallback(async (action: "generate" | "improve") => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/announcements/ai-generate", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, prompt: aiPrompt || undefined,
          currentTitle: form.title || undefined, currentMessage: form.message || undefined, type: form.type }) });
      const data = await res.json(); if (!data.success) throw new Error(data.error);
      setForm((f) => ({ ...f, title: data.title, message: data.message }));
      toast.success("AI content applied.");
    } catch { toast.error("AI generation failed."); }
    finally { setAiLoading(false); }
  }, [aiPrompt, form.title, form.message, form.type]);

  const saveTpl = useCallback(async () => {
    if (!tplForm.name.trim() || !tplForm.title.trim()) { toast.error("Name and title required."); return; }
    try {
      const res = await fetch("/api/announcements/templates", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(tplForm) });
      const d = await res.json(); if (!d.success) throw new Error(d.error);
      toast.success("Template saved."); setTplDlg(false);
      setTplForm({ name: "", title: "", message: "", type: "info" }); await load();
    } catch { toast.error("Failed to save template."); }
  }, [tplForm, load]);

  const delTpl = useCallback(async (id: string) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/announcements/templates/${id}`, { method: "DELETE" });
      const d = await res.json(); if (!d.success) throw new Error(d.error);
      toast.success("Template deleted."); await load();
    } catch { toast.error("Failed to delete template."); }
  }, [load]);

  const TBadge = ({ type }: { type: AType }) => (
    <Badge variant="outline" className={`${TYPE_CFG[type].color} text-xs capitalize`}>{type}</Badge>
  );
  const SBadge = ({ status }: { status: AStatus }) => (
    <Badge variant="outline" className={`${STATUS_CLR[status]} text-xs capitalize`}>{status}</Badge>
  );

  const Row = ({ a }: { a: Announcement }) => (
    <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <TBadge type={a.type} />
          <span className="truncate text-sm font-medium text-gray-100">{a.title}</span>
          <SBadge status={a.status} />
        </div>
        <p className="truncate text-xs text-gray-400">{a.message}</p>
        {(a.scheduledStart || a.scheduledEnd) && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />{fmtDate(a.scheduledStart)} → {fmtDate(a.scheduledEnd)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={a.isActive} onCheckedChange={() => toggle(a)} />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Edit className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => del(a._id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      <RefreshCw className="mr-2 h-5 w-5 animate-spin" />Loading…
    </div>
  );

  const sf = (v: string) => setForm((f) => ({ ...f, [v.split(":")[0]]: v.split(":").slice(1).join(":") }));

  return (
    <div className="space-y-4">
      <Tabs defaultValue="announcements" className="w-full">
        <TabsList className="bg-gray-800/50">
          <TabsTrigger value="announcements" className="gap-1.5"><Megaphone className="h-4 w-4" />Announcements</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><LayoutTemplate className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-4 w-4" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {FILTERS.map((s) => (
                <Button key={s} size="sm" variant={filter === s ? "default" : "outline"}
                  className="capitalize" onClick={() => setFilter(s)}>{s}</Button>
              ))}
            </div>
            <Button size="sm" onClick={() => openCreate()} className="gap-1.5"><Plus className="h-4 w-4" />Create</Button>
          </div>
          {filtered.length === 0
            ? <p className="py-12 text-center text-sm text-gray-500">No announcements found.</p>
            : <div className="space-y-2">{filtered.map((a) => <Row key={a._id} a={a} />)}</div>}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setTplDlg(true)} className="gap-1.5"><Plus className="h-4 w-4" />Create Template</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tpls.map((t) => (
              <Card key={t._id} className="border-gray-700 bg-gray-800/50">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-100">{t.name}</span>
                    <TBadge type={t.type} />
                  </div>
                  <p className="text-xs font-medium text-gray-300">{t.title}</p>
                  <p className="line-clamp-2 text-xs text-gray-500">{t.message}</p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs"
                      onClick={() => openCreate({ title: t.title, message: t.message, type: t.type })}>Use Template</Button>
                    {!t.isDefault && (
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => delTpl(t._id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {tpls.length === 0 && <p className="col-span-full py-12 text-center text-sm text-gray-500">No templates yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {history.length === 0
            ? <p className="py-12 text-center text-sm text-gray-500">No history items.</p>
            : history.map((a) => <Row key={a._id} a={a} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-gray-700 bg-gray-900">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Create"} Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title" className="mt-1" maxLength={200} /></div>
            <div><Label>Message</Label>
              <Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Announcement message" className="mt-1" rows={3} maxLength={2000} /></div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as AType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.dismissible} onCheckedChange={(v) => setForm((f) => ({ ...f, dismissible: v }))} />
                <Label className="text-sm">Dismissible</Label></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.showCountdown} onCheckedChange={(v) => setForm((f) => ({ ...f, showCountdown: v }))} />
                <Label className="text-sm">Show Countdown</Label></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-400">Scheduled Start</Label>
                <Input type="datetime-local" value={form.scheduledStart}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs text-gray-400">Scheduled End</Label>
                <Input type="datetime-local" value={form.scheduledEnd}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))} className="mt-1" /></div>
            </div>
            {!editId && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.activateNow}
                  onChange={(e) => setForm((f) => ({ ...f, activateNow: e.target.checked }))} className="rounded border-gray-600" />
                Activate immediately</label>)}
            <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />AI Assist</p>
              <Input placeholder="Optional context for AI…" value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)} className="text-xs" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={aiLoading} onClick={() => aiGen("generate")} className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />Generate</Button>
                {form.title && form.message && (
                  <Button size="sm" variant="outline" disabled={aiLoading} onClick={() => aiGen("improve")} className="gap-1 text-xs">
                    <Sparkles className="h-3 w-3" />Improve</Button>)}
                {aiLoading && <span className="text-xs text-gray-500 self-center">Generating…</span>}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tplDlg} onOpenChange={setTplDlg}>
        <DialogContent className="max-w-md border-gray-700 bg-gray-900">
          <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Template Name</Label>
              <Input value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Holiday Notice" className="mt-1" maxLength={100} /></div>
            <div><Label>Title</Label>
              <Input value={tplForm.title} onChange={(e) => setTplForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title" className="mt-1" maxLength={200} /></div>
            <div><Label>Message</Label>
              <Textarea value={tplForm.message} onChange={(e) => setTplForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Announcement message" className="mt-1" rows={3} maxLength={2000} /></div>
            <div><Label>Type</Label>
              <Select value={tplForm.type} onValueChange={(v) => setTplForm((f) => ({ ...f, type: v as AType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTplDlg(false)}>Cancel</Button>
            <Button onClick={saveTpl}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
