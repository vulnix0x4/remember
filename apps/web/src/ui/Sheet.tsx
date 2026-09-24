import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Portal + focus trap + inert background shared by every sheet, dialog, and full-screen layer. */
export function ModalBackdrop({ children, onClose, className = "sheet-backdrop", closeOnEscape = true, closeOnBackdrop = true }: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const escapeCloses = useRef(closeOnEscape); escapeCloses.current = closeOnEscape;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Hide the app and any layer already open underneath (a sheet can open over lock-in mode).
    const background = [...document.querySelectorAll<HTMLElement>(".app-shell > *, [data-modal-layer]")].filter((element) => element !== backdrop.current).map((element) => ({
      element,
      inert: element.hasAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    background.forEach(({ element }) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...(backdrop.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])];
    const isTopLayer = () => { const layers = document.querySelectorAll("[data-modal-layer]"); return layers[layers.length - 1] === backdrop.current; };
    const frame = window.requestAnimationFrame(() => (backdrop.current?.querySelector<HTMLElement>("[data-auto-focus]") ?? focusable()[0])?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isTopLayer()) return;
      if (event.key === "Escape") { if (escapeCloses.current) { event.preventDefault(); close.current(); } return; }
      if (event.key !== "Tab") return;
      const controls = focusable(); if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach(({ element, inert, ariaHidden }) => {
        if (!inert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<div ref={backdrop} className={className} data-modal-layer="" role="presentation" onMouseDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) close.current(); }}>{children}</div>, document.body);
}

/**
 * A bottom sheet on phones and a centered panel on wide screens.
 * Pass `onSubmit` to render the body as a form.
 */
export function Sheet({ title, onClose, children, className, onSubmit, hideTitle = false, role = "dialog", describedBy, closeLabel = "Close", closeDisabled = false }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  onSubmit?: (event: FormEvent) => void;
  hideTitle?: boolean;
  role?: "dialog" | "alertdialog";
  describedBy?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const content = <>
    <span className="sheet-grabber" aria-hidden="true" />
    <div className="sheet-head">
      <h2 id={titleId} className={hideTitle ? "sr-only" : undefined}>{title}</h2>
      <button className="icon-button sheet-close" type="button" aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}><X size={20} /></button>
    </div>
    {children}
  </>;
  const classes = `sheet${className ? ` ${className}` : ""}`;
  return <ModalBackdrop onClose={onClose}>
    {onSubmit
      ? <form className={classes} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy} onSubmit={onSubmit}>{content}</form>
      : <section className={classes} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy}>{content}</section>}
  </ModalBackdrop>;
}
