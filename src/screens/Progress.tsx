import { useState } from 'react';
import { store, uid, useData } from '../lib/storage';
import { CATEGORIES, checkXp, levelInfo, xpForLevel, xpSummary } from '../lib/game';
import { fmtDayMonth } from '../lib/date';
import { Ring } from '../components/Ring';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { askConfirm } from '../components/Dialog';
import { Report } from './Report';
import type { Redemption, Reward } from '../lib/types';

type View = 'level' | 'shop' | 'report';

export function Progress({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <div className="screen">
      <header className="top">
        <h1>Progresso</h1>
      </header>
      <div className="segmented">
        <button className={view === 'level' ? 'on' : ''} onClick={() => onView('level')}>
          🏅 Nível
        </button>
        <button className={view === 'shop' ? 'on' : ''} onClick={() => onView('shop')}>
          🎁 Loja
        </button>
        <button className={view === 'report' ? 'on' : ''} onClick={() => onView('report')}>
          📊 Relatório
        </button>
      </div>
      {view === 'level' && <LevelView onShop={() => onView('shop')} />}
      {view === 'shop' && <ShopView />}
      {view === 'report' && <Report embedded />}
    </div>
  );
}

function LevelView({ onShop }: { onShop: () => void }) {
  const data = useData();
  const g = data.game;
  const xp = xpSummary(data);
  const lv = levelInfo(xp.total);
  const [editXp, setEditXp] = useState(false);
  const maxCat = Math.max(...Object.values(xp.byCategory), 1);

  return (
    <>
      <section className="glass hero level-hero">
        <Ring value={lv.ratio} size={128} stroke={12} color="var(--accent-2)">
          <span className="tiny muted">nível</span>
          <strong className="ring-value">{lv.level}</strong>
        </Ring>
        <div className="hero-info">
          <p className="level-title">{lv.title}</p>
          <p className="small muted">
            {lv.current} / {lv.needed} XP para o nível {lv.level + 1}
          </p>
          <p className="small muted">{xp.total.toLocaleString('pt-BR')} XP no total</p>
          <button className="pill points-pill" onClick={onShop}>
            ⭐ {xp.points.toLocaleString('pt-BR')} pontos para trocar
          </button>
        </div>
      </section>

      <section className="glass list-card">
        <strong>XP por área</strong>
        {CATEGORIES.map((c) => (
          <div key={c.id} className="act-row">
            <span className="act-row-emoji">{c.emoji}</span>
            <div className="act-row-main">
              <div className="act-row-top">
                <span>{c.name}</span>
                <span className="small muted">{xp.byCategory[c.id].toLocaleString('pt-BR')} XP</span>
              </div>
              <div className="meter">
                <span style={{ width: `${(xp.byCategory[c.id] / maxCat) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="glass list-card">
        <div className="chart-head">
          <strong>Como ganhar XP</strong>
          <button className="btn ghost small-btn" onClick={() => setEditXp(true)}>
            <Icon name="edit" size={14} /> Ajustar
          </button>
        </div>
        <div className="xp-table">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="xp-row">
              <span>
                {c.emoji} {c.name}
                <span className="tiny muted"> · {c.hint}</span>
              </span>
              <strong className="xp-text">+{g.xp[c.id]}</strong>
            </div>
          ))}
          <div className="xp-row">
            <span>
              😴 Noite de sono no ideal<span className="tiny muted"> · 7 a 9h</span>
            </span>
            <strong className="xp-text">+{g.sleepXp}</strong>
          </div>
        </div>
        <p className="tiny muted">
          Atividades: XP do tipo a cada registro (até a meta do dia). Notas: metade do XP do tipo por quadradinho, mais o dobro ao completar tudo ou ao passar
          numa prova. Próximo nível ({lv.level + 1}) em {xpForLevel(lv.level + 1).toLocaleString('pt-BR')} XP.
        </p>
      </section>

      {editXp && <XpSettings onClose={() => setEditXp(false)} />}
    </>
  );
}

function XpSettings({ onClose }: { onClose: () => void }) {
  const g = useData().game;
  const step = (v: number, d: number) => Math.max(0, Math.min(500, v + d));
  return (
    <Sheet title="Pontos por área" onClose={onClose}>
      <p className="small muted">Quanto XP cada conclusão vale. Coisas do dia a dia valem menos; estudo e trabalho valem mais.</p>
      {CATEGORIES.map((c) => (
        <div key={c.id} className="xp-edit-row">
          <span>
            {c.emoji} {c.name}
            <span className="tiny muted d-block">quadradinho de nota: +{checkXp(g, c.id)}</span>
          </span>
          <div className="stepper compact">
            <button onClick={() => store.setGame({ xp: { ...g.xp, [c.id]: step(g.xp[c.id], -5) } })} aria-label={`Menos XP em ${c.name}`}>
              <Icon name="minus" size={16} />
            </button>
            <span>{g.xp[c.id]}</span>
            <button onClick={() => store.setGame({ xp: { ...g.xp, [c.id]: step(g.xp[c.id], 5) } })} aria-label={`Mais XP em ${c.name}`}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      ))}
      <div className="xp-edit-row">
        <span>😴 Noite de sono no ideal</span>
        <div className="stepper compact">
          <button onClick={() => store.setGame({ sleepXp: step(g.sleepXp, -5) })} aria-label="Menos XP de sono">
            <Icon name="minus" size={16} />
          </button>
          <span>{g.sleepXp}</span>
          <button onClick={() => store.setGame({ sleepXp: step(g.sleepXp, 5) })} aria-label="Mais XP de sono">
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
      <p className="tiny muted">Mudar os valores recalcula todo o seu XP, inclusive o que já foi ganho.</p>
    </Sheet>
  );
}

function ShopView() {
  const data = useData();
  const g = data.game;
  const xp = xpSummary(data);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [won, setWon] = useState<Redemption | null>(null);
  const history = [...g.redemptions].sort((a, b) => b.at - a.at).slice(0, 15);

  return (
    <>
      <section className="glass points-card">
        <span className="small muted">Seus pontos</span>
        <strong className="points-value">⭐ {xp.points.toLocaleString('pt-BR')}</strong>
        <span className="tiny muted">
          {xp.total.toLocaleString('pt-BR')} ganhos · {xp.spent.toLocaleString('pt-BR')} já trocados
        </span>
      </section>

      <div className="reward-grid">
        {g.rewards.map((r) => {
          const can = xp.points >= r.cost;
          return (
            <div key={r.id} className={`reward glass ${can ? 'can' : ''}`}>
              <button className="reward-edit icon-btn" onClick={() => setEditing(r)} aria-label={`Editar ${r.name}`}>
                <Icon name="edit" size={14} />
              </button>
              <span className="reward-emoji">{r.emoji}</span>
              <span className="reward-name">{r.name}</span>
              <span className="reward-cost">⭐ {r.cost.toLocaleString('pt-BR')}</span>
              <button
                className={`btn small-btn block ${can ? 'primary' : 'ghost'}`}
                disabled={!can}
                onClick={async () => {
                  if (await askConfirm(`Trocar ${r.cost.toLocaleString('pt-BR')} pontos por "${r.name}"?`, { confirmLabel: 'Trocar' })) setWon(store.redeem(r));
                }}
              >
                {can ? 'Trocar' : `Faltam ${(r.cost - xp.points).toLocaleString('pt-BR')}`}
              </button>
            </div>
          );
        })}
        <button className="reward glass reward-new" onClick={() => setEditing({ id: uid(), name: '', emoji: '🎁', cost: 300, message: '' })}>
          <Icon name="plus" size={26} />
          <span>Nova recompensa</span>
        </button>
      </div>

      {history.length > 0 && (
        <section className="glass list-card">
          <strong>Trocas feitas</strong>
          {history.map((h) => (
            <div key={h.id} className="tx-row">
              <span className="tx-icon adjust">{h.emoji}</span>
              <span className="tx-main">
                <span className="small">{h.name}</span>
                <span className="tiny muted">{fmtDayMonth(new Date(h.at))}</span>
              </span>
              <span className="tx-value neg">− {h.cost.toLocaleString('pt-BR')}</span>
              <button
                className="icon-btn"
                aria-label="Desfazer troca"
                onClick={async () => (await askConfirm('Desfazer essa troca e devolver os pontos?', { confirmLabel: 'Desfazer' })) && store.undoRedeem(h.id)}
              >
                <Icon name="undo" size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      {editing && <RewardEditor reward={editing} onClose={() => setEditing(null)} />}
      {won && (
        <div className="dialog-backdrop" onClick={() => setWon(null)}>
          <div className="dialog glass-strong celebrate" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="celebrate-burst" aria-hidden="true">
              {won.emoji}
            </div>
            <span className="small muted">Recompensa desbloqueada!</span>
            <strong className="celebrate-title">{won.name}</strong>
            <p className="celebrate-phrase">{won.message || 'Aproveite, você mereceu! 🎉'}</p>
            <button className="btn primary block" onClick={() => setWon(null)} autoFocus>
              Valeu! 🎉
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const REWARD_EMOJIS = ['🎁', '🎮', '🕹️', '🍦', '🍕', '🍔', '🍫', '☕', '🎬', '🏖️', '🚶', '🛍️', '👟', '📱', '🎧', '✈️', '🎉', '😴', '🍿', '💆'];

function RewardEditor({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const exists = useData().game.rewards.some((r) => r.id === reward.id);
  const [r, setR] = useState(reward);
  const [costText, setCostText] = useState(String(reward.cost));
  const [error, setError] = useState('');
  return (
    <Sheet title={exists ? 'Editar recompensa' : 'Nova recompensa'} onClose={onClose}>
      <div className="emoji-grid">
        {REWARD_EMOJIS.map((e) => (
          <button key={e} className={`emoji-cell ${r.emoji === e ? 'on' : ''}`} onClick={() => setR({ ...r, emoji: e })}>
            {e}
          </button>
        ))}
      </div>
      <input className="input" placeholder="Nome (ex.: Comprar um jogo)" value={r.name} maxLength={40} onChange={(e) => setR({ ...r, name: e.target.value })} />
      <label className="field-label" htmlFor="reward-cost">
        Custa quantos pontos
      </label>
      <input
        id="reward-cost"
        className="input"
        inputMode="numeric"
        value={costText}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCostText(t);
          if (t) setR({ ...r, cost: Number(t) });
        }}
      />
      <p className="tiny muted">Referência: um dia bem cumprido costuma render 100 a 200 XP.</p>
      <label className="field-label" htmlFor="reward-msg">
        Mensagem ao trocar
      </label>
      <textarea
        id="reward-msg"
        className="input"
        rows={2}
        placeholder="Ex.: Você está liberado para comprar aquele jogo! 🎮"
        value={r.message}
        maxLength={140}
        onChange={(e) => setR({ ...r, message: e.target.value })}
      />
      {error && <p className="error">{error}</p>}
      <button
        className="btn primary block"
        onClick={() => {
          if (!r.name.trim()) return setError('Dê um nome para a recompensa.');
          if (!costText || r.cost < 1) return setError('Coloque quantos pontos ela custa.');
          store.saveReward({ ...r, name: r.name.trim() });
          onClose();
        }}
      >
        <Icon name="check" size={18} /> Salvar
      </button>
      {exists && (
        <button
          className="btn danger block"
          onClick={async () => {
            if (await askConfirm(`Excluir a recompensa "${r.name}"?`, { confirmLabel: 'Excluir', danger: true })) {
              store.deleteReward(r.id);
              onClose();
            }
          }}
        >
          <Icon name="trash" size={18} /> Excluir
        </button>
      )}
    </Sheet>
  );
}
