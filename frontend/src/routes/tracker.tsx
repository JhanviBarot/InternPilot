import { createFileRoute } from "@tanstack/react-router";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { LoadingState, EmptyState, ErrorState } from "@/components/data-states";
import { Bell, ChevronLeft } from "lucide-react";
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
  { key: "rejected", label: "Rejected" },
  { key: "ghosted", label: "Ghosted" },
];

// Terminal states: clicking does NOT advance the card — explicit to avoid silent failures (#10)
const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set(["offer", "rejected", "ghosted"]);

function Tracker() {
  const { data, loading, error, reload } = useApi(() => api.getApplications(), []);
  const [local, setLocal] = useState<Application[]>([]);
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const STEP_ORDER: ApplicationStatus[] = ["saved", "applied", "viewed", "responded", "interview", "offer"];

  const advance = async (a: Application) => {
    if (TERMINAL_STATUSES.has(a.status)) return;
    const idx = STEP_ORDER.indexOf(a.status);
    if (idx < 0 || idx >= STEP_ORDER.length - 1) return;
    const next = STEP_ORDER[idx + 1];
    setLocal((cur) => cur.map((x) => x.id === a.id ? { ...x, status: next } : x));
    await api.setApplicationStatus(a.id, next);
  };

  const demote = async (a: Application) => {
    let prev: ApplicationStatus;
    if (TERMINAL_STATUSES.has(a.status)) {
      prev = "interview";
    } else {
      const idx = STEP_ORDER.indexOf(a.status);
      if (idx <= 0) return;
      prev = STEP_ORDER[idx - 1];
    }
    setLocal((cur) => cur.map((x) => x.id === a.id ? { ...x, status: prev } : x));
    await api.setApplicationStatus(a.id, prev);
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
            <div className="overflow-x-auto -mx-6 px-6 pb-3">
              <div className="flex gap-3 min-w-max lg:min-w-0 lg:grid lg:grid-cols-8">
              {COLS.map((c) => {
                const items = local.filter((a) => a.status === c.key);
                return (
                  <div key={c.key} className="w-[185px] lg:w-auto rounded-2xl border bg-surface p-3 min-h-[400px] flex-none" style={{ borderColor: "var(--color-hairline)" }}>
                    <div className="px-2 pt-1 pb-3 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{c.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {items.length === 0 && (
                        <div className="text-xs text-muted-foreground/60 italic px-2 py-3">empty</div>
                      )}
                      {items.map((a) => {
                        const canAdvance = !TERMINAL_STATUSES.has(a.status);
                        const canGoBack = a.status !== "saved";
                        return (
                          <div key={a.id} className="relative group">
                            <div
                              onClick={() => canAdvance && advance(a)}
                              role={canAdvance ? "button" : undefined}
                              tabIndex={canAdvance ? 0 : undefined}
                              onKeyDown={canAdvance ? (e) => (e.key === "Enter" || e.key === " ") && advance(a) : undefined}
                              className={`card-soft card-lift p-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] ${canAdvance ? "cursor-pointer" : "cursor-default"} ${canGoBack ? "pr-8" : ""}`}
                              aria-label={canAdvance ? `${a.posting.title} - click to advance status` : `${a.posting.title} - terminal status`}
                              aria-disabled={!canAdvance}
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
                            </div>
                            {canGoBack && (
                              <button
                                onClick={() => demote(a)}
                                className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center border bg-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary focus:outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-[color:var(--ring)]"
                                style={{ borderColor: "var(--color-hairline)" }}
                                title="Move to previous stage"
                                aria-label={`Move ${a.posting.title} to previous stage`}
                              >
                                <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
