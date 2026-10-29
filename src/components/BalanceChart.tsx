import { useMemo, useState } from 'react';
import type { Finance } from '../lib/types';
import { balanceByDay, money, moneyShort } from '../lib/finance';
import { fmtDayMonth, WEEKDAYS_SHORT } from '../lib/date';

const W = 340;
const H = 170;
const PAD = { top: 14, right: 10, bottom: 24, left: 52 };

/** Gráfico de linha do saldo: sobe quando entra dinheiro, desce quando sai. */
export function BalanceChart({ f, hide }: { f: Finance; hide: boolean }) {
  const [range, setRange] = useState<7 | 30>(7);
  const [sel, setSel] = useState<number | null>(null);
  const points = useMemo(() => balanceByDay(f, range), [f, range]);
  const values = points.map((p) => p.balance);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 100_00;
    max += 100_00;
  }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + ih} L${x(0).toFixed(1)},${PAD.top + ih} Z`;
  const selIdx = sel ?? points.length - 1;
  const cur = points[selIdx];
  const first = points[0].balance - points[0].change;
  const diff = points[points.length - 1].balance - first;
  const ticks = [max - (max - min) * 0.12, (max + min) / 2, min + (max - min) * 0.12];
  const zeroY = min < 0 && max > 0 ? y(0) : undefined;
  const dense = range === 30;

  return (
    <section className="glass chart-card">
      <div className="chart-head">
        <strong>Evolução do saldo</strong>
        <div className="segmented compact mini">
          <button className={range === 7 ? 'on' : ''} onClick={() => { setRange(7); setSel(null); }}>
            7 dias
          </button>
          <button className={range === 30 ? 'on' : ''} onClick={() => { setRange(30); setSel(null); }}>
            30 dias
          </button>
        </div>
      </div>
      <p className="small muted">
        {WEEKDAYS_SHORT[cur.date.getDay()]} {fmtDayMonth(cur.date)}: <strong className="text">{hide ? 'R$ ••••' : money(cur.balance)}</strong>
        {cur.change !== 0 && !hide && (
          <span className={cur.change > 0 ? 'up' : 'down'}>
            {' '}
            {cur.change > 0 ? '▲' : '▼'} {money(Math.abs(cur.change))} no dia
          </span>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" role="img" aria-label={`Saldo nos últimos ${range} dias: ${diff >= 0 ? 'subiu' : 'caiu'} ${money(Math.abs(diff))}`}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 6} y={y(t) + 3.5} className="axis" textAnchor="end">
              {hide ? '•••' : moneyShort(Math.round(t / 100) * 100).replace(/,00$/, '')}
            </text>
          </g>
        ))}
        {zeroY !== undefined && <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} className="zero" />}
        <path d={area} fill="url(#balanceFill)" />
        <path d={line} className="line" />
        {points.map((p, i) => {
          const dir = p.change > 0 ? 'up' : p.change < 0 ? 'down' : 'flat';
          const on = i === selIdx;
          return (
            <g key={i}>
              {on && <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + ih} className="cursor" />}
              {(!dense || on || p.change !== 0) && <circle cx={x(i)} cy={y(p.balance)} r={on ? 5.5 : dense ? 2.6 : 4} className={`dot ${dir} ${on ? 'on' : ''}`} />}
              <rect x={x(i) - iw / points.length / 2} y={PAD.top} width={iw / points.length} height={ih} fill="transparent" onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                <title>{`${fmtDayMonth(p.date)}: ${money(p.balance)}`}</title>
              </rect>
              {(!dense ? true : i % 5 === 4 || i === points.length - 1) && (
                <text x={x(i)} y={H - 6} className={`axis ${on ? 'strong' : ''}`} textAnchor="middle">
                  {dense ? p.date.getDate() : WEEKDAYS_SHORT[p.date.getDay()]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="legend-row tiny muted">
        <span>
          <i className="dot-legend up" /> entrou dinheiro
        </span>
        <span>
          <i className="dot-legend down" /> saiu dinheiro
        </span>
        <span className={diff >= 0 ? 'up' : 'down'}>
          {diff >= 0 ? '▲' : '▼'} {hide ? '' : money(Math.abs(diff))} no período
        </span>
      </div>
    </section>
  );
}
