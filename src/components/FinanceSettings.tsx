import { useState } from 'react';
import { store, useData } from '../lib/storage';
import { DEFAULT_PHRASES, money, moneyInput, parseMoney } from '../lib/finance';
import { WEEKDAYS_SHORT } from '../lib/date';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { askConfirm } from './Dialog';

/** Personalização do painel de finanças: meta, exibição, notificações e frases. */
export function FinanceSettings({ onClose }: { onClose: () => void }) {
  const data = useData();
  const f = data.finance;
  const [goalText, setGoalText] = useState(f.goal ? moneyInput(f.goal) : '');
  const [newPhrase, setNewPhrase] = useState('');
  const goalCents = parseMoney(goalText);

  const saveGoal = (text: string) => {
    const c = parseMoney(text);
    if (!text.trim()) store.setFinance({ goal: 0 });
    else if (Number.isFinite(c) && c > 0) store.setFinance({ goal: c });
  };

  return (
    <Sheet title="Personalizar finanças" onClose={onClose}>
      <h3 className="section-title">
        <Icon name="target" size={16} /> Meta
      </h3>
      <input className="input" placeholder="Nome da meta (ex.: Meta do mês)" value={f.goalName} maxLength={30} onChange={(e) => store.setFinance({ goalName: e.target.value })} />
      <label className="money-input small">
        <span>R$</span>
        <input
          inputMode="decimal"
          placeholder="Valor da meta, ex.: 10.000"
          value={goalText}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d.,]/g, '');
            setGoalText(t);
            saveGoal(t);
          }}
          aria-label="Valor da meta"
        />
      </label>
      {Number.isFinite(goalCents) && goalCents > 0 && <p className="tiny muted">Meta: {money(goalCents)}</p>}

      <label className="field-label">A meta conta</label>
      <div className="segmented">
        <button className={f.goalBasis === 'balance' ? 'on' : ''} onClick={() => store.setFinance({ goalBasis: 'balance' })}>
          Meu saldo
        </button>
        <button className={f.goalBasis === 'income' ? 'on' : ''} onClick={() => store.setFinance({ goalBasis: 'income', goalSince: Date.now() })}>
          O que entrar
        </button>
      </div>
      <p className="tiny muted">
        {f.goalBasis === 'balance'
          ? 'Progresso = quanto você tem agora no saldo.'
          : `Progresso = soma das entradas desde ${new Date(f.goalSince).toLocaleDateString('pt-BR')}. Tocar de novo em "O que entrar" recomeça a contagem de hoje.`}
      </p>

      <label className="field-label" htmlFor="goal-deadline">
        Prazo (opcional)
      </label>
      <div className="input-with-btn">
        <input id="goal-deadline" type="date" className="input" value={f.goalDeadline ?? ''} onChange={(e) => store.setFinance({ goalDeadline: e.target.value || undefined })} />
        {f.goalDeadline && (
          <button className="icon-btn" onClick={() => store.setFinance({ goalDeadline: undefined })} aria-label="Sem prazo">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>

      <label className="field-label">Mostrar o progresso em</label>
      <div className="segmented">
        <button className={f.display === 'percent' ? 'on' : ''} onClick={() => store.setFinance({ display: 'percent' })}>
          %
        </button>
        <button className={f.display === 'money' ? 'on' : ''} onClick={() => store.setFinance({ display: 'money' })}>
          R$
        </button>
        <button className={f.display === 'both' ? 'on' : ''} onClick={() => store.setFinance({ display: 'both' })}>
          Os dois
        </button>
      </div>
      <p className="tiny muted">
        Ex.: meta de R$ 10.000 e você fez R$ 1.000 →{' '}
        {f.display === 'percent' ? '"10% da meta"' : f.display === 'money' ? '"R$ 1.000,00 de R$ 10.000,00"' : '"R$ 1.000,00 de R$ 10.000,00 (10% da meta)"'}
      </p>

      <h3 className="section-title">
        <Icon name="bell" size={16} /> Notificações
      </h3>
      <div className="toggle-row">
        <div>
          <strong>Avisar quando entrar dinheiro</strong>
          <p className="muted small">Ao registrar uma entrada: notificação com o valor, uma frase motivacional e o progresso da meta.</p>
        </div>
        <button className={`switch ${f.notifyOnIncome ? 'on' : ''}`} onClick={() => store.setFinance({ notifyOnIncome: !f.notifyOnIncome })} aria-label="Avisar quando entrar dinheiro" />
      </div>
      {f.notifyOnIncome && (
        <input className="input" placeholder="Título da notificação" value={f.incomeTitle} maxLength={40} onChange={(e) => store.setFinance({ incomeTitle: e.target.value })} aria-label="Título da notificação de entrada" />
      )}

      <label className="field-label">Frase motivacional</label>
      <div className="segmented">
        {(
          [
            ['off', 'Desligada'],
            ['daily', 'Todo dia'],
            ['weekly', 'Toda semana'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={f.motivationFreq === k ? 'on' : ''} onClick={() => store.setFinance({ motivationFreq: k })}>
            {l}
          </button>
        ))}
      </div>
      {f.motivationFreq === 'weekly' && (
        <div className="weekday-row">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button key={d} className={`day-chip ${f.motivationWeekday === i ? 'on' : ''}`} onClick={() => store.setFinance({ motivationWeekday: i })} aria-label={d}>
              {d[0]}
            </button>
          ))}
        </div>
      )}
      {f.motivationFreq !== 'off' && (
        <div className="row-2">
          <div>
            <label className="field-label" htmlFor="motivation-time">
              Horário
            </label>
            <input id="motivation-time" type="time" className="input" value={f.motivationTime} onChange={(e) => e.target.value && store.setFinance({ motivationTime: e.target.value })} />
          </div>
          <p className="tiny muted align-end">
            {f.motivationFreq === 'weekly' ? `Toda ${WEEKDAYS_SHORT[f.motivationWeekday].toLowerCase()} às ${f.motivationTime}` : `Todo dia às ${f.motivationTime}`}, com uma frase sorteada da sua lista.
          </p>
        </div>
      )}

      <h3 className="section-title">
        <Icon name="sparkles" size={16} /> Suas frases ({f.phrases.length})
      </h3>
      <div className="phrase-list">
        {f.phrases.map((ph, i) => (
          <div key={i} className="phrase-item">
            <input
              className="input"
              value={ph}
              maxLength={120}
              onChange={(e) => store.setFinance({ phrases: f.phrases.map((x, j) => (j === i ? e.target.value : x)) })}
              aria-label={`Frase ${i + 1}`}
            />
            <button className="icon-btn" onClick={() => store.setFinance({ phrases: f.phrases.filter((_, j) => j !== i) })} aria-label="Remover frase">
              <Icon name="x" size={18} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="input-with-btn"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newPhrase.trim()) return;
          store.setFinance({ phrases: [...f.phrases, newPhrase.trim()] });
          setNewPhrase('');
        }}
      >
        <input className="input" placeholder="Nova frase (ex.: O mundo é nosso!)" value={newPhrase} maxLength={120} onChange={(e) => setNewPhrase(e.target.value)} />
        <button className="icon-btn glass" type="submit" aria-label="Adicionar frase">
          <Icon name="plus" size={18} />
        </button>
      </form>
      <button
        className="btn ghost block"
        onClick={async () => (await askConfirm('Voltar para as frases padrão? Suas frases personalizadas serão substituídas.', { confirmLabel: 'Restaurar' })) && store.setFinance({ phrases: [...DEFAULT_PHRASES] })}
      >
        <Icon name="undo" size={18} /> Restaurar frases padrão
      </button>
    </Sheet>
  );
}
