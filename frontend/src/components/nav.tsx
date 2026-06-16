import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/feed", label: "Match Feed" },
  { to: "/tracker", label: "Tracker" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/referrals", label: "Referrals" },
  { to: "/outreach", label: "Outreach" },
  { to: "/prep", label: "Interview" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mt-4 flex items-center justify-between rounded-full border border-hairline bg-white/70 px-5 py-2.5 backdrop-blur-xl shadow-soft"
             style={{ borderColor: "var(--color-hairline)", boxShadow: "var(--shadow-soft)" }}>
          <Link to="/" className="flex items-center gap-2 group">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Compass className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">InternPilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className="px-3 py-1.5 rounded-full transition-colors hover:text-foreground hover:bg-secondary"
                activeProps={{ className: "px-3 py-1.5 rounded-full text-foreground bg-secondary" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">
              Sign in
            </Link>
            <Link
              to="/onboarding"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color:var(--primary-hover)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-32 border-t border-hairline" style={{ borderColor: "var(--color-hairline)" }}>
      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Compass className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">InternPilot</span>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            The opposite of mass-blast bots. Apply only where you can actually win.
          </p>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-3">Product</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/feed" className="hover:text-foreground">Match feed</Link></li>
            <li><Link to="/tracker" className="hover:text-foreground">Tracker</Link></li>
            <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-medium mb-3">Get started</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/onboarding" className="hover:text-foreground">Build your Career Twin</Link></li>
            <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
            <li><Link to="/referrals" className="hover:text-foreground">Referrals</Link></li>
            <li><Link to="/prep" className="hover:text-foreground">Interview prep</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 pb-10 text-xs text-muted-foreground flex justify-between">
        <span>© 2026 InternPilot</span>
        <span className="font-mono">v0.9 · platform IQ rising</span>
      </div>
    </footer>
  );
}
