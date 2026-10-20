export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 0 = domingo ... 6 = sábado
  | { kind: 'once'; date: string } // AAAA-MM-DD
  | { kind: 'free' }; // sem agenda: só registro (ex.: "quanto tempo sem...")

export interface Activity {
  id: string;
  name: string;
  emoji: string;
  color: string;
  schedule: Schedule;
  /** Horário no formato HH:MM (opcional). */
  time?: string;
  /** Quantas vezes por dia conta como "feito" (ex.: 8 copos de água). */
  goal: number;
  unit?: string;
  /** Avisar se passar X horas sem registrar (ex.: banheiro). */
  alertHours?: number;
  reminder: boolean;
  notes?: string;
  createdAt: number;
  archivedAt?: number;
}

export interface LogEntry {
  id: string;
  activityId: string;
  at: number;
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  source?: 'local' | 'ai';
}

export type AiModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';

export interface Settings {
  wallpaper: string;
  aiEnabled: boolean;
  apiKey: string;
  model: AiModel;
  notifications: boolean;
}

export interface UserData {
  version: 1;
  activities: Activity[];
  logs: LogEntry[];
  chat: ChatMsg[];
  settings: Settings;
}

export interface UserAccount {
  id: string;
  name: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: number;
}
