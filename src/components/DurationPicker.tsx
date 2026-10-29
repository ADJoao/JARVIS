import { useState } from 'react';
import type { Activity } from '../lib/types';
import { store, useData } from '../lib/storage';
import { activityDayXp } from '../lib/game';
import { fmtMinutes } from '../lib/date';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

const QUICK = [15, 30, 45, 60, 90, 120, 150, 180, 240];

/** "Quanto tempo você fez?" para atividades com meta em tempo (ex.: estudar 2h). */
export function DurationPicker({ activity: a, doneToday, at, onClose }: { activity: Activity; doneToday: number; at: number; onClose: () => void }) {
  const g = useData().game;
  const [min, setMin] = useState(0);
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const custom = (Number(h) || 0) * 60 + (Number(m) || 0);
  const chosen = custom > 0 ? custom : min;
  const total = doneToday + chosen;
  const gain = activityDayXp(g, a, total) - activityDayXp(g, a, doneToday);

  return (
    <Sheet title={`Quanto tempo de ${a.name.toLowerCase()}?`} onClose={onClose}>
      <p className="small muted">
        Meta do dia: <strong className="text">{fmtMinutes(a.goal)}</strong>
        {doneToday > 0 && ` · já feito hoje: ${fmtMinutes(doneToday)}`}
      </p>
      <div className="chips wrap">
        {QUICK.map((q) => (
          <button
            key={q}
            className={`chip ${min === q && !custom ? 'on' : ''}`}
            onClick={() => {
              setMin(q);
              setH('');
              setM('');
            }}
          >
            {fmtMinutes(q)}
          </button>
        ))}
      </div>
      <label className="field-label">Ou digite</label>
      <div className="row-2">
        <label className="money-input small">
          <input inputMode="numeric" placeholder="0" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, '').slice(0, 2))} aria-label="Horas" />
          <span>h</span>
        </label>
        <label className="money-input small">
          <input inputMode="numeric" placeholder="0" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-label="Minutos" />
          <span>min</span>
        </label>
      </div>
      {chosen > 0 && (
        <div className="glass note-progress">
          <strong>
            Total hoje: {fmtMinutes(total)} de {fmtMinutes(a.goal)} ({Math.round((total / a.goal) * 100)}%)
          </strong>
          <div className="goal-meter">
            <span style={{ width: `${Math.min(total / a.goal, 1) * 100}%` }} />
          </div>
          <span className="small xp-text">
            +{gain} XP{total > a.goal ? ` · passou da meta, bônus incluído! 🔥` : ''}
          </span>
        </div>
      )}
      <button
        className="btn primary block"
        disabled={chosen <= 0}
        onClick={() => {
          store.addLog(a.id, at, chosen);
          navigator.vibrate?.(15);
          onClose();
        }}
      >
        <Icon name="check" size={18} /> Registrar {chosen > 0 ? fmtMinutes(chosen) : ''}
      </button>
    </Sheet>
  );
}
