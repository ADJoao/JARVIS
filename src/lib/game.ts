import type { Activity, CategoryId, Game, Note, Reward, UserData } from './types';
import { dayKey } from './date';
import { hoursOf } from './sleep';

export const CATEGORIES: { id: CategoryId; name: string; emoji: string; hint: string }[] = [
  { id: 'cuidado', name: 'Cuidados', emoji: '💧', hint: 'água, banheiro, remédio, refeições' },
  { id: 'saude', name: 'Saúde', emoji: '💪', hint: 'exercício, treino, meditação' },
  { id: 'estudo', name: 'Estudo', emoji: '📚', hint: 'aulas, provas, cursos, leitura' },
  { id: 'trabalho', name: 'Trabalho', emoji: '💼', hint: 'trabalho, projetos, vendas' },
  { id: 'financas', name: 'Dinheiro', emoji: '💰', hint: 'cada entrada registrada em Finanças' },
  { id: 'casa', name: 'Casa', emoji: '🏠', hint: 'limpeza, compras, organização' },
  { id: 'lazer', name: 'Mente & lazer', emoji: '🎨', hint: 'hobbies, descanso, social' },
  { id: 'outro', name: 'Outro', emoji: '⭐', hint: 'qualquer outra coisa' },
];

export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const DEFAULT_XP: Record<CategoryId, number> = {
  cuidado: 5,
  saude: 15,
  estudo: 20,
  trabalho: 25,
  financas: 20,
  casa: 10,
  lazer: 10,
  outro: 10,
};

export const DEFAULT_REWARDS: Reward[] = [
  { id: 'r1', name: '1h de videogame', emoji: '🎮', cost: 150, message: 'Pode jogar 1 hora sem culpa! Você mereceu. 🎮' },
  { id: 'r2', name: 'Tomar um sorvete', emoji: '🍦', cost: 200, message: 'Liberado! Vai lá tomar aquele sorvete. 🍦' },
  { id: 'r3', name: 'Sair para passear', emoji: '🚶', cost: 400, message: 'Hora de passear e recarregar as energias! 🌅' },
  { id: 'r4', name: 'Pedir uma pizza', emoji: '🍕', cost: 600, message: 'Pizza liberada! Comemore suas conquistas. 🍕' },
  { id: 'r5', name: 'Dia livre', emoji: '🏖️', cost: 1500, message: 'Você está com o dia livre! Descanse, você trabalhou duro. 🏖️' },
  { id: 'r6', name: 'Comprar um jogo', emoji: '🕹️', cost: 2500, message: 'Você está liberado para comprar aquele jogo! 🕹️🔥' },
];

export const DEFAULT_GAME = (): Game => ({
  xp: { ...DEFAULT_XP },
  sleepXp: 15,
  rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
  redemptions: [],
  seenLevel: 0,
});

const EMOJI_CATEGORY: Record<string, CategoryId> = {
  '💩': 'cuidado', '🚽': 'cuidado', '🧻': 'cuidado', '💧': 'cuidado', '🥤': 'cuidado', '💊': 'cuidado', '🩺': 'cuidado', '🦷': 'cuidado', '🚿': 'cuidado', '🧴': 'cuidado',
  '🍽️': 'cuidado', '🥗': 'cuidado', '🍎': 'cuidado', '🍳': 'cuidado', '🥛': 'cuidado', '😴': 'cuidado', '🛌': 'cuidado',
  '🏋️': 'saude', '🏃': 'saude', '🚴': 'saude', '🏊': 'saude', '🧘': 'saude', '⚽': 'saude', '🏀': 'saude', '🥊': 'saude', '🤸': 'saude', '🚶': 'saude', '💪': 'saude',
  '📚': 'estudo', '📖': 'estudo', '✏️': 'estudo', '🧮': 'estudo', '🎓': 'estudo', '🔬': 'estudo', '🌐': 'estudo', '🗣️': 'estudo', '📝': 'estudo',
  '💼': 'trabalho', '💻': 'trabalho', '📊': 'trabalho', '🗂️': 'trabalho', '🎯': 'trabalho', '💡': 'trabalho',
  '🧹': 'casa', '🧺': 'casa', '🛒': 'casa', '🪴': 'casa', '🐶': 'casa', '🐱': 'casa', '🗑️': 'casa', '🧽': 'casa', '🛏️': 'casa', '🛠️': 'casa',
  '💰': 'financas', '🧾': 'financas',
  '🎮': 'lazer', '🎧': 'lazer', '🎸': 'lazer', '🎨': 'lazer', '📷': 'lazer', '🎬': 'lazer', '🙏': 'lazer',
};

/** Tipo da atividade: o escolhido, ou deduzido pelo ícone. */
export const activityCategory = (a: Pick<Activity, 'category' | 'emoji'>): CategoryId => a.category ?? EMOJI_CATEGORY[a.emoji] ?? 'outro';

