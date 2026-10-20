import type { Activity } from './types';

/** Todos os horários de uma atividade (ex.: remédio 06:20, 14:20, 22:20), em ordem. */
export function timesOf(a: Pick<Activity, 'time' | 'times'>): string[] {
  if (a.times?.length) return a.times;
  return a.time ? [a.time] : [];
}

/** "06:20" ou "06:20, 14:20 e 22:20". */
export function timesLabel(a: Pick<Activity, 'time' | 'times'>): string {
  const t = timesOf(a);
  if (t.length <= 1) return t[0] ?? '';
  return `${t.slice(0, -1).join(', ')} e ${t[t.length - 1]}`;
}

/** Ordena, remove repetidos e vazios. */
export function normalizeTimes(times: string[]): string[] {
  return [...new Set(times.filter(Boolean))].sort();
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Horários "a cada X horas" num dia, a partir do primeiro. Ex.: 06:20 a cada 8h → 06:20, 14:20, 22:20. */
export function everyHours(start: string, hours: number): string[] {
  const first = toMin(start);
  const out: string[] = [];
  for (let m = first; m < first + 1440; m += hours * 60) out.push(toTime(m));
  return normalizeTimes(out);
}

/** Próximo horário pendente do dia, dado quantas vezes já foi feito (ex.: 1 dose tomada → 2º horário). */
export function nextTimeFor(a: Pick<Activity, 'time' | 'times'>, doneCount: number): string | undefined {
  const t = timesOf(a);
  return t[doneCount];
}
