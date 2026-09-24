import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const LOCK_IN_KEY = "remember-lock-in-v1";

export interface LockInApi {
  /** The task shown in lock-in mode, if it's open. */
  taskId: string | null;
  open: (taskId: string) => void;
  close: () => void;
}

const LockInContext = createContext<LockInApi>({ taskId: null, open: () => undefined, close: () => undefined });

export function useLockIn() { return useContext(LockInContext); }

function readOpenTask() {
  try { return sessionStorage.getItem(LOCK_IN_KEY); } catch { return null; }
}

/** Remembers which task is in lock-in mode, so a reload lands back in it. */
export function LockInProvider({ children }: { children: ReactNode }) {
  const [taskId, setTaskId] = useState<string | null>(readOpenTask);
  const open = useCallback((id: string) => {
    try { sessionStorage.setItem(LOCK_IN_KEY, id); } catch { /* Still opens for this view. */ }
    setTaskId(id);
  }, []);
  const close = useCallback(() => {
    try { sessionStorage.removeItem(LOCK_IN_KEY); } catch { /* Nothing stored. */ }
    setTaskId(null);
  }, []);
  const api = useMemo(() => ({ taskId, open, close }), [taskId, open, close]);
  return <LockInContext.Provider value={api}>{children}</LockInContext.Provider>;
}
