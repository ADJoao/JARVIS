import { useState, type FormEvent } from 'react';
import { listUsers, login, register, startSession } from '../lib/auth';
import type { UserAccount } from '../lib/types';
import { Icon } from '../components/Icon';
import { DEMO_NAME, enterDemo } from '../lib/demo';

export function Login({ onLogin }: { onLogin: (u: UserAccount) => void }) {
  const users = listUsers().filter((u) => u.name !== DEMO_NAME);
  const [mode, setMode] = useState<'login' | 'register'>(users.length ? 'login' : 'register');
  const [name, setName] = useState(users.length === 1 ? users[0].name : '');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && pass !== pass2) return setError('As senhas não conferem.');
    setBusy(true);
    try {
      const u = mode === 'login' ? await login(name, pass) : await register(name, pass);
      startSession(u.id, remember);
      onLogin(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <div className="jarvis-orb big" aria-hidden="true" />
        <h1 className="logo">JARVIS</h1>
        <p className="muted">Sua rotina, organizada.</p>
      </div>

      <form className="login-card glass-strong" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')} disabled={!users.length}>
            Entrar
          </button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
            Criar conta
          </button>
        </div>

        {mode === 'login' && users.length > 1 && (
          <div className="chips wrap">
            {users.map((u) => (
              <button type="button" key={u.id} className={`chip ${u.name === name ? 'on' : ''}`} onClick={() => setName(u.name)}>
                <Icon name="user" size={14} /> {u.name}
              </button>
            ))}
          </div>
        )}

        <label className="input-icon">
          <Icon name="user" size={18} />
          <input className="input" placeholder="Usuário" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="input-icon">
          <Icon name="lock" size={18} />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        {mode === 'register' && (
          <label className="input-icon">
            <Icon name="lock" size={18} />
            <input className="input" type="password" placeholder="Repita a senha" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          </label>
        )}

        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Manter conectado neste aparelho</span>
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn primary block" disabled={busy || !name || !pass}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta e entrar'}
        </button>
        <button
          type="button"
          className="btn ghost block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const u = await enterDemo();
              startSession(u.id, false);
              onLogin(u);
            } catch {
              setError('Não foi possível abrir a demonstração.');
            } finally {
              setBusy(false);
            }
          }}
        >
          👀 Ver demonstração com dados de exemplo
        </button>
        <p className="tiny muted center">
          Seus dados ficam salvos somente neste aparelho, separados por conta. A senha é guardada criptografada (hash).
        </p>
      </form>
    </div>
  );
}
