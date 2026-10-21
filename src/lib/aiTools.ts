import type Anthropic from '@anthropic-ai/sdk';
import type { CategoryId, NoteBlock } from './types';
import { store, uid } from './storage';
import { matchActivity, norm } from './assistant';
import { balance, money } from './finance';
import { notifyIncome } from './notify';
import { CATEGORIES } from './game';
import { dayStats } from './stats';
import { evaluateSleep, fmtHours, hoursOf } from './sleep';
import { COLORS } from './catalog';

/** Ferramentas que o Claude pode usar para agir dentro do app (como o JARVIS do Tony Stark). */
export const AI_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'registrar_atividade',
    description:
      'Registra que o usuário fez uma atividade da rotina dele (ex.: bebeu água, foi ao banheiro, tomou o remédio, treinou, estudou). Use só quando o usuário disser que FEZ a atividade.',
    input_schema: {
      type: 'object',
      properties: {
        atividade: { type: 'string', description: 'Nome ou descrição da atividade, ex.: "beber água", "remédio"' },
        quantidade: { type: 'integer', description: 'Quantas vezes registrar (ex.: 2 copos de água). Padrão 1.' },
      },
      required: ['atividade'],
    },
  },
  {
    name: 'registrar_dinheiro',
    description:
      'Registra uma entrada (dinheiro que o usuário RECEBEU) ou saída (dinheiro que GASTOU/PAGOU) no painel de Finanças. Não use para valores apenas planejados ou esperados.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['entrada', 'saida'] },
        valor: { type: 'number', description: 'Valor em reais, ex.: 150.5' },
        descricao: { type: 'string', description: 'Descrição curta, ex.: "Venda do site", "Mercado"' },
      },
      required: ['tipo', 'valor'],
    },
  },
  {
    name: 'nota_tarefa',
    description:
      'Adiciona uma tarefa com quadradinho numa nota (cria a nota se não existir) ou marca uma tarefa como concluída. Útil para listas de estudo e de afazeres.',
    input_schema: {
      type: 'object',
      properties: {
        acao: { type: 'string', enum: ['adicionar', 'concluir'] },
        nota: { type: 'string', description: 'Título da nota, ex.: "Simulado ENEM"' },
        tarefa: { type: 'string', description: 'Texto da tarefa, ex.: "Estatística"' },
      },
      required: ['acao', 'nota', 'tarefa'],
    },
  },
  {
    name: 'sono',
    description: 'Marca que o usuário foi dormir agora ("dormir") ou que acabou de acordar ("acordar").',
    input_schema: { type: 'object', properties: { acao: { type: 'string', enum: ['dormir', 'acordar'] } }, required: ['acao'] },
  },
  {
    name: 'criar_atividade',
    description: 'Cria uma nova atividade diária na rotina do usuário, quando ele pedir (ex.: "me lembra de tomar vitamina às 8h").',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        emoji: { type: 'string', description: 'Um emoji que represente a atividade' },
        horarios: { type: 'array', items: { type: 'string' }, description: 'Horários no formato HH:MM (opcional)' },
        meta_por_dia: { type: 'integer', description: 'Quantas vezes por dia (padrão 1)' },
        tipo: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
      },
      required: ['nome'],
    },
  },
];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Executa uma ferramenta e devolve { resultado para o Claude, resumo para mostrar no chat }. */
export function runTool(name: string, input: Record<string, unknown>): { result: string; summary?: string; error?: boolean } {
  const data = store.get();
  switch (name) {
    case 'registrar_atividade': {
      const a = matchActivity(data, str(input.atividade));
      if (!a) return { result: `Nenhuma atividade parecida com "${str(input.atividade)}" na rotina. Atividades existentes: ${data.activities.filter((x) => !x.archivedAt).map((x) => x.name).join(', ') || 'nenhuma'}.`, error: true };
      const n = Math.max(1, Math.min(20, Math.round(Number(input.quantidade) || 1)));
      for (let i = 0; i < n; i++) store.addLog(a.id);
      const it = dayStats(store.get(), new Date()).items.find((i) => i.activity.id === a.id);
      return {
        result: `Registrado ${n}x "${a.name}". Progresso de hoje: ${it?.count ?? n}/${a.goal}.`,
        summary: `${a.emoji} ${a.name}${n > 1 ? ` ×${n}` : ''} registrado`,
      };
    }
    case 'registrar_dinheiro': {
      const cents = Math.round(Number(input.valor) * 100);
      if (!Number.isFinite(cents) || cents <= 0) return { result: 'Valor inválido.', error: true };
      const out = input.tipo === 'saida';
      const tx = store.addTx(out ? 'out' : 'in', cents, str(input.descricao) || undefined);
      if (!out) notifyIncome(store.get(), tx);
      return {
        result: `${out ? 'Saída' : 'Entrada'} de ${money(cents)} registrada. Saldo agora: ${money(balance(store.get().finance))}.`,
        summary: `${out ? '💸 Saída' : '💰 Entrada'} ${money(cents)}${tx.note ? ` · ${tx.note}` : ''}`,
      };
    }
    case 'nota_tarefa': {
      const title = str(input.nota);
      const task = str(input.tarefa);
      if (!title || !task) return { result: 'Faltou o nome da nota ou da tarefa.', error: true };
      const notes = store.get().notes;
      let note = notes.find((n) => norm(n.title) === norm(title)) ?? notes.find((n) => norm(n.title).includes(norm(title)) || norm(title).includes(norm(n.title)));
      if (input.acao === 'concluir') {
        if (!note) return { result: `Não encontrei a nota "${title}".`, error: true };
        const b = note.blocks.find((x) => x.type === 'check' && norm(x.text).includes(norm(task))) as Extract<NoteBlock, { type: 'check' }> | undefined;
        if (!b) return { result: `Não encontrei a tarefa "${task}" na nota "${note.title}".`, error: true };
        store.saveNote({ ...note, blocks: note.blocks.map((x) => (x.id === b.id ? { ...b, doneAt: Date.now() } : x)) });
        return { result: `Tarefa "${b.text}" marcada como concluída em "${note.title}".`, summary: `☑️ ${b.text} concluída` };
      }
      if (!note) {
        note = { id: uid(), title, emoji: '📝', category: 'outro' as CategoryId, blocks: [], createdAt: Date.now(), updatedAt: Date.now() };
      }
      store.saveNote({ ...note, blocks: [...note.blocks, { id: uid(), type: 'check', text: task }] });
      return { result: `Tarefa "${task}" adicionada na nota "${note.title}".`, summary: `📝 "${task}" em ${note.title}` };
    }
    case 'sono': {
      if (input.acao === 'dormir') {
        store.startSleep();
        return { result: 'Marcado que o usuário foi dormir agora.', summary: '🌙 Boa noite registrado' };
      }
      const since = store.get().sleepingSince;
      if (!since) return { result: 'Não havia um "vou dormir" marcado; o usuário pode adicionar a noite manualmente no cartão de sono.', error: true };
      const e = store.addSleep(since, Date.now());
      if (!e) {
        store.cancelSleep();
        return { result: 'Não foi possível registrar (mais de 20h ou sobreposição).', error: true };
      }
      const h = hoursOf(e);
      return { result: `Dormiu ${fmtHours(h)}: ${evaluateSleep(h, store.get().settings.sleepGoal).label}.`, summary: `☀️ Sono: ${fmtHours(h)}` };
    }
    case 'criar_atividade': {
      const nome = str(input.nome);
      if (!nome) return { result: 'Faltou o nome.', error: true };
      const times = (Array.isArray(input.horarios) ? input.horarios : []).map(str).filter((t) => /^\d{2}:\d{2}$/.test(t)).sort();
      const cat = CATEGORIES.some((c) => c.id === input.tipo) ? (input.tipo as CategoryId) : undefined;
      store.saveActivity({
        id: uid(),
        name: nome.slice(0, 40),
        emoji: str(input.emoji) || '⭐',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        schedule: { kind: 'daily' },
        time: times[0],
        times: times.length > 1 ? times : undefined,
        goal: Math.max(1, Math.min(50, Math.round(Number(input.meta_por_dia) || times.length || 1))),
        reminder: times.length > 0,
        category: cat,
        createdAt: Date.now(),
      });
      return { result: `Atividade "${nome}" criada${times.length ? ` com lembrete às ${times.join(', ')}` : ''}.`, summary: `✨ Nova rotina: ${nome}` };
    }
  }
  return { result: `Ferramenta desconhecida: ${name}`, error: true };
}
