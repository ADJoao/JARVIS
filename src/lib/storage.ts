import { useSyncExternalStore } from 'react';
import type { Activity, Finance, Game, LogEntry, MoneyTx, Note, Reward, Settings, SleepEntry, UserData } from './types';
import { DEFAULT_GAME } from './game';
import { DEFAULT_FINANCE, balance } from './finance';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const DEFAULT_SETTINGS: Settings = {
  wallpaper: 'aurora',
  aiEnabled: false,
  apiKey: '',
  model: 'claude-opus-5-5',
  notifications: true,
  voiceReplies: false,
  discreet: false,
  sleepGoal: 8,
  bedtime: '23:00',
  bedtimeReminder: false,
};

const emptyData = (): UserData => ({
  version: 1,
  activities: [],
  logs: [],
  chat: [],
  sleep: [],
  finance: DEFAULT_FINANCE(),
  notes: [],
  game: DEFAULT_GAME(),
  settings: { ...DEFAULT_SETTINGS },
});

/** Completa dados antigos/backup com os campos novos. */
function migrate(parsed: Partial<UserData>): UserData {
  const base = emptyData();
  return {
    ...base,
    ...parsed,
    finance: { ...DEFAULT_FINANCE(), ...parsed.finance },
    notes: parsed.notes ?? [],
    game: { ...DEFAULT_GAME(), ...parsed.game, xp: { ...DEFAULT_GAME().xp, ...parsed.game?.xp } },
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
  } as UserData;
}

const dataKey = (userId: string) => `jarvis.data.${userId}`;

/**
 * Armazenamento simples por usuário. Cada conta tem seus próprios dados,
 * guardados somente neste aparelho.
 */
class Store {
  private userId: string | null = null;
  private data: UserData = emptyData();
  private listeners = new Set<() => void>();

  load(userId: string) {
    this.userId = userId;
    try {
      const raw = localStorage.getItem(dataKey(userId));
      const parsed = raw ? (JSON.parse(raw) as UserData) : emptyData();
      this.data = migrate(parsed);
    } catch {
      this.data = emptyData();
    }
    this.emit();
  }

  unload() {
    this.userId = null;
    this.data = emptyData();
    this.emit();
  }

  get = () => this.data;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  update(fn: (d: UserData) => UserData) {
    this.data = fn(this.data);
    try {
      if (this.userId) localStorage.setItem(dataKey(this.userId), JSON.stringify(this.data));
    } catch (e) {
      console.warn('Não foi possível salvar os dados', e);
    }
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  // ---- atalhos ----
  saveActivity(a: Activity) {
    this.update((d) => {
      const exists = d.activities.some((x) => x.id === a.id);
      return {
        ...d,
        activities: exists ? d.activities.map((x) => (x.id === a.id ? a : x)) : [...d.activities, a],
      };
    });
  }

  archiveActivity(id: string) {
    this.update((d) => ({
      ...d,
      activities: d.activities.map((a) => (a.id === id ? { ...a, archivedAt: Date.now() } : a)),
    }));
  }

  restoreActivity(id: string) {
    this.update((d) => ({
      ...d,
      activities: d.activities.map((a) => (a.id === id ? { ...a, archivedAt: undefined } : a)),
    }));
  }

  deleteActivity(id: string) {
    this.update((d) => ({
      ...d,
      activities: d.activities.filter((a) => a.id !== id),
      logs: d.logs.filter((l) => l.activityId !== id),
    }));
  }

  addLog(activityId: string, at = Date.now()): LogEntry {
    const log = { id: uid(), activityId, at };
    this.update((d) => ({ ...d, logs: [...d.logs, log] }));
    return log;
  }

  removeLog(id: string) {
    this.update((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }));
  }

  // ---- sono ----
  startSleep(at = Date.now()) {
    this.update((d) => ({ ...d, sleepingSince: at }));
  }

