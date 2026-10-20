import type { CSSProperties } from 'react';
import type { DayItem } from '../lib/stats';
import { store } from '../lib/storage';
import { fmtTime, sameDay } from '../lib/date';
import type { LogEntry } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  item: DayItem;
  date: Date;
  logs: LogEntry[];
  onEdit?: () => void;
}

/** Horário do registro: agora (se for hoje) ou o mesmo horário no dia escolhido. */
export function logTimeFor(date: Date): number {
  const now = new Date();
  if (sameDay(date, now)) return now.getTime();
  const d = new Date(date);
  d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return d.getTime();
}

export function ActivityCard({ item, date, logs, onEdit }: Props) {
  const { activity: a, count, goal, complete } = item;
  const pct = Math.min(count / goal, 1);
  const last = logs.length ? logs.reduce((m, l) => (l.at > m.at ? l : m)) : undefined;

  const add = () => {
    store.addLog(a.id, logTimeFor(date));
    navigator.vibrate?.(15);
  };
  const undo = () => last && store.removeLog(last.id);

  const single = goal === 1;
  return (
    <div className={`act-card glass ${complete ? 'done' : ''}`} style={{ '--c': a.color, '--p': pct } as CSSProperties}>
      <div className="act-progress" />
      <button className="act-emoji" onClick={onEdit} aria-label={`Editar ${a.name}`}>
        {a.emoji}
      </button>
      <div className="act-info" onClick={onEdit}>
        <div className="act-name">{a.name}</div>
        <div className="act-meta">
          {a.time && (
            <span>
              <Icon name="clock" size={12} /> {a.time}
            </span>
          )}
          {!single && (
            <span>
              {count}/{goal} {a.unit ?? ''}
            </span>
          )}
          {!item.scheduled && <span>livre</span>}
          {last && <span>último {fmtTime(last.at)}</span>}
        </div>
      </div>
      <div className="act-actions">
        {!single && count > 0 && (
          <button className="round-btn subtle" onClick={undo} aria-label="Desfazer">
            <Icon name="minus" size={18} />
          </button>
        )}
        {single && complete ? (
          <button className="round-btn checked" onClick={undo} aria-label="Desmarcar">
            <Icon name="check" size={20} stroke={3} />
          </button>
        ) : (
          <button className={`round-btn ${complete ? 'checked' : ''}`} onClick={add} aria-label={single ? 'Concluir' : 'Adicionar'}>
            <Icon name={single ? 'check' : 'plus'} size={20} stroke={single ? 3 : 2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
