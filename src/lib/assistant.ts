import type { Activity, UserData } from './types';
import { store } from './storage';
import { addDays, fmtDuration, fmtTime, greeting, startOfDay, WEEKDAYS_LONG } from './date';
import { dayStats, grade, indexLogs, lastLog, streak, suggestions, weekStats } from './stats';
import { scheduleLabel } from './catalog';
import { evaluateSleep, fmtHours, hoursOf, lastSleep, sleepSummaryText, sleepTips, sleepWeek } from './sleep';

/** Remove acentos e deixa minúsculo para comparar texto. */
export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SYNONYMS: Record<string, string[]> = {
  '💩': ['banheiro', 'coco', 'evacuar', 'fazer o 2', 'numero 2', 'cagar', 'intestino'],
  '🚽': ['banheiro', 'coco', 'privada', 'xixi'],
  '💧': ['agua', 'beber', 'bebi', 'copo', 'hidrat'],
  '🥤': ['agua', 'beber', 'bebi', 'copo'],
  '🍽️': ['comer', 'comi', 'refeic', 'comida', 'almoc', 'jantar', 'jantei', 'cafe da manha', 'lanche', 'aliment'],
  '🥗': ['comer', 'comi', 'refeic', 'salada', 'aliment'],
  '📚': ['estud', 'aula', 'curso', 'prova'],
  '📖': ['leitura', 'ler', 'li ', 'livro'],
  '🏋️': ['treino', 'treinei', 'academia', 'exercicio', 'malh', 'atividade fisica'],
  '🏃': ['correr', 'corri', 'corrida', 'exercicio', 'atividade fisica'],
  '💊': ['remedio', 'medicamento', 'pilula', 'tomei'],
  '😴': ['dormir', 'dormi', 'sono'],
  '💼': ['trabalh'],
  '🧘': ['medit'],
};

function matchActivity(data: UserData, text: string): Activity | undefined {
  const t = ` ${norm(text)} `;
  const active = data.activities.filter((a) => !a.archivedAt);
  let best: { a: Activity; score: number } | undefined;
  for (const a of active) {
    let score = 0;
    const name = norm(a.name);
    if (t.includes(name)) score += 10;
    for (const w of name.split(/\s+/)) if (w.length >= 3 && t.includes(w.slice(0, Math.max(3, w.length - 1)))) score += 3;
    for (const syn of SYNONYMS[a.emoji] ?? []) if (t.includes(syn)) score += 2;
    if (text.includes(a.emoji)) score += 10;
    if (score && (!best || score > best.score)) best = { a, score };
  }
  return best?.a;
}

const has = (t: string, re: RegExp) => re.test(t);
const pct = (x: number) => `${Math.round(x * 100)}%`;

function todaySummary(data: UserData): string {
  const s = dayStats(data, new Date());
  if (!s.items.length) return 'Hoje você não tem nada agendado. Aproveite ou crie uma nova rotina na aba **Rotinas**.';
  const lines = s.items.map((i) => {
    const mark = i.complete ? '✅' : '⬜';
    const prog = i.goal > 1 ? ` (${i.count}/${i.goal})` : '';
    return `${mark} ${i.activity.emoji} ${i.activity.name}${i.activity.time ? ` · ${i.activity.time}` : ''}${prog}`;
  });
  return `Hoje você concluiu **${s.completed} de ${s.planned}** atividades (${pct(s.score)}).\n\n${lines.join('\n')}`;
}

