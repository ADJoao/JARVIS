import { useMemo, useState, type CSSProperties } from 'react';
import { useData } from '../lib/storage';
import { grade, indexLogs, suggestions, weekStats } from '../lib/stats';
import { addDays, fmtDayMonth, startOfDay, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../lib/date';
import { Ring } from '../components/Ring';
import { Icon } from '../components/Icon';

const TONE_COLOR = { good: 'var(--good)', ok: 'var(--accent)', warn: 'var(--warn)', bad: 'var(--bad)' } as const;

export function Report() {
  const data = useData();
  const [offset, setOffset] = useState(0);
  const idx = useMemo(() => indexLogs(data.logs), [data.logs]);
  const refKey = addDays(startOfDay(new Date()), offset * 7).getTime();
  const w = useMemo(() => weekStats(data, new Date(refKey), idx), [data, idx, refKey]);
  const prev = useMemo(() => weekStats(data, addDays(new Date(refKey), -7), idx), [data, idx, refKey]);
  const g = grade(w.score, w.planned);
  const tips = useMemo(() => suggestions(data, w), [data, w]);
  const todayIdx = w.days.findIndex((d) => startOfDay(d.date).getTime() === startOfDay(new Date()).getTime());
  const [sel, setSel] = useState<number | null>(null);
  const selIdx = sel ?? (todayIdx >= 0 ? todayIdx : 6);
  const selDay = w.days[selIdx];
  const diff = prev.planned ? Math.round((w.score - prev.score) * 100) : null;
  const end = addDays(w.start, 6);

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1>Relatório semanal</h1>
          <p className="muted small">
            {fmtDayMonth(w.start)} – {fmtDayMonth(end)}
            {offset === 0 ? ' · esta semana' : offset === -1 ? ' · semana passada' : ''}
          </p>
        </div>
        <div className="row">
          <button className="icon-btn glass" onClick={() => { setOffset(offset - 1); setSel(null); }} aria-label="Semana anterior">
            <Icon name="left" />
          </button>
          <button className="icon-btn glass" disabled={offset >= 0} onClick={() => { setOffset(offset + 1); setSel(null); }} aria-label="Próxima semana">
            <Icon name="right" />
          </button>
        </div>
      </header>

      <section className="hero glass">
        <Ring value={w.score} size={128} stroke={12} color={TONE_COLOR[g.tone]}>
          <strong className="ring-value">{Math.round(w.score * 100)}%</strong>
          <span className="muted tiny">aproveitamento</span>
        </Ring>
        <div className="hero-info">
          <p className="hero-big">
            {w.completed}
            <span className="muted"> de {w.planned}</span>
          </p>
          <p className="muted small">atividades concluídas</p>
          <span className={`badge tone-${g.tone}`}>
            {g.emoji} {g.label}
          </span>
          {diff !== null && (
            <p className="small trend">
              {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {diff > 0 ? '+' : ''}
              {diff} pts vs. semana anterior
            </p>
          )}
        </div>
      </section>

      <p className="verdict glass">{g.message}</p>

      <section className="glass chart-card">
        <div className="chart-head">
          <strong>Conclusão por dia</strong>
          {selDay && (
            <span className="small muted">
              {WEEKDAYS_LONG[selDay.date.getDay()]}:{' '}
              <strong className="text">{selDay.future ? 'ainda não chegou' : selDay.planned ? `${selDay.completed}/${selDay.planned} · ${Math.round(selDay.score * 100)}%` : 'sem atividades'}</strong>
            </span>
          )}
        </div>
        <div className="bars" role="img" aria-label="Porcentagem concluída por dia da semana">
          {[100, 50, 0].map((v) => (
            <div key={v} className="gridline" style={{ bottom: `${v}%` }}>
              <span className="tiny muted">{v}%</span>
            </div>
          ))}
          {w.days.map((d, i) => (
            <button
              key={i}
              className={`bar-col ${i === selIdx ? 'on' : ''}`}
              onClick={() => setSel(i)}
              aria-label={`${WEEKDAYS_LONG[d.date.getDay()]}: ${d.completed} de ${d.planned}`}
            >
              <span className="bar" style={{ '--h': d.future || !d.planned ? 0 : d.score } as CSSProperties} />
            </button>
          ))}
        </div>
        <div className="bar-labels">
          {w.days.map((d, i) => (
            <span key={i} className={`tiny ${i === selIdx ? 'text' : 'muted'}`}>
              {WEEKDAYS_SHORT[d.date.getDay()]}
            </span>
          ))}
        </div>
      </section>

      {w.perActivity.length > 0 && (
        <section className="glass list-card">
          <strong>Por atividade</strong>
          {w.perActivity.map((p) => (
            <div key={p.activity.id} className="act-row">
              <span className="act-row-emoji">{p.activity.emoji}</span>
              <div className="act-row-main">
                <div className="act-row-top">
                  <span>{p.activity.name}</span>
                  <span className="small muted">
                    {p.planned ? `${p.completed}/${p.planned} · ${Math.round(p.score * 100)}%` : `${p.logs} registros`}
                  </span>
                </div>
                <div className="meter">
                  <span style={{ width: `${(p.planned ? p.score : 0) * 100}%`, background: p.activity.color }} />
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="glass list-card">
        <strong>
          <Icon name="sparkles" size={16} /> O que melhorar
        </strong>
        {tips.map((t, i) => (
          <p key={i} className="tip">
            {t}
          </p>
        ))}
      </section>
    </div>
  );
}
