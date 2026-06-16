import { createFileRoute } from "@tanstack/react-router";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { LoadingState, ErrorState } from "@/components/data-states";
import { Play, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/prep")({
  head: () => ({ meta: [{ title: "Interview prep — InternPilot" }, { name: "description", content: "Mock interviews tuned to your gaps." }] }),
  component: Prep,
});

function Prep() {
  const { data, loading, error, reload } = useApi(() => api.getDefaultInterviewPrep(), []);

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {loading && <LoadingState label="Loading prep" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && data && (
          <>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Loop · {data.company_name} · {data.role}</div>
              <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-tight">Practice where you&apos;ll stumble.</h1>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <div className="card-soft p-8">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Likely questions</div>
                <ol className="mt-5 space-y-5">
                  {data.questions.map((q, i) => (
                    <li key={q.q} className="flex gap-4 items-start">
                      <span className="font-mono text-xs text-muted-foreground mt-1.5">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-xl leading-snug">{q.q}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          <span className="rounded-full bg-primary-tint px-2 py-0.5" style={{ color: "var(--color-primary)" }}>{q.type}</span>
                          <span>{q.answer_guidance}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <button className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-3 text-sm font-medium hover:-translate-y-0.5 transition-transform">
                  <Play className="h-4 w-4" /> Start mock interview
                </button>
              </div>

              <div className="card-soft p-8">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Your weak spots</div>
                <ul className="mt-5 space-y-4">
                  {data.weak_spots.map((w) => (
                    <li key={w} className="flex gap-3 items-start">
                      <AlertTriangle className="h-4 w-4 mt-1 shrink-0" style={{ color: "var(--color-warm)" }} />
                      <span className="text-sm leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 rounded-xl p-5" style={{ background: "var(--color-primary-tint)" }}>
                  <div className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--color-primary)" }}>Tip from your cohort</div>
                  <p className="mt-2 text-sm">Candidates who scored ≥70 on the mock loop got an offer 3.2× more often than those who skipped it.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