  cancelSleep() {
    this.update((d) => ({ ...d, sleepingSince: undefined }));
  }

  /** Registra uma noite de sono (e encerra o "Vou dormir" em andamento). */
  addSleep(start: number, end: number, quality?: number): SleepEntry | undefined {
    if (end <= start || end - start > 20 * 3600_000) return undefined;
    if (this.data.sleep.some((s) => start < s.end && end > s.start)) return undefined; // sobreposição
    const entry = { id: uid(), start, end, quality };
    this.update((d) => ({
      ...d,
      sleepingSince: undefined,
      sleep: [...d.sleep, entry].sort((a, b) => a.start - b.start),
    }));
    return entry;
  }

  updateSleep(id: string, patch: Partial<SleepEntry>) {
    this.update((d) => ({ ...d, sleep: d.sleep.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  removeSleep(id: string) {
    this.update((d) => ({ ...d, sleep: d.sleep.filter((s) => s.id !== id) }));
  }

  // ---- finanças ----
  addTx(type: MoneyTx['type'], amount: number, note?: string, at = Date.now()): MoneyTx {
    const tx = { id: uid(), type, amount, note: note?.trim() || undefined, at };
    this.update((d) => ({ ...d, finance: { ...d.finance, txs: [...d.finance.txs, tx] } }));
    return tx;
  }

  /** Corrige o saldo para um valor exato (gera uma "correção" que não conta como faturamento). */
  setBalance(cents: number) {
    const diff = cents - balance(this.data.finance);
    if (diff) this.addTx('adjust', diff, 'Saldo ajustado');
  }

  removeTx(id: string) {
    this.update((d) => ({ ...d, finance: { ...d.finance, txs: d.finance.txs.filter((t) => t.id !== id) } }));
  }

  setFinance(patch: Partial<Finance>) {
    this.update((d) => ({ ...d, finance: { ...d.finance, ...patch } }));
  }

  // ---- notas ----
  saveNote(n: Note) {
    const note = { ...n, updatedAt: Date.now() };
    this.update((d) => ({
      ...d,
      notes: d.notes.some((x) => x.id === n.id) ? d.notes.map((x) => (x.id === n.id ? note : x)) : [note, ...d.notes],
    }));
  }

  deleteNote(id: string) {
    this.update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
  }

  // ---- pontos e lojinha ----
  setGame(patch: Partial<Game>) {
    this.update((d) => ({ ...d, game: { ...d.game, ...patch } }));
  }

  saveReward(r: Reward) {
    this.update((d) => ({
      ...d,
      game: {
        ...d.game,
        rewards: d.game.rewards.some((x) => x.id === r.id) ? d.game.rewards.map((x) => (x.id === r.id ? r : x)) : [...d.game.rewards, r],
      },
    }));
  }

  deleteReward(id: string) {
    this.update((d) => ({ ...d, game: { ...d.game, rewards: d.game.rewards.filter((r) => r.id !== id) } }));
  }

  redeem(r: Reward) {
    const red = { id: uid(), rewardId: r.id, name: r.name, emoji: r.emoji, cost: r.cost, message: r.message, at: Date.now() };
    this.update((d) => ({ ...d, game: { ...d.game, redemptions: [...d.game.redemptions, red] } }));
    return red;
  }

  undoRedeem(id: string) {
    this.update((d) => ({ ...d, game: { ...d.game, redemptions: d.game.redemptions.filter((r) => r.id !== id) } }));
  }

  setSettings(patch: Partial<Settings>) {
    this.update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importJson(json: string) {
    const parsed = JSON.parse(json) as UserData;
    if (!Array.isArray(parsed.activities) || !Array.isArray(parsed.logs))
      throw new Error('Arquivo de backup inválido.');
    this.update(() => migrate(parsed));
  }
}

export const store = new Store();

export function useData(): UserData {
  return useSyncExternalStore(store.subscribe, store.get);
}