/** Passar da meta em vezes: cada vez extra vale esta fração do XP (até o dobro da meta). */
export const EXTRA_RATE = 0.5;
/** Meta em tempo: o XP do dia é proporcional ao tempo feito, até este múltiplo. */
export const MAX_TIME_MULTIPLIER = 3;

/** XP que uma atividade rende num dia, dado o quanto foi feito (vezes ou minutos). Usado para mostrar a prévia. */
export function activityDayXp(g: Game, a: Activity, amount: number): number {
  const xp = g.xp[activityCategory(a)];
  const goal = Math.max(1, a.goal);
  if (a.goalKind === 'minutes') return Math.round(xp * Math.min(amount / goal, MAX_TIME_MULTIPLIER));
  return Math.min(amount, goal) * xp + Math.round(Math.min(Math.max(0, amount - goal), goal) * xp * EXTRA_RATE);
}

/** XP de cada quadradinho marcado numa nota (metade do valor do tipo, mínimo 2). */
export const checkXp = (g: Game, cat: CategoryId) => Math.max(2, Math.round(g.xp[cat] / 2));
/** Bônus ao completar todos os quadradinhos de uma nota, ou ao passar numa prova. */
export const bonusXp = (g: Game, cat: CategoryId) => g.xp[cat] * 2;

export function noteProgress(n: Note): { done: number; total: number } {
  const checks = n.blocks.filter((b) => b.type === 'check');
  return { done: checks.filter((b) => b.type === 'check' && b.doneAt).length, total: checks.length };
}

export interface XpSummary {
  total: number;
  byCategory: Record<CategoryId, number>;
  sleep: number;
  spent: number;
  points: number;
}

/**
 * XP é calculado a partir do que está registrado (não fica salvo à parte),
 * então desmarcar ou apagar algo tira os pontos automaticamente.
 */
export function xpSummary(data: UserData): XpSummary {
  const g = data.game;
  const by = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>;

  // atividades
  // - meta em vezes: cada registro vale o XP do tipo até a meta; passou da meta, +50% por vez extra (até o dobro da meta)
  // - meta em tempo: XP proporcional ao tempo feito no dia (2h de meta e 3h feitas = 1,5x), até 3x
  const perDay = new Map<string, { a: Activity; n: number; minutes: number }>();
  const acts = new Map(data.activities.map((a) => [a.id, a]));
  for (const l of data.logs) {
    const a = acts.get(l.activityId);
    if (!a) continue;
    const k = `${a.id}|${dayKey(l.at)}`;
    const cur = perDay.get(k) ?? { a, n: 0, minutes: 0 };
    cur.n += 1;
    cur.minutes += l.minutes ?? 0;
    perDay.set(k, cur);
  }
  for (const { a, n, minutes } of perDay.values()) {
    const cat = activityCategory(a);
    const goal = Math.max(1, a.goal);
    if (a.goalKind === 'minutes') {
      by[cat] += Math.round(g.xp[cat] * Math.min(minutes / goal, MAX_TIME_MULTIPLIER));
    } else {
      const within = Math.min(n, goal);
      const extra = Math.min(Math.max(0, n - goal), goal);
      by[cat] += within * g.xp[cat] + Math.round(extra * g.xp[cat] * EXTRA_RATE);
    }
  }

  // notas: cada quadradinho + bônus por nota completa e por prova aprovada
  for (const note of data.notes) {
    const cat = note.category;
    const { done, total } = noteProgress(note);
    by[cat] += done * checkXp(g, cat);
    if (total > 0 && done === total) by[cat] += bonusXp(g, cat);
    for (const b of note.blocks)
      if (b.type === 'grade' && b.got !== undefined && b.need !== undefined && b.got >= b.need) by[cat] += bonusXp(g, cat);
  }

  // dinheiro: cada entrada
  by.financas += data.finance.txs.filter((t) => t.type === 'in').length * g.xp.financas;

  // sono: noites no ideal
  const sleep = data.sleep.filter((s) => {
    const h = hoursOf(s);
    return h >= 7 && h <= 9.5;
  }).length * g.sleepXp;
  by.saude += sleep;

  const total = Object.values(by).reduce((s, v) => s + v, 0);
  const spent = g.redemptions.reduce((s, r) => s + r.cost, 0);
  return { total, byCategory: by, sleep, spent, points: total - spent };
}

/** XP acumulado necessário para chegar ao nível n (nível 1 = 0, 2 = 100, 3 = 300, 4 = 600…). */
export const xpForLevel = (n: number) => 50 * (n - 1) * n;

export function levelInfo(totalXp: number) {
  let level = 1;
  while (totalXp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, title: levelTitle(level), current: totalXp - base, needed: next - base, ratio: (totalXp - base) / (next - base), toNext: next - totalXp };
}

const TITLES = ['Iniciante', 'Aprendiz', 'Focado', 'Dedicado', 'Determinado', 'Disciplinado', 'Imparável', 'Elite', 'Mestre', 'Lenda'];
export function levelTitle(level: number): string {
  if (level >= 30) return 'JARVIS Supremo';
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))];
}