function remaining(data: UserData, a?: Activity): string {
  const s = dayStats(data, new Date());
  if (a) {
    const it = s.items.find((i) => i.activity.id === a.id);
    if (!it || !it.scheduled) return `${a.emoji} ${a.name} não está agendada para hoje (${scheduleLabel(a.schedule)}).`;
    if (it.complete) return `${a.emoji} ${a.name} já está concluída hoje (${it.count}/${it.goal}). 👏`;
    const left = it.goal - it.count;
    const unit = a.unit ? ` ${a.unit}` : left === 1 ? ' vez' : ' vezes';
    return `Faltam **${left}${unit}** de ${a.emoji} ${a.name} hoje (você está em ${it.count}/${it.goal}).${a.time ? ` Horário planejado: ${a.time}.` : ''}`;
  }
  const pending = s.items.filter((i) => i.scheduled && !i.complete);
  if (!pending.length) return s.planned ? 'Nada pendente! Você concluiu tudo que estava planejado para hoje. 🎉' : 'Você não tem atividades agendadas para hoje.';
  return `Faltam **${pending.length}** atividades hoje:\n\n${pending
    .map((i) => `• ${i.activity.emoji} ${i.activity.name}${i.goal > 1 ? ` — faltam ${i.goal - i.count}` : ''}${i.activity.time ? ` (${i.activity.time})` : ''}`)
    .join('\n')}`;
}

function since(data: UserData, a: Activity): string {
  const last = lastLog(data, a.id);
  if (!last) return `Você ainda não registrou ${a.emoji} ${a.name}. Toque nela na tela **Hoje** para registrar.`;
  const ms = Date.now() - last.at;
  const warn = a.alertHours && ms > a.alertHours * 3600_000 ? `\n\n⚠️ Passou do seu limite de ${a.alertHours}h.` : '';
  const when = startOfDay(last.at).getTime() === startOfDay(new Date()).getTime() ? `hoje às ${fmtTime(last.at)}` : `${new Date(last.at).toLocaleDateString('pt-BR')} às ${fmtTime(last.at)}`;
  return `Faz **${fmtDuration(ms)}** desde o último registro de ${a.emoji} ${a.name} (${when}).${warn}`;
}

function performance(data: UserData): string {
  const idx = indexLogs(data.logs);
  const w = weekStats(data, new Date(), idx);
  const prev = weekStats(data, addDays(w.start, -7), idx);
  const g = grade(w.score, w.planned);
  let cmp = '';
  if (prev.planned) {
    const diff = Math.round((w.score - prev.score) * 100);
    cmp = diff === 0 ? '\nIgual à semana passada.' : `\n${diff > 0 ? '📈' : '📉'} ${diff > 0 ? '+' : ''}${diff} pontos em relação à semana passada.`;
  }
  const top = w.perActivity.slice(0, 6).map((p) => `• ${p.activity.emoji} ${p.activity.name}: ${p.completed}/${p.planned} (${pct(p.score)})`);
  return `${g.emoji} **${g.label}** — nesta semana você concluiu **${w.completed} de ${w.planned}** atividades planejadas.${cmp}\n\n${g.message}${top.length ? `\n\n${top.join('\n')}` : ''}\n\nVeja os detalhes na aba **Relatório**.`;
}

function tomorrow(data: UserData): string {
  const d = addDays(startOfDay(new Date()), 1);
  const s = dayStats(data, d);
  const items = s.items.filter((i) => i.scheduled);
  if (!items.length) return `Amanhã (${WEEKDAYS_LONG[d.getDay()]}) você não tem atividades agendadas.`;
  return `Amanhã (${WEEKDAYS_LONG[d.getDay()]}) você tem ${items.length} atividades:\n\n${items
    .map((i) => `• ${i.activity.emoji} ${i.activity.name}${i.activity.time ? ` às ${i.activity.time}` : ''}`)
    .join('\n')}`;
}

const HELP = `Posso te ajudar com coisas como:

• "O que eu tenho hoje?"
• "Quanto falta para terminar a água?"
• "Quanto tempo estou sem ir ao banheiro?"
• "Como está meu desempenho?"
• "O que eu devo melhorar?"
• "Bebi água" / "Fui ao banheiro" (eu registro pra você)
• "O que tenho amanhã?"
• "Quanto eu dormi?" / "Como está meu sono?"
• "Vou dormir" / "Acordei"`;

