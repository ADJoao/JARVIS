import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useData, store } from '../lib/storage';
import { dayStats, indexLogs, lastLog, logsOn, streak } from '../lib/stats';
import { addDays, fmtDuration, fmtLongDate, greeting, sameDay, startOfDay, startOfWeek, WEEKDAYS_SHORT } from '../lib/date';
import { Ring } from '../components/Ring';
import { Icon } from '../components/Icon';
import { ActivityCard } from '../components/ActivityCard';
import { SleepCard } from '../components/SleepCard';
import type { Activity } from '../lib/types';

interface Props {
  userName: string;
  onEdit: (a?: Activity) => void;
  onSettings: () => void;
  onSleep: (rateId?: string) => void;
  onLogs: (activityId: string) => void;
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Today({ userName, onEdit, onSettings, onSleep, onLogs }: Props) {
  const data = useData();
  const now = useNow();
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const idx = useMemo(() => indexLogs(data.logs), [data.logs]);
  const day = useMemo(() => dayStats(data, selected, idx), [data, selected, idx]);
  const week = useMemo(() => {
    const s = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => dayStats(data, addDays(s, i), idx));
  }, [data, idx]);
  const fire = useMemo(() => streak(data, idx), [data, idx]);

  const trackers = data.activities.filter((a) => !a.archivedAt && (a.alertHours || a.schedule.kind === 'free'));
  const isToday = sameDay(selected, new Date());
  const first = userName.split(' ')[0];

  return (
    <div className="screen">
      <header className="top">
        <div>
          <p className="muted small cap">{fmtLongDate(selected)}</p>
          <h1>
            {greeting()}, <span className="grad-text">{first}</span>
          </h1>
        </div>
        <button className="avatar glass" onClick={onSettings} aria-label="Ajustes">
          {first.slice(0, 1).toUpperCase()}
        </button>
      </header>

      <section className="hero glass">
        <Ring value={day.score} size={128} stroke={12}>
          <strong className="ring-value">{Math.round(day.score * 100)}%</strong>
          <span className="muted tiny">{isToday ? 'hoje' : 'no dia'}</span>
        </Ring>
        <div className="hero-info">
          <p className="hero-big">
            {day.completed}
            <span className="muted"> / {day.planned}</span>
          </p>
          <p className="muted small">atividades concluídas</p>
          <div className="pill-row">
            <span className="pill">
              <Icon name="flame" size={14} /> {fire} {fire === 1 ? 'dia' : 'dias'} seguidos
            </span>
          </div>
        </div>
      </section>

      <div className="week-strip">
        {week.map((d) => {
          const on = sameDay(d.date, selected);
          const future = d.date.getTime() > Date.now();
          return (
            <button key={d.date.toISOString()} className={`week-day ${on ? 'on' : ''}`} onClick={() => setSelected(d.date)}>
              <span className="tiny muted">{WEEKDAYS_SHORT[d.date.getDay()]}</span>
              <Ring value={future ? 0 : d.score} size={36} stroke={4}>
                <span className="tiny">{d.date.getDate()}</span>
              </Ring>
            </button>
          );
        })}
      </div>

      {isToday && <SleepCard now={now} onOpen={onSleep} />}

      {trackers.length > 0 && isToday && (
        <>
          <h3 className="section-title">Tempo desde o último</h3>
          <div className="tracker-row scroll-x">
            {trackers.map((a) => {
              const last = lastLog(data, a.id);
              const ms = last ? now - last.at : 0;
              const over = Boolean(a.alertHours && last && ms > a.alertHours * 3600_000);
              const ratio = a.alertHours && last ? Math.min(ms / (a.alertHours * 3600_000), 1) : 0;
              return (
                <div
                  key={a.id}
                  className={`tracker glass ${over ? 'over' : ''}`}
                  style={{ '--c': a.color, '--p': ratio } as CSSProperties}
                  role="button"
                  tabIndex={0}
                  onClick={() => onLogs(a.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onLogs(a.id)}
                >
                  <div className="tracker-top">
                    <span className="tracker-emoji">{a.emoji}</span>
                    <button
                      className="round-btn small"
                      onClick={(e) => {
                        e.stopPropagation();
                        store.addLog(a.id);
                        navigator.vibrate?.(15);
                      }}
                      aria-label={`Registrar ${a.name} agora`}
                    >
                      <Icon name="plus" size={16} stroke={2.5} />
                    </button>
                  </div>
                  <div className="tracker-time">{last ? fmtDuration(ms) : '—'}</div>
                  <div className="tiny muted">{last ? `sem ${a.name.toLowerCase()}` : 'toque e diga quando foi'}</div>
                  {a.alertHours && <div className="tracker-bar" />}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 className="section-title">{isToday ? 'Sua rotina de hoje' : `Rotina de ${fmtLongDate(selected)}`}</h3>
      {day.items.length === 0 ? (
        <div className="empty glass">
          <div className="empty-emoji">🌤️</div>
          <p>{data.activities.length ? 'Nada agendado para esse dia.' : 'Você ainda não tem atividades.'}</p>
          <button className="btn primary" onClick={() => onEdit()}>
            <Icon name="plus" size={18} /> Criar atividade
          </button>
        </div>
      ) : (
        <div className="stack">
          {day.items.map((it) => (
            <ActivityCard key={it.activity.id} item={it} date={selected} logs={logsOn(idx, it.activity.id, selected)} onEdit={() => onEdit(it.activity)} />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => onEdit()} aria-label="Nova atividade">
        <Icon name="plus" size={28} stroke={2.5} />
      </button>
    </div>
  );
}
