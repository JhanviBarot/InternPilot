import { createFileRoute } from "@tanstack/react-router";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "@/components/data-states";
import { Bell } from "lucide-react";
import type { Application, ApplicationStatus } from "@/lib/mocks";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/tracker")({
  head: () => ({ meta: [{ title: "Tracker — InternPilot" }, { name: "description", content: "Your application pipeline." }] }),
  component: Tracker,
});

const FOLLOWUP_DAYS = 7;

function followupLabel(lastStatusAt: string): string {
  const elapsed = Math.ceil((Date.now() - new Date(lastStatusAt).getTime()) / 86_400_000);
  const remaining = FOLLOWUP_DAYS - elapsed;
  return remaining <= 0 ? "follow up now" : `follow up in ${remaining}d`;
}

const COLS: { key: ApplicationStatus; label: string }[] = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "viewed", label: "Viewed" },
  { key: "responded", label: "Responded" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "ghosted", label: "Ghosted" },
];

function Tracker() {
  const { data, loading, error, reload } = useApi(() => api.getApplications(), []);
  const [local, setLocal] = useState<Application[]>([]);
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const advance = async (a: Application) => {
    const order: ApplicationStatus[] = ["saved", "applied", "viewed", "responded", "interview", "offer"];
    const idx = order.indexOf(a.status);
    const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : a.status;
    if (next === a.status) return;
    setLocal((cur) => cur.map((x) => x.id === a.id ? { ...x, status: next } : x));
    await api.setApplicationStatus(a.id, next);
  };

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-[1500px] px-6 py-12">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Pipeline</div>
            <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-tight">Every conversation in one place.</h1>
          </div>
        </div>

        <div className="mt-10">
          {loading && <LoadingState label="Loading pipeline" />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && !error && local.length === 0 && (
            <EmptyState title="No applications yet." body="Save a match from the feed and it'll land here." />
          )}
          {!loading && !error && local.length > 0 && (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {COLS.map((c) => {
                const items = local.filter((a) => a.status === c.key);
                return (
                  <div key={c.key} className="rounded-2xl border bg-surface p-3 min-h-[400px]" style={{ borderColor: "var(--color-hairline)" }}>
                    <div className="px-2 pt-1 pb-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{c.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {items.length === 0 && (
                        <div className="text-xs text-muted-foreground/60 italic px-2 py-3">empty</div>
                      )}
                      {items.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => advance(a)}
                          className="w-full text-left card-soft card-lift p-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                          aria-label={`${a.posting.title} — click to advance status`}
                        >
                          <div className="text-sm font-medium leading-snug">{a.posting.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{a.posting.company_name}</div>
                          <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            <span>{a.channel}</span>
                            <span className="font-mono">{Math.round(a.predicted_response_prob * 100)}%</span>
                          </div>
                          {(c.key === "applied" || c.key === "viewed") && (
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--color-warm)_12%,white)] px-2 py-0.5 text-[10px] font-medium" style={{ color: "color-mix(in oklab, var(--color-warm) 75%, black)" }}>
                              <Bell className="h-2.5 w-2.5" /> {followupLabel(a.last_status_at)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
