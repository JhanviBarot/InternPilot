import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "@/components/data-states";
import { FlaskConical, ChevronDown, Check } from "lucide-react";
import type { ResearchOutreach, ResearchOutreachStatus } from "@/lib/mocks";

export const Route = createFileRoute("/outreach")({
  head: () => ({ meta: [{ title: "Research outreach — InternPilot" }, { name: "description", content: "Track your professor pitches and replies." }] }),
  component: Outreach,
});

const STATUSES: { k: ResearchOutreachStatus; label: string }[] = [
  { k: "suggested", label: "Suggested" },
  { k: "drafted", label: "Drafted" },
  { k: "contacted", label: "Contacted" },
  { k: "replied", label: "Replied" },
  { k: "accepted", label: "Accepted" },
  { k: "declined", label: "Declined" },
  { k: "no_response", label: "No response" },
];

// Allowed transitions (forward + backward revert paths)
const ALLOWED_NEXT: Record<ResearchOutreachStatus, ReadonlySet<ResearchOutreachStatus>> = {
  suggested:   new Set(["drafted", "contacted", "no_response"]),
  drafted:     new Set(["contacted", "suggested", "no_response"]),
  contacted:   new Set(["replied", "no_response"]),
  replied:     new Set(["accepted", "declined", "contacted"]),
  accepted:    new Set(["replied"]),
  declined:    new Set(["contacted", "replied"]),
  no_response: new Set(["contacted"]),
};

const TONE: Record<ResearchOutreachStatus, { bg: string; fg: string }> = {
  suggested: { bg: "var(--color-secondary)", fg: "var(--color-foreground)" },
  drafted:   { bg: "color-mix(in oklab, var(--color-ghost) 14%, white)", fg: "color-mix(in oklab, var(--color-ghost) 80%, black)" },
  contacted: { bg: "var(--color-primary-tint)", fg: "var(--color-primary)" },
  replied:   { bg: "color-mix(in oklab, var(--color-success) 18%, white)", fg: "color-mix(in oklab, var(--color-success) 80%, black)" },
  accepted:  { bg: "var(--color-primary)", fg: "var(--color-primary-foreground)" },
  declined:  { bg: "color-mix(in oklab, var(--color-reject) 14%, white)", fg: "var(--color-reject)" },
  no_response: { bg: "var(--color-secondary)", fg: "var(--color-muted-foreground)" },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Outreach() {
  const { data, loading, error, reload } = useApi(() => api.getResearchOutreach(), []);
  const [local, setLocal] = useState<ResearchOutreach[]>([]);
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const setStatus = async (id: string, status: ResearchOutreachStatus) => {
    const previous = local;
    setLocal((cur) => cur.map((x) => x.id === id ? { ...x, status } : x));
    try {
      await api.setResearchOutreachStatus(id, status);
    } catch {
      setLocal(previous);
    }
  };

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Research outreach</div>
            <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-tight">Every lab, tracked.</h1>
          </div>
          <Link to="/feed" className="text-sm text-muted-foreground hover:text-foreground">+ Find more labs</Link>
        </div>

        <div className="mt-10">
          {loading && <LoadingState label="Loading outreach" />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && !error && local.length === 0 && (
            <EmptyState icon={FlaskConical} title="No outreach yet."
              body="Open the research feed, draft a pitch, and save it here to track replies." />
          )}
          {!loading && !error && local.length > 0 && (
            <div className="card-soft overflow-hidden">
              <div className="grid grid-cols-[1.6fr_1fr_180px_100px_100px] gap-4 px-6 py-3 border-b text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono"
                   style={{ borderColor: "var(--color-hairline)" }}>
                <span>Professor · lab</span>
                <span>Institution</span>
                <span>Status</span>
                <span>Contacted</span>
                <span className="text-right">Added</span>
              </div>
              {local.map((r) => (
                <div key={r.id} className="grid grid-cols-[1.6fr_1fr_180px_100px_100px] gap-4 items-center px-6 py-4 border-b last:border-0"
                     style={{ borderColor: "var(--color-hairline)" }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.opportunity.professor_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.opportunity.lab_name || r.opportunity.institution}</div>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{r.opportunity.institution}</div>
                  <StatusPicker status={r.status} onChange={(s) => setStatus(r.id, s)} />
                  <div className="text-xs text-muted-foreground font-mono">{fmtDate(r.contacted_at)}</div>
                  <div className="text-right text-xs text-muted-foreground font-mono">{fmtDate(r.last_status_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusPicker({ status, onChange }: { status: ResearchOutreachStatus; onChange: (s: ResearchOutreachStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tone = TONE[status];
  const label = STATUSES.find((s) => s.k === status)?.label ?? status;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] transition-opacity hover:opacity-90"
        style={{ background: tone.bg, color: tone.fg }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 z-50 w-44 rounded-2xl border bg-white py-1.5 shadow-lg"
          style={{ borderColor: "var(--color-hairline)", boxShadow: "0 8px 24px -4px rgb(0 0 0 / 0.12)" }}
          role="listbox"
        >
          {STATUSES.map((s) => {
            const isCurrent = s.k === status;
            const isAllowed = ALLOWED_NEXT[status].has(s.k);
            const disabled = !isCurrent && !isAllowed;
            const t = TONE[s.k];
            return (
              <button
                key={s.k}
                role="option"
                aria-selected={isCurrent}
                disabled={disabled}
                onClick={() => { if (!disabled && !isCurrent) { onChange(s.k); } setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                  isCurrent ? "font-medium" : disabled ? "opacity-30 cursor-not-allowed" : "hover:bg-secondary cursor-pointer"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: t.fg }}
                />
                <span className="flex-1 text-left" style={{ color: isCurrent ? t.fg : undefined }}>{s.label}</span>
                {isCurrent && <Check className="h-3 w-3 shrink-0" style={{ color: t.fg }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
