import { useState } from 'react';
import { store, useData } from '../lib/storage';
import { lastLog } from '../lib/stats';
import { dayKey, fmtDayMonth, fmtDuration, fmtTime, fromKey, WEEKDAYS_SHORT } from '../lib/date';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { askConfirm } from './Dialog';

const pad = (n: number) => String(n).padStart(2, '0');

/** Painel de registros de uma atividade: registrar agora, em outro horário, e apagar registros. */
export function LogSheet({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const data = useData();
  const a = data.activities.find((x) => x.id === activityId);
  const now = new Date();
  const [date, setDate] = useState(dayKey(now));
  const [time, setTime] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  const [msg, setMsg] = useState('');
  if (!a) return null;

  const last = lastLog(data, a.id);
  const logs = data.logs.filter((l) => l.activityId === a.id).sort((x, y) => y.at - x.at).slice(0, 12);

  const addAt = () => {
    const d = fromKey(date);
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    if (d.getTime() > Date.now() + 60_000) return setMsg('Esse horário ainda não chegou.');
    store.addLog(a.id, d.getTime());
    setMsg(`Registrado: ${WEEKDAYS_SHORT[d.getDay()]} ${fmtDayMonth(d)} às ${fmtTime(d.getTime())} ✓`);
  };

  /** Atalhos: hoje/ontem/anteontem mantendo o horário escolhido. */
  const shiftDay = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setDate(dayKey(d));
  };

  return (
    <Sheet title={`${a.emoji} ${a.name}`} onClose={onClose}>
      <div className="glass log-summary">
        {last ? (
          <>
            <span className="muted small">Última vez</span>
            <strong className="log-big">há {fmtDuration(Date.now() - last.at)}</strong>
            <span className="muted small">
              {WEEKDAYS_SHORT[new Date(last.at).getDay()]} {fmtDayMonth(new Date(last.at))} às {fmtTime(last.at)}
            </span>
          </>
        ) : (
          <>
            <strong>Nenhum registro ainda</strong>
            <span className="muted small">Registre abaixo quando foi a última vez, mesmo que tenha sido há dias.</span>
          </>
        )}
      </div>

      <button
        className="btn primary block"
        onClick={() => {
          store.addLog(a.id);
          navigator.vibrate?.(15);
          setMsg(`Registrado agora (${fmtTime(Date.now())}) ✓`);
        }}
      >
        <Icon name="plus" size={18} /> Registrar agora
      </button>

      <section className="glass list-card">
        <strong>Registrar em outro horário</strong>
        <div className="chips wrap">
          {[
            ['Hoje', 0],
            ['Ontem', 1],
            ['Anteontem', 2],
            ['Há 3 dias', 3],
          ].map(([label, n]) => (
            <button key={label} className={`chip ${date === dayKey(new Date(Date.now() - (n as number) * 86400_000)) ? 'on' : ''}`} onClick={() => shiftDay(n as number)}>
              {label}
            </button>
          ))}
        </div>
        <div className="row-2">
          <div>
            <label className="field-label" htmlFor="log-date">
              Dia
            </label>
            <input id="log-date" type="date" className="input" value={date} max={dayKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="log-time">
              Hora
            </label>
            <input id="log-time" type="time" className="input" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
          </div>
        </div>
        <button className="btn block" onClick={addAt}>
          <Icon name="check" size={18} /> Registrar nesse horário
        </button>
      </section>

      {msg && <p className="flash">{msg}</p>}

      {logs.length > 0 && (
        <section className="glass list-card">
          <strong>Últimos registros</strong>
          {logs.map((l) => (
            <div key={l.id} className="sleep-row">
              <span className="sleep-row-main small">
                {WEEKDAYS_SHORT[new Date(l.at).getDay()]} {fmtDayMonth(new Date(l.at))} às {fmtTime(l.at)}
                <span className="tiny muted"> · há {fmtDuration(Date.now() - l.at)}</span>
              </span>
              <button
                className="icon-btn"
                aria-label="Apagar registro"
                onClick={async () => (await askConfirm('Apagar esse registro?', { confirmLabel: 'Apagar', danger: true })) && store.removeLog(l.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </section>
      )}
    </Sheet>
  );
}
