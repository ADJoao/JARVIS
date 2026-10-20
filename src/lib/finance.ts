import type { Finance, MoneyTx, UserData } from './types';
import { addDays, dayKey, startOfDay } from './date';

export const DEFAULT_PHRASES = [
  'Não deixe o agora para depois. 🚀',
  'O mundo é nosso. Bora fazer acontecer! 🌍',
  'Disciplina hoje, liberdade amanhã.',
  'Cada real conta. Cada passo conta. 💰',
  'Você não chegou até aqui para parar agora.',
  'A meta está te esperando. Foco! 🎯',
  'Quem planta hoje colhe amanhã. Bora trabalhar!',
  'Seu futuro agradece o esforço de hoje. 💪',
  'Grandes resultados vêm de pequenas ações todo dia.',
  'Você é capaz de muito mais do que imagina. 🔥',
];

export const DEFAULT_FINANCE = (): Finance => ({
  txs: [],
  goal: 0,
  goalName: 'Minha meta',
  goalBasis: 'balance',
  goalSince: Date.now(),
  display: 'both',
  hideValues: false,
  phrases: [...DEFAULT_PHRASES],
  motivationFreq: 'weekly',
  motivationWeekday: 1,
  motivationTime: '08:00',
  notifyOnIncome: true,
  incomeTitle: '💸 Venda aprovada!',
});

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos → "R$ 1.234,56". */
export const money = (cents: number) => BRL.format(cents / 100);

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

/** Valor curto para espaços pequenos: "R$ 980,50", "R$ 1,3 mil", "R$ 25 mil". */
export const moneyShort = (cents: number) => (Math.abs(cents) < 100000 ? money(cents) : BRL_COMPACT.format(cents / 100));

/** Centavos → texto para editar num campo: "10.000,00". */
export const moneyInput = (cents: number) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor escondido (olho fechado). */
export const moneyOrHidden = (cents: number, hide: boolean) => (hide ? 'R$ ••••' : money(cents));

/**
 * Lê o que a pessoa digitou ("1.500", "1500,50", "R$ 2.000,00", "99.90") e devolve centavos.
 * Retorna NaN se não for um número.
 */
export function parseMoney(text: string): number {
  let t = text.replace(/[R$\s]/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

const signed = (t: MoneyTx) => (t.type === 'out' ? -t.amount : t.amount);

export function balance(f: Finance): number {
  return f.txs.reduce((s, t) => s + signed(t), 0);
}

/** Soma das entradas (faturamento) entre dois instantes. */
export function incomeBetween(f: Finance, from: number, to = Number.MAX_SAFE_INTEGER): number {
  return f.txs.filter((t) => t.type === 'in' && t.at >= from && t.at < to).reduce((s, t) => s + t.amount, 0);
}

export function outBetween(f: Finance, from: number, to = Number.MAX_SAFE_INTEGER): number {
  return f.txs.filter((t) => t.type === 'out' && t.at >= from && t.at < to).reduce((s, t) => s + t.amount, 0);
}

export interface GoalProgress {
  current: number;
  goal: number;
  ratio: number; // 0..1+
  missing: number;
  /** Quanto precisa por dia até o prazo (se houver prazo). */
  perDay?: number;
  daysLeft?: number;
}

export function goalProgress(f: Finance): GoalProgress | undefined {
  if (!f.goal) return undefined;
  const current = f.goalBasis === 'income' ? incomeBetween(f, f.goalSince) : Math.max(0, balance(f));
  const missing = Math.max(0, f.goal - current);
  let perDay: number | undefined;
  let daysLeft: number | undefined;
  if (f.goalDeadline) {
    const [y, m, d] = f.goalDeadline.split('-').map(Number);
    const end = new Date(y, m - 1, d).getTime();
    daysLeft = Math.max(0, Math.ceil((end - startOfDay(new Date()).getTime()) / 86400_000) + 1);
    perDay = daysLeft ? Math.ceil(missing / daysLeft) : missing;
  }
  return { current, goal: f.goal, ratio: current / f.goal, missing, perDay, daysLeft };
}

/** Texto do progresso no formato escolhido: "10% da meta", "R$ 1.000 de R$ 10.000" ou os dois. */
export function progressText(f: Finance, p = goalProgress(f)): string {
  if (!p) return '';
  const pct = `${Math.floor(p.ratio * 100)}% da meta`;
  const val = `${money(p.current)} de ${money(p.goal)}`;
  if (p.ratio >= 1) return `Meta batida! 🏆 ${f.display === 'percent' ? pct : val}`;
  if (f.display === 'percent') return pct;
  if (f.display === 'money') return val;
  return `${val} (${pct})`;
}

export function randomPhrase(f: Finance, seed = Math.random()): string {
  const list = f.phrases.filter((p) => p.trim());
  if (!list.length) return DEFAULT_PHRASES[0];
  return list[Math.floor(seed * list.length) % list.length];
}

/** Faturamento por dia dos últimos `days` dias (inclui hoje). */
export function incomeByDay(f: Finance, days: number): { date: Date; total: number }[] {
  const today = startOfDay(new Date());
  const map = new Map<string, number>();
  for (const t of f.txs) if (t.type === 'in') map.set(dayKey(t.at), (map.get(dayKey(t.at)) ?? 0) + t.amount);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, total: map.get(dayKey(date)) ?? 0 };
  });
}

/** Resumo em texto para o assistente local. */
export function financeSummary(data: UserData): string {
  const f = data.finance;
  const today = startOfDay(new Date()).getTime();
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const p = goalProgress(f);
  const lines = [
    `💰 Saldo: **${money(balance(f))}**`,
    `Entrou hoje: ${money(incomeBetween(f, today))} · no mês: ${money(incomeBetween(f, month.getTime()))}`,
  ];
  if (p)
    lines.push(
      `🎯 ${f.goalName}: ${progressText(f, p)}${p.missing ? ` — faltam ${money(p.missing)}` : ''}${p.perDay && p.missing ? ` (${money(p.perDay)} por dia até o prazo)` : ''}.`,
    );
  else lines.push('Você ainda não definiu uma meta. Defina em Finanças → Personalizar.');
  lines.push(`\n${randomPhrase(f)}`);
  return lines.join('\n');
}
