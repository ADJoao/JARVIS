import { useRef, useState } from 'react';
import { store, useData } from '../lib/storage';
import { MODEL_OPTIONS, WALLPAPERS } from '../lib/catalog';
import { changePassword, deleteAccount } from '../lib/auth';
import { ensurePermission, isNative } from '../lib/notify';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { askConfirm } from '../components/Dialog';
import { fmtHours } from '../lib/sleep';
import { timesOf } from '../lib/times';
import type { UserAccount } from '../lib/types';

interface Props {
  user: UserAccount;
  onClose: () => void;
  onLogout: () => void;
}

async function download(name: string, text: string) {
  if (isNative()) {
    // No app Android: salva no cache e abre o menu de compartilhar (Drive, WhatsApp, e-mail…)
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Backup do JARVIS', files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Settings({ user, onClose, onLogout }: Props) {
  const data = useData();
  const s = data.settings;
  const [key, setKey] = useState(s.apiKey);
  const [msg, setMsg] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const activeActs = data.activities.filter((a) => !a.archivedAt);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="profile glass">
        <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{user.name}</strong>
          <p className="tiny muted">
            {data.activities.length} atividades · {data.logs.length} registros
          </p>
        </div>
      </div>

      {msg && <p className="flash">{msg}</p>}

      <h3 className="section-title">
        <Icon name="palette" size={16} /> Papel de parede
      </h3>
      <div className="wallpapers">
        {WALLPAPERS.map((w) => (
          <button key={w.id} className={`wallpaper ${s.wallpaper === w.id ? 'on' : ''}`} style={{ background: w.css }} onClick={() => store.setSettings({ wallpaper: w.id })}>
            <span>{w.name}</span>
          </button>
        ))}
      </div>

      <h3 className="section-title">
        <Icon name="bell" size={16} /> Notificações
      </h3>
      <div className="toggle-row">
        <div>
          <strong>Receber notificações</strong>
          <p className="muted small">{isNative() ? 'Chave geral: desligue para silenciar todas.' : 'Funcionam no app Android instalado (APK).'}</p>
        </div>
        <button
          className={`switch ${s.notifications ? 'on' : ''}`}
          aria-label="Receber notificações"
          onClick={async () => {
            const next = !s.notifications;
            if (next && isNative() && !(await ensurePermission())) return flash('Permissão de notificação negada nas configurações do Android.');
            store.setSettings({ notifications: next });
          }}
        />
      </div>
      {s.notifications && (
        <>
          <div className="toggle-row">
            <div>
              <strong>Modo discreto</strong>
              <p className="muted small">A notificação mostra só "JARVIS: você tem um lembrete", sem dizer qual atividade é.</p>
            </div>
            <button className={`switch ${s.discreet ? 'on' : ''}`} aria-label="Modo discreto" onClick={() => store.setSettings({ discreet: !s.discreet })} />
          </div>

          <p className="field-label">Escolha quais notificações receber</p>
          <div className="notif-list glass">
            <div className="notif-row">
              <span className="notif-emoji">😴</span>
              <span className="notif-name">Hora de dormir ({s.bedtime})</span>
              <button className={`mini-toggle ${s.bedtimeReminder ? 'on' : ''}`} onClick={() => store.setSettings({ bedtimeReminder: !s.bedtimeReminder })}>
                {s.bedtimeReminder ? 'Ligada' : 'Desligada'}
              </button>
            </div>
            {activeActs.map((a) => (
              <div key={a.id} className="notif-row">
                <span className="notif-emoji">{a.emoji}</span>
                <span className="notif-name">{a.name}</span>
                <div className="notif-toggles">
                  {timesOf(a).length > 0 && (
                    <button
                      className={`mini-toggle ${a.reminder ? 'on' : ''}`}
                      title="Lembrete no horário"
                      onClick={() => store.saveActivity({ ...a, reminder: !a.reminder })}
                    >
                      ⏰ {timesOf(a).length > 1 ? `${timesOf(a).length}x/dia` : a.time}
                    </button>
                  )}
                  {a.alertHours !== undefined && (
                    <button
                      className={`mini-toggle ${a.alertNotify !== false ? 'on' : ''}`}
                      title={`Alerta de ${a.alertHours}h sem registrar`}
                      onClick={() => store.saveActivity({ ...a, alertNotify: a.alertNotify === false })}
                    >
                      ⚠️ {a.alertHours}h sem
                    </button>
                  )}
                  {!timesOf(a).length && a.alertHours === undefined && <span className="tiny muted">sem notificação</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="tiny muted">Destacado = ligada. Toque para ligar ou desligar. ⏰ é o lembrete no horário; ⚠️ é o aviso de "tempo sem fazer".</p>
        </>
      )}

      <h3 className="section-title">
        <span aria-hidden="true">🌙</span> Sono
      </h3>
      <div className="row-2">
        <div>
          <label className="field-label">Meta por noite</label>
          <div className="stepper">
            <button onClick={() => store.setSettings({ sleepGoal: Math.max(5, s.sleepGoal - 0.5) })} aria-label="Menos">
              <Icon name="minus" size={18} />
            </button>
            <span>{fmtHours(s.sleepGoal)}</span>
            <button onClick={() => store.setSettings({ sleepGoal: Math.min(12, s.sleepGoal + 0.5) })} aria-label="Mais">
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>
        <div>
          <label className="field-label">Hora de dormir</label>
          <input type="time" className="input" value={s.bedtime} onChange={(e) => e.target.value && store.setSettings({ bedtime: e.target.value })} />
        </div>
      </div>
      <p className="tiny muted">O recomendado para adultos é de 7 a 9 horas por noite.</p>

      <h3 className="section-title">
        <Icon name="sparkles" size={16} /> Assistente com IA (opcional)
      </h3>
      <p className="muted small">
        O JARVIS já responde perguntas comuns de graça e sem internet. Para conversar livremente, ative o Claude com sua própria chave de API
        (console.anthropic.com). O uso da API é cobrado pela Anthropic de acordo com o consumo. A chave fica salva só neste aparelho.
      </p>
      <div className="toggle-row">
        <strong>Usar Claude</strong>
        <button className={`switch ${s.aiEnabled ? 'on' : ''}`} aria-label="Usar Claude" onClick={() => store.setSettings({ aiEnabled: !s.aiEnabled })} />
      </div>
      {s.aiEnabled && (
        <>
          <label className="input-icon">
            <Icon name="key" size={18} />
            <input className="input" type="password" placeholder="sk-ant-..." value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </label>
          <div className="segmented vertical">
            {MODEL_OPTIONS.map((m) => (
              <button key={m.id} className={s.model === m.id ? 'on' : ''} onClick={() => store.setSettings({ model: m.id })}>
                <span>{m.label}</span>
                <span className="tiny muted">{m.hint}</span>
              </button>
            ))}
          </div>
          <button
            className="btn block"
            onClick={() => {
              store.setSettings({ apiKey: key.trim() });
              flash('Chave salva ✓');
            }}
          >
            Salvar chave
          </button>
        </>
      )}

      <h3 className="section-title">
        <Icon name="download" size={16} /> Backup
      </h3>
      <div className="row-2">
        <button className="btn" onClick={() => download(`jarvis-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson()).catch(() => flash('Não foi possível exportar.'))}>
          <Icon name="download" size={18} /> Exportar
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={18} /> Importar
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (!(await askConfirm('Importar vai substituir os dados atuais desta conta. Continuar?', { confirmLabel: 'Importar' }))) return;
            store.importJson(await f.text());
            flash('Backup importado ✓');
          } catch (err) {
            flash(err instanceof Error ? err.message : 'Falha ao importar.');
          } finally {
            e.target.value = '';
          }
        }}
      />

      <h3 className="section-title">
        <Icon name="lock" size={16} /> Conta
      </h3>
      <input className="input" type="password" placeholder="Senha atual" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
      <input className="input" type="password" placeholder="Nova senha" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
      <button
        className="btn block"
        disabled={!pw.cur || !pw.next}
        onClick={async () => {
          try {
            await changePassword(user.id, pw.cur, pw.next);
            setPw({ cur: '', next: '' });
            flash('Senha alterada ✓');
          } catch (err) {
            flash(err instanceof Error ? err.message : 'Erro');
          }
        }}
      >
        Trocar senha
      </button>

      <button className="btn ghost block" onClick={onLogout}>
        <Icon name="logout" size={18} /> Sair da conta
      </button>
      <button
        className="btn danger block"
        onClick={async () => {
          if (await askConfirm('Excluir sua conta e TODOS os dados deste aparelho? Isso não pode ser desfeito.', { confirmLabel: 'Excluir conta', danger: true })) {
            deleteAccount(user.id);
            onLogout();
          }
        }}
      >
        <Icon name="trash" size={18} /> Excluir conta
      </button>
      <p className="tiny muted center">JARVIS v1.0 · feito sob medida</p>
    </Sheet>
  );
}
