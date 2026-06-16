import { createFileRoute, Link } from "@tanstack/react-router";
import { CalmBackground } from "@/components/live-background";
import { Nav } from "@/components/nav";
import { api, useApi } from "@/lib/api-client";
import { LoadingState, ErrorState } from "@/components/data-states";
import { Upload, Github, ArrowRight, Sparkles } from "lucide-react";
import { Pill } from "@/components/ui-bits";
import type { Profile } from "@/lib/mocks";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Build your Career Twin — InternPilot" }, { name: "description", content: "Set up your Career Twin in two minutes." }] }),
  component: Onboarding,
});

function Onboarding() {
  const { data, loading, error, reload } = useApi(() => api.getProfile(), []);

  return (
    <div className="min-h-screen">
      <CalmBackground />
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Step 1 of 3 · Career Twin</div>
        <h1 className="mt-3 font-display text-5xl md:text-6xl font-medium tracking-tight text-balance">
          Tell us what you&apos;ve actually shipped.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          The more honest your inputs, the sharper your match feed. We never spray your applications — you approve every send.
        </p>

        <div className="mt-12">
          {loading && <LoadingState label="Loading your profile" />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && !error && data && <OnboardingInner profile={data} />}
        </div>
      </main>
    </div>
  );
}

function OnboardingInner({ profile }: { profile: Profile }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-6">
        <div className="card-soft p-8">
          <h2 className="font-display text-xl">Résumé</h2>
          <p className="text-sm text-muted-foreground mt-1">PDF or DOCX, max 5 MB.</p>
          <label className="mt-5 block rounded-xl border border-dashed p-10 text-center cursor-pointer hover:bg-secondary transition focus-within:ring-2 focus-within:ring-[color:var(--ring)]"
                 style={{ borderColor: "var(--color-hairline)" }}>
            <input type="file" accept=".pdf,.docx" className="sr-only" />
            <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
            <div className="mt-3 text-sm">Drop your résumé here, or click to browse</div>
            <div className="mt-1 text-xs text-muted-foreground font-mono">resume.pdf · 312 KB · parsed ✓</div>
          </label>
        </div>

        <div className="card-soft p-8">
          <h2 className="font-display text-xl">Connect GitHub</h2>
          <p className="text-sm text-muted-foreground mt-1">We read your repos to ground every application in your real work.</p>
          <a
            href={profile.github_url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full border bg-foreground text-background px-5 py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--color-hairline)" }}
          >
            <Github className="h-4 w-4" /> Connect GitHub
          </a>
          <div className="mt-5 grid gap-3">
            {profile.projects.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border bg-surface px-4 py-3" style={{ borderColor: "var(--color-hairline)" }}>
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline">{p.name}</a>
                    ) : p.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">{p.tech.map((s) => <Pill key={s}>{s}</Pill>)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-8">
          <h2 className="font-display text-xl">About you</h2>
          <div className="mt-5 grid sm:grid-cols-2 gap-5 text-sm">
            <Field label="University">
              <input defaultValue={profile.university}
                     className="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                     style={{ borderColor: "var(--color-hairline)" }} />
            </Field>
            <Field label="Graduation year">
              <input type="number" defaultValue={profile.grad_year ?? ""}
                     className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                     style={{ borderColor: "var(--color-hairline)" }} />
            </Field>
            <Field label="Research interests">
              <div className="flex flex-wrap gap-1.5">
                {profile.research_interests.map((r) => <Pill key={r} tone="primary">{r}</Pill>)}
                <button className="text-xs text-muted-foreground hover:text-foreground rounded-full border bg-white px-2.5 py-1" style={{ borderColor: "var(--color-hairline)" }}>+ add</button>
              </div>
            </Field>
          </div>
        </div>

        <div className="card-soft p-8">
          <h2 className="font-display text-xl">Preferences</h2>
          <div className="mt-5 grid sm:grid-cols-2 gap-5 text-sm">
            <Field label="Domains">
              <div className="flex flex-wrap gap-1.5">{profile.preferences.domains.map((d) => <Pill key={d} tone="primary">{d}</Pill>)}</div>
            </Field>
            <Field label="Work mode"><Pill>{profile.preferences.work_mode}</Pill></Field>
            <Field label="Stipend min"><span className="font-mono">${profile.preferences.stipend_min.toLocaleString()}/mo</span></Field>
            <Field label="Duration"><span className="font-mono">{profile.preferences.duration_months} months</span></Field>
            <Field label="Locations">
              <div className="flex flex-wrap gap-1.5">{profile.preferences.locations.map((l) => <Pill key={l}>{l}</Pill>)}</div>
            </Field>
            <Field label="Target companies">
              <div className="flex flex-wrap gap-1.5">{profile.preferences.target_companies.map((c) => <Pill key={c} tone="warm">{c}</Pill>)}</div>
            </Field>
          </div>
        </div>
      </div>

      <aside className="card-soft p-8 h-fit sticky top-24">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-mono">Profile strength</div>
        <StrengthMeter value={profile.profile_strength} />
        <div className="mt-6">
          <div className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: "var(--color-primary)" }} /> Gaps to fix</div>
          <ul className="mt-3 space-y-2.5 text-sm">
            {profile.gaps.map((g, i) => (
              <li key={g} className="flex gap-2.5">
                <span className="mt-0.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-muted-foreground">{g}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link to="/feed" className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-[color:var(--primary-hover)]">
          See my match feed <ArrowRight className="h-4 w-4" />
        </Link>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">{label}</div>
      {children}
    </div>
  );
}

function StrengthMeter({ value }: { value: number }) {
  const size = 180, r = 78, c = 2 * Math.PI * r;
  return (
    <div className="relative mt-4 grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Profile strength">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-hairline)" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r}
                stroke="var(--color-primary)" strokeWidth="10" fill="none" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-5xl font-medium">{value}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">/ 100</div>
        </div>
      </div>
    </div>
  );
}