/** Assistente local: funciona offline e de graça, entendendo perguntas comuns. */
export function localAnswer(text: string): { text: string; understood: boolean; action?: boolean } {
  const data = store.get();
  const t = norm(text);
  const act = matchActivity(data, text);

  // ---- sono ----
  if (has(t, /^(vou|indo) (dormir|deitar)|boa noite,? (vou|to indo)/)) {
    store.startSleep();
    return { text: `Boa noite! 🌙 Marquei que você foi dormir às ${fmtTime(Date.now())}. Quando acordar, me diga "acordei" ou toque em "Acordei" na tela Hoje.`, understood: true, action: true };
  }
  if (has(t, /^(acordei|bom dia,? acordei|levantei)/)) {
    const since = data.sleepingSince;
    if (!since) return { text: 'Não encontrei um "Vou dormir" marcado. Você pode adicionar a noite manualmente no cartão de sono da tela Hoje.', understood: true, action: true };
    const e = store.addSleep(since, Date.now());
    if (!e) store.cancelSleep();
    if (!e) return { text: 'Não consegui registrar essa noite (passou de 20 horas ou já há sono registrado nesse horário). Ajuste no cartão de sono da tela Hoje.', understood: true, action: true };
    const v = evaluateSleep(hoursOf(e), data.settings.sleepGoal);
    return { text: `Bom dia! ☀️ Você dormiu **${fmtHours(hoursOf(e))}** (${fmtTime(e.start)} → ${fmtTime(e.end)}): ${v.emoji} **${v.label}**.\n\n${v.message}`, understood: true, action: true };
  }
  if (has(t, /(sono|dormi|dormir|dormindo|cansad|insonia)/)) {
    const wantsTips = has(t, /(melhorar|dica|como (eu )?(posso|faco)|ajuda|conselho)/);
    const w = sleepWeek(data, new Date());
    if (wantsTips || !lastSleep(data))
      return { text: `Dicas para o seu sono:\n\n${sleepTips(data, w).map((s) => `• ${s}`).join('\n\n')}`, understood: true };
    return { text: sleepSummaryText(data), understood: true };
  }

  if (has(t, /(quanto tempo|faz quanto|ha quanto|desde quando|ultima vez|sem ir|ultimo registro)/) && act)
    return { text: since(data, act), understood: true };

  if (act && has(t, /\b(fiz|bebi|tomei|comi|registr\w*|marc\w*|conclui|terminei|treinei|estudei|li|fui|meditei|dormi|almocei|jantei|corri)\b/)) {
    store.addLog(act.id);
    const after = store.get();
    const it = dayStats(after, new Date()).items.find((i) => i.activity.id === act.id);
    const prog = it ? ` Agora: ${it.count}/${it.goal}${it.complete ? ' ✅' : ''}.` : '';
    return { text: `Registrado! ${act.emoji} ${act.name} às ${fmtTime(Date.now())}.${prog}`, understood: true, action: true };
  }

  if (has(t, /(quanto falta|falta quanto|faltam|o que falta|pendente|falta pra|falta para|terminar)/))
    return { text: remaining(data, act), understood: true };

  if (has(t, /amanha/)) return { text: tomorrow(data), understood: true };

  if (has(t, /(hoje|agenda|o que (eu )?tenho|minhas atividades|meu dia)/)) return { text: todaySummary(data), understood: true };

  if (has(t, /(sequencia|streak|seguidos|seguidas)/)) {
    const n = streak(data);
    return {
      text: n ? `🔥 Você está há **${n} ${n === 1 ? 'dia' : 'dias'}** seguidos cumprindo pelo menos 80% do planejado.` : 'Você ainda não tem uma sequência ativa. Cumpra 80% do dia hoje para começar uma! 💪',
      understood: true,
    };
  }

  if (has(t, /(melhorar|dica|sugest|mudar|mudanca|conselho|recomend|o que (voce )?acha)/)) {
    const w = weekStats(data, new Date());
    return { text: `Aqui vão minhas sugestões:\n\n${suggestions(data, w).map((s) => `• ${s}`).join('\n\n')}`, understood: true };
  }

  if (has(t, /(desempenho|como (eu )?(estou|to|ta|esta|fui)|semana|relatorio|progresso|resultado|rendimento|nota)/))
    return { text: performance(data), understood: true };

  if (act) return { text: `${since(data, act)}\n\n${remaining(data, act)}`, understood: true };

  if (has(t, /^(oi|ola|e ai|eai|hey|bom dia|boa tarde|boa noite|jarvis|opa)\b/)) {
    const s = dayStats(data, new Date());
    return {
      text: `${greeting()}! 👋 ${s.planned ? `Hoje você já concluiu ${s.completed} de ${s.planned} atividades.` : 'Você não tem atividades para hoje ainda.'}\n\n${HELP}`,
      understood: true,
    };
  }

  if (has(t, /(ajuda|o que voce faz|comandos|help)/)) return { text: HELP, understood: true };

  return { text: `Não entendi muito bem. 🤔\n\n${HELP}`, understood: false };
}

