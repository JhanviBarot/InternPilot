import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
        {loading && <LoadingState label="Decoding posting" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !error && m && <AssistantInner m={m} />}
      </main>
    </div>
  );
}

function AssistantInner({ m }: { m: Match }) {
  const [nonce, setNonce] = useState(0);

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

  const atsScore = draft?.ats_score ? draft.ats_score : Math.round(70 + m.match_score * 25);
  const missing = draft?.missing_keywords?.length
    ? draft.missing_keywords
    : (m.missing_skills.length ? m.missing_skills : ["Yjs", "OT operations"]);
  const summary = decoded?.summary || m.posting.description;
  const requirements = decoded?.requirements?.length ? decoded.requirements : m.posting.requirements;

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
            <div className="font-mono text-sm" style={{ color: "var(--color-primary)" }}>{atsScore} / 100</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={atsScore}>
            <div className="h-full rounded-full" style={{ width: `${atsScore}%`, background: "var(--color-primary)" }} />
          </div>
          <div className="mt-5 text-xs uppercase tracking-[0.14em] text-muted-foreground">Missing keywords</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((k) => <Pill key={k} tone="warm">{k}</Pill>)}
          </div>
        </div>

        <div className="card-soft p-6">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Job summary</div>
          <p className="mt-2 text-sm leading-relaxed">{summary}</p>
          <div className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">Requirements</div>
          <ul className="mt-2 text-sm space-y-1.5">
            {requirements.map((r) => (
              <li key={r} className="flex gap-2"><Check className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: "var(--color-primary)" }} />{r}</li>
            ))}
          </ul>
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
              disabled={draftLoading}
              className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-60"
              style={{ borderColor: "var(--color-hairline)" }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${draftLoading ? "animate-spin" : ""}`} /> Regenerate
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs font-medium hover:bg-[color:var(--primary-hover)]">
              <Send className="h-3.5 w-3.5" /> Review &amp; send
            </button>
          </div>
        </div>

        {draftLoading ? (
          <div className="card-soft mt-6 p-10 flex items-center justify-center min-h-[320px]">
            <LoadingState label="Drafting cover letter" />
          </div>
        ) : draft?.content ? (
          <div className="card-soft mt-6 p-10 leading-relaxed text-[15px] font-display"
               contentEditable suppressContentEditableWarning>
            {draft.content.split("\n\n").map((para, i) => (
              <p key={i} className={i > 0 ? "mt-4" : ""}>{para}</p>
            ))}
          </div>
        ) : (
          <div className="card-soft mt-6 p-10 leading-relaxed text-[15px] font-display"
               contentEditable suppressContentEditableWarning>
            <p>Hi {m.posting.company.name} team,</p>
            <p className="mt-4">
              I&apos;ve been pulling at the same threads your {m.posting.title.toLowerCase()} team is working on. In <em>rustpad-mini</em> I shipped a CRDT-backed
              editor in Rust + WASM with conflict-free cursor sync — the same problem space, just at a much smaller scale.
              The tradeoffs around presence under network partition are still on my mind.
            </p>
            <p className="mt-4">
              Most recently at Replicate I shipped 14 PRs to the inference tooling, optimizing a hot serving path that cut p95 latency
              by 38%. I care about the same things you publicly care about: a calm interface, tight feedback loops, and code that
              doesn&apos;t apologize for itself.
            </p>
            <p className="mt-4">
              I&apos;d love to spend the summer on the {m.posting.title.toLowerCase().includes("editor") ? "editor" : "platform"} surface.
              I&apos;m also happy to take a small async take-home if it&apos;d be useful.
            </p>
            <p className="mt-4">— Maya</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Attachments: resume.pdf, projects.pdf · auto-tailored to this posting
        </div>
      </section>
    </div>
  );
}
