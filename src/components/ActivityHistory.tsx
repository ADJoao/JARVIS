import { useState, type CSSProperties } from 'react';
import { useData } from '../lib/storage';
import { isNative } from '../lib/notify';
import { addDays, dayKey, fmtDayMonth, fmtDuration, fmtTime, MONTHS, sameDay, startOfWeek, WEEKDAYS_SHORT } from '../lib/date';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

/** Mês de registros de uma atividade: calendário com a contagem por dia, resumo e texto para mostrar ao médico. */
export function ActivityHistory({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const data = useData();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [msg, setMsg] = useState('');
  const a = data.activities.find((x) => x.id === activityId);
  if (!a) return null;

  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const now = new Date();
  const isCurrent = month <= now && now < next;
  const all = data.logs.filter((l) => l.activityId === a.id).sort((x, y) => x.at - y.at);
  const logs = all.filter((l) => l.at >= month.getTime() && l.at < next.getTime());

  const byDay = new Map<string, number[]>();
  for (const l of logs) {
    const k = dayKey(l.at);
    byDay.set(k, [...(byDay.get(k) ?? []), l.at]);
  }
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const daysCounted = isCurrent ? now.getDate() : month > now ? 0 : daysInMonth;
  const maxPerDay = Math.max(1, ...[...byDay.values()].map((v) => v.length));
  const busiest = [...byDay.entries()].sort((x, y) => y[1].length - x[1].length)[0];

  // maior tempo sem registrar dentro do mês (contando até agora, se for o mês atual)
  const points = logs.map((l) => l.at);
  if (isCurrent) points.push(Date.now());
  let longest = 0;
  for (let i = 1; i < points.length; i++) longest = Math.max(longest, points[i] - points[i - 1]);

  const avg = daysCounted ? logs.length / daysCounted : 0;
  const daysWith = byDay.size;
  const fmtAvg = avg.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const title = `${MONTHS[month.getMonth()]} de ${month.getFullYear()}`;

  // grade começando na segunda-feira
  const first = startOfWeek(month);
  const cells: Date[] = [];
  for (let d = first; d < next || cells.length % 7; d = addDays(d, 1)) cells.push(d);

  const report = () => {
    const lines = [...byDay.entries()].map(([, times]) => {
      const d = new Date(times[0]);
      return `${WEEKDAYS_SHORT[d.getDay()]} ${fmtDayMonth(d)}: ${times.length}x (${times.map((t) => fmtTime(t)).join(', ')})`;
    });
    return [
      `${a.emoji} ${a.name} — ${title}`,
      `Total: ${logs.length} ${logs.length === 1 ? 'vez' : 'vezes'} em ${daysCounted} dias`,
      `Dias com registro: ${daysWith} de ${daysCounted}`,
      `Média: ${fmtAvg} por dia`,
      longest ? `Maior intervalo sem registro: ${fmtDuration(longest)}` : '',
      '',
      ...lines,
      '',
      'Registrado no app JARVIS.',
    ]
      .filter((l, i, arr) => l || arr[i - 1])
      .join('\n');
  };

  const share = async () => {
    const text = report();
    try {
      if (isNative()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: `${a.name} — ${title}`, text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: `${a.name} — ${title}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg('Resumo copiado. É só colar no WhatsApp ou onde quiser.');
    } catch {
      /* compartilhamento cancelado */
    }
  };

  return (
    <Sheet title={`${a.emoji} ${a.name}: histórico`} onClose={onClose}>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior">
          <Icon name="left" />
        </button>
        <strong className="cap">{title}</strong>
        <button className="icon-btn" disabled={isCurrent} onClick={() => setMonth(next)} aria-label="Próximo mês">
          <Icon name="right" />
        </button>
      </div>

      <div className="hist-stats">
        <div className="glass">
          <strong>{logs.length}</strong>
          <span className="tiny muted">{logs.length === 1 ? 'vez no mês' : 'vezes no mês'}</span>
        </div>
        <div className="glass">
          <strong>{fmtAvg}</strong>
          <span className="tiny muted">média por dia</span>
        </div>
        <div className="glass">
          <strong>
            {daysWith}/{daysCounted}
          </strong>
          <span className="tiny muted">dias com registro</span>
        </div>
      </div>

      <section className="glass calendar">
        <div className="cal-grid">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((w, i) => (
            <span key={i} className="cal-wd tiny muted">
              {w}
            </span>
          ))}
          {cells.map((d) => {
            const n = byDay.get(dayKey(d))?.length ?? 0;
            const inMonth = d.getMonth() === month.getMonth();
            return (
              <div
                key={d.toISOString()}
                className={`cal-cell ${inMonth ? '' : 'out'} ${sameDay(d, now) ? 'today' : ''}`}
                style={{ '--lvl': inMonth ? n / maxPerDay : 0 } as CSSProperties}
                aria-label={`${d.getDate()}: ${n} ${n === 1 ? 'vez' : 'vezes'}`}
              >
                <span>{d.getDate()}</span>
                {inMonth && n > 0 && <span className="cal-dots">{n}x</span>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="glass list-card hist-notes small">
        {busiest && busiest[1].length > 1 && (
          <span>
            Dia com mais registros: <strong>{fmtDayMonth(new Date(busiest[1][0]))}</strong> ({busiest[1].length}x)
          </span>
        )}
        {longest > 0 && (
          <span>
            Maior tempo sem registrar: <strong>{fmtDuration(longest)}</strong>
          </span>
        )}
        {daysCounted - daysWith > 0 && (
          <span>
            Dias sem nenhum registro: <strong>{daysCounted - daysWith}</strong>
          </span>
        )}
        {!logs.length && <span className="muted">Nenhum registro neste mês.</span>}
      </div>

      {logs.length > 0 && (
        <section className="glass list-card">
          <strong>Dia a dia</strong>
          {[...byDay.entries()].reverse().map(([k, times]) => {
            const d = new Date(times[0]);
            return (
              <div key={k} className="sleep-row">
                <span className="sleep-row-main small">
                  <span>
                    <strong>
                      {WEEKDAYS_SHORT[d.getDay()]} {fmtDayMonth(d)}
                    </strong>
                    {` · ${times.length}x`}
                  </span>
                  <span className="tiny muted">{times.map((t) => fmtTime(t)).join(' · ')}</span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      {msg && <p className="flash">{msg}</p>}
      <button className="btn primary block" onClick={share} disabled={!logs.length}>
        <Icon name="send" size={18} /> Enviar resumo
      </button>
    </Sheet>
  );
}
