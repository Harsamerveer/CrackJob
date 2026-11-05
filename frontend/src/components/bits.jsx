import { ExternalLink, ShieldCheck, Sparkles, AlarmClock, Lock } from "lucide-react";
import { daysUntil, relTime, CONTACT_TYPES } from "../lib/api";

export const ScoreBadge = ({ score, testId }) => {
  const s = Math.round(score || 0);
  const tone = s >= 75 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" : s >= 55 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-rose-400 border-rose-500/40 bg-rose-500/10";
  return (
    <span data-testid={testId} className={`inline-flex items-center justify-center min-w-[2.5rem] rounded border px-1.5 py-0.5 font-mono text-xs font-semibold ${tone}`}>
      {s}
    </span>
  );
};

export const VerifyTag = ({ value, testId }) =>
  value === "verified" ? (
    <span data-testid={testId} className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>
  ) : (
    <span data-testid={testId} className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
      <Sparkles className="h-3 w-3" /> Inferred
    </span>
  );

export const TypeBadge = ({ type }) => (
  <span className="inline-flex rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{CONTACT_TYPES[type] || type}</span>
);

export const SourceStamp = ({ url, label, at, testId }) => (
  <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
    {url ? (
      <a data-testid={testId} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline max-w-[220px] truncate">
        {label || (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return "source"; } })()}
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    ) : (
      <span>{label || "no source"}</span>
    )}
    {at && <span className="font-mono">· verified {relTime(at)}</span>}
  </span>
);

export const DeadlineFlag = ({ deadline }) => {
  const d = daysUntil(deadline);
  if (d === null || d > 7) return null;
  return (
    <span data-testid="deadline-flag" className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-400">
      <AlarmClock className="h-3 w-3" /> {d < 0 ? "Closed" : d === 0 ? "Closes today" : `Closes in ${d}d`}
    </span>
  );
};

export const PageHeader = ({ eyebrow, title, desc, actions }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between fade-up">
    <div>
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <h1 data-testid="page-title" className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
      {desc && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const Panel = ({ title, right, children, className = "", testId }) => (
  <section data-testid={testId} className={`rounded-md border bg-card ${className}`}>
    {title && (
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
    )}
    {children}
  </section>
);

export const Empty = ({ children, testId }) => (
  <div data-testid={testId} className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>
);

export const Chip = ({ children, tone = "default" }) => {
  const tones = { default: "bg-secondary text-secondary-foreground", good: "bg-emerald-500/10 text-emerald-300", bad: "bg-rose-500/10 text-rose-300" };
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] ${tones[tone]}`}>{children}</span>;
};

export const ComingSoon = ({ phase, title, items }) => (
  <div className="grid-bg rounded-md border p-8 sm:p-12 fade-up" data-testid="coming-soon-panel">
    <div className="inline-flex items-center gap-2 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 font-mono text-xs text-sky-300">
      <Lock className="h-3 w-3" /> Coming in Phase {phase}
    </div>
    <h2 className="mt-4 text-xl font-semibold">{title}</h2>
    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
      {items.map((i) => <li key={i} className="flex gap-2"><span className="text-sky-400">→</span>{i}</li>)}
    </ul>
  </div>
);
