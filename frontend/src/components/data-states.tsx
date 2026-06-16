import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="card-soft p-10 flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon = Inbox }: { title: string; body?: string; icon?: any }) {
  return (
    <div className="card-soft p-10 text-center">
      <Icon className="mx-auto h-6 w-6 text-muted-foreground" />
      <div className="mt-4 font-display text-xl">{title}</div>
      {body && <div className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{body}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="card-soft p-8" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: "var(--color-warm)" }} />
        <div className="flex-1">
          <div className="font-display text-lg">Something broke loading this.</div>
          <div className="text-sm text-muted-foreground mt-1">{error.message}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 inline-flex items-center rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-xs font-medium hover:bg-[color:var(--primary-hover)]"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
