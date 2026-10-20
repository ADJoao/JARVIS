import { useEffect, useRef, useState } from 'react';
import { store, uid, useData } from '../lib/storage';
import { NOTE_TEMPLATES, fromNoteTemplate } from '../lib/noteTemplates';
import { CATEGORIES, bonusXp, categoryOf, checkXp, noteProgress } from '../lib/game';
import { dayKey, fmtDayMonth, fromKey } from '../lib/date';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { askConfirm } from '../components/Dialog';
import type { Note, NoteBlock } from '../lib/types';

const NOTE_EMOJIS = ['📝', '📚', '🎓', '✅', '💻', '💼', '🧮', '🔬', '🌐', '🗣️', '🎯', '💡', '🏋️', '💰', '🛒', '🏠', '✈️', '🎮', '❤️', '⭐'];

export function Notes({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const data = useData();
  const [picking, setPicking] = useState(false);
  const open = openId ? data.notes.find((n) => n.id === openId) : undefined;

  if (open) return <NoteEditor note={open} onBack={() => onOpen(null)} />;

  const notes = [...data.notes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
  const today = dayKey(new Date());

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1>Notas</h1>
          <p className="muted small">Listas com quadradinhos que dão pontos ao marcar</p>
        </div>
      </header>

      {notes.length === 0 ? (
        <div className="empty glass">
          <div className="empty-emoji">📒</div>
          <p>Crie notas para estudar para a prova, listas de tarefas ou acompanhar suas notas do trimestre.</p>
          <button className="btn primary" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} /> Nova nota
          </button>
        </div>
      ) : (
        <div className="stack">
          {notes.map((n) => {
            const { done, total } = noteProgress(n);
            const grades = n.blocks.filter((b) => b.type === 'grade');
            const cat = categoryOf(n.category);
            const complete = total > 0 && done === total;
            return (
              <button key={n.id} className={`note-card glass ${complete ? 'done' : ''}`} onClick={() => onOpen(n.id)}>
                <span className="note-emoji">{n.emoji}</span>
                <span className="note-main">
                  <span className="note-title">
                    {n.pinned && <span aria-label="Fixada">📌 </span>}
                    {n.title || 'Sem título'}
                  </span>
                  <span className="tiny muted">
                    {cat.emoji} {cat.name}
                    {total > 0 && ` · ${done}/${total} concluídos`}
                    {grades.length > 0 && ` · ${grades.length} ${grades.length === 1 ? 'nota' : 'notas'} de prova`}
                    {n.remindDate && ` · ${n.remindDate === today ? '🔔 hoje' : `🔔 ${fmtDayMonth(fromKey(n.remindDate))}`}`}
                  </span>
                  {total > 0 && (
                    <span className="meter note-meter">
                      <span style={{ width: `${(done / total) * 100}%` }} />
                    </span>
                  )}
                </span>
                {complete ? <span className="badge small-badge tone-good">✓</span> : <Icon name="right" size={18} />}
              </button>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => setPicking(true)} aria-label="Nova nota">
        <Icon name="plus" size={28} stroke={2.5} />
      </button>

      {picking && (
        <Sheet title="Nova nota" onClose={() => setPicking(false)}>
          <div className="template-grid">
            {NOTE_TEMPLATES.map((t) => (
              <button
                key={t.name}
                className="template glass note-template"
                onClick={() => {
                  const n = fromNoteTemplate(t);
                  store.saveNote(n);
                  setPicking(false);
                  onOpen(n.id);
                }}
              >
                <span className="template-emoji">{t.emoji}</span>
                <span>
                  <span className="note-template-name">{t.name}</span>
                  <span className="tiny muted">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const data = useData();
  const g = data.game;
  const [focusId, setFocusId] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const save = (patch: Partial<Note>) => store.saveNote({ ...note, ...patch });
  const setBlocks = (blocks: NoteBlock[]) => save({ blocks });
  const updateBlock = (id: string, patch: Partial<NoteBlock>) => setBlocks(note.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as NoteBlock) : b)));
  const removeBlock = (id: string) => setBlocks(note.blocks.filter((b) => b.id !== id));
  const insertAfter = (afterId: string | null, block: NoteBlock) => {
    const i = afterId ? note.blocks.findIndex((b) => b.id === afterId) : note.blocks.length - 1;
    const blocks = [...note.blocks];
    blocks.splice(i + 1, 0, block);
    setBlocks(blocks);
    setFocusId(block.id);
  };
  const add = (type: NoteBlock['type']) => {
    const id = uid();
    const block: NoteBlock =
      type === 'grade' ? { id, type, subject: '', need: 6 } : type === 'check' ? { id, type, text: '' } : { id, type, text: '' };
    insertAfter(null, block);
  };

  const { done, total } = noteProgress(note);
  const cat = note.category;
  const itemXp = checkXp(g, cat);

  return (
    <div className="screen note-editor">
      <header className="top">
        <button className="icon-btn glass" onClick={onBack} aria-label="Voltar para as notas">
          <Icon name="left" />
        </button>
        <div className="row">
          <button className={`icon-btn glass ${note.pinned ? 'active' : ''}`} onClick={() => save({ pinned: !note.pinned })} aria-label={note.pinned ? 'Desafixar' : 'Fixar no topo'}>
            📌
          </button>
          <button
            className="icon-btn glass"
            aria-label="Excluir nota"
            onClick={async () => {
              if (await askConfirm(`Excluir a nota "${note.title || 'Sem título'}"? Os pontos ganhos com ela também saem.`, { confirmLabel: 'Excluir', danger: true })) {
                store.deleteNote(note.id);
                onBack();
              }
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      </header>

      <div className="note-head">
        <button className="note-emoji big" onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Trocar ícone">
          {note.emoji}
        </button>
        <input className="note-title-input" placeholder="Título (ex.: Simulado de sábado)" value={note.title} maxLength={60} onChange={(e) => save({ title: e.target.value })} />
      </div>
      {emojiOpen && (
        <div className="emoji-grid">
          {NOTE_EMOJIS.map((e) => (
            <button key={e} className={`emoji-cell ${note.emoji === e ? 'on' : ''}`} onClick={() => { save({ emoji: e }); setEmojiOpen(false); }}>
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="chips scroll-x">
        {CATEGORIES.filter((c) => c.id !== 'financas').map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => save({ category: c.id })}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {total > 0 && (
        <div className="glass note-progress">
          <div className="chart-head">
            <strong>
              {done} de {total} concluídos
            </strong>
            <span className="small xp-text">+{itemXp} XP por item</span>
          </div>
          <div className="goal-meter">
            <span style={{ width: `${(done / total) * 100}%` }} />
          </div>
          {done === total ? (
            <span className="small">🏆 Tudo concluído! Bônus de +{bonusXp(g, cat)} XP.</span>
          ) : (
            <span className="tiny muted">Complete tudo para ganhar um bônus de +{bonusXp(g, cat)} XP.</span>
          )}
        </div>
      )}

      <div className="blocks">
        {note.blocks.map((b) => (
          <BlockView
            key={b.id}
            block={b}
            autoFocus={focusId === b.id}
            onChange={(patch) => updateBlock(b.id, patch)}
            onRemove={() => removeBlock(b.id)}
            onEnter={() => insertAfter(b.id, { id: uid(), type: 'check', text: '' })}
            bonus={bonusXp(g, cat)}
          />
        ))}
      </div>

      <div className="add-blocks">
        <button className="chip" onClick={() => add('check')}>
          ☑️ Tarefa
        </button>
        <button className="chip" onClick={() => add('heading')}>
          🔠 Seção
        </button>
        <button className="chip" onClick={() => add('text')}>
          📝 Texto
        </button>
        <button className="chip" onClick={() => add('grade')}>
          🎓 Nota de prova
        </button>
      </div>

      <section className="glass list-card">
        <strong>🔔 Lembrar no dia</strong>
        <div className="row-2">
          <input type="date" className="input" value={note.remindDate ?? ''} onChange={(e) => save({ remindDate: e.target.value || undefined })} aria-label="Dia do lembrete" />
          <input type="time" className="input" value={note.remindTime ?? ''} disabled={!note.remindDate} onChange={(e) => save({ remindTime: e.target.value || undefined })} aria-label="Hora do lembrete" />
        </div>
        <p className="tiny muted">
          {note.remindDate
            ? `Aparece na tela Hoje nesse dia${note.remindTime ? ` e notifica às ${note.remindTime}` : ' e notifica às 09:00'}.`
            : 'Opcional: a nota aparece na tela Hoje no dia escolhido.'}
          {note.remindDate && (
            <button className="link-btn" onClick={() => save({ remindDate: undefined, remindTime: undefined })}>
              Remover
            </button>
          )}
        </p>
      </section>
    </div>
  );
}

function BlockView({
  block: b,
  autoFocus,
  onChange,
  onRemove,
  onEnter,
  bonus,
}: {
  block: NoteBlock;
  autoFocus: boolean;
  onChange: (patch: Partial<NoteBlock>) => void;
  onRemove: () => void;
  onEnter: () => void;
  bonus: number;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const remove = (
    <button className="icon-btn nblock-remove" onClick={onRemove} aria-label="Remover">
      <Icon name="x" size={16} />
    </button>
  );

  if (b.type === 'heading')
    return (
      <div className="nblock nblock-heading">
        <input ref={ref} className="heading-input" placeholder="Nome da seção (ex.: Matemática)" value={b.text} onChange={(e) => onChange({ text: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && onEnter()} />
        {remove}
      </div>
    );

  if (b.type === 'text')
    return (
      <div className="nblock nblock-text">
        <textarea ref={ref} className="text-input" rows={2} placeholder="Escreva aqui…" value={b.text} onChange={(e) => onChange({ text: e.target.value })} />
        {remove}
      </div>
    );

  if (b.type === 'check')
    return (
      <div className={`nblock nblock-check ${b.doneAt ? 'done' : ''}`}>
        <button
          className={`checkbox ${b.doneAt ? 'on' : ''}`}
          role="checkbox"
          aria-checked={Boolean(b.doneAt)}
          aria-label={b.text || 'Tarefa'}
          onClick={() => {
            onChange({ doneAt: b.doneAt ? undefined : Date.now() });
            if (!b.doneAt) navigator.vibrate?.(15);
          }}
        >
          {b.doneAt && <Icon name="check" size={16} stroke={3} />}
        </button>
        <input
          ref={ref}
          className="check-input"
          placeholder="Tarefa (ex.: Estatística)"
          value={b.text}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        {remove}
      </div>
    );

  // nota de prova: preciso / tirei / quero
  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.min(1000, Number(v.replace(',', '.')))));
  const show = (n?: number) => (n === undefined || Number.isNaN(n) ? '' : String(n).replace('.', ','));
  const passed = b.got !== undefined && b.need !== undefined && b.got >= b.need;
  const reachedWant = b.got !== undefined && b.want !== undefined && b.got >= b.want;
  return (
    <div className={`nblock nblock-grade glass ${passed ? 'passed' : ''}`}>
      <div className="grade-top">
        <input ref={ref} className="heading-input" placeholder="Matéria (ex.: Matemática)" value={b.subject} onChange={(e) => onChange({ subject: e.target.value })} />
        {remove}
      </div>
      <div className="grade-fields">
        {(
          [
            ['need', 'Preciso'],
            ['got', 'Tirei'],
            ['want', 'Quero'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="grade-field">
            <span className="tiny muted">{label}</span>
            <input
              inputMode="decimal"
              className="input"
              placeholder="—"
              value={show(b[k])}
              onChange={(e) => {
                const v = num(e.target.value.replace(/[^\d.,]/g, ''));
                onChange({ [k]: v !== undefined && Number.isNaN(v) ? undefined : v } as Partial<NoteBlock>);
              }}
            />
          </label>
        ))}
      </div>
      <p className="small grade-status">
        {b.got === undefined
          ? 'Coloque a nota que você tirou quando sair o resultado.'
          : passed
            ? `✅ Aprovado nessa! (+${bonus} XP)${b.want !== undefined ? (reachedWant ? ' 🎯 E bateu a nota que queria!' : ` Faltou ${show(Number(((b.want ?? 0) - b.got).toFixed(2)))} para a nota que queria.`) : ''}`
            : b.need !== undefined
              ? `⚠️ Faltou ${show(Number((b.need - b.got).toFixed(2)))} para a nota que precisava.`
              : 'Defina a nota que você precisa.'}
      </p>
    </div>
  );
}

export const notesForToday = (notes: Note[]) => notes.filter((n) => n.remindDate === dayKey(new Date()));