/** Resumo dos dados para o assistente com IA (Claude). */
export function contextForAi(data: UserData): string {
  const idx = indexLogs(data.logs);
  const now = new Date();
  const today = dayStats(data, now, idx);
  const w = weekStats(data, now, idx);
  const prev = weekStats(data, addDays(w.start, -7), idx);
  const acts = data.activities
    .filter((a) => !a.archivedAt)
    .map((a) => {
      const last = lastLog(data, a.id);
      return {
        nome: a.name,
        icone: a.emoji,
        agenda: scheduleLabel(a.schedule),
        horario: a.time ?? null,
        meta_por_dia: `${a.goal}${a.unit ? ` ${a.unit}` : ''}`,
        alerta_horas_sem_registro: a.alertHours ?? null,
        ultimo_registro: last ? `${new Date(last.at).toLocaleString('pt-BR')} (há ${fmtDuration(now.getTime() - last.at)})` : 'nunca',
        notas: a.notes ?? null,
      };
    });
  return JSON.stringify(
    {
      agora: now.toLocaleString('pt-BR'),
      dia_da_semana: WEEKDAYS_LONG[now.getDay()],
      atividades: acts,
      hoje: today.items.map((i) => ({ nome: i.activity.name, feito: i.count, meta: i.goal, agendada: i.scheduled, concluida: i.complete })),
      semana_atual: {
        concluidas: w.completed,
        planejadas: w.planned,
        aproveitamento: pct(w.score),
        por_atividade: w.perActivity.map((p) => ({ nome: p.activity.name, concluidas: p.completed, planejadas: p.planned, aproveitamento: pct(p.score) })),
        por_dia: w.days.filter((d) => !d.future).map((d) => ({ dia: WEEKDAYS_LONG[d.date.getDay()], concluidas: d.completed, planejadas: d.planned })),
      },
      semana_passada: { concluidas: prev.completed, planejadas: prev.planned, aproveitamento: pct(prev.score) },
      sequencia_dias_bons: streak(data, idx),
      sono: (() => {
        const sw = sleepWeek(data, now);
        const last = lastSleep(data);
        return {
          meta_horas: data.settings.sleepGoal,
          dormindo_agora_desde: data.sleepingSince ? new Date(data.sleepingSince).toLocaleString('pt-BR') : null,
          ultima_noite: last ? { dormiu: new Date(last.start).toLocaleString('pt-BR'), acordou: new Date(last.end).toLocaleString('pt-BR'), horas: fmtHours(hoursOf(last)), avaliacao: evaluateSleep(hoursOf(last), data.settings.sleepGoal).label, como_acordou_1a5: last.quality ?? null } : null,
          semana: { media: sw.recorded ? fmtHours(sw.avg) : null, noites_registradas: sw.recorded, noites_no_ideal_7a9h: sw.goodNights, horas_faltando_para_meta: fmtHours(sw.debt), horario_medio_dormir: sw.avgBedtime ?? null, horario_medio_acordar: sw.avgWake ?? null },
        };
      })(),
    },
    null,
    1,
  );
}
