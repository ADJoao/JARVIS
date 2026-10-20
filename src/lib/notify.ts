import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { MoneyTx, UserData } from './types';
import { money, progressText, randomPhrase } from './finance';
import { lastLog } from './stats';
import { timesOf } from './times';

export const isNative = () => Capacitor.isNativePlatform();

/** Id numérico estável (32 bits) a partir do id da atividade. */
function numId(s: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 1) % 2_000_000_000;
}

export async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false;
  const cur = await LocalNotifications.checkPermissions();
  if (cur.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

/**
 * Reagenda todos os lembretes a partir dos dados atuais:
 * - lembrete no horário de cada rotina (se ligado na rotina);
 * - alerta "faz X horas sem ..." (se a rotina permitir notificar);
 * - lembrete de hora de dormir.
 * No modo discreto o texto não revela qual é a atividade.
 */
export async function rescheduleAll(data: UserData): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length)
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!data.settings.notifications) return;
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;

    const list: LocalNotificationSchema[] = [];
    const now = Date.now();
    const discreet = data.settings.discreet;
    const DISCREET_TITLE = 'JARVIS';
    const DISCREET_BODY = 'Você tem um lembrete. Abra o app para ver.';

    if (data.settings.bedtimeReminder && data.settings.bedtime) {
      const [hour, minute] = data.settings.bedtime.split(':').map(Number);
      list.push({
        id: numId('__hora_de_dormir__', 77),
        title: discreet ? DISCREET_TITLE : '😴 Hora de dormir',
        body: discreet ? DISCREET_BODY : `Sua meta é dormir ${data.settings.sleepGoal}h. Toque em "Vou dormir" no JARVIS.`,
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      });
    }

    // frases motivacionais (semanal ou diária). Agendamos as próximas ocorrências uma a uma
    // para cada aviso trazer uma frase diferente; o app reagenda sempre que é aberto.
    const f = data.finance;
    if (f.motivationFreq !== 'off' && f.phrases.some((p) => p.trim())) {
      const [hour, minute] = f.motivationTime.split(':').map(Number);
      const prog = progressText(f);
      const shuffled = [...f.phrases.filter((p) => p.trim())].sort(() => Math.random() - 0.5);
      const dates: Date[] = [];
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      if (d.getTime() <= now) d.setDate(d.getDate() + 1);
      while (dates.length < (f.motivationFreq === 'daily' ? 14 : 8)) {
        if (f.motivationFreq === 'daily' || d.getDay() === f.motivationWeekday) dates.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      dates.forEach((at, i) =>
        list.push({
          id: numId('__motivacao__', i),
          title: discreet ? DISCREET_TITLE : '🔥 JARVIS',
          body: discreet ? DISCREET_BODY : `${shuffled[i % shuffled.length]}${prog ? `\n🎯 ${prog}` : ''}`,
          schedule: { at, allowWhileIdle: true },
        }),
      );
    }

    // lembretes de notas ("lembrar no dia")
    for (const n of data.notes) {
      if (!n.remindDate) continue;
      const [y, m, d] = n.remindDate.split('-').map(Number);
      const [hour, minute] = (n.remindTime || '09:00').split(':').map(Number);
      const at = new Date(y, m - 1, d, hour, minute);
      if (at.getTime() <= now) continue;
      const left = n.blocks.filter((b) => b.type === 'check' && !b.doneAt).length;
      list.push({
        id: numId(n.id, 60),
        title: discreet ? DISCREET_TITLE : `${n.emoji} ${n.title || 'Nota'}`,
        body: discreet ? DISCREET_BODY : left ? `Você tem ${left} ${left === 1 ? 'tarefa pendente' : 'tarefas pendentes'} nessa nota.` : 'Lembrete da sua nota.',
        schedule: { at, allowWhileIdle: true },
      });
    }

    for (const a of data.activities) {
      if (a.archivedAt) continue;
      const times = timesOf(a);
      if (a.reminder && times.length) {
        const title = discreet ? DISCREET_TITLE : `${a.emoji} ${a.name}`;
        const s = a.schedule;
        times.forEach((t, ti) => {
          const [hour, minute] = t.split(':').map(Number);
          const body = discreet
            ? DISCREET_BODY
            : times.length > 1
              ? `Horário ${ti + 1} de ${times.length} (${t}).`
              : a.goal > 1
                ? `Meta de hoje: ${a.goal}${a.unit ? ` ${a.unit}` : ''}.`
                : 'Hora da sua rotina!';
          if (s.kind === 'daily') {
            list.push({ id: numId(a.id, 1000 + ti), title, body, schedule: { on: { hour, minute }, allowWhileIdle: true } });
          } else if (s.kind === 'weekdays') {
            // Capacitor: 1 = domingo ... 7 = sábado
            for (const d of s.days)
              list.push({ id: numId(a.id, 2000 + ti * 10 + d), title, body, schedule: { on: { weekday: d + 1, hour, minute }, allowWhileIdle: true } });
          } else if (s.kind === 'once') {
            const [y, m, d] = s.date.split('-').map(Number);
            const at = new Date(y, m - 1, d, hour, minute);
            if (at.getTime() > now) list.push({ id: numId(a.id, 3000 + ti), title, body, schedule: { at, allowWhileIdle: true } });
          }
        });
      }
      if (a.alertHours && a.alertNotify !== false) {
        const last = lastLog(data, a.id);
        const base = last?.at ?? a.createdAt;
        const at = new Date(base + a.alertHours * 3600_000);
        if (at.getTime() > now + 60_000)
          list.push({
            id: numId(a.id, 50),
            title: discreet ? DISCREET_TITLE : `${a.emoji} Já faz ${a.alertHours}h…`,
            body: discreet ? DISCREET_BODY : `Você está há ${a.alertHours} horas sem registrar "${a.name}".`,
            schedule: { at, allowWhileIdle: true },
          });
      }
    }
    // no Android, largeBody mostra o texto inteiro (com quebras de linha) ao expandir a notificação
    for (const n of list) n.largeBody ??= n.body;
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch (e) {
    console.warn('Falha ao agendar lembretes', e);
  }
}

/** Notificação na hora em que uma entrada é registrada, no estilo "venda aprovada". */
export async function notifyIncome(data: UserData, tx: MoneyTx): Promise<void> {
  const f = data.finance;
  if (!isNative() || !data.settings.notifications || !f.notifyOnIncome) return;
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    const discreet = data.settings.discreet;
    const prog = progressText(f);
    const note: LocalNotificationSchema = {
      id: numId(tx.id, 99),
      title: discreet ? 'JARVIS' : f.incomeTitle || '💸 Venda aprovada!',
      body: discreet ? 'Nova entrada registrada.' : `Valor: ${money(tx.amount)}${tx.note ? ` · ${tx.note}` : ''}\n${randomPhrase(f)}${prog ? `\n🎯 ${prog}` : ''}`,
      schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
    };
    note.largeBody = note.body;
    await LocalNotifications.schedule({ notifications: [note] });
  } catch (e) {
    console.warn('Falha ao notificar entrada', e);
  }
}
