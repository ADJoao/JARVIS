import { useState } from 'react';
import type { SleepEntry } from '../lib/types';
import { store, useData } from '../lib/storage';
import { evaluateSleep, fmtHours } from '../lib/sleep';
import { addDays, dayKey, fromKey } from '../lib/date';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { askConfirm } from './Dialog';

export const QUALITY = ['😫', '😕', '😐', '🙂', '🤩'];
export const QUALITY_LABEL = ['Péssimo', 'Ruim', 'Normal', 'Bem', 'Ótimo'];

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Props {
  /** Noite já registrada para corrigir. */
  entry?: SleepEntry;
  /** Sugestões iniciais (ex.: "vou dormir" marcado + agora). */
  start?: number;
  end?: number;
  /** Aviso no topo (ex.: "parece que você esqueceu de marcar"). */
  warning?: string;
  title?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

/** Lançar ou corrigir uma noite: dia em que acordou, hora que dormiu e hora que acordou. */
export function SleepEditor({ entry, start, end, warning, title, onClose, onSaved }: Props) {
  const data = useData();
  const bedtime = data.settings.bedtime || '23:00';
  const initEnd = entry?.end ?? end ?? (() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d.getTime() > Date.now() ? Date.now() : d.getTime();
  })();
  const [date, setDate] = useState(dayKey(initEnd));
  const [bed, setBed] = useState(entry ? hhmm(entry.start) : start ? hhmm(start) : bedtime);
  const [wake, setWake] = useState(hhmm(initEnd));
  const [quality, setQuality] = useState(entry?.quality ?? 0);
  const [error, setError] = useState('');

  // dormiu no dia anterior quando o horário de dormir é "depois" do de acordar (ex.: 23:30 → 07:00)
  const wakeTs = (() => {
    const d = fromKey(date);
    const [h, m] = wake.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  })();
  const bedTs = (() => {
    const d = fromKey(date);
    const [h, m] = bed.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    if (d.getTime() > wakeTs) return addDays(d, -1).getTime();
    return d.getTime();
  })();
  const hours = (wakeTs - bedTs) / 3600_000;
  const v = evaluateSleep(hours, data.settings.sleepGoal);
  const problem = store.sleepProblem(bedTs, wakeTs, entry?.id);

  const save = () => {
    if (problem) return setError(problem);
    if (entry) {
      store.replaceSleep(entry.id, bedTs, wakeTs, quality || undefined);
      onSaved?.(entry.id);
    } else {
      const e = store.addSleep(bedTs, wakeTs, quality || undefined);
      if (!e) return setError('Não foi possível salvar. Confira os horários.');
      onSaved?.(e.id);
    }
    onClose();
  };

  return (
    <Sheet title={title ?? (entry ? 'Ajustar noite' : 'Lançar noite de sono')} onClose={onClose}>
      {warning && <p className="warn-box small">{warning}</p>}
      <label className="field-label" htmlFor="sleep-date">
        Dia em que acordou
      </label>
      <div className="chips wrap">
        {[
          ['Hoje', 0],
          ['Ontem', 1],
          ['Anteontem', 2],
        ].map(([label, n]) => {
          const k = dayKey(addDays(new Date(), -(n as number)));
          return (
            <button key={label} className={`chip ${date === k ? 'on' : ''}`} onClick={() => setDate(k)}>
              {label}
            </button>
          );
        })}
      </div>
      <input id="sleep-date" type="date" className="input" value={date} max={dayKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
      <div className="row-2">
        <div>
          <label className="field-label" htmlFor="sleep-bed">
            🌙 Dormi às
          </label>
          <input id="sleep-bed" type="time" className="input" value={bed} onChange={(e) => e.target.value && setBed(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sleep-wake">
            ☀️ Acordei às
          </label>
          <input id="sleep-wake" type="time" className="input" value={wake} onChange={(e) => e.target.value && setWake(e.target.value)} />
        </div>
      </div>
      <div className={`glass sleep-preview ${problem ? 'bad' : ''}`}>
        {problem ? (
          <span className="small">⚠️ {problem}</span>
        ) : (
          <>
            <strong>
              {v.emoji} {fmtHours(hours)} de sono · {v.label}
            </strong>
            <span className="tiny muted">
              {new Date(bedTs).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} {bed} →{' '}
              {new Date(wakeTs).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} {wake}
            </span>
          </>
        )}
      </div>
      <label className="field-label">Como acordou (opcional)</label>
      <div className="quality-row">
        {QUALITY.map((q, i) => (
          <button key={q} className={`quality ${quality === i + 1 ? 'on' : ''}`} onClick={() => setQuality(quality === i + 1 ? 0 : i + 1)} aria-label={QUALITY_LABEL[i]}>
            <span>{q}</span>
            <span className="tiny">{QUALITY_LABEL[i]}</span>
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn primary block" onClick={save} disabled={Boolean(problem)}>
        <Icon name="check" size={18} /> Salvar
      </button>
      {entry && (
        <button
          className="btn danger block"
          onClick={async () => {
            if (await askConfirm('Apagar esse registro de sono?', { confirmLabel: 'Apagar', danger: true })) {
              store.removeSleep(entry.id);
              onClose();
            }
          }}
        >
          <Icon name="trash" size={18} /> Apagar noite
        </button>
      )}
    </Sheet>
  );
}
