import { useEffect, useRef } from "react";

/**
 * AuroraMesh — a slow, calm animated gradient mesh in sage/mint/ivory.
 * Pure CSS conic+radial blobs, drifting. Pauses when off-screen.
 */
export function AuroraMesh({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="absolute inset-0" style={{ background: "var(--color-background)" }} />
      <div className="aurora-blob aurora-a" />
      <div className="aurora-blob aurora-b" />
      <div className="aurora-blob aurora-c" />
      <div className="aurora-blob aurora-d" />
      <style>{`
        .aurora-blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.7;will-change:transform;}
        .aurora-a{width:60vmax;height:60vmax;left:-10vmax;top:-15vmax;background:radial-gradient(circle at 30% 30%, #CFE3D6, transparent 60%);animation:drift1 28s ease-in-out infinite alternate;}
        .aurora-b{width:50vmax;height:50vmax;right:-12vmax;top:-8vmax;background:radial-gradient(circle at 50% 50%, #DCEAE0, transparent 60%);animation:drift2 34s ease-in-out infinite alternate;}
        .aurora-c{width:55vmax;height:55vmax;left:20vmax;bottom:-20vmax;background:radial-gradient(circle at 50% 50%, #E6F0EB, transparent 60%);animation:drift3 40s ease-in-out infinite alternate;}
        .aurora-d{width:35vmax;height:35vmax;right:10vmax;bottom:-10vmax;background:radial-gradient(circle at 50% 50%, rgba(14,92,70,.18), transparent 60%);animation:drift4 32s ease-in-out infinite alternate;}
        @keyframes drift1{from{transform:translate(0,0) rotate(0deg)}to{transform:translate(4vmax,3vmax) rotate(20deg)}}
        @keyframes drift2{from{transform:translate(0,0)}to{transform:translate(-3vmax,4vmax)}}
        @keyframes drift3{from{transform:translate(0,0) scale(1)}to{transform:translate(-2vmax,-3vmax) scale(1.08)}}
        @keyframes drift4{from{transform:translate(0,0)}to{transform:translate(3vmax,-2vmax)}}
        @media (prefers-reduced-motion: reduce){.aurora-blob{animation:none!important}}
      `}</style>
    </div>
  );
}

/**
 * OpportunityNetwork — sparse evergreen nodes with soft links slowly forming
 * and dissolving. Represents matching + referrals. Calm, on-theme.
 */
export function OpportunityNetwork({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0, running = true;

    type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number };
    let nodes: Node[] = [];
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      const count = Math.max(18, Math.floor((w * h) / 36000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 1.4 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) tick(); });
    io.observe(canvas);

    let t = 0;
    const tick = () => {
      if (!running) return;
      t += 0.004;
      const { clientWidth: w, clientHeight: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      // links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 180) {
            const wobble = (Math.sin(t * 1.5 + (i + j) * 0.4) + 1) / 2;
            const op = (1 - d / 180) * 0.22 * wobble;
            if (op < 0.02) continue;
            ctx.strokeStyle = `rgba(14,92,70,${op})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // nodes
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -10) n.x = w + 10; if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; if (n.y > h + 10) n.y = -10;
        const pulse = 0.55 + 0.45 * Math.sin(t * 2 + n.phase);
        ctx.fillStyle = `rgba(14,92,70,${0.35 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(14,92,70,${0.08 * pulse})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); io.disconnect(); };
  }, []);
  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />;
}

export function LiveBackground({ withNetwork = true, className = "" }: { withNetwork?: boolean; className?: string }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden>
      <AuroraMesh />
      {withNetwork && <OpportunityNetwork />}
      <div className="grain absolute inset-0" />
    </div>
  );
}

export function CalmBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(1200px 600px at 80% -10%, rgba(207,227,214,.45), transparent 60%), radial-gradient(900px 500px at -10% 10%, rgba(230,240,235,.6), transparent 60%), var(--color-background)"
      }} />
      <div className="grain absolute inset-0 opacity-60" />
    </div>
  );
}
