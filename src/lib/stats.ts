import type { Activity, LogEntry, UserData } from './types';
import { addDays, dayKey, fmtDuration, startOfDay, startOfWeek, timeToMinutes, weekDays, WEEKDAYS_LONG } from './date';
import { timesLabel, timesOf } from './times';

export function isActiveOn(a: Activity, date: Date): boolean {
  const day = startOfDay(date).getTime();
  if (startOfDay(a.createdAt).getTime() > day) return false;
  if (a.archivedAt && startOfDay(a.archivedAt).getTime() <= day) return false;
  return true;
}

export function isScheduledOn(a: Activity, date: Date): boolean {
  if (!isActiveOn(a, date)) return false;
  const s = a.schedule;
  switch (s.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return s.days.includes(date.getDay());
    case 'once':
      return s.date === dayKey(date);
    case 'free':
      return false;
  }
}

/** Índice de registros por "atividade|dia" para contar rápido. */
export function indexLogs(logs: LogEntry[]): Map<string, LogEntry[]> {
  const map = new Map<string, LogEntry[]>();
  for (const l of logs) {
    const k = `${l.activityId}|${dayKey(l.at)}`;
    const arr = map.get(k);
    if (arr) arr.push(l);
    else map.set(k, [l]);
  }
  return map;
}

export function logsOn(idx: Map<string, LogEntry[]>, activityId: string, date: Date): LogEntry[] {
  return idx.get(`${activityId}|${dayKey(date)}`) ?? [];
}

export interface DayItem {
  activity: Activity;
  count: number;
  goal: number;
  complete: boolean;
  scheduled: boolean;
}

export interface DayStats {
  date: Date;
  items: DayItem[];
  planned: number;
  completed: number;
  /** 0..1, com crédito parcial (ex.: 6 de 8 copos = 0,75). */
  score: number;
}

/** Quanto um registro conta para a meta: 1 vez, ou os minutos (meta em tempo). */
export const logAmount = (a: Activity, l: LogEntry) => (a.goalKind === 'minutes' ? (l.minutes ?? 0) : 1);

export function dayStats(data: UserData, date: Date, idx = indexLogs(data.logs)): DayStats {
  const items: DayItem[] = [];
  for (const a of data.activities) {
    const scheduled = isScheduledOn(a, date);
    const count = logsOn(idx, a.id, date).reduce((s, l) => s + logAmount(a, l), 0);
    // atividades "sem agenda" só aparecem no dia se houve registro
    if (!scheduled && !(a.schedule.kind === 'free' && isActiveOn(a, date))) continue;
    items.push({ activity: a, count, goal: a.goal, complete: count >= a.goal, scheduled });
  }
  items.sort((x, y) => timeToMinutes(x.activity.time) - timeToMinutes(y.activity.time));
  const planned = items.filter((i) => i.scheduled);
  const completed = planned.filter((i) => i.complete).length;
  const partial = planned.reduce((s, i) => s + Math.min(i.count / i.goal, 1), 0);
  return {
    date,
    items,
    planned: planned.length,
    completed,
    score: planned.length ? partial / planned.length : 0,
  };
}

export interface ActivityWeek {
  activity: Activity;
  planned: number;
  completed: number;
  score: number;
  logs: number;
}

export interface WeekStats {
  start: Date;
  days: (DayStats & { future: boolean })[];
  planned: number;
  completed: number;
  score: number;
  perActivity: ActivityWeek[];
  bestDay?: DayStats;
  worstDay?: DayStats;
}

export function weekStats(data: UserData, anyDay: Date, idx = indexLogs(data.logs)): WeekStats {
  const start = startOfWeek(anyDay);
  const today = startOfDay(new Date()).getTime();
  const days = weekDays(start).map((d) => ({ ...dayStats(data, d, idx), future: d.getTime() > today }));
  const counted = days.filter((d) => !d.future);
  const per = new Map<string, ActivityWeek>();
  for (const d of counted) {
    for (const it of d.items) {
      const cur = per.get(it.activity.id) ?? { activity: it.activity, planned: 0, completed: 0, score: 0, logs: 0 };
      cur.logs += it.count;
      if (it.scheduled) {
        cur.planned += 1;
        if (it.complete) cur.completed += 1;
        cur.score += Math.min(it.count / it.goal, 1);
      }
      per.set(it.activity.id, cur);
    }
  }
  const perActivity = [...per.values()]
    .map((p) => ({ ...p, score: p.planned ? p.score / p.planned : 0 }))
    .sort((a, b) => b.planned - a.planned || a.score - b.score);
  const planned = counted.reduce((s, d) => s + d.planned, 0);
  const completed = counted.reduce((s, d) => s + d.completed, 0);
  const partial = counted.reduce((s, d) => s + d.score * d.planned, 0);
  const withPlan = counted.filter((d) => d.planned > 0);
  const sorted = [...withPlan].sort((a, b) => b.score - a.score);
  return {
    start,
    days,
    planned,
    completed,
    score: planned ? partial / planned : 0,
    perActivity,
    bestDay: sorted[0],
    worstDay: sorted.length > 1 ? sorted[sorted.length - 1] : undefined,
  };
}

export function lastLog(data: UserData, activityId: string): LogEntry | undefined {
  let last: LogEntry | undefined;
  for (const l of data.logs) if (l.activityId === activityId && (!last || l.at > last.at)) last = l;
  return last;
}

/** Dias seguidos (até hoje) com pelo menos 80% do planejado. Hoje só conta se já bateu. */
export function streak(data: UserData, idx = indexLogs(data.logs)): number {
  let n = 0;
  let d = startOfDay(new Date());
  const today = dayStats(data, d, idx);
  if (today.planned && today.score >= 0.8) n++;
  for (let i = 0; i < 365; i++) {
    d = addDays(d, -1);
    const s = dayStats(data, d, idx);
    if (!s.planned) {
      if (data.activities.every((a) => !isActiveOn(a, d))) break;
      continue;
    }
    if (s.score >= 0.8) n++;
    else break;
  }
  return n;
}

