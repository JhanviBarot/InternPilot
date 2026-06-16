import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api-client";
import { LoadingState } from "@/components/data-states";
import { Play, AlertTriangle, ArrowRight, ArrowLeft, X, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import type { InterviewPrep, InterviewQuestion } from "@/lib/mocks";

export const Route = createFileRoute("/prep")({
  head: () => ({ meta: [{ title: "Interview prep — InternPilot" }, { name: "description", content: "Mock interviews tuned to your gaps." }] }),
  component: Prep,
});

function Prep() {
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [mockOpen, setMockOpen] = useState(false);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const result = await api.createInterviewPrep(company.trim(), role.trim());
      setPrep(result);
    } catch (err: any) {
      setGenError(err?.message ?? "Failed to generate prep. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => { setPrep(null); setCompany(""); setRole(""); setGenError(null); };

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {!prep ? (
          <PrepForm
            company={company}
            role={role}
            onCompany={setCompany}
            onRole={setRole}
            onSubmit={generate}
            generating={generating}
            error={genError}
          />
        ) : (
          <>
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">
                  Loop · {prep.company_name} · {prep.role}
                </div>
                <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-tight">
                  Practice where you&apos;ll stumble.
                </h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                  style={{ borderColor: "var(--color-hairline)" }}
                >
                  New prep
                </button>
                <button
                  onClick={() => setMockOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:-translate-y-0.5 transition-transform"
                >
                  <Play className="h-4 w-4" /> Start mock interview
                </button>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <div className="card-soft p-8">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Likely questions ({prep.questions.length})
                </div>
                <ol className="mt-5 space-y-5">
                  {prep.questions.map((q, i) => (
                    <QuestionItem key={i} q={q} index={i} />
                  ))}
                </ol>
              </div>

              <div className="space-y-6">
                <div className="card-soft p-8">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Your weak spots</div>
                  <ul className="mt-5 space-y-4">
                    {prep.weak_spots.length === 0 ? (
                      <li className="text-sm text-muted-foreground">No specific weak spots identified for this role.</li>
                    ) : prep.weak_spots.map((w, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <AlertTriangle className="h-4 w-4 mt-1 shrink-0" style={{ color: "var(--color-warm)" }} />
                        <span className="text-sm leading-relaxed">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {prep.reverse_questions.length > 0 && (
                  <div className="card-soft p-8">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Ask them these
                    </div>
                    <ul className="mt-5 space-y-3">
                      {prep.reverse_questions.map((rq, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--color-primary)" }} />
                          <span className="text-sm leading-relaxed">{rq}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl p-5" style={{ background: "var(--color-primary-tint)" }}>
                  <div className="text-xs uppercase tracking-[0.14em]" style={{ color: "var(--color-primary)" }}>Tip from your cohort</div>
                  <p className="mt-2 text-sm">Candidates who scored ≥70 on the mock loop got an offer 3.2× more often than those who skipped it.</p>
                </div>
              </div>
            </div>

            {mockOpen && (
              <MockInterviewModal questions={prep.questions} onClose={() => setMockOpen(false)} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PrepForm({
  company, role, onCompany, onRole, onSubmit, generating, error
}: {
  company: string; role: string;
  onCompany: (v: string) => void; onRole: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  generating: boolean; error: string | null;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Interview prep</div>
      <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-tight">
        Practice where you&apos;ll stumble.
      </h1>
      <p className="mt-4 text-muted-foreground max-w-lg">
        Enter a company and role to generate a personalised prep pack — likely questions, your weak spots, and reverse questions to impress the interviewer.
      </p>

      <form onSubmit={onSubmit} className="mt-10 max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="company">Company</label>
          <input
            id="company"
            type="text"
            value={company}
            onChange={(e) => onCompany(e.target.value)}
            placeholder="e.g. Anthropic"
            required
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            style={{ borderColor: "var(--color-hairline)" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="role">Role</label>
          <input
            id="role"
            type="text"
            value={role}
            onChange={(e) => onRole(e.target.value)}
            placeholder="e.g. Research Engineer Intern"
            required
            className="w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            style={{ borderColor: "var(--color-hairline)" }}
          />
        </div>
        {error && <div className="text-xs" style={{ color: "var(--color-reject)" }}>{error}</div>}
        <button
          type="submit"
          disabled={generating || !company.trim() || !role.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-[color:var(--primary-hover)] transition disabled:opacity-60"
        >
          {generating ? "Generating prep…" : <>Generate prep <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      {generating && (
        <div className="mt-10">
          <LoadingState label="Generating your prep pack — analysing your profile and the role…" />
        </div>
      )}
    </div>
  );
}

function QuestionItem({ q, index }: { q: InterviewQuestion; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="flex gap-4 items-start">
      <span className="font-mono text-xs text-muted-foreground mt-1.5">{String(index + 1).padStart(2, "0")}</span>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-xl leading-snug">{q.q}</span>
          <button
            onClick={() => setExpanded((o) => !o)}
            className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Hide guidance" : "Show guidance"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="rounded-full bg-primary-tint px-2 py-0.5" style={{ color: "var(--color-primary)" }}>{q.type}</span>
          <span>{q.category}</span>
          <span>· {q.difficulty}</span>
        </div>
        {expanded && q.answer_guidance && (
          <div className="mt-3 rounded-lg p-3 text-sm text-muted-foreground" style={{ background: "var(--color-surface)" }}>
            <div className="font-medium text-foreground text-xs uppercase tracking-[0.12em] mb-1">Answer guidance</div>
            <p>{q.answer_guidance}</p>
            {q.ideal_answer_outline && (
              <>
                <div className="font-medium text-foreground text-xs uppercase tracking-[0.12em] mt-3 mb-1">Ideal outline</div>
                <p>{q.ideal_answer_outline}</p>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function MockInterviewModal({ questions, onClose }: { questions: InterviewQuestion[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);

  const q = questions[idx];
  const total = questions.length;

  const next = () => {
    setAnswers((a) => ({ ...a, [idx]: answer }));
    setAnswer("");
    if (idx + 1 >= total) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
    }
  };

  const prev = () => {
    setAnswers((a) => ({ ...a, [idx]: answer }));
    setAnswer(answers[idx - 1] ?? "");
    setIdx((i) => i - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl p-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="text-center py-8">
            <div className="font-display text-3xl font-medium">Practice complete!</div>
            <p className="mt-3 text-muted-foreground">You answered {Object.keys(answers).length} of {total} questions. Review the answer guidance above to refine your responses.</p>
            <button
              onClick={onClose}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-[color:var(--primary-hover)] transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-mono">
                Question {idx + 1} / {total}
              </div>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === idx ? "24px" : "8px",
                      background: i < idx ? "var(--color-primary)" : i === idx ? "var(--color-primary)" : "var(--color-hairline)",
                      opacity: i <= idx ? 1 : 0.4,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                {q.type}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-[0.14em]">{q.category} · {q.difficulty}</span>
            </div>

            <h2 className="font-display text-2xl leading-snug">{q.q}</h2>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here… (or just think through it aloud)"
              rows={6}
              className="mt-6 w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] resize-none"
              style={{ borderColor: "var(--color-hairline)" }}
            />

            {q.answer_guidance && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Show answer guidance
                </summary>
                <div className="mt-2 rounded-lg p-3 text-sm text-muted-foreground" style={{ background: "var(--color-surface)" }}>
                  {q.answer_guidance}
                </div>
              </details>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={prev}
                disabled={idx === 0}
                className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition disabled:opacity-40"
                style={{ borderColor: "var(--color-hairline)" }}
              >
                <ArrowLeft className="h-4 w-4" /> Previous
              </button>
              <button
                onClick={next}
                className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:-translate-y-0.5 transition-transform"
              >
                {idx + 1 === total ? "Finish" : "Next"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
