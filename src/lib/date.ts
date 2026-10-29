export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Chave local de dia: AAAA-MM-DD (no fuso do aparelho). */
export function dayKey(d: Date | number): string {
  const x = typeof d === 'number' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Semana começando na segunda-feira. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  return addDays(x, -diff);
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function sameDay(a: Date | number, b: Date | number): boolean {
  return dayKey(a) === dayKey(b);
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDayMonth(d: Date): string {
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}

export function fmtLongDate(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "3h 20min", "2 dias e 4h", "15 min" */
export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
  const days = Math.floor(h / 24);
  const rh = h % 24;
  const dl = days === 1 ? '1 dia' : `${days} dias`;
  return rh ? `${dl} e ${rh}h` : dl;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function timeToMinutes(t?: string): number {
  if (!t) return 24 * 60 + 1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 45 → "45 min", 90 → "1h 30min", 120 → "2h". */
export function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}
