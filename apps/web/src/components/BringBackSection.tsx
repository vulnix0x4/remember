import { useEffect, useState } from "react";
import { Check, ClockCounterClockwise, Warning } from "@phosphor-icons/react";
import type { Imprint, ReturnCue } from "../types";
import { updateReturnCue } from "../services/api";
import { scheduleReturnDay, returnAtToLocalDate, returnCueLabel } from "../product/returnCues";
import { ReturnCuePicker } from "./ReturnCuePicker";

export function BringBackSection({ imprint, onUpdate }: { imprint: Imprint; onUpdate: (imprint: Imprint) => void }) {
  const [cue, setCue] = useState<ReturnCue | undefined>(imprint.returnCue);
  const [date, setDate] = useState(returnAtToLocalDate(imprint.returnAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setCue(imprint.returnCue); setDate(returnAtToLocalDate(imprint.returnAt)); }, [imprint.id, imprint.returnAt, imprint.returnCue]);

  const persist = async (nextCue?: ReturnCue, nextDate = date) => {
    const returnAt = nextCue === "date" ? scheduleReturnDay(nextDate) : undefined;
    if (nextCue === "date" && !returnAt) { setError("Choose today or a future day."); return; }
    setSaving(true); setError(""); setSaved(false);
    try {
      const updated = await updateReturnCue(imprint, nextCue, returnAt);
      onUpdate(updated); setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This return cue could not be saved.");
    } finally { setSaving(false); }
  };

  const choose = (next?: ReturnCue) => {
    setCue(next); setSaved(false);
    if (next !== "date") void persist(next);
  };

  return <section className="bring-back-section">
    <div className="bring-back-intro"><span><ClockCounterClockwise size={22} /></span><div><h2>Bring this back when it can help</h2><p>Tell Remember the kind of moment this idea belongs in.</p></div></div>
    <ReturnCuePicker cue={cue} date={date} onCue={choose} onDate={(value) => { setDate(value); setSaved(false); }} />
    {cue === "date" && <button className="button primary" type="button" disabled={!date || saving} onClick={() => void persist("date")}>{saving ? "Saving…" : "Set return day"}</button>}
    {saved && <p className="return-cue-saved" role="status"><Check size={16} weight="bold" /> {cue ? `Ready for ${returnCueLabel(cue).toLowerCase()}.` : "Return cue removed."}</p>}
    {error && <p className="field-error" role="alert"><Warning size={15} /> {error}</p>}
  </section>;
}
