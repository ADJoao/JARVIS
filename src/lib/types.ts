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
  /** Primeiro horário no formato HH:MM (opcional). */
  time?: string;
  /** Todos os horários do dia, em ordem (ex.: remédio 06:20, 14:20, 22:20). Inclui `time`. */
  times?: string[];
  /** Quantas vezes por dia conta como "feito" (ex.: 8 copos de água). */
  goal: number;
  unit?: string;
  /** Mostrar alerta se passar X horas sem registrar (ex.: banheiro). */
  alertHours?: number;
  /** Se o alerta de "X horas sem" também vira notificação no celular (padrão: sim). */
  alertNotify?: boolean;
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

export interface SleepEntry {
  id: string;
  /** Quando foi dormir (timestamp). */
  start: number;
  /** Quando acordou (timestamp). */
  end: number;
  /** Como acordou: 1 (péssimo) a 5 (ótimo). */
  quality?: number;
}

/** Movimentação de dinheiro. Valores em centavos (inteiros) para não ter erro de arredondamento. */
export interface MoneyTx {
  id: string;
  /** in = entrada, out = saída, adjust = correção de saldo (não conta como faturamento). */
  type: 'in' | 'out' | 'adjust';
  amount: number;
  note?: string;
  at: number;
}

export interface Finance {
  txs: MoneyTx[];
  /** Meta em centavos (0 = sem meta). */
  goal: number;
  goalName: string;
  /** Prazo opcional da meta (AAAA-MM-DD). */
  goalDeadline?: string;
  /** A meta conta o saldo atual ou o total que entrou desde `goalSince`. */
  goalBasis: 'balance' | 'income';
  goalSince: number;
  /** Como mostrar o progresso da meta. */
  display: 'percent' | 'money' | 'both';
  hideValues: boolean;
  /** Frases motivacionais (sorteadas nas notificações). */
  phrases: string[];
  motivationFreq: 'off' | 'daily' | 'weekly';
  /** 0 = domingo ... 6 = sábado */
  motivationWeekday: number;
  motivationTime: string;
  notifyOnIncome: boolean;
  /** Título da notificação de entrada (ex.: "💸 Venda aprovada!"). */
  incomeTitle: string;
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
  /** Notificações sem nome/ícone da atividade (privacidade). */
  discreet: boolean;
  /** Meta de sono em horas. */
  sleepGoal: number;
  /** Horário em que pretende dormir (HH:MM). */
  bedtime: string;
  bedtimeReminder: boolean;
}

export interface UserData {
  version: 1;
  activities: Activity[];
  logs: LogEntry[];
  chat: ChatMsg[];
  sleep: SleepEntry[];
  /** Se está dormindo agora: desde quando ("Vou dormir" foi tocado). */
  sleepingSince?: number;
  finance: Finance;
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
