import type { Activity, Schedule, Settings } from './types';

export const EMOJI_GROUPS: { name: string; items: string[] }[] = [
  { name: 'Corpo & saúde', items: ['💩', '🚽', '🧻', '💧', '🥤', '💊', '🩺', '😴', '🛌', '🦷', '🚿', '🧴', '🩸', '❤️', '🧠', '🫁'] },
  { name: 'Alimentação', items: ['🍽️', '🥗', '🍎', '🍌', '🥑', '🍳', '🥩', '🍚', '🥛', '☕', '🍵', '🥪', '🍲', '🥕', '🍓', '🥦'] },
  { name: 'Exercício', items: ['🏋️', '🏃', '🚴', '🏊', '🧘', '⚽', '🏀', '🥊', '🤸', '🚶', '🧗', '🎾', '💪', '🔥', '🏆', '⏱️'] },
  { name: 'Estudos & trabalho', items: ['📚', '📖', '✏️', '🧮', '💻', '💼', '📝', '🎓', '🗂️', '📊', '🔬', '🌐', '🗣️', '🎯', '💡', '📅'] },
  { name: 'Casa & rotina', items: ['🧹', '🧺', '🛒', '🪴', '🐶', '🐱', '🛏️', '🗑️', '🧽', '🔑', '🚗', '⛽', '💰', '🧾', '📦', '🛠️'] },
  { name: 'Lazer & mente', items: ['🎮', '🎧', '🎸', '🎨', '📷', '🎬', '🙏', '🌅', '🌙', '⭐', '✨', '😊', '🤝', '📞', '💬', '🎉'] },
];

export const COLORS = [
  '#7cc4ff', // azul
  '#8b7cff', // violeta
  '#ff7ce0', // rosa
  '#ff8a6b', // coral
  '#ffc857', // âmbar
  '#6be3a6', // verde
  '#5fe0e0', // ciano
  '#c7a17a', // marrom
  '#e8e8f0', // gelo
];

export interface Template {
  name: string;
  emoji: string;
  color: string;
  schedule: Schedule;
  time?: string;
  goal: number;
  unit?: string;
  alertHours?: number;
  alertNotify?: boolean;
}

export const TEMPLATES: Template[] = [
  { name: 'Ir ao banheiro', emoji: '💩', color: '#c7a17a', schedule: { kind: 'daily' }, goal: 1, unit: 'vez', alertHours: 24, alertNotify: false },
  { name: 'Beber água', emoji: '💧', color: '#7cc4ff', schedule: { kind: 'daily' }, goal: 8, unit: 'copos', alertHours: 3 },
  { name: 'Refeições', emoji: '🍽️', color: '#ff8a6b', schedule: { kind: 'daily' }, goal: 3, unit: 'refeições', alertHours: 5 },
  { name: 'Estudos', emoji: '📚', color: '#8b7cff', schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5] }, time: '19:00', goal: 1, unit: 'sessão' },
  { name: 'Atividade física', emoji: '🏋️', color: '#6be3a6', schedule: { kind: 'weekdays', days: [1, 3, 5] }, time: '07:00', goal: 1, unit: 'treino' },
  { name: 'Trabalho focado', emoji: '💼', color: '#ffc857', schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5] }, time: '09:00', goal: 1, unit: 'bloco' },
  { name: 'Remédio', emoji: '💊', color: '#ff7ce0', schedule: { kind: 'daily' }, time: '08:00', goal: 1, unit: 'dose' },
  { name: 'Leitura', emoji: '📖', color: '#e8e8f0', schedule: { kind: 'daily' }, time: '21:30', goal: 1, unit: 'capítulo' },
  { name: 'Meditação', emoji: '🧘', color: '#8b7cff', schedule: { kind: 'daily' }, time: '07:30', goal: 1 },
];

export function fromTemplate(t: Template, id: string): Activity {
  return {
    id,
    name: t.name,
    emoji: t.emoji,
    color: t.color,
    schedule: t.schedule,
    time: t.time,
    goal: t.goal,
    unit: t.unit,
    alertHours: t.alertHours,
    alertNotify: t.alertNotify,
    reminder: Boolean(t.time),
    createdAt: Date.now(),
  };
}

export const WALLPAPERS: { id: string; name: string; css: string }[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    css: 'radial-gradient(60% 50% at 15% 10%, #3b5bff88 0%, transparent 60%), radial-gradient(50% 45% at 90% 25%, #ff4fd888 0%, transparent 60%), radial-gradient(60% 50% at 50% 100%, #00d4c888 0%, transparent 65%), #070814',
  },
  {
    id: 'oceano',
    name: 'Oceano',
    css: 'radial-gradient(70% 55% at 20% 0%, #0ea5e999 0%, transparent 60%), radial-gradient(60% 50% at 100% 70%, #2563eb88 0%, transparent 60%), radial-gradient(50% 40% at 0% 100%, #14b8a688 0%, transparent 60%), #050b16',
  },
  {
    id: 'por-do-sol',
    name: 'Pôr do sol',
    css: 'radial-gradient(60% 50% at 80% 5%, #ff7a1899 0%, transparent 60%), radial-gradient(60% 50% at 10% 60%, #e1157288 0%, transparent 60%), radial-gradient(60% 45% at 80% 100%, #7c3aed88 0%, transparent 60%), #120712',
  },
  {
    id: 'floresta',
    name: 'Floresta',
    css: 'radial-gradient(60% 50% at 10% 10%, #22c55e88 0%, transparent 60%), radial-gradient(55% 45% at 100% 50%, #0d948888 0%, transparent 60%), radial-gradient(60% 50% at 40% 100%, #84cc1666 0%, transparent 60%), #06110b',
  },
  {
    id: 'jarvis',
    name: 'Reator',
    css: 'radial-gradient(45% 35% at 50% 30%, #38bdf8aa 0%, transparent 65%), radial-gradient(70% 50% at 50% 110%, #ef444466 0%, transparent 60%), radial-gradient(40% 40% at 0% 0%, #f59e0b55 0%, transparent 60%), #08070d',
  },
  {
    id: 'grafite',
    name: 'Grafite',
    css: 'radial-gradient(60% 50% at 20% 10%, #64748b77 0%, transparent 60%), radial-gradient(60% 50% at 90% 90%, #47556977 0%, transparent 60%), #0a0b0f',
  },
];

export function scheduleLabel(s: Schedule): string {
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  switch (s.kind) {
    case 'daily':
      return 'Todo dia';
    case 'free':
      return 'Sem agenda';
    case 'once': {
      const [y, m, d] = s.date.split('-');
      return `Só em ${d}/${m}/${y}`;
    }
    case 'weekdays': {
      const days = [...s.days].sort();
      if (days.join() === '1,2,3,4,5') return 'Dias úteis';
      if (days.join() === '0,6') return 'Fins de semana';
      if (days.length === 7) return 'Todo dia';
      return days.map((d) => names[d]).join(', ');
    }
  }
}

export const MODEL_OPTIONS: { id: Settings['model']; label: string; hint: string }[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Mais inteligente' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Equilibrado' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Mais rápido e barato' },
];
