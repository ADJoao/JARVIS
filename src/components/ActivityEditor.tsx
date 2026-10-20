import { useState, type CSSProperties } from 'react';
import type { Activity, Schedule } from '../lib/types';
import { COLORS, EMOJI_GROUPS, TEMPLATES, fromTemplate } from '../lib/catalog';
import { dayKey, fmtDuration, fromKey, WEEKDAYS_SHORT } from '../lib/date';
import { lastLog } from '../lib/stats';
import { everyHours, normalizeTimes, timesLabel, timesOf } from '../lib/times';
import { store, uid } from '../lib/storage';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { askConfirm } from './Dialog';

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
  // horários do dia; a meta acompanha a quantidade de horários (dá para ajustar depois)
  const times = timesOf(a);
  const setTimes = (next: string[], tidy = true) => {
    const list = tidy ? normalizeTimes(next) : next;
    setA((x) => {
      const prev = timesOf(x).length;
      const goal = x.goal === prev || x.goal < list.length ? Math.max(1, list.length) : x.goal;
      const turnedOn = !prev && list.length ? { reminder: true } : {};
      return { ...x, ...turnedOn, time: list[0], times: list.length ? list : undefined, goal, reminder: list.length ? (turnedOn.reminder ?? x.reminder) : false };
    });
  };
  const addTime = () => {
    if (!times.length) return setTimes(['08:00']);
    // sugere o próximo horário repetindo o intervalo entre os dois últimos (ou +4h)
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const last = toMin(times[times.length - 1]);
    const step = times.length > 1 ? last - toMin(times[times.length - 2]) : 240;
    const m = (last + step) % 1440;
    setTimes([...times, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`]);
  };

  // rascunho do campo de horas enquanto a pessoa digita (pode ficar vazio); null = mostra o valor salvo
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);
  const hoursText = hoursDraft ?? String(a.alertHours ?? '');
  // ao criar: quando foi a última vez (para o contador "tempo desde" já começar certo)
  const [lastDate, setLastDate] = useState('');
  const [lastTime, setLastTime] = useState('');
  const lastLogged = activity ? lastLog(store.get(), activity.id) : undefined;
  const setHours = (h: number) => {
    setHoursDraft(null);
    set({ alertHours: Math.max(1, Math.min(240, h)) });
  };

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
    let lastAt: number | undefined;
    if (!activity && lastDate) {
      const d = fromKey(lastDate);
      const [h, m] = (lastTime || '12:00').split(':').map(Number);
      d.setHours(h, m, 0, 0);
      if (d.getTime() > Date.now() + 60_000) return setError('A "última vez" não pode ser no futuro.');
      lastAt = d.getTime();
    }
    const finalTimes = normalizeTimes(times);
    store.saveActivity({
      ...a,
      name: a.name.trim(),
      goal: Math.max(1, Math.round(a.goal)),
      time: finalTimes[0],
      times: finalTimes.length > 1 ? finalTimes : undefined,
      reminder: a.reminder && finalTimes.length > 0,
    });
    if (lastAt) store.addLog(a.id, lastAt);
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
        <>
          <label className="field-label">{times.length > 1 ? `Horários (${times.length} por dia)` : 'Horário'}</label>
          <div className="times-list">
            {times.map((t, i) => (
              <div key={i} className="time-item">
                <input
                  type="time"
                  className="input"
                  value={t}
                  aria-label={`Horário ${i + 1}`}
                  onChange={(e) => e.target.value && setTimes(times.map((x, j) => (j === i ? e.target.value : x)), false)}
                  onBlur={() => setTimes(times)}
                />
                <button className="icon-btn" onClick={() => setTimes(times.filter((_, j) => j !== i))} aria-label={`Remover horário ${t}`}>
                  <Icon name="x" size={18} />
                </button>
              </div>
            ))}
            <button className="btn ghost add-time" onClick={addTime}>
              <Icon name="plus" size={18} /> {times.length ? 'Adicionar outro horário' : 'Definir horário'}
            </button>
          </div>
          <div className="repeat-row">
            <span className="small muted">Repetir a cada</span>
            <div className="chips wrap">
              {[4, 6, 8, 12].map((h) => (
                <button
                  key={h}
                  className={`chip ${times.length > 1 && everyHours(times[0], h).join() === times.join() ? 'on' : ''}`}
                  onClick={() => setTimes(everyHours(times[0] ?? '08:00', h))}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
          <p className="tiny muted">
            {times.length > 1
              ? `Começando às ${times[0]}: ${timesLabel({ times })}. Para mudar o começo, troque o primeiro horário e toque de novo no intervalo.`
              : 'Ex.: remédio de 8 em 8 horas: coloque o primeiro horário e toque em "8h".'}
          </p>

          <label className="field-label">Meta por dia</label>
          <div className="stepper">
            <button onClick={() => set({ goal: Math.max(1, a.goal - 1) })} aria-label="Menos">
              <Icon name="minus" size={18} />
            </button>
            <span>
              {a.goal} {a.goal === 1 ? 'vez' : 'vezes'}
            </span>
            <button onClick={() => set({ goal: Math.min(50, a.goal + 1) })} aria-label="Mais">
              <Icon name="plus" size={18} />
            </button>
          </div>
        </>
      )}

      {kind !== 'free' && a.goal > 1 && (
        <input className="input" placeholder="Unidade (ex.: copos, páginas, km)" value={a.unit ?? ''} maxLength={16} onChange={(e) => set({ unit: e.target.value || undefined })} />
      )}

      <div className="toggle-row">
        <div>
          <strong>{times.length > 1 ? 'Lembrete em cada horário' : 'Lembrete no horário'}</strong>
          <p className="muted small">{times.length ? `Notifica às ${timesLabel({ times })}, no app instalado.` : 'Defina um horário para ativar.'}</p>
        </div>
        <button className={`switch ${a.reminder && times.length ? 'on' : ''}`} disabled={!times.length} onClick={() => set({ reminder: !a.reminder })} aria-label="Lembrete" />
      </div>

      <div className="toggle-row">
        <div>
          <strong>Alerta "tempo sem fazer"</strong>
          <p className="muted small">Mostra quando passar muitas horas sem registrar (ótimo para banheiro e água).</p>
        </div>
        <button className={`switch ${a.alertHours ? 'on' : ''}`} onClick={() => set({ alertHours: a.alertHours ? undefined : 24 })} aria-label="Alerta" />
      </div>
      {a.alertHours !== undefined && (
        <>
          <label className="field-label" htmlFor="alert-hours">
            Alertar depois de quantas horas sem registrar
          </label>
          <div className="stepper">
            <button onClick={() => setHours((a.alertHours ?? 1) - 1)} aria-label="Menos uma hora">
              <Icon name="minus" size={18} />
            </button>
            <span className="stepper-field">
              <input
                id="alert-hours"
                inputMode="numeric"
                className="stepper-input"
                value={hoursText}
                onChange={(e) => {
                  const txt = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setHoursDraft(txt);
                  const n = Number(txt);
                  if (txt && n >= 1 && n <= 240) set({ alertHours: n });
                }}
                onBlur={() => {
                  // número grande demais vira 240; vazio volta para o último valor válido
                  if (hoursDraft && Number(hoursDraft) > 240) setHours(240);
                  else setHoursDraft(null);
                }}
              />
              <span className="muted small">horas</span>
            </span>
            <button onClick={() => setHours((a.alertHours ?? 0) + 1)} aria-label="Mais uma hora">
              <Icon name="plus" size={18} />
            </button>
          </div>
          <div className="chips wrap">
            {[2, 3, 4, 5, 6, 8, 12, 24, 48].map((h) => (
              <button key={h} className={`chip ${a.alertHours === h ? 'on' : ''}`} onClick={() => setHours(h)}>
                {h}h
              </button>
            ))}
          </div>
          {hoursText !== String(a.alertHours) && <p className="tiny muted">Use um número de 1 a 240 horas.</p>}
        </>
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

      {(a.alertHours !== undefined || kind === 'free') &&
        (activity ? (
          <p className="tiny muted">
            {lastLogged ? `Último registro: há ${fmtDuration(Date.now() - lastLogged.at)}. ` : 'Sem registros ainda. '}
            Para registrar em outro horário, toque no cartão dela em "Tempo desde o último", na tela Hoje.
          </p>
        ) : (
          <>
            <label className="field-label" htmlFor="last-date">
              Quando foi a última vez? (opcional)
            </label>
            <div className="chips wrap">
              {[
                ['Agora', 0],
                ['Ontem', 1],
                ['Há 2 dias', 2],
                ['Há 3 dias', 3],
              ].map(([label, n]) => {
                const key = dayKey(new Date(Date.now() - (n as number) * 86400_000));
                return (
                  <button
                    key={label}
                    className={`chip ${lastDate === key && (n !== 0 || lastTime) ? 'on' : ''}`}
                    onClick={() => {
                      const d = new Date();
                      setLastDate(key);
                      setLastTime(n === 0 ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : lastTime || '08:00');
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="row-2">
              <input id="last-date" type="date" className="input" value={lastDate} max={dayKey(new Date())} onChange={(e) => setLastDate(e.target.value)} aria-label="Dia da última vez" />
              <input type="time" className="input" value={lastTime} onChange={(e) => setLastTime(e.target.value)} aria-label="Hora da última vez" />
            </div>
            <p className="tiny muted">
              {lastDate ? 'O contador "tempo desde" já começa a partir desse horário.' : 'Se deixar em branco, o contador começa quando você registrar pela primeira vez.'}
            </p>
          </>
        ))}

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
            onClick={async () => {
              if (await askConfirm(`Excluir "${activity.name}" e todo o histórico dela?`, { confirmLabel: 'Excluir', danger: true })) {
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
