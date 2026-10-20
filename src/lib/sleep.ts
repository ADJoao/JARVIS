import type { SleepEntry, UserData } from './types';
import { addDays, dayKey, fmtTime, startOfWeek, weekDays } from './date';

export const hoursOf = (e: SleepEntry) => (e.end - e.start) / 3600_000;

/** "7h 20min" a partir de horas decimais. */
export function fmtHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h ${String(mm).padStart(2, '0')}min` : `${hh}h`;
}

export interface SleepVerdict {
  label: string;
  emoji: string;
  tone: 'good' | 'ok' | 'warn' | 'bad';
  message: string;
}

/**
 * Avaliação da quantidade de sono para adultos.
 * Referência: a recomendação geral para adultos é de 7 a 9 horas por noite.
 */
export function evaluateSleep(hours: number, goal: number): SleepVerdict {
  if (hours < 5)
    return { label: 'Muito pouco', emoji: '🚨', tone: 'bad', message: 'Menos de 5 horas é pouco demais: afeta memória, humor, foco e imunidade. Tente ir para a cama mais cedo hoje.' };
  if (hours < 6)
    return { label: 'Pouco', emoji: '😵', tone: 'bad', message: 'Entre 5 e 6 horas não é suficiente para a maioria dos adultos. Seu corpo vai sentir isso ao longo do dia.' };
  if (hours < 7)
    return { label: 'Abaixo do ideal', emoji: '😐', tone: 'warn', message: 'Quase lá! O recomendado para adultos é de 7 a 9 horas. Mais 30–60 minutos já fazem diferença.' };
  if (hours <= 9)
    return hours >= goal - 0.25
      ? { label: 'Ótimo', emoji: '🌟', tone: 'good', message: 'Sono na medida certa: dentro do recomendado (7–9h) e da sua meta. Continue assim!' }
      : { label: 'Bom', emoji: '😊', tone: 'good', message: `Dentro do recomendado (7–9h), mas um pouco abaixo da sua meta de ${fmtHours(goal)}.` };
  if (hours <= 10)
    return { label: 'Um pouco demais', emoji: '🥱', tone: 'warn', message: 'Acima de 9 horas. Tudo bem de vez em quando, mas se for frequente pode ser sinal de cansaço acumulado.' };
  return { label: 'Demais', emoji: '🛌', tone: 'warn', message: 'Mais de 10 horas de sono. Se acontecer sempre e você continuar cansado, vale conversar com um médico.' };
}

/** Última noite registrada. */
export function lastSleep(data: UserData): SleepEntry | undefined {
  return data.sleep.reduce<SleepEntry | undefined>((m, s) => (!m || s.end > m.end ? s : m), undefined);
}

/** Minutos desde 12:00 (para comparar horários de dormir que cruzam a meia-noite). */
function bedMinutes(ts: number): number {
  const d = new Date(ts);
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 12 * 60 ? m + 12 * 60 : m - 12 * 60;
}

export function avgClock(times: number[]): string | undefined {
  if (!times.length) return undefined;
  const avg = times.reduce((s, t) => s + bedMinutes(t), 0) / times.length;
  const m = Math.round(avg + 12 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface SleepNight {
  date: Date;
  hours: number; // 0 se não registrou
  entries: SleepEntry[];
}

export interface SleepWeek {
  nights: SleepNight[];
  recorded: number;
  avg: number;
  goodNights: number;
  /** Horas que faltaram para bater a meta, somando as noites registradas. */
  debt: number;
  /** Variação do horário de dormir (desvio-padrão, em minutos). */
  bedtimeSpread: number;
  avgBedtime?: string;
  avgWake?: string;
}

/** Noites de uma semana (seg–dom); cada noite conta no dia em que você acordou. */
export function sleepWeek(data: UserData, anyDay: Date): SleepWeek {
  const goal = data.settings.sleepGoal;
  const byDay = new Map<string, SleepEntry[]>();
  for (const s of data.sleep) {
    const k = dayKey(s.end);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const nights = weekDays(startOfWeek(anyDay)).map((date) => {
    const entries = byDay.get(dayKey(date)) ?? [];
    return { date, entries, hours: entries.reduce((s, e) => s + hoursOf(e), 0) };
  });
  const rec = nights.filter((n) => n.hours > 0);
  const mains = rec.map((n) => n.entries.reduce((a, b) => (hoursOf(b) > hoursOf(a) ? b : a)));
  const mins = mains.map((e) => bedMinutes(e.start));
  const mean = mins.reduce((s, m) => s + m, 0) / Math.max(1, mins.length);
  const spread = mins.length > 1 ? Math.sqrt(mins.reduce((s, m) => s + (m - mean) ** 2, 0) / mins.length) : 0;
  return {
    nights,
    recorded: rec.length,
    avg: rec.length ? rec.reduce((s, n) => s + n.hours, 0) / rec.length : 0,
    goodNights: rec.filter((n) => n.hours >= 7 && n.hours <= 9).length,
    debt: rec.reduce((s, n) => s + Math.max(0, goal - n.hours), 0),
    bedtimeSpread: spread,
    avgBedtime: avgClock(mains.map((e) => e.start)),
    avgWake: avgWakeClock(mains),
  };
}

function avgWakeClock(entries: SleepEntry[]): string | undefined {
  if (!entries.length) return undefined;
  const avg = entries.reduce((s, e) => {
    const d = new Date(e.end);
    return s + d.getHours() * 60 + d.getMinutes();
  }, 0) / entries.length;
  const m = Math.round(avg);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Dicas de sono com base na semana. */
export function sleepTips(data: UserData, w: SleepWeek): string[] {
  const goal = data.settings.sleepGoal;
  if (!w.recorded) return ['Registre seu sono tocando em "Vou dormir" antes de deitar e "Acordei" ao levantar — ou adicione a noite manualmente.'];
  const out: string[] = [];
  if (w.avg < 7) out.push(`Sua média foi de ${fmtHours(w.avg)} por noite, abaixo do recomendado (7–9h). Tente antecipar o horário de dormir em 30 minutos por alguns dias.`);
  else if (w.avg > 9.5) out.push(`Sua média foi de ${fmtHours(w.avg)} — acima do recomendado. Se mesmo assim você acorda cansado, vale observar a qualidade do sono.`);
  else out.push(`Média de ${fmtHours(w.avg)} por noite: dentro do recomendado. 👏`);
  if (w.debt >= 3) out.push(`Você ficou devendo ${fmtHours(w.debt)} de sono em relação à sua meta de ${fmtHours(goal)}. Evite compensar só no fim de semana: regularidade ajuda mais.`);
  if (w.bedtimeSpread > 60) out.push(`Seu horário de dormir variou bastante (cerca de ${fmtHours(w.bedtimeSpread / 60)} de diferença). Dormir e acordar sempre no mesmo horário melhora muito a qualidade do sono.`);
  if (w.avgBedtime) {
    const [h] = w.avgBedtime.split(':').map(Number);
    if (h >= 1 && h < 12) out.push(`Você tem dormido em média às ${w.avgBedtime}. Desligar as telas 30–60 min antes ajuda a pegar no sono mais cedo.`);
  }
  const lowQ = data.sleep.filter((s) => s.quality && s.quality <= 2 && Date.now() - s.end < 7 * 86400_000).length;
  if (lowQ >= 2) out.push('Você acordou mal em várias noites. Evite cafeína depois das 16h e refeições pesadas perto de dormir.');
  return out;
}

/** Resumo em texto para o assistente local. */
export function sleepSummaryText(data: UserData): string {
  const goal = data.settings.sleepGoal;
  const now = new Date();
  if (data.sleepingSince) return `Você marcou que foi dormir às ${fmtTime(data.sleepingSince)}. Toque em "Acordei" no cartão de sono quando levantar. 😴`;
  const last = lastSleep(data);
  const w = sleepWeek(data, now);
  const prev = sleepWeek(data, addDays(startOfWeek(now), -7));
  if (!last) return sleepTips(data, w)[0];
  const h = hoursOf(last);
  const v = evaluateSleep(h, goal);
  const lines = [
    `${v.emoji} Na última noite você dormiu **${fmtHours(h)}** (${fmtTime(last.start)} → ${fmtTime(last.end)}): **${v.label}**.`,
    v.message,
  ];
  if (w.recorded)
    lines.push(`\nNesta semana: média de **${fmtHours(w.avg)}** em ${w.recorded} ${w.recorded === 1 ? 'noite' : 'noites'}, ${w.goodNights} dentro do ideal (7–9h).${prev.recorded ? ` Semana passada: ${fmtHours(prev.avg)}.` : ''}`);
  return lines.join('\n');
}
