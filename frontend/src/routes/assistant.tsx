import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { Pill } from "@/components/ui-bits";
import { LoadingState, ErrorState } from "@/components/data-states";
import { Send, RefreshCw, FileText, Check } from "lucide-react";
import type { Match } from "@/lib/mocks";

export const Route = createFileRoute("/assistant")({
  validateSearch: (s: Record<string, unknown>) => ({
    posting_id: typeof s.posting_id === "string" ? s.posting_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Application Assistant — InternPilot" }, { name: "description", content: "Draft a grounded, ATS-optimized application." }] }),
  component: Assistant,
});

function Assistant() {
  const { posting_id } = Route.useSearch();
  const { data: matches, loading, error, reload } = useApi(() => api.getMatches(), []);

  const m: Match | undefined =
    matches?.find((x) => x.posting.id === posting_id) ?? matches?.[0];

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-12">
        {loading && <LoadingState label="Loading matches" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && !m && (
          <div className="text-center py-24 text-muted-foreground">
            No match selected. <Link to="/feed" className="underline">Browse the feed</Link> and open a posting first.
          </div>
        )}
        {!loading && !error && m && <AssistantInner m={m} />}
      </main>
    </div>
  );
}

function AssistantInner({ m }: { m: Match }) {
  const navigate = useNavigate();
  const [nonce, setNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const draftRef = useRef<HTMLDivElement>(null);

  // Decode posting: LLM-extracted summary + canonical requirements + resume keywords
  const { data: decoded } = useApi(
    () => api.decodePosting(m.posting.id),
    [m.posting.id],
  );

  // Draft cover letter + ATS score (re-fetched on regenerate)
  const { data: draft, loading: draftLoading } = useApi(
    () => api.draftCoverLetter(m.posting.id),
    [m.posting.id, nonce],
  );

  const atsScore = draft?.ats_score ?? 0;
  const missing = draft?.missing_keywords ?? [];
  const summary = decoded?.summary || m.posting.description;
  const requirements = decoded?.requirements?.length ? decoded.requirements : m.posting.requirements;

  const handleReviewAndSend = async () => {
    if (!draft?.artifact_id || submitting || submitted) return;
    setSubmitting(true);
    try {
      const app = await api.createApplication(m.posting.id, "portal", draft.artifact_id);
      await api.setApplicationStatus(app.id, "applied");
      setSubmitted(true);
      setTimeout(() => navigate({ to: "/tracker" }), 800);
    } catch (err) {
      console.error("Failed to submit application:", err);
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-[420px_1fr]">
      <aside className="space-y-6 md:sticky md:top-24 h-fit">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Decoded posting</div>
          <h2 className="mt-2 font-display text-3xl tracking-tight">{m.posting.title}</h2>
          <p className="text-sm text-muted-foreground">{m.posting.company.name} · {m.posting.location}</p>
          <Link to="/feed" className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground">← Back to feed</Link>
        </div>

        <div className="card-soft p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">ATS score</div>
            <div className="font-mono text-sm" style={{ color: atsScore >= 70 ? "var(--color-primary)" : atsScore >= 40 ? "var(--color-warm)" : "#e44" }}>
              {draftLoading ? "—" : `${atsScore} / 100`}
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={atsScore}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: draftLoading ? "0%" : `${atsScore}%`,
                background: atsScore >= 70 ? "var(--color-primary)" : atsScore >= 40 ? "var(--color-warm)" : "#e44",
              }}
            />
          </div>
          {missing.length > 0 && (
            <>
              <div className="mt-5 text-xs uppercase tracking-[0.14em] text-muted-foreground">Missing keywords</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missing.map((k) => <Pill key={k} tone="warm">{k}</Pill>)}
              </div>
            </>
          )}
          {!draftLoading && missing.length === 0 && atsScore > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">All key terms covered.</p>
          )}
        </div>

        <div className="card-soft p-6">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Job summary</div>
          <p className="mt-2 text-sm leading-relaxed">{summary}</p>
          {requirements.length > 0 && (
            <>
              <div className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">Requirements</div>
              <ul className="mt-2 text-sm space-y-1.5">
                {requirements.map((r) => (
                  <li key={r} className="flex gap-2"><Check className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: "var(--color-primary)" }} />{r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Draft · grounded in your work</div>
            <h1 className="mt-2 font-display text-4xl tracking-tight">Cover letter</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setNonce((n) => n + 1)}
              disabled={draftLoading || submitting}
              className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-60"
              style={{ borderColor: "var(--color-hairline)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${draftLoading ? "animate-spin" : ""}`} /> Regenerate
            </button>
            <button
              onClick={handleReviewAndSend}
              disabled={!draft?.artifact_id || draftLoading || submitting || submitted}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs font-medium hover:bg-[color:var(--primary-hover)] disabled:opacity-60"
            >
              {submitted ? (
                <><Check className="h-3.5 w-3.5" /> Submitted</>
              ) : submitting ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Review &amp; send</>
              )}
            </button>
          </div>
        </div>

        {draftLoading ? (
          <div className="card-soft mt-6 p-10 flex items-center justify-center min-h-[320px]">
            <LoadingState label="Drafting cover letter — analysing job description and your profile…" />
          </div>
        ) : draft?.content ? (
          <div
            ref={draftRef}
            className="card-soft mt-6 p-10 leading-relaxed text-[15px] font-display"
            contentEditable
            suppressContentEditableWarning
          >
            {draft.content.split("\n\n").map((para, i) => (
              <p key={i} className={i > 0 ? "mt-4" : ""}>{para}</p>
            ))}
          </div>
        ) : (
          <div className="card-soft mt-6 p-10 flex items-center justify-center min-h-[320px] text-muted-foreground text-sm">
            Draft will appear here once your profile and the posting are loaded.
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Attachments: resume.pdf, projects.pdf · auto-tailored to this posting
        </div>
      </section>
    </div>
  );
}
