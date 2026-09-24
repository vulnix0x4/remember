import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ToastInput {
  message: string;
  tone?: "default" | "error";
  action?: { label: string; onAction: () => unknown };
  /** Milliseconds before the toast disappears. Defaults to 5 seconds. */
  duration?: number;
}

interface ActiveToast extends ToastInput { id: number }

interface ToastApi {
  show: (toast: ToastInput) => void;
  error: (message: string, action?: ToastInput["action"]) => void;
  dismiss: () => void;
}

const noop: ToastApi = { show: () => undefined, error: () => undefined, dismiss: () => undefined };
const ToastContext = createContext<ToastApi>(noop);

export function useToast() { return useContext(ToastContext); }

/** Short, cheap feedback for a tap. Silently does nothing where vibration is unavailable. */
export function haptic(pattern: number | number[] = 10) {
  try { navigator.vibrate?.(pattern); } catch { /* Not supported. */ }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const sequence = useRef(0);
  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((input: ToastInput) => { sequence.current += 1; setToast({ ...input, id: sequence.current }); }, []);
  const error = useCallback((message: string, action?: ToastInput["action"]) => show({ message, tone: "error", action }), [show]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), toast.duration ?? 5_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  const api = useMemo(() => ({ show, error, dismiss }), [show, error, dismiss]);
  // Toasts sit inside the bottom dock (above the add bar) so they share its solid background.
  // With no dock, or while a sheet is open over the page, they float above everything instead.
  const slot = toast && !document.querySelector("[data-modal-layer]") ? document.querySelector<HTMLElement>(".add-dock .toast-slot") : null;
  const view = toast && <ToastView key={toast.id} toast={toast} onDone={dismiss} />;
  return <ToastContext.Provider value={api}>
    {children}
    {createPortal(<div className={`toast-region${slot ? " docked" : ""}`} aria-live="polite" role="status">
      {toast?.tone !== "error" && view}
    </div>, slot ?? document.body)}
    {toast?.tone === "error" && createPortal(<div className={`toast-region${slot ? " docked" : ""}`}>{view}</div>, slot ?? document.body)}
  </ToastContext.Provider>;
}

function ToastView({ toast, onDone }: { toast: ActiveToast; onDone: () => void }) {
  return <div className={`toast${toast.tone === "error" ? " error" : ""}`} role={toast.tone === "error" ? "alert" : undefined}>
    <span>{toast.message}</span>
    {toast.action && <button type="button" onClick={() => { onDone(); void toast.action!.onAction(); }}>{toast.action.label}</button>}
  </div>;
}
