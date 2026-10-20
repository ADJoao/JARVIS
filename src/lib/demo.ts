import type { Activity, LogEntry, MoneyTx, SleepEntry, UserAccount, UserData } from './types';
import { DEFAULT_FINANCE } from './finance';
import { DEFAULT_GAME } from './game';
import { toBlocks } from './noteTemplates';
import { dayKey } from './date';
import { listUsers, login, register } from './auth';
import { DEFAULT_SETTINGS } from './storage';

export const DEMO_NAME = 'Demonstração';
const DEMO_PASS = 'demo1234';

/** Número "aleatório" fixo a partir de uma semente, para a demo ser sempre parecida. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function demoData(): UserData {
  const now = Date.now();
  const day = 86400_000;
  const created = now - 21 * day;
  const activities: Activity[] = [
    { id: 'd1', name: 'Ir ao banheiro', emoji: '💩', color: '#c7a17a', schedule: { kind: 'daily' }, goal: 1, unit: 'vez', alertHours: 24, alertNotify: false, reminder: false, createdAt: created },
    { id: 'd2', name: 'Beber água', emoji: '💧', color: '#7cc4ff', schedule: { kind: 'daily' }, goal: 8, unit: 'copos', alertHours: 3, reminder: false, createdAt: created },
    { id: 'd3', name: 'Estudos', emoji: '📚', color: '#8b7cff', schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5] }, time: '19:00', goal: 1, unit: 'sessão', reminder: true, createdAt: created },
    { id: 'd4', name: 'Atividade física', emoji: '🏋️', color: '#6be3a6', schedule: { kind: 'weekdays', days: [1, 3, 5] }, time: '07:00', goal: 1, unit: 'treino', reminder: true, createdAt: created },
    { id: 'd5', name: 'Refeições', emoji: '🍽️', color: '#ff8a6b', schedule: { kind: 'daily' }, goal: 3, unit: 'refeições', alertHours: 5, reminder: false, createdAt: created },
    { id: 'd6', name: 'Remédio', emoji: '💊', color: '#ff7ce0', schedule: { kind: 'daily' }, time: '08:00', goal: 1, unit: 'dose', reminder: true, createdAt: created },
  ];
  const logs: LogEntry[] = [];
  const sleep: SleepEntry[] = [];
  let n = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 20; i >= 0; i--) {
    const base = today.getTime() - i * day;
    const dow = new Date(base).getDay();
    const r = (k: number) => rand(i * 17 + k);
    const add = (id: string, hour: number) => {
      const at = base + hour * 3600_000;
      if (at < now) logs.push({ id: `l${n++}`, activityId: id, at });
    };
    if (r(1) < 0.8) add('d1', 8 + r(9) * 3);
    const water = Math.round(4 + r(2) * 5);
    for (let w = 0; w < water; w++) add('d2', 8 + w * 1.6);
    if (dow >= 1 && dow <= 5 && r(3) < 0.7) add('d3', 19.2);
    if ([1, 3, 5].includes(dow) && r(4) < 0.65) add('d4', 7.1);
    const meals = r(5) < 0.7 ? 3 : 2;
    for (let m = 0; m < meals; m++) add('d5', 8 + m * 5);
    if (r(6) < 0.85) add('d6', 8.2);
    // sono: acordou entre 6h e 8h deste dia, depois de 5h30 a 9h dormindo
    const end = base + (6 + r(7) * 2) * 3600_000;
    const hours = 5.5 + r(8) * 3.5;
    if (end < now) sleep.push({ id: `s${i}`, start: end - hours * 3600_000, end, quality: 1 + Math.round(r(10) * 4) });
  }
  // finanças de exemplo: saldo inicial + entradas nos últimos 30 dias
  const txs: MoneyTx[] = [{ id: 'f0', type: 'adjust', amount: 120000, note: 'Saldo ajustado', at: now - 31 * day }];
  const notes = ['Venda produto', 'Serviço freelance', 'Venda online', 'Pix cliente', 'Comissão'];
  for (let i = 30; i >= 0; i--) {
    const r = (k: number) => rand(i * 31 + k);
    const sales = r(1) < 0.25 ? 0 : 1 + Math.floor(r(2) * 3);
    for (let k = 0; k < sales; k++) {
      const at = today.getTime() - i * day + (9 + r(3 + k) * 11) * 3600_000;
      if (at < now) txs.push({ id: `f${i}-${k}`, type: 'in', amount: Math.round((50 + r(4 + k) * 450) * 100), note: notes[Math.floor(r(9 + k) * notes.length)], at });
    }
    if (r(7) < 0.15) txs.push({ id: `o${i}`, type: 'out', amount: Math.round((80 + r(8) * 300) * 100), note: 'Gasto', at: today.getTime() - i * day + 15 * 3600_000 });
  }
  return {
    version: 1,
    activities,
    logs,
    sleep,
    finance: { ...DEFAULT_FINANCE(), txs, goal: 2000000, goalName: 'Meta do mês' },
    notes: [
      {
        id: 'n1',
        title: 'Simulado ENEM',
        emoji: '📚',
        category: 'estudo',
        pinned: true,
        remindDate: dayKey(new Date()),
        createdAt: now - 5 * day,
        updatedAt: now - day,
        blocks: toBlocks(
          [
            { type: 'heading', text: 'Matemática' },
            { type: 'check', text: 'Estatística', done: true },
            { type: 'check', text: 'Progressão aritmética', done: true },
            { type: 'check', text: 'Geometria plana' },
            { type: 'heading', text: 'Biologia' },
            { type: 'check', text: 'Citologia', done: true },
            { type: 'check', text: 'Genética' },
            { type: 'text', text: 'Revisar os exercícios que errei no último simulado.' },
          ],
          now - 2 * day,
        ),
      },
      {
        id: 'n2',
        title: 'Notas do 2º trimestre',
        emoji: '🎓',
        category: 'estudo',
        createdAt: now - 20 * day,
        updatedAt: now - 3 * day,
        blocks: toBlocks([
          { type: 'grade', subject: 'Matemática', need: 6, got: 7.5, want: 8 },
          { type: 'grade', subject: 'Português', need: 6, got: 8.5, want: 8 },
          { type: 'grade', subject: 'Biologia', need: 6, got: 5, want: 8 },
        ]),
      },
      {
        id: 'n3',
        title: 'Estudar tráfego (digital)',
        emoji: '💻',
        category: 'trabalho',
        createdAt: now - 7 * day,
        updatedAt: now - day,
        blocks: toBlocks(
          [
            { type: 'check', text: 'Aula 1 — Fundamentos de tráfego pago', done: true },
            { type: 'check', text: 'Aula 2 — Públicos e segmentação', done: true },
            { type: 'check', text: 'Aula 3 — Criativos que convertem' },
            { type: 'check', text: 'Criar a primeira campanha de teste' },
          ],
          now - day,
        ),
      },
    ],
    game: { ...DEFAULT_GAME(), redemptions: [{ id: 'red1', rewardId: 'r2', name: 'Tomar um sorvete', emoji: '🍦', cost: 200, message: 'Liberado!', at: now - 4 * day }] },
    chat: [],
    settings: { ...DEFAULT_SETTINGS, bedtimeReminder: true },
  };
}

/** Entra na conta de demonstração (cria e preenche na primeira vez). */
export async function enterDemo(): Promise<UserAccount> {
  if (listUsers().some((u) => u.name === DEMO_NAME)) return login(DEMO_NAME, DEMO_PASS);
  const user = await register(DEMO_NAME, DEMO_PASS);
  localStorage.setItem(`jarvis.data.${user.id}`, JSON.stringify(demoData()));
  return user;
}
