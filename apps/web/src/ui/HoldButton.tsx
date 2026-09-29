import { useEffect, useRef, useState } from "react";
import { haptic } from "./Toast";

/**
 * A quiet button that only fires after being pressed and held (mouse, touch, Space, or Enter).
 * Used for Leave focus so a stray tap can't pull someone out of lock-in mode.
 */
export function HoldButton({ label, holdMs = 3_000, onComplete, className = "btn quiet" }: { label: string; holdMs?: number; onComplete: () => void; className?: string }) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const timeout = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const complete = useRef(onComplete); complete.current = onComplete;

  const stop = () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    if (ticker.current !== null) window.clearInterval(ticker.current);
    timeout.current = null; ticker.current = null; startedAt.current = null;
  };
  const cancel = () => { if (startedAt.current === null) return; stop(); setProgress(0); };
  const begin = () => {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now(); haptic(6);
    ticker.current = window.setInterval(() => {
      if (startedAt.current !== null) setProgress(Math.min(1, (Date.now() - startedAt.current) / holdMs));
    }, 50);
    timeout.current = window.setTimeout(() => { stop(); setProgress(0); haptic([8, 30, 8]); complete.current(); }, holdMs);
  };
  useEffect(() => stop, []);

  const holding = progress > 0;
  return <button
    className={`hold-button ${className}${holding ? " holding" : ""}`}
    type="button"
    aria-label={`${label} (press and hold)`}
    style={{ ["--hold" as string]: progress }}
    onPointerDown={(event) => { if (!(event.button > 0)) begin(); }}
    onPointerUp={cancel}
    onPointerLeave={cancel}
    onPointerCancel={cancel}
    onContextMenu={(event) => event.preventDefault()}
    onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) begin(); } }}
    onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") cancel(); }}
    onBlur={cancel}
  >
    <span className="hold-fill" aria-hidden="true" />
    <span className="hold-label" aria-hidden="true">{holding ? "Keep holding…" : label}</span>
  </button>;
}
