import { useState, type CSSProperties } from 'react';
import { useData } from '../lib/storage';
import { scheduleLabel } from '../lib/catalog';
import { lastLog } from '../lib/stats';
import { fmtDuration } from '../lib/date';
import { Icon } from '../components/Icon';
import type { Activity } from '../lib/types';

export function Activities({ onEdit }: { onEdit: (a?: Activity) => void }) {
  const data = useData();
  const [showArchived, setShowArchived] = useState(false);
  const active = data.activities.filter((a) => !a.archivedAt);
  const archived = data.activities.filter((a) => a.archivedAt);
  const list = showArchived ? archived : active;

  return (
    <div className="screen">
      <header className="top">
        <div>
          <h1>Rotinas</h1>
          <p className="muted small">{active.length} ativas · toque para editar</p>
        </div>
      </header>

      {archived.length > 0 && (
        <div className="segmented compact">
          <button className={!showArchived ? 'on' : ''} onClick={() => setShowArchived(false)}>
            Ativas
          </button>
          <button className={showArchived ? 'on' : ''} onClick={() => setShowArchived(true)}>
            Arquivadas ({archived.length})
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty glass">
          <div className="empty-emoji">🧩</div>
          <p>Monte sua rotina: água, banheiro, estudos, treino, alimentação… do jeito que você quiser.</p>
          <button className="btn primary" onClick={() => onEdit()}>
            <Icon name="plus" size={18} /> Nova atividade
          </button>
        </div>
      ) : (
        <div className="routine-grid">
          {list.map((a) => {
            const last = lastLog(data, a.id);
            return (
              <button key={a.id} className="routine glass" style={{ '--c': a.color } as CSSProperties} onClick={() => onEdit(a)}>
                <span className="routine-emoji">{a.emoji}</span>
                <span className="routine-name">{a.name}</span>
                <span className="tiny muted">
                  {scheduleLabel(a.schedule)}
                  {a.time ? ` · ${a.time}` : ''}
                </span>
                <span className="tiny muted">
                  Meta: {a.goal} {a.unit ?? (a.goal > 1 ? 'vezes' : 'vez')}/dia
                </span>
                <span className="routine-foot tiny">
                  {a.reminder && a.time && <Icon name="bell" size={12} />}
                  {last ? `há ${fmtDuration(Date.now() - last.at)}` : 'sem registros'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => onEdit()} aria-label="Nova atividade">
        <Icon name="plus" size={28} stroke={2.5} />
      </button>
    </div>
  );
}
