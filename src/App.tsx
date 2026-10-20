import { useEffect, useState } from 'react';
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
import { Report } from './screens/Report';
import { Assistant } from './screens/Assistant';
import { Settings } from './screens/Settings';
import { ActivityEditor } from './components/ActivityEditor';
import { SleepSheet } from './components/SleepSheet';
import { LogSheet } from './components/LogSheet';
import { Icon } from './components/Icon';

type Tab = 'today' | 'calendar' | 'routines' | 'report' | 'assistant';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Hoje', icon: 'home' },
  { id: 'calendar', label: 'Agenda', icon: 'calendar' },
  { id: 'assistant', label: 'JARVIS', icon: 'chat' },
  { id: 'routines', label: 'Rotinas', icon: 'list' },
  { id: 'report', label: 'Relatório', icon: 'chart' },
];

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
  const data = useData();

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
  }, [user, data.activities, data.logs, data.settings]);

  // Pede permissão de notificação na primeira vez (app Android)
  useEffect(() => {
    if (user && isNative() && data.settings.notifications) ensurePermission();
  }, [user]);

  // Botão "voltar" do Android: fecha painéis, volta para Hoje, ou sai do app
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('backButton', () => {
      if (document.body.classList.contains('no-scroll')) window.dispatchEvent(new Event('jarvis:back'));
      else if (tab !== 'today') setTab('today');
      else CapApp.minimizeApp();
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, [tab]);

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
      <main key={tab} className="fade-in">
        {tab === 'today' && <Today userName={user.name} onEdit={onEdit} onSettings={openSettings} onSleep={(rateId) => setSleepOpen({ rateId })} onLogs={setLogsFor} />}
        {tab === 'calendar' && <CalendarScreen onEdit={onEdit} />}
        {tab === 'routines' && <Activities onEdit={onEdit} />}
        {tab === 'report' && <Report />}
        {tab === 'assistant' && <Assistant onSettings={openSettings} />}
      </main>

      <nav className="tabbar glass-strong">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''} ${t.id === 'assistant' ? 'center' : ''}`} onClick={() => setTab(t.id)}>
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
    </div>
  );
}
