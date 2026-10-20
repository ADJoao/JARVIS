import { useMemo, useState, type CSSProperties } from 'react';
import { store, useData } from '../lib/storage';
import {
  balance,
  goalProgress,
  incomeBetween,
  incomeByDay,
  money,
  moneyInput,
  moneyOrHidden,
  moneyShort,
  outBetween,
  parseMoney,
  progressText,
  randomPhrase,
} from '../lib/finance';
import { dayKey, fmtDayMonth, fmtTime, fromKey, startOfDay, WEEKDAYS_SHORT } from '../lib/date';
import { notifyIncome } from '../lib/notify';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { askConfirm } from '../components/Dialog';
import { FinanceSettings } from '../components/FinanceSettings';
import type { MoneyTx } from '../lib/types';

type Mode = 'in' | 'out' | 'adjust';

export function Finance() {
  const data = useData();
  const f = data.finance;
  const hide = f.hideValues;
  const [sheet, setSheet] = useState<Mode | null>(null);
  const [settings, setSettings] = useState(false);
  const [celebrate, setCelebrate] = useState<{ tx: MoneyTx; phrase: string } | null>(null);
  const [range, setRange] = useState<7 | 30>(7);
  const [sel, setSel] = useState<number | null>(null);

  const now = new Date();
  const today = startOfDay(now).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const bal = balance(f);
  const p = goalProgress(f);
  const series = useMemo(() => incomeByDay(f, range), [f, range]);
  const max = Math.max(...series.map((d) => d.total), 1);
  const selIdx = sel ?? series.length - 1;
  const [showAll, setShowAll] = useState(false);
  const sorted = [...f.txs].sort((a, b) => b.at - a.at);
  const recent = showAll ? sorted.slice(0, 200) : sorted.slice(0, 8);
  const countSince = (from: number) => f.txs.filter((t) => t.type === 'in' && t.at >= from).length;

  const kpis = [
    { label: 'Hoje', value: incomeBetween(f, today), count: countSince(today) },
    { label: '7 dias', value: incomeBetween(f, today - 6 * 86400_000), count: countSince(today - 6 * 86400_000) },
    { label: 'Este mês', value: incomeBetween(f, monthStart), count: countSince(monthStart) },
  ];

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1>Finanças</h1>
          <p className="muted small">Seu painel de dinheiro e metas</p>
        </div>
        <div className="row">
          <button className="icon-btn glass" onClick={() => store.setFinance({ hideValues: !hide })} aria-label={hide ? 'Mostrar valores' : 'Esconder valores'}>
            <Icon name={hide ? 'eyeOff' : 'eye'} size={18} />
          </button>
          <button className="icon-btn glass" onClick={() => setSettings(true)} aria-label="Personalizar finanças">
            <Icon name="settings" size={18} />
          </button>
        </div>
      </header>

      <section className="glass balance-card">
        <span className="small muted">
          <Icon name="wallet" size={14} /> Saldo disponível
        </span>
        <strong className="balance-value">{moneyOrHidden(bal, hide)}</strong>
        <div className="flow-row">
          <span className="flow in">
            <Icon name="arrowUp" size={14} /> {moneyOrHidden(incomeBetween(f, monthStart), hide)} <span className="muted">entrou no mês</span>
          </span>
          <span className="flow out">
            <Icon name="arrowDown" size={14} /> {moneyOrHidden(outBetween(f, monthStart), hide)} <span className="muted">saiu</span>
          </span>
        </div>
        <div className="money-actions">
          <button className="btn money-in" onClick={() => setSheet('in')}>
            <Icon name="plus" size={18} /> Entrada
          </button>
          <button className="btn ghost" onClick={() => setSheet('out')}>
            <Icon name="minus" size={18} /> Saída
          </button>
          <button className="btn ghost" onClick={() => setSheet('adjust')} aria-label="Ajustar saldo">
            <Icon name="edit" size={16} /> Saldo
          </button>
        </div>
      </section>

      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.label} className="glass kpi">
            <span className="tiny muted">{k.label}</span>
            <strong>{hide ? 'R$ ••••' : moneyShort(k.value)}</strong>
            <span className="tiny muted">
              {k.count} {k.count === 1 ? 'entrada' : 'entradas'}
            </span>
          </div>
        ))}
      </div>

      <section className="glass goal-card">
        {p ? (
          <>
            <div className="chart-head">
              <strong>
                <Icon name="target" size={16} /> {f.goalName}
              </strong>
              <span className={`badge small-badge ${p.ratio >= 1 ? 'tone-good' : 'tone-ok'}`}>{Math.floor(p.ratio * 100)}%</span>
            </div>
            <div className="goal-meter" role="img" aria-label={progressText(f, p)}>
              <span style={{ width: `${Math.min(p.ratio, 1) * 100}%` }} />
            </div>
            <p className="goal-text">{hide ? `${Math.floor(p.ratio * 100)}% da meta` : progressText(f, p)}</p>
            <p className="small muted">
              {p.missing
                ? `Faltam ${moneyOrHidden(p.missing, hide)}${p.daysLeft !== undefined ? ` · ${p.daysLeft} ${p.daysLeft === 1 ? 'dia' : 'dias'} até o prazo` : ''}${p.perDay && !hide ? ` · ${money(p.perDay)} por dia` : ''}`
                : 'Você bateu a meta! Hora de definir a próxima. 🏆'}
            </p>
            <p className="tiny muted">{f.goalBasis === 'income' ? 'Conta o que entrou desde o início da meta.' : 'Conta o seu saldo atual.'}</p>
          </>
        ) : (
          <div className="empty-goal">
            <strong>
              <Icon name="target" size={16} /> Defina uma meta
            </strong>
            <p className="small muted">Ex.: R$ 10.000 até o fim do mês. Você acompanha em % ou em reais.</p>
            <button className="btn primary" onClick={() => setSettings(true)}>
              Definir meta
            </button>
          </div>
        )}
      </section>

      <section className="glass chart-card">
        <div className="chart-head">
          <strong>Faturamento</strong>
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
          {WEEKDAYS_SHORT[series[selIdx].date.getDay()]} {fmtDayMonth(series[selIdx].date)}:{' '}
          <strong className="text">{moneyOrHidden(series[selIdx].total, hide)}</strong>
        </p>
        <div className={`bars money-bars ${range === 30 ? 'dense' : ''}`} role="img" aria-label="Faturamento por dia">
          <div className="gridline" style={{ bottom: '100%' }}>
            <span className="tiny muted">{hide ? '' : money(max).replace(/,00$/, '')}</span>
          </div>
          <div className="gridline" style={{ bottom: '0%' }}>
            <span className="tiny muted">0</span>
          </div>
          {series.map((d, i) => (
            <button key={i} className={`bar-col ${i === selIdx ? 'on' : ''}`} onClick={() => setSel(i)} aria-label={`${fmtDayMonth(d.date)}: ${money(d.total)}`}>
              <span className="bar" style={{ '--h': d.total / max } as CSSProperties} />
            </button>
          ))}
        </div>
        <div className={`bar-labels ${range === 30 ? 'dense' : ''}`}>
          {series.map((d, i) => (
            <span key={i} className={`tiny ${i === selIdx ? 'text' : 'muted'}`}>
              {range === 7 ? WEEKDAYS_SHORT[d.date.getDay()] : i % 5 === 4 || i === series.length - 1 ? d.date.getDate() : ''}
            </span>
          ))}
        </div>
      </section>

      <section className="glass list-card">
        <strong>Movimentações</strong>
        {recent.length === 0 && <p className="small muted">Nenhuma movimentação ainda. Registre sua primeira entrada!</p>}
        {recent.map((t) => (
          <div key={t.id} className="tx-row">
            <span className={`tx-icon ${t.type}`}>
              <Icon name={t.type === 'in' ? 'arrowUp' : t.type === 'out' ? 'arrowDown' : 'scale'} size={16} />
            </span>
            <span className="tx-main">
              <span className="small">{t.note ?? (t.type === 'in' ? 'Entrada' : t.type === 'out' ? 'Saída' : 'Saldo ajustado')}</span>
              <span className="tiny muted">
                {WEEKDAYS_SHORT[new Date(t.at).getDay()]} {fmtDayMonth(new Date(t.at))} · {fmtTime(t.at)}
              </span>
            </span>
            <span className={`tx-value ${t.type === 'out' || (t.type === 'adjust' && t.amount < 0) ? 'neg' : 'pos'}`}>
              {t.type === 'out' || t.amount < 0 ? '−' : '+'} {moneyOrHidden(Math.abs(t.amount), hide)}
            </span>
            <button
              className="icon-btn"
              aria-label="Apagar movimentação"
              onClick={async () => (await askConfirm('Apagar essa movimentação? O saldo será recalculado.', { confirmLabel: 'Apagar', danger: true })) && store.removeTx(t.id)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        {sorted.length > 8 && (
          <button className="btn ghost block" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Mostrar menos' : `Ver todas (${sorted.length})`}
          </button>
        )}
      </section>

      {sheet && (
        <MoneySheet
          mode={sheet}
          current={bal}
          onClose={() => setSheet(null)}
          onIncome={(tx) => {
            setCelebrate({ tx, phrase: randomPhrase(store.get().finance) });
            notifyIncome(store.get(), tx);
          }}
        />
      )}
      {settings && <FinanceSettings onClose={() => setSettings(false)} />}
      {celebrate && <Celebration tx={celebrate.tx} phrase={celebrate.phrase} onClose={() => setCelebrate(null)} />}
    </div>
  );
}

function MoneySheet({ mode, current, onClose, onIncome }: { mode: Mode; current: number; onClose: () => void; onIncome: (tx: MoneyTx) => void }) {
  const [text, setText] = useState(mode === 'adjust' ? moneyInput(current) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(dayKey(new Date()));
  const [error, setError] = useState('');
  const cents = parseMoney(text);
  const title = mode === 'in' ? 'Nova entrada' : mode === 'out' ? 'Nova saída' : 'Ajustar saldo';

  const save = () => {
    if (!Number.isFinite(cents) || (mode !== 'adjust' && cents <= 0)) return setError('Digite um valor válido, ex.: 150 ou 1.250,90');
    if (mode === 'adjust') {
      store.setBalance(cents);
      return onClose();
    }
    // data escolhida com o horário de agora (ou meio-dia, se for outro dia)
    const d = fromKey(date);
    const n = new Date();
    if (dayKey(n) === date) d.setHours(n.getHours(), n.getMinutes(), n.getSeconds());
    else d.setHours(12, 0, 0, 0);
    const tx = store.addTx(mode, cents, note, d.getTime());
    onClose();
    if (mode === 'in') onIncome(tx);
  };

  return (
    <Sheet title={title} onClose={onClose}>
      {mode === 'adjust' && <p className="small muted">Quanto dinheiro você tem agora? O app corrige o saldo para esse valor (não conta como faturamento).</p>}
      <label className={`money-input ${mode}`}>
        <span>R$</span>
        <input
          inputMode="decimal"
          placeholder="0,00"
          value={text}
          autoFocus
          onChange={(e) => {
            setText(e.target.value.replace(/[^\d.,]/g, ''));
            setError('');
          }}
          aria-label="Valor"
        />
      </label>
      {Number.isFinite(cents) && cents > 0 && <p className="small muted center">{money(cents)}</p>}
      {mode !== 'adjust' && (
        <>
          <div className="chips wrap">
            {[50, 100, 200, 500, 1000].map((v) => (
              <button key={v} className="chip" onClick={() => setText(String(v))}>
                {money(v * 100).replace(',00', '')}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder={mode === 'in' ? 'Descrição (ex.: Venda, Pix do cliente)' : 'Descrição (ex.: Conta de luz)'}
            value={note}
            maxLength={40}
            onChange={(e) => setNote(e.target.value)}
          />
          <label className="field-label" htmlFor="tx-date">
            Data
          </label>
          <input id="tx-date" type="date" className="input" value={date} max={dayKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </>
      )}
      {error && <p className="error">{error}</p>}
      <button className={`btn block ${mode === 'out' ? 'danger' : 'primary'}`} onClick={save}>
        <Icon name="check" size={18} /> {mode === 'in' ? 'Registrar entrada' : mode === 'out' ? 'Registrar saída' : 'Salvar saldo'}
      </button>
    </Sheet>
  );
}

function Celebration({ tx, phrase, onClose }: { tx: MoneyTx; phrase: string; onClose: () => void }) {
  const data = useData();
  const f = data.finance;
  const p = goalProgress(f);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog glass-strong celebrate" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-burst" aria-hidden="true">
          💸
        </div>
        <span className="small muted">{f.incomeTitle || '💸 Venda aprovada!'}</span>
        <strong className="celebrate-value">+ {money(tx.amount)}</strong>
        {tx.note && <span className="small muted">{tx.note}</span>}
        <p className="celebrate-phrase">{phrase}</p>
        {p && (
          <>
            <div className="goal-meter">
              <span style={{ width: `${Math.min(p.ratio, 1) * 100}%` }} />
            </div>
            <p className="small">
              🎯 {progressText(f, p)}
              {p.missing ? ` · faltam ${money(p.missing)}` : ''}
            </p>
          </>
        )}
        <button className="btn primary block" onClick={onClose} autoFocus>
          Bora! 🚀
        </button>
      </div>
    </div>
  );
}
