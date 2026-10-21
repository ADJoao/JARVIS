import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { currentSession, endSession } from './lib/auth';
import { store, useData } from './lib/storage';
import { WALLPAPERS } from './lib/catalog';
import { rescheduleAll, ensurePermission, isNative } from './lib/notify';
import type { Activity, UserAccount } from './lib/types';
import { Login } from './screens/Login';
import { Today } from './screens/Today';
import { CalendarScreen } from './screens/CalendarScreen';
import { Activities } from './screens/Activities';
import { Notes } from './screens/Notes';
import { Progress } from './screens/Progress';
import { levelInfo, xpSummary } from './lib/game';
import { Finance } from './screens/Finance';
import { Assistant } from './screens/Assistant';
import { Settings } from './screens/Settings';
import { ActivityEditor } from './components/ActivityEditor';
import { SleepSheet } from './components/SleepSheet';
import { LogSheet } from './components/LogSheet';
import { Icon } from './components/Icon';

type Tab = 'today' | 'calendar' | 'routines' | 'notes' | 'assistant' | 'finance' | 'progress';
type ProgressView = 'level' | 'shop' | 'report';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoje', icon: 'home' },
  { id: 'notes', label: 'Notas', icon: 'note' },
  { id: 'assistant', label: 'JARVIS', icon: 'chat' },
  { id: 'finance', label: 'Finanças', icon: 'wallet' },
  { id: 'progress', label: 'Progresso', icon: 'trophy' },
];

/** Telas que ficam "dentro" de Hoje (a aba Hoje continua acesa e o voltar retorna para ela). */
const UNDER_TODAY: Tab[] = ['calendar', 'routines'];

