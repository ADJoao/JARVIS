export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 0 = domingo ... 6 = sábado
  | { kind: 'once'; date: string } // AAAA-MM-DD
  | { kind: 'free' }; // sem agenda: só registro (ex.: "quanto tempo sem...")

/** Tipo (ramo) de uma atividade ou nota; cada tipo vale uma quantidade de XP. */
export type CategoryId = 'cuidado' | 'saude' | 'estudo' | 'trabalho' | 'financas' | 'casa' | 'lazer' | 'outro';

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
  /** Meta do dia: quantas vezes (ex.: 8 copos de água) ou, se goalKind = 'minutes', quantos minutos (ex.: 120 de estudo). */
  goal: number;
  /** "times" (padrão) = meta em vezes; "minutes" = meta em tempo. */
  goalKind?: 'times' | 'minutes';
  unit?: string;
  /** Mostrar alerta se passar X horas sem registrar (ex.: banheiro). */
  alertHours?: number;
  /** Se o alerta de "X horas sem" também vira notificação no celular (padrão: sim). */
  alertNotify?: boolean;
  reminder: boolean;
  /** Tipo da atividade (define quantos pontos vale). Sem tipo = deduzido pelo ícone. */
  category?: CategoryId;
  notes?: string;
  createdAt: number;
  archivedAt?: number;
}

export interface LogEntry {
  id: string;
  activityId: string;
  at: number;
  /** Duração registrada (só em atividades com meta em tempo). */
  minutes?: number;
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

/** Dinheiro previsto para entrar (ex.: "vou vender um site, acima de R$ 1.000"). */
export interface ExpectedIncome {
  id: string;
  name: string;
  /** Valor em centavos (para faixas, o mínimo da faixa). */
  amount: number;
  /** Texto da faixa escolhida, ex.: "acima de R$ 1.000". */
  label?: string;
  createdAt: number;
}

export interface Finance {
  txs: MoneyTx[];
  expected?: ExpectedIncome[];
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

// ---- notas (bloco de notas com quadradinhos) ----
export type NoteBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'check'; text: string; doneAt?: number }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'grade'; subject: string; need?: number; got?: number; want?: number };

export interface Note {
  id: string;
  title: string;
  emoji: string;
  category: CategoryId;
  blocks: NoteBlock[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  /** Lembrete no dia (AAAA-MM-DD) e horário opcional (HH:MM). */
  remindDate?: string;
  remindTime?: string;
}

// ---- pontos, nível e lojinha ----
export interface Reward {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  /** Mensagem ao trocar (ex.: "Você está liberado para comprar um jogo!"). */
  message: string;
}

export interface Redemption {
  id: string;
  rewardId: string;
  name: string;
  emoji: string;
  cost: number;
  message: string;
  at: number;
}

export interface Game {
  /** XP ganho por conclusão, por tipo. */
  xp: Record<CategoryId, number>;
  /** XP por noite de sono no ideal (7–9h). */
  sleepXp: number;
  rewards: Reward[];
  redemptions: Redemption[];
  /** Último nível já comemorado (0 = ainda não inicializado). */
  seenLevel: number;
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  source?: 'local' | 'ai';
  /** O que o assistente fez no app ao responder (ex.: "Registrado: Beber água"). */
  actions?: string[];
  /** Mensagem enviada por voz. */
  voice?: boolean;
}

export type AiModel = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';

export interface Settings {
  wallpaper: string;
  aiEnabled: boolean;
  apiKey: string;
  model: AiModel;
  notifications: boolean;
  /** Esconde o aviso "Ativar a conversa inteligente" no chat. */
  aiBannerHidden?: boolean;
  /** Como o JARVIS chama o usuário (ex.: "me chama de Jão"). */
  nickname?: string;
  /** O JARVIS lê as respostas em voz alta. */
  voiceReplies: boolean;
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
  notes: Note[];
  game: Game;
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
