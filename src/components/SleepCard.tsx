import { store, useData } from '../lib/storage';
import { evaluateSleep, fmtHours, hoursOf, lastSleep } from '../lib/sleep';
import { fmtTime } from '../lib/date';

interface Props {
  now: number;
  onOpen: (rateId?: string) => void;
}

/** Cartão de sono da tela Hoje: "Vou dormir" / "Acordei" e a avaliação da última noite. */
export function SleepCard({ now, onOpen }: Props) {
  const data = useData();
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
        <div className="sleep-actions">
          <button className="btn ghost small-btn" onClick={() => store.cancelSleep()}>
            Cancelar
          </button>
          <button
            className="btn primary small-btn"
            onClick={() => {
              const e = store.addSleep(since, Date.now());
              if (!e) {
                alert('Não deu para registrar: esse horário já tem sono registrado ou passou de 20 horas. Ajuste em "Ver semana".');
                store.cancelSleep();
              }
              onOpen(e?.id);
            }}
          >
            ☀️ Acordei
          </button>
        </div>
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
    </section>
  );
}