export default function App() {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const u = currentSession();
    if (u) store.load(u.id);
    return u;
  });
  const [tab, setTab] = useState<Tab>('today');
  const [editing, setEditing] = useState<{ activity?: Activity } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState<{ rateId?: string } | null>(null);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [progressView, setProgressView] = useState<ProgressView>('level');
  const [xpToast, setXpToast] = useState<{ amount: number; key: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const data = useData();

  // XP e nível: aviso "+N XP" ao ganhar pontos e comemoração ao subir de nível
  const xpTotal = useMemo(() => (user ? xpSummary(data).total : 0), [user, data]);
  const prevXp = useRef<number | null>(null);
  useEffect(() => {
    if (!user) {
      prevXp.current = null;
      return;
    }
    if (prevXp.current !== null && xpTotal > prevXp.current) {
      setXpToast({ amount: xpTotal - prevXp.current, key: Date.now() });
    }
    prevXp.current = xpTotal;
    const level = levelInfo(xpTotal).level;
    const seen = store.get().game.seenLevel;
    if (!seen) store.setGame({ seenLevel: level });
    else if (level > seen) {
      store.setGame({ seenLevel: level });
      setLevelUp(level);
    } else if (level < seen) store.setGame({ seenLevel: level });
  }, [user, xpTotal]);
  useEffect(() => {
    if (!xpToast) return;
    const t = setTimeout(() => setXpToast(null), 1800);
    return () => clearTimeout(t);
  }, [xpToast]);

  // Papel de parede
  useEffect(() => {
    const wp = WALLPAPERS.find((w) => w.id === data.settings.wallpaper) ?? WALLPAPERS[0];
    document.documentElement.style.setProperty('--wallpaper', wp.css);
  }, [data.settings.wallpaper]);

  // Reagenda lembretes quando as atividades/registros mudam
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => rescheduleAll(store.get()), 800);
    return () => clearTimeout(t);
  }, [user, data.activities, data.logs, data.settings, data.notes, data.finance]);

  // Pede permissão de notificação na primeira vez (app Android)
  useEffect(() => {
    if (user && isNative() && data.settings.notifications) ensurePermission();
  }, [user]);

  // Botão "voltar" do Android: fecha painéis, volta para Hoje, ou sai do app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('backButton', () => {
      if (document.body.classList.contains('no-scroll')) window.dispatchEvent(new Event('jarvis:back'));
      else if (tab === 'notes' && noteOpen) setNoteOpen(null);
      else if (tab !== 'today') setTab('today');
      else CapApp.minimizeApp();
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, [tab, noteOpen]);

  if (!user) {
    return (
      <Login
        onLogin={(u) => {
          store.load(u.id);
          setUser(u);
          setTab('today');
        }}
      />
    );
  }

  const logout = () => {
    endSession();
    store.unload();
    setSettingsOpen(false);
    setUser(null);
  };

  const onEdit = (a?: Activity) => setEditing({ activity: a });
  const openSettings = () => setSettingsOpen(true);

  return (
    <div className="app">
      <main key={tab + (noteOpen ?? '')} className="fade-in">
        {tab === 'today' && (
          <Today
            userName={user.name}
            onEdit={onEdit}
            onSettings={openSettings}
            onSleep={(rateId) => setSleepOpen({ rateId })}
            onLogs={setLogsFor}
            onCalendar={() => setTab('calendar')}
            onFinance={() => setTab('finance')}
            onRoutines={() => setTab('routines')}
            onProgress={() => {
              setProgressView('level');
              setTab('progress');
            }}
            onNote={(id) => {
              setNoteOpen(id);
              setTab('notes');
            }}
          />
        )}
        {tab === 'calendar' && <CalendarScreen onEdit={onEdit} onBack={() => setTab('today')} />}
        {tab === 'routines' && <Activities onEdit={onEdit} onBack={() => setTab('today')} />}
        {tab === 'notes' && <Notes openId={noteOpen} onOpen={setNoteOpen} />}
        {tab === 'progress' && <Progress view={progressView} onView={setProgressView} />}
        {tab === 'finance' && <Finance />}
        {tab === 'assistant' && <Assistant onSettings={openSettings} userName={user.name} />}
      </main>

      <nav className="tabbar glass-strong">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id || (t.id === 'today' && UNDER_TODAY.includes(tab)) ? 'on' : ''} ${t.id === 'assistant' ? 'center' : ''}`}
            onClick={() => {
              if (t.id === 'notes' && tab === 'notes') setNoteOpen(null);
              setTab(t.id);
            }}
          >
            {t.id === 'assistant' ? (
              <span className="tab-orb">
                <Icon name="sparkles" size={22} />
              </span>
            ) : (
              <Icon name={t.icon} size={22} />
            )}
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {editing && <ActivityEditor activity={editing.activity} onClose={() => setEditing(null)} />}
      {logsFor && <LogSheet activityId={logsFor} onClose={() => setLogsFor(null)} />}
      {sleepOpen && <SleepSheet rateId={sleepOpen.rateId} onClose={() => setSleepOpen(null)} />}
      {settingsOpen && <Settings user={user} onClose={() => setSettingsOpen(false)} onLogout={logout} />}

      {xpToast && (
        <div key={xpToast.key} className="xp-toast" role="status">
          ✨ +{xpToast.amount} XP
        </div>
      )}
      {levelUp && (
        <div className="dialog-backdrop" onClick={() => setLevelUp(null)}>
          <div className="dialog glass-strong celebrate" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="celebrate-burst" aria-hidden="true">
              🏅
            </div>
            <span className="small muted">Você subiu de nível!</span>
            <strong className="celebrate-value level-up">Nível {levelUp}</strong>
            <p className="celebrate-phrase">{levelInfo(xpTotal).title} · continue assim! 🔥</p>
            <button
              className="btn primary block"
              onClick={() => {
                setLevelUp(null);
                setProgressView('shop');
                setTab('progress');
              }}
            >
              Ver a loja de recompensas 🎁
            </button>
            <button className="btn ghost block" onClick={() => setLevelUp(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
