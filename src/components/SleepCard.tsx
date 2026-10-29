import { store, useData } from '../lib/storage';
import { evaluateSleep, fmtHours, hoursOf, lastSleep } from '../lib/sleep';
import { fmtDuration, fmtTime } from '../lib/date';
import { useState } from 'react';
import type { SleepEntry } from '../lib/types';
import { SleepEditor } from './SleepEditor';

interface Props {
  now: number;
  onOpen: (rateId?: string) => void;
}

/** Cartão de sono da tela Hoje: "Vou dormir" / "Acordei" e a avaliação da última noite. */
export function SleepCard({ now, onOpen }: Props) {
  const data = useData();
  const [editor, setEditor] = useState<{ entry?: SleepEntry; start?: number; end?: number; warning?: string } | null>(null);
  const editorView = editor && (
    <SleepEditor
      entry={editor.entry}
      start={editor.start}
      end={editor.end}
      warning={editor.warning}
      onClose={() => setEditor(null)}
      onSaved={(id) => (editor.entry ? undefined : onOpen(id))}
    />
  );
  const since = data.sleepingSince;
  const last = lastSleep(data);
  const goal = data.settings.sleepGoal;

  if (since) {
    return (
      <section className="sleep-card glass sleeping">
        <div className="sleep-main" onClick={() => onOpen()}>
          <span className="sleep-moon">🌙</span>
          <div>
            <strong>Dormindo desde {fmtTime(since)}</strong>
            <p className="small muted">{fmtHours((now - since) / 3600_000)} até agora</p>
          </div>
        </div>
        <button className="link-btn sleep-link" onClick={() => setEditor({ start: since, end: Date.now() })}>
          ✏️ Esqueci de marcar na hora? Ajustar horários
        </button>
        <div className="sleep-actions">
          <button className="btn ghost small-btn" onClick={() => store.cancelSleep()}>
            Cancelar
          </button>
          <button
            className="btn primary small-btn"
            onClick={() => {
              const hours = (Date.now() - since) / 3600_000;
              // muito tempo (ou quase nada): provavelmente esqueceu de marcar na hora, então pede para ajustar
              if (hours > 14 || hours < 0.5 || store.sleepProblem(since, Date.now())) {
                setEditor({
                  start: since,
                  end: Date.now(),
                  warning: `Você marcou "vou dormir" às ${fmtTime(since)}, há ${fmtDuration(Date.now() - since)}. Se esqueceu de marcar na hora, ajuste os horários de quando dormiu e acordou.`,
                });
                return;
              }
              const e = store.addSleep(since, Date.now());
              onOpen(e?.id);
            }}
          >
            ☀️ Acordei
          </button>
        </div>
        {editorView}
      </section>
    );
  }

  const h = last ? hoursOf(last) : 0;
  const v = last ? evaluateSleep(h, goal) : undefined;
  return (
    <section className="sleep-card glass">
      <div className="sleep-main" onClick={() => onOpen()}>
        <span className="sleep-moon">{v ? v.emoji : '😴'}</span>
        <div>
          {last && v ? (
            <>
              <strong>
                Sono: {fmtHours(h)} <span className={`badge small-badge tone-${v.tone}`}>{v.label}</span>
              </strong>
              <p className="small muted">
                Última noite · {fmtTime(last.start)} → {fmtTime(last.end)} · meta {fmtHours(goal)}
              </p>
            </>
          ) : (
            <>
              <strong>Acompanhe seu sono</strong>
              <p className="small muted">Toque em "Vou dormir" ao deitar e "Acordei" ao levantar.</p>
            </>
          )}
        </div>
      </div>
      <div className="sleep-actions">
        <button className="btn ghost small-btn" onClick={() => onOpen()}>
          Ver semana
        </button>
        <button className="btn primary small-btn" onClick={() => store.startSleep()}>
          🌙 Vou dormir
        </button>
      </div>
      <div className="sleep-links">
        <button className="link-btn" onClick={() => setEditor({})}>
          ✏️ Esqueci de marcar: lançar noite
        </button>
        {last && (
          <button className="link-btn" onClick={() => setEditor({ entry: last })}>
            Ajustar última noite
          </button>
        )}
      </div>
      {editorView}
    </section>
  );
}
