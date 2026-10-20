import { useRef, useState } from 'react';
import { store, useData } from '../lib/storage';
import { MODEL_OPTIONS, WALLPAPERS } from '../lib/catalog';
import { changePassword, deleteAccount } from '../lib/auth';
import { ensurePermission, isNative } from '../lib/notify';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
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
        <Icon name="bell" size={16} /> Lembretes
      </h3>
      <div className="toggle-row">
        <div>
          <strong>Notificações</strong>
          <p className="muted small">{isNative() ? 'Lembretes nos horários e alertas de "tempo sem fazer".' : 'Funcionam no app Android instalado (APK).'}</p>
        </div>
        <button
          className={`switch ${s.notifications ? 'on' : ''}`}
          aria-label="Notificações"
          onClick={async () => {
            const next = !s.notifications;
            if (next && isNative() && !(await ensurePermission())) return flash('Permissão de notificação negada nas configurações do Android.');
            store.setSettings({ notifications: next });
          }}
        />
      </div>

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
            if (!confirm('Importar vai substituir os dados atuais desta conta. Continuar?')) return;
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
        onClick={() => {
          if (confirm('Excluir sua conta e TODOS os dados deste aparelho? Isso não pode ser desfeito.')) {
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
