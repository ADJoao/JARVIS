import { useMemo, useState, type CSSProperties } from 'react';
import { useData } from '../lib/storage';
import { dayStats, indexLogs, logsOn } from '../lib/stats';
import { addDays, fmtLongDate, MONTHS, sameDay, startOfDay } from '../lib/date';
import { Icon } from '../components/Icon';
import { ActivityCard } from '../components/ActivityCard';
import type { Activity } from '../lib/types';

export function CalendarScreen({ onEdit }: { onEdit: (a?: Activity) => void }) {
  const data = useData();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const idx = useMemo(() => indexLogs(data.logs), [data.logs]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // semana começa na segunda
    const start = addDays(first, -offset);
    const today = startOfDay(new Date()).getTime();
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(start, i);
      const s = dayStats(data, d, idx);
      return { d, s, inMonth: d.getMonth() === month.getMonth(), future: d.getTime() > today };
    });
  }, [month, data, idx]);

  const day = useMemo(() => dayStats(data, selected, idx), [data, selected, idx]);
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className="screen">
      <header className="top">
        <h1>Agenda</h1>
      </header>

      <section className="glass calendar">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior">
            <Icon name="left" />
          </button>
          <strong className="cap">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </strong>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês">
            <Icon name="right" />
          </button>
        </div>
        <div className="cal-grid">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((w, i) => (
            <span key={i} className="cal-wd tiny muted">
              {w}
            </span>
          ))}
          {cells.map(({ d, s, inMonth, future }) => {
            const on = sameDay(d, selected);
            const today = sameDay(d, new Date());
            const level = !future && s.planned ? s.score : 0;
            return (
              <button
                key={d.toISOString()}
                className={`cal-cell ${inMonth ? '' : 'out'} ${on ? 'on' : ''} ${today ? 'today' : ''}`}
                style={{ '--lvl': level } as CSSProperties}
                onClick={() => setSelected(startOfDay(d))}
                aria-label={`${d.getDate()}: ${s.completed} de ${s.planned}`}
              >
                <span>{d.getDate()}</span>
                {s.planned > 0 && (
                  <span className="cal-dots">
                    {future ? '•'.repeat(Math.min(s.planned, 3)) : `${s.completed}/${s.planned}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="cal-legend tiny muted">
          <span>0%</span>
          <span className="legend-bar" />
          <span>100% concluído</span>
        </div>
      </section>

      <h3 className="section-title cap">{fmtLongDate(selected)}</h3>
      {day.items.length === 0 ? (
        <div className="empty glass">
          <p className="muted">Nada agendado nesse dia.</p>
        </div>
      ) : (
        <div className="stack">
          {day.items.map((it) => (
            <ActivityCard key={it.activity.id} item={it} date={selected} logs={logsOn(idx, it.activity.id, selected)} onEdit={() => onEdit(it.activity)} />
          ))}
        </div>
      )}
    </div>
  );
}
