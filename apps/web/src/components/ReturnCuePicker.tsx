import type { ReturnCue } from "../types";
import { returnAtToLocalDate, returnCueChoices } from "../product/returnCues";

export function ReturnCuePicker({ cue, date, onCue, onDate }: {
  cue?: ReturnCue;
  date: string;
  onCue: (cue?: ReturnCue) => void;
  onDate: (date: string) => void;
}) {
  return <div className="return-cue-picker">
    <div className="return-cue-heading"><strong>Bring this back…</strong><span>Optional. Give this idea a useful future moment.</span></div>
    <div className="return-cue-options" role="group" aria-label="When should Remember bring this back?">
      {returnCueChoices.map((choice) => <button className={cue === choice.value ? "active" : ""} type="button" key={choice.value} aria-pressed={cue === choice.value} onClick={() => onCue(cue === choice.value ? undefined : choice.value)}>{choice.label}</button>)}
    </div>
    {cue === "date" && <label className="return-date-field">Choose a day<input type="date" value={date} min={returnAtToLocalDate(new Date().toISOString())} onChange={(event) => onDate(event.target.value)} /></label>}
  </div>;
}
