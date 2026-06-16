import { createFileRoute } from "@tanstack/react-router";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { Pill } from "@/components/ui-bits";
import { LoadingState, ErrorState, EmptyState } from "@/components/data-states";
import { Send, Linkedin } from "lucide-react";
import type { Referral } from "@/lib/mocks";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Referrals — InternPilot" }, { name: "description", content: "Warm intros instead of cold applies." }] }),
  component: Referrals,
});

const relationshipLabel: Record<Referral["contact"]["relationship"], string> = {
  alumni: "alum",
  second_degree: "2nd-degree",
  unknown: "warm",
};

function Referrals() {
  const { data, loading, error, reload } = useApi(() => api.getReferrals(), []);

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Target · Linear</div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-tight">A warm intro,<br/><span className="italic" style={{color:"var(--color-primary)"}}>drafted for you.</span></h1>
        </div>

        <div className="mt-10">
          {loading && <LoadingState label="Finding alumni" />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && !error && (data?.length ?? 0) === 0 && (
            <EmptyState title="No referral paths yet." body="As you save more roles, we'll surface alumni and 2nd-degree contacts at those companies." />
          )}
          {!loading && !error && data && data.length > 0 && (
            <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                {data.map((r) => (
                  <div key={r.id} className="card-soft card-lift p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full grid place-items-center font-display text-lg"
                         style={{ background: "var(--color-primary-tint)", color: "var(--color-primary)" }}>
                      {r.contact.name.split(" ").map(s => s[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{r.contact.name}</div>
                      <div className="text-xs text-muted-foreground">{r.contact.role} · {r.contact.university} '{String(r.contact.grad_year).slice(2)}</div>
                      <div className="mt-2 flex gap-1.5">
                        <Pill tone="primary">{relationshipLabel[r.contact.relationship]}</Pill>
                        <Pill>{r.status}</Pill>
                      </div>
                    </div>
                    <a
                      href={r.contact.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${r.contact.name} on LinkedIn`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>

              <div className="card-soft p-8">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-mono">Drafted intro · {data[0].contact.name}</div>
                <h2 className="mt-2 font-display text-2xl">Subject: Berkeley → Linear editor team</h2>
                <div className="mt-5 leading-relaxed text-[15px] font-display" contentEditable suppressContentEditableWarning>
                  <p>Hi {data[0].contact.name.split(" ")[0]},</p>
                  <p className="mt-3">
                    Maya from Berkeley — also EECS, also obsessed with text editors. I&apos;ve been shipping a CRDT-backed editor in Rust + WASM
                    (<em>rustpad-mini</em>) and I noticed Linear is hiring an editor intern.
                  </p>
                  <p className="mt-3">
                    I don&apos;t want to dump a cold application on the team — would you be open to a quick 15-min chat? Happy to send a short
                    project demo first if it&apos;d be more useful than coffee.
                  </p>
                  <p className="mt-3">Thanks either way.</p>
                  <p className="mt-3">— Maya</p>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button className="rounded-full border bg-white px-4 py-2 text-xs hover:bg-secondary" style={{ borderColor: "var(--color-hairline)" }}>Tweak draft</button>
                  <button
                    onClick={() => api.setReferralStatus(data[0].id, "sent")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:bg-[color:var(--primary-hover)]"
                  >
                    <Send className="h-3.5 w-3.5" /> Send intro request
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
