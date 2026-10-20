import type { CategoryId, Note, NoteBlock } from './types';
import { uid } from './storage';

type BlockDraft =
  | { type: 'heading'; text: string }
  | { type: 'check'; text: string; done?: boolean }
  | { type: 'text'; text: string }
  | { type: 'grade'; subject: string; need?: number; got?: number; want?: number };

export interface NoteTemplate {
  name: string;
  emoji: string;
  category: CategoryId;
  hint: string;
  blocks: BlockDraft[];
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  { name: 'Em branco', emoji: '📝', category: 'outro', hint: 'Comece do zero', blocks: [{ type: 'check', text: '' }] },
  {
    name: 'Estudo para prova',
    emoji: '📚',
    category: 'estudo',
    hint: 'Matérias e assuntos com quadradinhos',
    blocks: [
      { type: 'heading', text: 'Matemática' },
      { type: 'check', text: 'Estatística' },
      { type: 'check', text: 'Progressão aritmética' },
      { type: 'heading', text: 'Biologia' },
      { type: 'check', text: 'Citologia' },
      { type: 'check', text: 'Genética' },
    ],
  },
  {
    name: 'Lista de tarefas',
    emoji: '✅',
    category: 'trabalho',
    hint: 'Coisas para fazer hoje',
    blocks: [
      { type: 'check', text: 'Primeira tarefa' },
      { type: 'check', text: 'Segunda tarefa' },
    ],
  },
  {
    name: 'Notas do trimestre',
    emoji: '🎓',
    category: 'estudo',
    hint: 'Nota que preciso, que tirei e que quero',
    blocks: [
      { type: 'grade', subject: 'Matemática', need: 6, want: 8 },
      { type: 'grade', subject: 'Português', need: 6, want: 8 },
      { type: 'grade', subject: 'Biologia', need: 6, want: 8 },
    ],
  },
];

export function toBlocks(drafts: BlockDraft[], doneAt = Date.now()): NoteBlock[] {
  return drafts.map((b) => {
    if (b.type === 'check') return { id: uid(), type: 'check', text: b.text, doneAt: b.done ? doneAt : undefined };
    return { id: uid(), ...b } as NoteBlock;
  });
}

export function fromNoteTemplate(t: NoteTemplate): Note {
  const now = Date.now();
  return {
    id: uid(),
    title: t.name === 'Em branco' ? '' : t.name,
    emoji: t.emoji,
    category: t.category,
    blocks: toBlocks(t.blocks),
    createdAt: now,
    updatedAt: now,
  };
}
