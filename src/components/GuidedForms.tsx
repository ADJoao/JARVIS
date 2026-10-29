/**
 * Formulários rápidos com caixinhas (usados no "💡 Ideias" do JARVIS e em Finanças):
 * em vez de frases fixas, a pessoa escolhe valores e opções e o app salva.
 */
import { useState, type ReactNode } from 'react';
import { store, uid, useData } from '../lib/storage';
import { balance, goalProgress, money, parseMoney, progressText, randomPhrase } from '../lib/finance';
import { notifyIncome } from '../lib/notify';
import { reminder } from '../lib/smalltalk';
import { activityDayXp } from '../lib/game';
import { addDays, dayKey, fmtMinutes, fromKey } from '../lib/date';
import { dayStats } from '../lib/stats';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

/** Chamado ao concluir: o que a pessoa "disse" e a resposta do JARVIS (para aparecer no chat). */
type Done = (said: string, reply: string) => void;

interface FormProps {
  onClose: () => void;
  onDone?: Done;
}

function Choice<T extends string | number>({ options, value, onPick, render }: { options: T[]; value: T | null; onPick: (v: T) => void; render?: (v: T) => ReactNode }) {
  return (
    <div className="chips wrap">
      {options.map((o) => (
        <button key={String(o)} className={`chip ${value === o ? 'on' : ''}`} onClick={() => onPick(o)}>
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}

/** Valor em reais: caixinhas com valores comuns + "outro valor". */
function AmountPicker({ values, cents, onChange }: { values: number[]; cents: number; onChange: (c: number) => void }) {
  const [other, setOther] = useState(false);
  const [text, setText] = useState('');
  return (
    <>
      <div className="chips wrap">
        {values.map((v) => (
          <button
            key={v}
            className={`chip ${!other && cents === v * 100 ? 'on' : ''}`}
            onClick={() => {
              setOther(false);
              onChange(v * 100);
            }}
          >
            {money(v * 100).replace(',00', '')}
          </button>
        ))}
        <button className={`chip ${other ? 'on' : ''}`} onClick={() => setOther(true)}>
          Outro valor
        </button>
      </div>
      {other && (
        <label className="money-input small">
          <span>R$</span>
          <input
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            value={text}
            onChange={(e) => {
              const t = e.target.value.replace(/[^\d.,]/g, '');
              setText(t);
              const c = parseMoney(t);
              onChange(Number.isFinite(c) ? c : 0);
            }}
            aria-label="Valor"
          />
        </label>
      )}
    </>
  );
}

/** Opções com "Outro" que abre um campo de texto. */
function LabelPicker({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [other, setOther] = useState(false);
  return (
    <>
      <div className="chips wrap">
        {options.map((o) => (
          <button
            key={o}
            className={`chip ${!other && value === o ? 'on' : ''}`}
            onClick={() => {
              setOther(false);
              onChange(o);
            }}
          >
            {o}
          </button>
        ))}
        <button
          className={`chip ${other ? 'on' : ''}`}
          onClick={() => {
            setOther(true);
            onChange('');
          }}
        >
          ✏️ Outro
        </button>
      </div>
      {other && <input className="input" autoFocus placeholder={placeholder} maxLength={40} value={value} onChange={(e) => onChange(e.target.value)} />}
    </>
  );
}

const plain = (s: string) => s.replace(/^\p{Extended_Pictographic}️?\s*/u, '');

// ---------------------------------------------------------------- dinheiro

export function IncomeForm({ onClose, onDone }: FormProps) {
  const [cents, setCents] = useState(0);
  const [from, setFrom] = useState('');
  return (
    <Sheet title="💰 Recebi dinheiro" onClose={onClose}>
      <label className="field-label">Quanto entrou?</label>
      <AmountPicker values={[50, 100, 200, 500, 1000, 2000]} cents={cents} onChange={setCents} />
      <label className="field-label">De onde veio?</label>
      <LabelPicker options={['💼 Venda', '👤 Cliente', '💵 Salário', '⚡ Pix', '🧑‍💻 Freela', '🎁 Presente']} value={from} onChange={setFrom} placeholder="Ex.: Site do meu pai" />
      <button
        className="btn money-in block"
        disabled={cents <= 0}
        onClick={() => {
          const note = plain(from).trim() || undefined;
          const tx = store.addTx('in', cents, note);
          notifyIncome(store.get(), tx);
          const f = store.get().finance;
          const p = goalProgress(f);
          onDone?.(
            `Recebi ${money(cents)}${note ? ` (${note})` : ''}`,
            `${f.incomeTitle || '💸 Venda aprovada!'}\n**+ ${money(cents)}**${note ? ` · ${note}` : ''}\n\n${randomPhrase(f)}${p ? `\n\n🎯 ${progressText(f, p)}${p.missing ? ` — faltam ${money(p.missing)}` : ''}` : ''}`,
          );
          onClose();
        }}
      >
        <Icon name="check" size={18} /> Registrar entrada {cents > 0 ? `de ${money(cents)}` : ''}
      </button>
    </Sheet>
  );
}

export function ExpenseForm({ onClose, onDone }: FormProps) {
  const [cents, setCents] = useState(0);
  const [what, setWhat] = useState('');
  return (
    <Sheet title="💸 Gastei dinheiro" onClose={onClose}>
      <label className="field-label">Quanto saiu?</label>
      <AmountPicker values={[10, 20, 50, 100, 200, 500]} cents={cents} onChange={setCents} />
      <label className="field-label">Com o quê?</label>
      <LabelPicker
        options={['🍔 Lanche', '🛒 Mercado', '🚌 Transporte', '💡 Contas', '🎮 Lazer', '🛍️ Compras', '💊 Saúde', '📚 Estudos']}
        value={what}
        onChange={setWhat}
        placeholder="Ex.: Presente da minha mãe"
      />
      <button
        className="btn danger block"
        disabled={cents <= 0}
        onClick={() => {
          const note = plain(what).trim() || undefined;
          store.addTx('out', cents, note);
          onDone?.(`Gastei ${money(cents)}${note ? ` com ${note.toLowerCase()}` : ''}`, `Saída registrada: **− ${money(cents)}**${note ? ` (${note})` : ''}.\nSaldo agora: **${money(balance(store.get().finance))}**.`);
          onClose();
        }}
      >
        <Icon name="check" size={18} /> Registrar saída {cents > 0 ? `de ${money(cents)}` : ''}
      </button>
    </Sheet>
  );
}

const RANGES = [
  { label: 'até R$ 500', amount: 500_00 },
  { label: 'acima de R$ 500', amount: 500_00 },
  { label: 'acima de R$ 1.000', amount: 1000_00 },
  { label: 'acima de R$ 2.000', amount: 2000_00 },
  { label: 'acima de R$ 5.000', amount: 5000_00 },
  { label: 'acima de R$ 10.000', amount: 10000_00 },
];

/** "Vou vender um site": o que e uma faixa de valor; fica em Finanças → Previsto para entrar. */
export function ExpectedForm({ onClose, onDone }: FormProps) {
  const [what, setWhat] = useState('');
  const [range, setRange] = useState<string | null>(null);
  const [exact, setExact] = useState(false);
  const [text, setText] = useState('');
  const exactCents = parseMoney(text);
  const amount = exact ? (Number.isFinite(exactCents) ? exactCents : 0) : (RANGES.find((r) => r.label === range)?.amount ?? 0);
  const label = exact ? undefined : (range ?? undefined);

  return (
    <Sheet title="🚀 Vou vender / vou receber" onClose={onClose}>
      <label className="field-label">O quê?</label>
      <LabelPicker options={['🌐 Site', '📦 Produto', '🛠️ Serviço', '🧑‍💻 Freela', '📱 Social media', '🎨 Design']} value={what} onChange={setWhat} placeholder="Ex.: Site para meu pai" />
      <label className="field-label">Quanto deve entrar?</label>
      <div className="chips wrap">
        {RANGES.map((r) => (
          <button
            key={r.label}
            className={`chip ${!exact && range === r.label ? 'on' : ''}`}
            onClick={() => {
              setExact(false);
              setRange(r.label);
            }}
          >
            {r.label}
          </button>
        ))}
        <button className={`chip ${exact ? 'on' : ''}`} onClick={() => setExact(true)}>
          Valor exato
        </button>
      </div>
      {exact && (
        <label className="money-input small">
          <span>R$</span>
          <input inputMode="decimal" placeholder="0,00" autoFocus value={text} onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))} aria-label="Valor previsto" />
        </label>
      )}
      <p className="tiny muted">Fica salvo em Finanças → "Previsto para entrar". Quando o dinheiro cair, toque em "Recebi" e coloque o valor certinho.</p>
      <button
        className="btn primary block"
        disabled={amount <= 0 || !plain(what).trim()}
        onClick={() => {
          const name = plain(what).trim();
          store.addExpected(name, amount, label);
          const f = store.get().finance;
          const p = goalProgress(f);
          const valueText = label ?? money(amount);
          onDone?.(
            `Vou vender: ${name} (${valueText})`,
            `${randomPhrase(f)} 🚀\n\nAnotei **${name}** (${valueText}) em Finanças → Previsto para entrar.${
              p ? `\nSe der certo, sua meta "${f.goalName}" vai de ${Math.floor(p.ratio * 100)}% para ${Math.min(100, Math.floor(((p.current + amount) / p.goal) * 100))}%.` : ''
            }\nQuando o dinheiro cair, é só tocar em "Recebi". 💰`,
          );
          onClose();
        }}
      >
        <Icon name="check" size={18} /> Salvar previsão
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- lembretes e notas

const REMINDER_KINDS = [
  { id: 'ligar', label: '📞 Ligar para alguém', ask: 'Para quem?', placeholder: 'Nome da pessoa', make: (x: string) => `Ligar para ${x}` },
  { id: 'msg', label: '💬 Mandar mensagem', ask: 'Para quem?', placeholder: 'Nome da pessoa', make: (x: string) => `Mandar mensagem para ${x}` },
  { id: 'pagar', label: '💳 Pagar uma conta', ask: 'Qual conta?', placeholder: 'Ex.: luz, internet, boleto', make: (x: string) => `Pagar ${x}` },
  { id: 'comprar', label: '🛒 Comprar algo', ask: 'O quê?', placeholder: 'Ex.: pão, presente', make: (x: string) => `Comprar ${x}` },
  { id: 'estudar', label: '📚 Estudar', ask: 'Qual matéria? (opcional)', placeholder: 'Ex.: matemática', make: (x: string) => (x ? `Estudar ${x}` : 'Estudar') },
  { id: 'outro', label: '✏️ Outra coisa', ask: 'Lembrar de quê?', placeholder: 'Ex.: levar o carro na revisão', make: (x: string) => x },
];

export function ReminderForm({ onClose, onDone }: FormProps) {
  const [kind, setKind] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [when, setWhen] = useState<'Hoje' | 'Amanhã' | 'Outro dia'>('Hoje');
  const [date, setDate] = useState(dayKey(addDays(new Date(), 2)));
  const [time, setTime] = useState('');
  const k = REMINDER_KINDS.find((r) => r.id === kind);
  const what = k ? k.make(detail.trim()).trim() : '';
  const needsDetail = k && k.id !== 'estudar';

  return (
    <Sheet title="⏰ Criar lembrete" onClose={onClose}>
      <label className="field-label">Lembrar de quê?</label>
      <div className="chips wrap">
        {REMINDER_KINDS.map((r) => (
          <button
            key={r.id}
            className={`chip ${kind === r.id ? 'on' : ''}`}
            onClick={() => {
              setKind(r.id);
              setDetail('');
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {k && (
        <>
          <label className="field-label">{k.ask}</label>
          <input className="input" autoFocus placeholder={k.placeholder} maxLength={50} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </>
      )}
      <label className="field-label">Quando?</label>
      <Choice options={['Hoje', 'Amanhã', 'Outro dia'] as const as unknown as ('Hoje' | 'Amanhã' | 'Outro dia')[]} value={when} onPick={setWhen} />
      {when === 'Outro dia' && <input type="date" className="input" value={date} min={dayKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />}
      <label className="field-label">Que horas?</label>
      <Choice options={['08:00', '10:00', '12:00', '15:00', '18:00', '20:00', '22:00']} value={time || null} onPick={setTime} />
      <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Outro horário" />
      <button
        className="btn primary block"
        disabled={!k || (needsDetail && !detail.trim())}
        onClick={() => {
          const day = when === 'Hoje' ? new Date() : when === 'Amanhã' ? addDays(new Date(), 1) : fromKey(date);
          reminder(what, day, time || undefined);
          const whenText = when === 'Outro dia' ? `em ${day.toLocaleDateString('pt-BR')}` : when.toLowerCase();
          onDone?.(`Me lembra de ${what.charAt(0).toLowerCase() + what.slice(1)} ${whenText}${time ? ` às ${time}` : ''}`, `Pode deixar! ⏰ Vou te lembrar de **${what}** ${whenText}${time ? ` às ${time}` : ''}. O lembrete aparece na tela Hoje${time ? ' e você recebe uma notificação' : ''}.`);
          onClose();
        }}
      >
        <Icon name="bell" size={18} /> Criar lembrete
      </button>
    </Sheet>
  );
}

export function NoteQuickForm({ onClose, onDone }: FormProps) {
  const notes = useData().notes;
  const [text, setText] = useState('');
  const [target, setTarget] = useState('Anotações rápidas');
  const titles = ['Anotações rápidas', ...notes.map((n) => n.title).filter((t) => t && t !== 'Anotações rápidas').slice(0, 6)];
  return (
    <Sheet title="🗒️ Anotar" onClose={onClose}>
      <label className="field-label">O que anotar?</label>
      <textarea className="input" rows={2} autoFocus placeholder="Ex.: comprar pão, revisar genética…" maxLength={120} value={text} onChange={(e) => setText(e.target.value)} />
      <label className="field-label">Em qual nota?</label>
      <Choice options={titles} value={target} onPick={setTarget} />
      <button
        className="btn primary block"
        disabled={!text.trim()}
        onClick={() => {
          const all = store.get().notes;
          const note = all.find((n) => n.title === target);
          const block = { id: uid(), type: 'check' as const, text: text.trim() };
          if (note) store.saveNote({ ...note, blocks: [...note.blocks, block] });
          else store.saveNote({ id: uid(), title: target, emoji: '🗒️', category: 'outro', blocks: [block], createdAt: Date.now(), updatedAt: Date.now() });
          onDone?.(`Anota: ${text.trim()}`, `Anotado! 🗒️ "${text.trim()}" foi para a nota **${target}**, com um quadradinho para marcar quando fizer.`);
          onClose();
        }}
      >
        <Icon name="check" size={18} /> Anotar
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------- atividades

export function ActivityQuickForm({ onClose, onDone }: FormProps) {
  const data = useData();
  const acts = data.activities.filter((a) => !a.archivedAt);
  const [id, setId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const a = acts.find((x) => x.id === id);
  const byTime = a?.goalKind === 'minutes';
  const today = a ? dayStats(data, new Date()).items.find((i) => i.activity.id === a.id)?.count ?? 0 : 0;
  const added = byTime ? minutes : qty;
  const gain = a ? activityDayXp(data.game, a, today + added) - activityDayXp(data.game, a, today) : 0;

  return (
    <Sheet title="✅ Registrar o que eu fiz" onClose={onClose}>
      {acts.length === 0 ? (
        <p className="small muted">Você ainda não tem atividades. Crie em Hoje → +.</p>
      ) : (
        <>
          <label className="field-label">O que você fez?</label>
          <div className="chips wrap">
            {acts.map((x) => (
              <button
                key={x.id}
                className={`chip ${id === x.id ? 'on' : ''}`}
                onClick={() => {
                  setId(x.id);
                  setQty(1);
                  setMinutes(0);
                }}
              >
                {x.emoji} {x.name}
              </button>
            ))}
          </div>
          {a && byTime && (
            <>
              <label className="field-label">Quanto tempo?</label>
              <Choice options={[15, 30, 45, 60, 90, 120, 180, 240]} value={minutes || null} onPick={setMinutes} render={(m) => fmtMinutes(m)} />
            </>
          )}
          {a && !byTime && (
            <>
              <label className="field-label">Quantas vezes?</label>
              <div className="stepper">
                <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Menos">
                  <Icon name="minus" size={18} />
                </button>
                <span>
                  {qty} {a.unit ?? (qty === 1 ? 'vez' : 'vezes')}
                </span>
                <button onClick={() => setQty(Math.min(20, qty + 1))} aria-label="Mais">
                  <Icon name="plus" size={18} />
                </button>
              </div>
            </>
          )}
          {a && added > 0 && <p className="small xp-text">+{gain} XP</p>}
          <button
            className="btn primary block"
            disabled={!a || added <= 0}
            onClick={() => {
              if (!a) return;
              if (byTime) store.addLog(a.id, Date.now(), minutes);
              else for (let i = 0; i < qty; i++) store.addLog(a.id);
              const total = today + added;
              const prog = byTime ? `${fmtMinutes(total)} de ${fmtMinutes(a.goal)}` : `${total}/${a.goal}`;
              onDone?.(
                byTime ? `Fiz ${fmtMinutes(minutes)} de ${a.name.toLowerCase()}` : `Fiz ${a.name.toLowerCase()}${qty > 1 ? ` ${qty}x` : ''}`,
                `Registrado! ${a.emoji} ${a.name}${byTime ? ` · ${fmtMinutes(minutes)}` : qty > 1 ? ` ×${qty}` : ''}. Hoje: ${prog}${total >= a.goal ? ' ✅' : ''}${total > a.goal ? ' Passou da meta, bônus de pontos! 🔥' : ''} (+${gain} XP)`,
              );
              onClose();
            }}
          >
            <Icon name="check" size={18} /> Registrar
          </button>
        </>
      )}
    </Sheet>
  );
}
