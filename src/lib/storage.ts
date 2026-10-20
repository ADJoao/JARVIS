import { useSyncExternalStore } from 'react';
import type { Activity, LogEntry, Settings, SleepEntry, UserData } from './types';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const DEFAULT_SETTINGS: Settings = {
  wallpaper: 'aurora',
  aiEnabled: false,
  apiKey: '',
  model: 'claude-opus-5-5',
  notifications: true,
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
  settings: { ...DEFAULT_SETTINGS },
});

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
      this.data = { ...emptyData(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
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
    this.update(() => ({
      ...emptyData(),
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    }));
  }
}

export const store = new Store();

export function useData(): UserData {
  return useSyncExternalStore(store.subscribe, store.get);
}
