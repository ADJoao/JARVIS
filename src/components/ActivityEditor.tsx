import { useState, type CSSProperties } from 'react';
import type { Activity, Schedule } from '../lib/types';
import { COLORS, EMOJI_GROUPS, TEMPLATES, fromTemplate } from '../lib/catalog';
import { dayKey, WEEKDAYS_SHORT } from '../lib/date';
import { store, uid } from '../lib/storage';
import { Sheet } from './Sheet';
import { Icon } from './Icon';

interface Props {
  activity?: Activity;
  onClose: () => void;
}

const blank = (): Activity => ({
  id: uid(),
  name: '',
  emoji: '⭐',
  color: COLORS[0],
  schedule: { kind: 'daily' },
  goal: 1,
  reminder: false,
  createdAt: Date.now(),
});

export function ActivityEditor({ activity, onClose }: Props) {
  const [step, setStep] = useState<'template' | 'form'>(activity ? 'form' : 'template');
  const [a, setA] = useState<Activity>(activity ?? blank());
  const [group, setGroup] = useState(0);
  const [error, setError] = useState('');
  const set = (patch: Partial<Activity>) => setA((x) => ({ ...x, ...patch }));

  const setKind = (kind: Schedule['kind']) => {
    if (kind === 'weekdays') set({ schedule: { kind, days: [1, 2, 3, 4, 5] } });
    else if (kind === 'once') set({ schedule: { kind, date: dayKey(new Date()) } });
    else set({ schedule: { kind } });
  };

  const toggleDay = (d: number) => {
    if (a.schedule.kind !== 'weekdays') return;
    const days = a.schedule.days.includes(d) ? a.schedule.days.filter((x) => x !== d) : [...a.schedule.days, d];
    set({ schedule: { kind: 'weekdays', days } });
  };

  const save = () => {
    if (!a.name.trim()) return setError('Dê um nome para a atividade.');
    if (a.schedule.kind === 'weekdays' && !a.schedule.days.length) return setError('Escolha pelo menos um dia da semana.');
    store.saveActivity({ ...a, name: a.name.trim(), goal: Math.max(1, Math.round(a.goal)), reminder: a.reminder && Boolean(a.time) });
    onClose();
  };

  if (step === 'template') {
    return (
      <Sheet title="Nova atividade" onClose={onClose}>
        <p className="muted small">Comece com um modelo pronto ou crie do zero. Tudo pode ser personalizado depois.</p>
        <div className="template-grid">
          <button className="template glass" onClick={() => setStep('form')}>
            <span className="template-emoji">✨</span>
            <span>Em branco</span>
          </button>
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              className="template glass"
              style={{ '--c': t.color } as CSSProperties}
              onClick={() => {
                setA(fromTemplate(t, a.id));
                setStep('form');
              }}
            >
              <span className="template-emoji">{t.emoji}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  const kind = a.schedule.kind;
  return (
    <Sheet title={activity ? 'Editar atividade' : 'Nova atividade'} onClose={onClose}>
      <div className="editor-preview" style={{ '--c': a.color } as CSSProperties}>
        <div className="big-emoji">{a.emoji}</div>
        <input
          className="input title-input"
          placeholder="Nome (ex.: Beber água)"
          value={a.name}
          maxLength={40}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <label className="field-label">Ícone</label>
      <div className="chips scroll-x">
        {EMOJI_GROUPS.map((g, i) => (
          <button key={g.name} className={`chip ${i === group ? 'on' : ''}`} onClick={() => setGroup(i)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="emoji-grid">
        {EMOJI_GROUPS[group].items.map((e) => (
          <button key={e} className={`emoji-cell ${a.emoji === e ? 'on' : ''}`} onClick={() => set({ emoji: e })}>
            {e}
          </button>
        ))}
      </div>
      <input
        className="input"
        placeholder="…ou cole/digite qualquer emoji aqui"
        maxLength={8}
        onChange={(e) => e.target.value.trim() && set({ emoji: e.target.value.trim() })}
      />

      <label className="field-label">Cor</label>
      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${a.color === c ? 'on' : ''}`}
            style={{ background: c }}
            aria-label={`Cor ${c}`}
            onClick={() => set({ color: c })}
          />
        ))}
      </div>

      <label className="field-label">Quando</label>
      <div className="segmented">
        {(
          [
            ['daily', 'Todo dia'],
            ['weekdays', 'Dias'],
            ['once', 'Uma vez'],
            ['free', 'Livre'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      {a.schedule.kind === 'weekdays' && (
        <div className="weekday-row">
          {WEEKDAYS_SHORT.map((d, i) => (
            <button key={d} className={`day-chip ${(a.schedule as { days: number[] }).days.includes(i) ? 'on' : ''}`} onClick={() => toggleDay(i)}>
              {d[0]}
            </button>
          ))}
        </div>
      )}
      {a.schedule.kind === 'once' && (
        <input
          type="date"
          className="input"
          value={a.schedule.date}
          onChange={(e) => e.target.value && set({ schedule: { kind: 'once', date: e.target.value } })}
        />
      )}
      {kind === 'free' && (
        <p className="muted small">Sem agenda: não entra na contagem de metas, mas você registra quando fizer e vê "quanto tempo faz".</p>
      )}

      {kind !== 'free' && (
        <div className="row-2">
          <div>
            <label className="field-label">Horário</label>
            <div className="input-with-btn">
              <input type="time" className="input" value={a.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} />
              {a.time && (
                <button className="icon-btn" onClick={() => set({ time: undefined, reminder: false })} aria-label="Sem horário">
                  <Icon name="x" size={18} />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="field-label">Meta por dia</label>
            <div className="stepper">
              <button onClick={() => set({ goal: Math.max(1, a.goal - 1) })} aria-label="Menos">
                <Icon name="minus" size={18} />
              </button>
              <span>{a.goal}</span>
              <button onClick={() => set({ goal: Math.min(50, a.goal + 1) })} aria-label="Mais">
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {kind !== 'free' && a.goal > 1 && (
        <input className="input" placeholder="Unidade (ex.: copos, páginas, km)" value={a.unit ?? ''} maxLength={16} onChange={(e) => set({ unit: e.target.value || undefined })} />
      )}

      <div className="toggle-row">
        <div>
          <strong>Lembrete no horário</strong>
          <p className="muted small">{a.time ? `Notifica às ${a.time} (no app instalado).` : 'Defina um horário para ativar.'}</p>
        </div>
        <button className={`switch ${a.reminder && a.time ? 'on' : ''}`} disabled={!a.time} onClick={() => set({ reminder: !a.reminder })} aria-label="Lembrete" />
      </div>

      <div className="toggle-row">
        <div>
          <strong>Alerta "tempo sem fazer"</strong>
          <p className="muted small">Mostra quando passar muitas horas sem registrar (ótimo para banheiro e água).</p>
        </div>
        <button className={`switch ${a.alertHours ? 'on' : ''}`} onClick={() => set({ alertHours: a.alertHours ? undefined : 24 })} aria-label="Alerta" />
      </div>
      {a.alertHours !== undefined && (
        <div className="inline-field">
          <span>Alertar depois de</span>
          <input
            type="number"
            className="input small-input"
            min={1}
            max={240}
            value={a.alertHours}
            onChange={(e) => set({ alertHours: Math.max(1, Math.min(240, Number(e.target.value) || 1)) })}
          />
          <span>horas</span>
        </div>
      )}
      {a.alertHours !== undefined && (
        <div className="toggle-row sub">
          <div>
            <strong>Notificar no celular</strong>
            <p className="muted small">
              {a.alertNotify === false
                ? 'Desligado: o alerta aparece só dentro do app, sem notificação.'
                : 'Ligado: chega uma notificação quando passar do tempo.'}
            </p>
          </div>
          <button className={`switch ${a.alertNotify !== false ? 'on' : ''}`} onClick={() => set({ alertNotify: a.alertNotify === false })} aria-label="Notificar alerta no celular" />
        </div>
      )}

      <label className="field-label">Observações</label>
      <textarea className="input" rows={2} placeholder="Opcional" value={a.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} />

      {error && <p className="error">{error}</p>}

      <button className="btn primary block" onClick={save}>
        <Icon name="check" size={18} /> Salvar
      </button>

      {activity && (
        <div className="row-2 danger-zone">
          {activity.archivedAt ? (
            <button
              className="btn ghost"
              onClick={() => {
                store.restoreActivity(activity.id);
                onClose();
              }}
            >
              <Icon name="undo" size={18} /> Reativar
            </button>
          ) : (
            <button
              className="btn ghost"
              onClick={() => {
                store.archiveActivity(activity.id);
                onClose();
              }}
            >
              <Icon name="archive" size={18} /> Arquivar
            </button>
          )}
          <button
            className="btn danger"
            onClick={() => {
              if (confirm(`Excluir "${activity.name}" e todo o histórico dela?`)) {
                store.deleteActivity(activity.id);
                onClose();
              }
            }}
          >
            <Icon name="trash" size={18} /> Excluir
          </button>
        </div>
      )}
    </Sheet>
  );
}