export interface Grade {
  label: string;
  emoji: string;
  tone: 'good' | 'ok' | 'warn' | 'bad';
  message: string;
}

export function grade(score: number, planned: number): Grade {
  if (!planned)
    return { label: 'Sem dados', emoji: '🗓️', tone: 'ok', message: 'Ainda não há atividades planejadas nesse período.' };
  const p = Math.round(score * 100);
  if (p >= 90) return { label: 'Excelente', emoji: '🏆', tone: 'good', message: `Você cumpriu ${p}% do planejado. Ritmo de campeão — mantenha assim!` };
  if (p >= 75) return { label: 'Muito bom', emoji: '🚀', tone: 'good', message: `${p}% concluído. Você está no caminho certo; pequenos ajustes te levam ao topo.` };
  if (p >= 55) return { label: 'Regular', emoji: '⚖️', tone: 'warn', message: `${p}% concluído. Dá para melhorar — foque nas atividades que mais ficaram para trás.` };
  if (p >= 30) return { label: 'Precisa melhorar', emoji: '🔧', tone: 'warn', message: `Só ${p}% concluído. Talvez a rotina esteja pesada demais; simplifique e vá aumentando.` };
  return { label: 'Atenção', emoji: '🚨', tone: 'bad', message: `Apenas ${p}% concluído. Recomece com 2 ou 3 hábitos essenciais e construa a partir deles.` };
}

const EMOJI_TIPS: Record<string, string> = {
  '💩': 'Beba mais água, coma frutas, verduras e fibras e tente ir sempre no mesmo horário (de manhã costuma ajudar). Se passar de 3 dias, procure um médico.',
  '🚽': 'Beba mais água e coma fibras. Se passar de 3 dias sem ir, vale procurar um médico.',
  '💧': 'Deixe uma garrafa sempre à vista e beba um copo a cada refeição e ao acordar.',
  '🥤': 'Deixe uma garrafa sempre à vista e beba um copo a cada refeição e ao acordar.',
  '🍽️': 'Evite pular refeições: deixe lanches práticos preparados e defina horários fixos.',
  '😴': 'Desligue telas 30 minutos antes de dormir e mantenha o mesmo horário todos os dias.',
  '💊': 'Deixe o remédio perto de algo que você usa todo dia (escova de dentes, café) e ative o lembrete.',
};

function tipFor(a: Activity): string {
  if (EMOJI_TIPS[a.emoji]) return EMOJI_TIPS[a.emoji];
  if (timesOf(a).length > 1) return `Você tem ${timesOf(a).length} horários (${timesLabel(a)}). Ative o lembrete em cada um e deixe tudo à mão para não esquecer.`;
  if (a.time) return `Tente mudar o horário das ${a.time} para um momento em que você esteja mais livre.`;
  return 'Defina um horário fixo e ative o lembrete — isso aumenta muito a chance de fazer.';
}

/** Dicas automáticas com base na semana. */
export function suggestions(data: UserData, w: WeekStats): string[] {
  const out: string[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (!data.activities.length) return ['Crie sua primeira atividade na aba "Rotinas" para eu começar a te acompanhar.'];
  if (!w.planned) return ['Nenhuma atividade agendada nessa semana. Defina dias e horários nas suas rotinas.'];

  const weak = w.perActivity.filter((a) => a.planned >= 2 && a.score < 0.6);
  for (const a of weak.slice(0, 2)) {
    out.push(`${a.activity.emoji} ${a.activity.name} ficou em ${pct(a.score)}. ${tipFor(a.activity)}`);
  }
  const strong = w.perActivity.filter((a) => a.planned >= 3 && a.score >= 0.95);
  if (strong.length) out.push(`Parabéns pela consistência em ${strong.map((s) => `${s.activity.emoji} ${s.activity.name}`).join(', ')}. Use esse hábito como "âncora" e encaixe algo novo logo depois dele.`);

  if (w.worstDay && w.bestDay && w.bestDay.score - w.worstDay.score > 0.4) {
    out.push(`Sua ${WEEKDAYS_LONG[w.worstDay.date.getDay()]} foi o dia mais fraco (${pct(w.worstDay.score)}). Que tal deixar esse dia mais leve?`);
  }
  const totalPerDay = w.planned / Math.max(1, w.days.filter((d) => !d.future).length);
  if (totalPerDay > 8 && w.score < 0.6) out.push(`Você tem em média ${totalPerDay.toFixed(0)} atividades por dia. Talvez seja muita coisa — reduza e foque no essencial.`);

  const now = Date.now();
  for (const a of data.activities) {
    if (a.archivedAt || !a.alertHours) continue;
    const last = lastLog(data, a.id);
    if (last && now - last.at > a.alertHours * 3600_000)
      out.push(`${a.emoji} Já faz ${fmtDuration(now - last.at)} desde o último registro de "${a.name}". Fique de olho!`);
  }
  const noReminder = data.activities.filter((a) => !a.archivedAt && a.schedule.kind !== 'free' && !a.time && a.goal === 1 && !a.alertHours);
  if (noReminder.length >= 3) out.push('Várias rotinas estão sem horário. Rotinas com horário definido costumam ser cumpridas com mais frequência.');
  if (!out.length) out.push(w.score >= 0.9 ? 'Semana impecável! Considere adicionar um novo desafio.' : 'Continue registrando tudo — quanto mais dados, melhores as dicas.');
  return out;
}
