import { useMemo, useState } from "react";
import { DeviceMobile, Moon } from "@phosphor-icons/react";
import { sleepDurationLabel, sleepTip, type SleepTip } from "@remember/domain";
import { apiConfig } from "../services/api";
import { Empty } from "../ui/Empty";
import { haptic, useToast } from "../ui/Toast";
import {
  clockLabel, clockOf, eveningLabel, hoursLabel, lastNightLine, lastNight, recentNights, sleepChart, sleepNights, sleepWeek, weekdayLabel,
  type SleepNight, type SleepWeek,
} from "./sleep";
import { useNow } from "./TaskViews";
import { SLEEP_OFFLINE_MESSAGE, useSleepSettings, type SleepLife } from "./useSleepSettings";
import type { LifeOSController } from "./useLifeOS";

type SleepPageLife = SleepLife & Pick<LifeOSController, "snapshot">;

/** Life → Sleep: tonight, the last seven nights, and one tip. Going to bed and I'm up happen on the iPhone. */
export function SleepPage({ life, onOpenSettings }: { life: SleepPageLife; onOpenSettings: () => void }) {
  const now = useNow();
  const toast = useToast();
  const { sleep, save } = useSleepSettings(life);
  const [turningOn, setTurningOn] = useState(false);
  const nights = useMemo(() => sleepNights(life.snapshot.health), [life.snapshot.health]);

  if (!life.brain && apiConfig.baseUrl && !life.brainError) {
    return <div className="screen-body sleep-page"><section className="now-card now-loading" aria-label="Sleep" aria-busy="true"><span className="skeleton wide" /><span className="skeleton" /></section></div>;
  }

  // While it saves, this stays the Off screen, so Settings opens with phone-free nights already on.
  if (!sleep.enabled || turningOn) {
    const turnOn = async () => {
      if (turningOn) return;
      if (!life.brain) { toast.error(life.brainError || SLEEP_OFFLINE_MESSAGE); return; }
      haptic(); setTurningOn(true);
      const saved = await save({ ...sleep, enabled: true }, { optimistic: false });
      setTurningOn(false);
      if (saved) onOpenSettings();
    };
    return <div className="screen-body sleep-page">
      <Empty icon={Moon} title="Phone-free nights" detail="Tap Going to bed when you’re done for the night. Your phone stays quiet until you’re up." action={turningOn ? "Turning on…" : "Turn on"} onAction={() => void turnOn()} />
    </div>;
  }

  const week = recentNights(nights, now);
  const numbers = sleepWeek(week);
  const last = lastNight(nights, now);
  return <div className="screen-body sleep-page">
    <section className="now-card sleep-tonight" aria-labelledby="sleep-tonight-title">
      <span className="now-label">Tonight</span>
      <h2 id="sleep-tonight-title" className="now-title">Done for the night?</h2>
      <p className="now-sub">Tap when you start winding down. Your phone stays quiet until you’re up.</p>
      <p className="sleep-hint"><DeviceMobile size={18} aria-hidden="true" />Tap Going to bed on your iPhone.</p>
      {last && <p className="sleep-last">{lastNightLine(last)}</p>}
    </section>
    <LastNights nights={week} numbers={numbers} />
    <TipCard tip={sleepTip(numbers)} />
    <button className="btn secondary" type="button" onClick={onOpenSettings}>Sleep settings</button>
    <p className="sleep-footer">Trouble sleeping most nights for weeks? Bring it up with a doctor.</p>
  </div>;
}

/** What a screen reader hears for one night: "Monday, 11:40 PM to 7:30 AM, 7 hr 50 min". */
function nightSummary(night: SleepNight) {
  return `${weekdayLabel(night.key, true)}, ${clockLabel(clockOf(night.asleepAt))} to ${clockLabel(clockOf(night.wokeAt))}, ${sleepDurationLabel(night.hours * 60)}`;
}

/** Keeps an axis label inside the chart near its edges. */
function edge(percent: number) { return percent < 12 ? "start" : percent > 88 ? "end" : undefined; }

function LastNights({ nights, numbers }: { nights: SleepNight[]; numbers: SleepWeek }) {
  if (!nights.length) {
    return <section className="today-section" aria-labelledby="sleep-nights-title">
      <h2 id="sleep-nights-title" className="section-label">Last 7 nights</h2>
      <p className="sleep-empty">No nights yet. Tap Going to bed tonight and I’m up tomorrow.</p>
    </section>;
  }
  const chart = sleepChart(nights, { bed: numbers.usualBedtime, wake: numbers.usualWake });
  const { bed, wake } = chart.lines;
  const labels = bed !== null && wake !== null
    ? [{ at: bed, text: eveningLabel(numbers.usualBedtime!) }, { at: wake, text: eveningLabel(numbers.usualWake!) }]
    : [{ at: 0, text: clockLabel(chart.from) }, { at: 100, text: clockLabel(chart.to) }];
  return <section className="today-section" aria-labelledby="sleep-nights-title">
    <h2 id="sleep-nights-title" className="section-label">Last 7 nights</h2>
    <div className="card sleep-week">
      <div className="sleep-chart">
        {bed !== null && wake !== null && <div className="sleep-guides" aria-hidden="true"><i style={{ left: `${bed}%` }} /><i style={{ left: `${wake}%` }} /></div>}
        <ul className="sleep-rows">
          {nights.map((night) => {
            const bar = chart.bars.get(night.key);
            return <li key={night.key}>
              <span className="sleep-day" aria-hidden="true">{weekdayLabel(night.key)}</span>
              <span className="sleep-track" aria-hidden="true"><i className="sleep-bar" style={{ left: `${bar?.left ?? 0}%`, width: `${bar?.width ?? 0}%` }} /></span>
              <span className="sr-only">{nightSummary(night)}</span>
            </li>;
          })}
        </ul>
        <div className="sleep-axis" aria-hidden="true">
          {labels.map((label, index) => <span key={index} className={edge(label.at)} style={{ left: `${label.at}%` }}>{label.text}</span>)}
        </div>
      </div>
      <div className="stat-row">
        <div><strong>{numbers.averageHours === null ? "—" : hoursLabel(numbers.averageHours)}</strong><small>average</small></div>
        <div><strong>{numbers.usualBedtime === null ? "—" : eveningLabel(numbers.usualBedtime)}</strong><small>usual bedtime</small></div>
        <div><strong>{numbers.wakeRangeMinutes === null ? "—" : sleepDurationLabel(numbers.wakeRangeMinutes)}</strong><small>wake-up range</small></div>
      </div>
    </div>
  </section>;
}

function TipCard({ tip }: { tip: SleepTip }) {
  return <section className="card idea-card sleep-tip" aria-labelledby="sleep-tip-title">
    <h2 id="sleep-tip-title">{tip.title}</h2>
    <p>{tip.line}</p>
  </section>;
}
