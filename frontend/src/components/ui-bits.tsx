import { Ghost, ShieldCheck, Sparkles } from "lucide-react";

export function MatchRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const pct = Math.round(value * 100);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const noData = pct === 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-hairline)" strokeWidth="4" fill="none" />
        {!noData && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke="var(--color-primary)" strokeWidth="4" fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className={`font-mono text-[13px] font-semibold ${noData ? "text-muted-foreground" : ""}`}>
            {noData ? "—" : `${pct}%`}
          </div>
          {label && <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>}
        </div>
      </div>
    </div>
  );
}

export function GhostBadge({ isGhost, score }: { isGhost: boolean; score: number }) {
  if (isGhost) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: "color-mix(in oklab, var(--color-ghost) 14%, white)", color: "color-mix(in oklab, var(--color-ghost) 80%, black)" }}>
        <Ghost className="h-3.5 w-3.5" /> Likely ghost — skip
        <span className="font-mono opacity-70">·{Math.round(score * 100)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium"
          style={{ color: "var(--color-primary)" }}>
      <ShieldCheck className="h-3.5 w-3.5" /> Strong match
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "warm" }) {
  const styles: Record<string, string> = {
    neutral: "bg-secondary text-foreground",
    primary: "bg-primary-tint text-[color:var(--color-primary)]",
    warm: "bg-[color-mix(in_oklab,var(--color-warm)_15%,white)] text-[color-mix(in_oklab,var(--color-warm)_75%,black)]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function SectionLabel({ children, icon: Icon = Sparkles }: { children: React.ReactNode; icon?: any }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" style={{ color: "var(--color-primary)" }} /> {children}
    </div>
  );
}
