import { useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowUp, CalendarBlank, Flag, Microphone, Repeat, Timer, Warning } from "@phosphor-icons/react";
import type { QuickChipKind } from "../services/quickTask";

export interface AddBarChip { kind: QuickChipKind; label: string }

const chipIcons: Record<QuickChipKind, typeof Timer> = { duration: Timer, when: CalendarBlank, due: CalendarBlank, repeat: Repeat, priority: Flag };

interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor });
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export interface AddBarProps {
  /** Accessible name of the text field. */
  label: string;
  placeholder: string;
  /** Return `false` (or throw) to keep the text in the field. */
  onSubmit: (text: string) => Promise<boolean | void> | boolean | void;
  value?: string;
  onValueChange?: (value: string) => void;
  chips?: (text: string) => AddBarChip[];
  sendLabel?: string;
  busy?: boolean;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "placeholder">;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Extra line shown above the bar, e.g. a validation message. */
  notice?: ReactNode;
}

/** The one big white add bar, pinned above the tab bar on every screen. */
export function AddBar({ label, placeholder, onSubmit, value, onValueChange, chips, sendLabel = "Add", busy = false, inputProps, inputRef, notice }: AddBarProps) {
  const [internal, setInternal] = useState("");
  const text = value ?? internal;
  const setText = (next: string) => { if (value === undefined) setInternal(next); onValueChange?.(next); };
  const ownRef = useRef<HTMLInputElement>(null);
  const field = inputRef ?? ownRef;
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [canDictate] = useState(() => Boolean(speechRecognition()));
  const inputId = useId();
  const recognized = chips && text.trim() ? chips(text) : [];
  useEffect(() => () => recognition.current?.stop(), []);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const clean = text.trim();
    if (!clean || submitting || busy) { if (!clean) field.current?.focus(); return; }
    setSubmitting(true);
    try {
      const kept = await onSubmit(clean);
      if (kept !== false) setText("");
    } catch { /* The caller reports the failure; keep the words. */ }
    finally { setSubmitting(false); field.current?.focus(); }
  };

  const dictate = () => {
    const Recognition = speechRecognition();
    if (!Recognition) return;
    if (listening) { recognition.current?.stop(); return; }
    const session = new Recognition();
    session.lang = navigator.language || "en-US"; session.interimResults = false; session.continuous = false;
    session.onresult = (event) => {
      const heard = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (heard) setText(text ? `${text.trim()} ${heard}` : heard);
    };
    session.onend = () => { setListening(false); field.current?.focus(); };
    session.onerror = () => setListening(false);
    recognition.current = session;
    setListening(true);
    session.start();
  };

  return <div className="add-dock">
    <div className="toast-slot" />
    {notice && <div className="add-notice"><Warning size={15} /> {notice}</div>}
    {recognized.length > 0 && <ul className="parse-chips" aria-label="Understood">
      {recognized.map((chip) => { const Icon = chipIcons[chip.kind]; return <li key={`${chip.kind}-${chip.label}`}><Icon size={13} weight="bold" aria-hidden="true" />{chip.label}</li>; })}
    </ul>}
    <form className="add-bar" onSubmit={(event) => void submit(event)} noValidate>
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <input
        {...inputProps}
        ref={field}
        id={inputId}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="send"
        onChange={(event) => setText(event.target.value)}
      />
      {text.trim()
        ? <button className="add-send" type="submit" aria-label={sendLabel} disabled={submitting || busy}><ArrowUp size={21} weight="bold" /></button>
        : canDictate && <button className={`add-mic${listening ? " listening" : ""}`} type="button" aria-label={listening ? "Stop dictation" : "Dictate"} aria-pressed={listening} onClick={dictate}><Microphone size={21} weight={listening ? "fill" : "regular"} /></button>}
    </form>
  </div>;
}

/** Button-style add bar for places where adding means picking something (Files). */
export function AddBarButton({ label, icon, onClick, disabled }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <div className="add-dock"><div className="toast-slot" /><button className="add-bar add-bar-button" type="button" disabled={disabled} onClick={onClick}><span>{label}</span><span className="add-send" aria-hidden="true">{icon}</span></button></div>;
}
