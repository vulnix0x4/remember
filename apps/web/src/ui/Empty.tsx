import type { Icon } from "@phosphor-icons/react";

/** Calm empty state: icon, one line, and at most one Secondary button. */
export function Empty({ icon: IconComponent, title, detail, action, onAction }: { icon: Icon; title: string; detail?: string; action?: string; onAction?: () => void }) {
  return <div className="empty">
    <span className="empty-mark" aria-hidden="true"><IconComponent size={26} /></span>
    <p className="empty-title">{title}</p>
    {detail && <p className="empty-detail">{detail}</p>}
    {action && onAction && <button className="btn secondary" type="button" onClick={onAction}>{action}</button>}
  </div>;
}
