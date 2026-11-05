import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, Download, Mail } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PageHeader, Panel } from "../components/bits";
import { api, get, errMsg, SKILL_CATALOG, BACKEND } from "../lib/api";

const lines = (a) => (a || []).join("\n");
const unlines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const ProfileTab = () => {
  const qc = useQueryClient();
  const { data: p } = useQuery({ queryKey: ["profile"], queryFn: () => get("/profile") });
  const [f, setF] = useState(null);
  useEffect(() => { if (p) setF({ ...p, education: lines(p.education), certifications: lines(p.certifications), target_roles: lines(p.target_roles), target_locations: lines(p.target_locations) }); }, [p]);
  if (!f) return null;
  const toggle = (s) => setF((x) => ({ ...x, skills: x.skills.includes(s) ? x.skills.filter((y) => y !== s) : [...x.skills, s] }));
  const save = async () => {
    try {
      const r = await api.put("/profile", { ...f, education: unlines(f.education), certifications: unlines(f.certifications), target_roles: unlines(f.target_roles), target_locations: unlines(f.target_locations) });
      toast.success(`Profile saved. ${r.data.rescored} jobs re-scored.`);
      qc.invalidateQueries();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const ta = (k, label, rows = 3) => <div><div className="eyebrow mb-1">{label}</div><Textarea data-testid={`profile-${k}`} rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <Panel><div className="grid gap-4 p-4 lg:grid-cols-2">
      <div><div className="eyebrow mb-1">Full name</div><Input data-testid="profile-full_name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div><div className="eyebrow mb-1">Headline</div><Input data-testid="profile-headline" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} /></div>
      {ta("education", "Education (one per line)")}{ta("certifications", "Certifications (one per line)")}
      <div className="lg:col-span-2"><div className="eyebrow mb-1">Experience</div>
        {f.experience.map((x, i) => <div key={i} className="rounded border p-3 text-sm"><div className="font-medium">{x.title} · {x.company}</div><div className="text-xs text-muted-foreground">{x.dates}</div><ul className="mt-1 list-disc pl-5 text-xs text-slate-300">{x.highlights.map((h) => <li key={h}>{h}</li>)}</ul></div>)}
      </div>
      <div className="lg:col-span-2"><div className="eyebrow mb-2">Skills you have (used for fit scoring)</div>
        <div className="flex flex-wrap gap-1.5">{SKILL_CATALOG.map((s) => (
          <button key={s} data-testid={`skill-toggle-${s.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} onClick={() => toggle(s)}
            className={`rounded border px-2 py-1 text-xs transition-colors ${f.skills.includes(s) ? "border-sky-500/50 bg-sky-500/15 text-sky-200" : "text-muted-foreground hover:text-white"}`}>{s}</button>
        ))}</div></div>
      {ta("target_roles", "Target roles (one per line)", 6)}{ta("target_locations", "Target locations (one per line)", 6)}
      <div className="lg:col-span-2"><Button data-testid="profile-save-btn" onClick={save} className="bg-sky-500 text-slate-950 hover:bg-sky-400">Save profile & re-score jobs</Button></div>
    </div></Panel>
  );
};

const TARGETS = [["jobs_discovered", "Jobs to discover"], ["contacts_identified", "Contacts to identify"], ["requests_sent", "Networking requests"], ["applications", "Applications"], ["follow_ups", "Follow-ups"], ["skill_minutes", "Skill practice minutes"]];
const MODELS = [["claude-opus-5-5", "Claude Opus 5.5"], ["claude-sonnet-5-5", "Claude Sonnet 5.5"], ["gpt-6-luna", "GPT 6 Luna"]];
const TASKS = [["research", "Research & scoring (web search)"], ["writing", "Outreach writing"], ["extraction", "Reading pasted job pages"]];

const PrefsTab = () => {
  const qc = useQueryClient();
  const { data: s } = useQuery({ queryKey: ["settings"], queryFn: () => get("/settings") });
  const [f, setF] = useState(null);
  useEffect(() => { if (s) setF(s); }, [s]);
  if (!f) return null;
  const save = async (patch) => {
    try { const r = await api.put("/settings", patch); setF(r.data); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["dashboard"] }); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const sendNow = async () => {
    try { await api.post("/reminders/send-now"); toast.success("Reminder email sent to your sign-in address"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Daily targets"><div className="grid grid-cols-2 gap-3 p-4">
        {TARGETS.map(([k, l]) => <div key={k}><div className="eyebrow mb-1">{l}</div><Input data-testid={`target-input-${k}`} type="number" min="0" value={f.targets[k]} onChange={(e) => setF({ ...f, targets: { ...f.targets, [k]: e.target.value } })} /></div>)}
        <Button data-testid="targets-save-btn" className="col-span-2 bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={() => save({ targets: f.targets })}>Save targets</Button>
      </div></Panel>
      <Panel title="AI models"><div className="space-y-3 p-4">
        {TASKS.map(([k, l]) => <div key={k}><div className="eyebrow mb-1">{l}</div>
          <Select value={f.models[k]} onValueChange={(v) => save({ models: { ...f.models, [k]: v } })}>
            <SelectTrigger data-testid={`model-select-${k}`}><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card">{MODELS.filter(([m]) => k !== "research" || m.startsWith("claude")).map(([v, n]) => <SelectItem key={v} value={v}>{n}</SelectItem>)}</SelectContent>
          </Select></div>)}
        <p className="text-[11px] text-muted-foreground">All models run on your Emergent universal key. Research uses live web search, which only Claude models support here.</p>
      </div></Panel>
      <Panel title="Reminders" className="lg:col-span-2"><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-3 text-sm"><Switch data-testid="email-reminders-toggle" checked={f.email_reminders} onCheckedChange={(v) => save({ email_reminders: v })} />
          Daily email at 6am Pacific with follow-ups due and top jobs. In-app reminders are always on.</label>
        <Button data-testid="send-reminder-now-btn" size="sm" variant="secondary" onClick={sendNow}><Mail className="mr-2 h-4 w-4" />Send today's reminder now</Button>
      </div></Panel>
    </div>
  );
};

const INTEGRATIONS = [
  { key: "adzuna", name: "Adzuna Canada", what: "Thousands of Canadian job ads from many boards, including BC.", env: "ADZUNA_APP_ID and ADZUNA_APP_KEY",
    steps: ["Go to developer.adzuna.com and create a free account.", "Open Dashboard → API Access Details.", "Copy the Application ID and Application Key.", "Ask me in chat to connect Adzuna; a secure card will collect both values."] },
  { key: "jsearch", name: "JSearch (Google Jobs)", what: "Covers LinkedIn, Indeed, Glassdoor, ZipRecruiter and more via Google for Jobs.", env: "RAPIDAPI_KEY",
    steps: ["Go to rapidapi.com and sign up.", "Search for 'JSearch' (by OpenWeb Ninja) and subscribe to the free Basic plan.", "Copy your X-RapidAPI-Key from the Endpoints page.", "Ask me in chat to connect JSearch; a secure card will collect it."] },
  { key: "apollo", name: "Apollo people data", what: "Recruiter and IT manager lookups by company. Paid. Arrives in Phase 2.", env: "APOLLO_API_KEY",
    steps: ["Sign up at apollo.io (a paid plan is needed for API access).", "Settings → Integrations → API → create a key.", "Ask me to connect Apollo when Phase 2 starts."] },
  { key: "ai", name: "AI models (Emergent universal key)", what: "Scoring, research, page reading and outreach writing.", steps: ["Already connected. Top up under Profile → Universal Key if balance runs low."] },
  { key: "email", name: "Reminder email (Emergent managed)", what: "Daily follow-up emails to your sign-in address.", steps: ["Already connected. No setup needed."] },
];

const IntegrationsTab = () => {
  const { data: st = {} } = useQuery({ queryKey: ["integrations"], queryFn: () => get("/integrations") });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {INTEGRATIONS.map((i) => (
        <Panel key={i.key} testId={`integration-${i.key}`}><div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-sm font-semibold">{i.name}</div><div className="text-xs text-muted-foreground">{i.what}</div></div>
            {st[i.key] ? <span data-testid={`integration-${i.key}-status`} className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span>
              : <span data-testid={`integration-${i.key}-status`} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" />Not connected</span>}
          </div>
          {!st[i.key] || i.key === "ai" || i.key === "email" ? <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-300">{i.steps.map((s) => <li key={s}>{s}</li>)}</ol> : null}
          {i.env && <div className="mt-2 font-mono text-[10px] text-muted-foreground">Keys: {i.env}</div>}
        </div></Panel>
      ))}
      <Panel title="Data export" className="lg:col-span-2"><div className="flex flex-wrap gap-2 p-4">
        {["jobs", "contacts", "companies"].map((k) => <a key={k} href={`${BACKEND}/api/export/${k}`} data-testid={`settings-export-${k}`}><Button size="sm" variant="secondary"><Download className="mr-2 h-4 w-4" />{k}.csv</Button></a>)}
      </div></Panel>
    </div>
  );
};

export default function Settings() {
  return (
    <div>
      <PageHeader eyebrow="11 · Settings" title="Settings & Integrations" desc="Your profile drives every score and message. Keys for job and people sources are stored securely on the server." />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 bg-card">
          <TabsTrigger data-testid="settings-tab-profile" value="profile">Profile</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-prefs" value="prefs">Targets & AI</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-integrations" value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="prefs"><PrefsTab /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
