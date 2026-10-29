import { useMemo, useState, type CSSProperties } from 'react';
import { store, useData } from '../lib/storage';
import { evaluateSleep, fmtHours, hoursOf, sleepTips, sleepWeek } from '../lib/sleep';
import { addDays, dayKey, fmtDayMonth, fmtTime, startOfDay, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../lib/date';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { QUALITY, QUALITY_LABEL, SleepEditor } from './SleepEditor';
import type { SleepEntry } from '../lib/types';

const MAX_H = 12;

interface Props {
  onClose: () => void;
  /** Noite recém-registrada para perguntar "como você acordou?". */
  rateId?: string;
}

export function SleepSheet({ onClose, rateId }: Props) {
  const data = useData();
  const goal = data.settings.sleepGoal;
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ entry?: SleepEntry } | null>(null);

  const refKey = addDays(startOfDay(new Date()), offset * 7).getTime();
  const w = useMemo(() => sleepWeek(data, new Date(refKey)), [data, refKey]);
  const tips = useMemo(() => sleepTips(data, w), [data, w]);
  const toRate = rateId ? data.sleep.find((s) => s.id === rateId) : undefined;
  const todayIdx = w.nights.findIndex((n) => dayKey(n.date) === dayKey(new Date()));
  const lastRecorded = [...w.nights].reverse().findIndex((n) => n.hours > 0);
  const selIdx = sel ?? (todayIdx >= 0 && w.nights[todayIdx].hours > 0 ? todayIdx : lastRecorded >= 0 ? 6 - lastRecorded : 0);
  const selNight = w.nights[selIdx];
  const history = [...data.sleep].sort((a, b) => b.end - a.end).slice(0, 10);

  return (
    <Sheet title="Sono" onClose={onClose}>
      {toRate && (
        <div className="glass sleep-rate">
          <strong>
            Bom dia! Você dormiu {fmtHours(hoursOf(toRate))}. {evaluateSleep(hoursOf(toRate), goal).emoji}
          </strong>
          <p className="muted small">Como você acordou?</p>
          <div className="quality-row">
            {QUALITY.map((q, i) => (
              <button key={q} className={`quality ${toRate.quality === i + 1 ? 'on' : ''}`} onClick={() => store.updateSleep(toRate.id, { quality: i + 1 })} aria-label={QUALITY_LABEL[i]}>
                <span>{q}</span>
                <span className="tiny">{QUALITY_LABEL[i]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sleep-week-head">
        <div>
          <strong>{offset === 0 ? 'Esta semana' : offset === -1 ? 'Semana passada' : `${fmtDayMonth(w.nights[0].date)} – ${fmtDayMonth(w.nights[6].date)}`}</strong>
          <p className="tiny muted">cada noite conta no dia em que você acordou</p>
        </div>
        <div className="row">
          <button className="icon-btn glass" onClick={() => { setOffset(offset - 1); setSel(null); }} aria-label="Semana anterior">
            <Icon name="left" size={18} />
          </button>
          <button className="icon-btn glass" disabled={offset >= 0} onClick={() => { setOffset(offset + 1); setSel(null); }} aria-label="Próxima semana">
            <Icon name="right" size={18} />
          </button>
        </div>
      </div>

      <div className="sleep-stats">
        <div className="stat glass">
          <span className="tiny muted">Média</span>
          <strong>{w.recorded ? fmtHours(w.avg) : '—'}</strong>
        </div>
        <div className="stat glass">
          <span className="tiny muted">No ideal (7–9h)</span>
          <strong>
            {w.goodNights}/{w.recorded}
          </strong>
        </div>
        <div className="stat glass">
          <span className="tiny muted">Faltou p/ meta</span>
          <strong>{w.recorded ? fmtHours(w.debt) : '—'}</strong>
        </div>
      </div>

      <section className="glass chart-card">
        <div className="chart-head">
          <strong>Horas dormidas</strong>
          {selNight && (
            <span className="small muted">
              {WEEKDAYS_LONG[selNight.date.getDay()]}:{' '}
              <strong className="text">{selNight.hours ? `${fmtHours(selNight.hours)} · ${evaluateSleep(selNight.hours, goal).label}` : 'sem registro'}</strong>
            </span>
          )}
        </div>
        <div className="bars sleep-bars" role="img" aria-label="Horas de sono por noite">
          <div className="ideal-band" style={{ bottom: `${(7 / MAX_H) * 100}%`, height: `${(2 / MAX_H) * 100}%` }}>
            <span className="tiny">ideal 7–9h</span>
          </div>
          {[12, 8, 4, 0].map((v) => (
            <div key={v} className="gridline" style={{ bottom: `${(v / MAX_H) * 100}%` }}>
              <span className="tiny muted">{v}h</span>
            </div>
          ))}
          <div className="goal-line" style={{ bottom: `${(goal / MAX_H) * 100}%` }}>
            <span className="tiny">meta {fmtHours(goal)}</span>
          </div>
          {w.nights.map((n, i) => {
            const tone = n.hours ? evaluateSleep(n.hours, goal).tone : 'ok';
            return (
              <button key={i} className={`bar-col ${i === selIdx ? 'on' : ''}`} onClick={() => setSel(i)} aria-label={`${WEEKDAYS_LONG[n.date.getDay()]}: ${n.hours ? fmtHours(n.hours) : 'sem registro'}`}>
                {n.hours > 0 && <span className={`bar sleep-bar tone-bar-${tone}`} style={{ '--h': Math.min(n.hours, MAX_H) / MAX_H } as CSSProperties} />}
              </button>
            );
          })}
        </div>
        <div className="bar-labels">
          {w.nights.map((n, i) => (
            <span key={i} className={`tiny ${i === selIdx ? 'text' : 'muted'}`}>
              {WEEKDAYS_SHORT[n.date.getDay()]}
            </span>
          ))}
        </div>
        <div className="legend-row tiny muted">
          <span><i className="dot tone-bar-good" /> bom</span>
          <span><i className="dot tone-bar-warn" /> atenção</span>
          <span><i className="dot tone-bar-bad" /> pouco</span>
        </div>
      </section>

      {(w.avgBedtime || w.avgWake) && (
        <p className="small muted center">
          Em média você dormiu às <strong className="text">{w.avgBedtime}</strong> e acordou às <strong className="text">{w.avgWake}</strong>.
        </p>
      )}

      <section className="glass list-card">
        <strong>
          <Icon name="sparkles" size={16} /> Como melhorar o sono
        </strong>
        {tips.map((t, i) => (
          <p key={i} className="tip">
            {t}
          </p>
        ))}
      </section>

      <button className="btn block" onClick={() => setEditing({})}>
        <Icon name="plus" size={18} /> Esqueci de marcar: lançar uma noite
      </button>

      {history.length > 0 && (
        <section className="glass list-card">
          <strong>Últimas noites</strong>
          <span className="tiny muted">Toque numa noite para ajustar os horários ou apagar.</span>
          {history.map((e) => {
            const h = hoursOf(e);
            const v = evaluateSleep(h, goal);
            return (
              <button key={e.id} className="sleep-row" onClick={() => setEditing({ entry: e })}>
                <div className="sleep-row-main">
                  <span className="small">
                    {WEEKDAYS_SHORT[new Date(e.end).getDay()]} {fmtDayMonth(new Date(e.end))} · {fmtTime(e.start)} → {fmtTime(e.end)}
                  </span>
                  <span className="tiny muted">
                    {fmtHours(h)} · {v.label}
                    {e.quality ? ` · acordou ${QUALITY[e.quality - 1]}` : ''}
                  </span>
                </div>
                <span className={`badge small-badge tone-${v.tone}`}>{v.emoji}</span>
                <Icon name="edit" size={16} />
              </button>
            );
          })}
        </section>
      )}
      {editing && <SleepEditor entry={editing.entry} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}
