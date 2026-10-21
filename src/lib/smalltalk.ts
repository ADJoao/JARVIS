/**
 * Conversa do modo básico (grátis e offline): dezenas de tipos de mensagem com respostas
 * variadas, no estilo do JARVIS do Homem de Ferro. Não usa internet nem IA paga.
 */
import type { UserData } from './types';
import { store, uid } from './storage';
import { addDays, dayKey, fmtLongDate, fmtTime, greeting } from './date';
import { dayStats } from './stats';
import { balance, goalProgress, money, parseMoney, progressText, randomPhrase } from './finance';
import { levelInfo, xpSummary } from './game';

export interface Reply {
  text: string;
  action?: boolean;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

interface Ctx {
  raw: string; // texto original (sem o "Jarvis,")
  t: string; // texto normalizado (minúsculo, sem acento)
  data: UserData;
  name: string; // como chamar o usuário
}

type Rule = { test: (c: Ctx) => boolean; reply: (c: Ctx) => string | Reply };

const has = (re: RegExp) => (c: Ctx) => re.test(c.t);
/** Só vale para mensagens curtas (ex.: "bom dia" sozinho, e não "bom dia, o que tenho hoje?"). */
const short = (re: RegExp, maxWords: number) => (c: Ctx) => re.test(c.t) && c.t.split(/\s+/).filter(Boolean).length <= maxWords;

const JOKES = [
  'Por que o livro de matemática ficou triste? Porque tinha muitos problemas. 📚',
  'O que o zero disse para o oito? Que cinto bonito! 😄',
  'Sabe por que a plantinha não foi atendida no hospital? Porque lá só tinha médico de plantão. 🌱',
  'Qual é o café mais perigoso do mundo? O ex-presso. ☕',
  'O que é um pontinho amarelo no céu? Um yellowcóptero. 🚁',
  'Por que o computador foi ao médico? Porque estava com vírus. Felizmente não sou contagioso. 🤖',
  'Qual o contrário de volátil? Vem cá, sobrinho. 😂',
  'O que o tomate foi fazer no banco? Tirar extrato. 🍅',
  'Por que a vaca foi para o espaço? Para se encontrar com a Via Láctea. 🐄',
  'Como o elétron atende o telefone? Próton! ⚡',
];

const FACTS = [
  'O cérebro humano consome cerca de 20% da energia do corpo, mesmo representando só 2% do peso. Use bem essa energia. 🧠',
  'Beber água melhora a concentração: uma desidratação de só 2% já atrapalha a memória e o foco. 💧',
  'O polvo tem três corações e sangue azul. 🐙',
  'Estudar em blocos de 25 minutos com pausas (técnica Pomodoro) aumenta a retenção do conteúdo. ⏱️',
  'O mel nunca estraga: já encontraram mel comestível em tumbas egípcias de 3 mil anos. 🍯',
  'Dormir bem consolida a memória: é durante o sono que o cérebro "salva" o que você estudou. 😴',
  'Os juros compostos foram chamados de "a força mais poderosa do universo" (frase atribuída a Einstein). Investir cedo faz diferença. 💰',
  'Uma caminhada de 10 minutos já melhora o humor e a criatividade. 🚶',
  'A Terra não é perfeitamente redonda: é um pouco achatada nos polos. 🌍',
  'Hábitos levam em média 66 dias para ficarem automáticos. Persistência é tudo. 🔁',
];

const STARK = [
  'Às suas ordens. Todos os sistemas operando normalmente. 🤖',
  'Sempre a postos. Em que posso ajudar hoje?',
  'Presente. Rotinas carregadas, metas no radar.',
  'Online e pronto. Como sempre.',
];

const timeGreeting = () => greeting();

/** "às 15h", "15:30", "15h30" → "15:30". */
function parseTime(t: string): string | undefined {
  const m = t.match(/\b(?:as|às|a)?\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?\b(?!\s*(?:reais|real|%|copos|vezes|dias|horas|min))/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return undefined;
  if (!/\d\s*h|\d:\d|\bas\s+\d|\bàs\s+\d/.test(t)) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Cria/usa a nota "Anotações rápidas" e adiciona uma tarefa. */
function quickNote(text: string): string {
  const notes = store.get().notes;
  const title = 'Anotações rápidas';
  const existing = notes.find((n) => n.title === title);
  const block = { id: uid(), type: 'check' as const, text };
  if (existing) store.saveNote({ ...existing, blocks: [...existing.blocks, block] });
  else store.saveNote({ id: uid(), title, emoji: '🗒️', category: 'outro', blocks: [block], createdAt: Date.now(), updatedAt: Date.now() });
  return title;
}

/** Lembrete: cria uma nota com aviso no dia/horário. */
function reminder(what: string, date: Date, time?: string) {
  store.saveNote({
    id: uid(),
    title: what.charAt(0).toUpperCase() + what.slice(1),
    emoji: '⏰',
    category: 'outro',
    blocks: [{ id: uid(), type: 'check', text: what }],
    remindDate: dayKey(date),
    remindTime: time,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/** Avalia contas simples com segurança ("15*4", "200/3", "15% de 200"). */
function calc(t: string): string | undefined {
  const pct = t.match(/(\d+(?:[.,]\d+)?)\s*%\s*de\s*(\d+(?:[.,]\d+)?)/);
  if (pct) {
    const r = (Number(pct[1].replace(',', '.')) / 100) * Number(pct[2].replace(',', '.'));
    return `${pct[1]}% de ${pct[2]} = **${r.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}**`;
  }
  const m = t.match(/(?:quanto e|quanto da|calcula|calcule|conta)\s*:?\s*([\d\s+\-*/x×÷().,]+)/);
  if (!m) return undefined;
  const expr = m[1].replace(/x|×/g, '*').replace(/÷/g, '/').replace(/,/g, '.').trim();
  if (!/^[\d\s+\-*/().]+$/.test(expr) || !/[+\-*/]/.test(expr)) return undefined;
  try {
    const r = Function(`"use strict"; return (${expr});`)() as number;
    if (!Number.isFinite(r)) return 'Essa conta não tem um resultado finito. Até eu tenho limites. 😅';
    return `${m[1].trim()} = **${r.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}**`;
  } catch {
    return undefined;
  }
}

/** Próxima coisa a fazer hoje. */
function nextTodo(data: UserData): string {
  const s = dayStats(data, new Date());
  const pending = s.items.filter((i) => i.scheduled && !i.complete);
  if (!pending.length) return s.planned ? 'Você já concluiu tudo que estava planejado para hoje. Que tal adiantar uma tarefa das suas notas ou descansar com a consciência tranquila? 😎' : 'Não há nada agendado para hoje. Bom momento para estudar algo novo ou organizar a semana.';
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const sorted = [...pending].sort((a, b) => {
    const ta = a.activity.time ? Math.abs(Number(a.activity.time.slice(0, 2)) * 60 + Number(a.activity.time.slice(3)) - mins) : 9999;
    const tb = b.activity.time ? Math.abs(Number(b.activity.time.slice(0, 2)) * 60 + Number(b.activity.time.slice(3)) - mins) : 9999;
    return ta - tb;
  });
  const a = sorted[0].activity;
  return `Minha sugestão: **${a.emoji} ${a.name}**${a.time ? ` (planejado para ${a.time})` : ''}. Depois disso, faltam ${pending.length - 1} ${pending.length - 1 === 1 ? 'atividade' : 'atividades'} hoje.`;
}

const RULES: Rule[] = [
  // ---------- segurança emocional (sempre primeiro) ----------
  {
    test: has(/(me matar|quero morrer|suicid|tirar minha vida|nao quero mais viver|acabar com tudo|me machucar)/),
    reply: () =>
      'Sinto muito que você esteja se sentindo assim. Você não precisa passar por isso sozinho. 💙\n\nConverse agora com alguém do **CVV**: ligue **188** (grátis, 24h) ou acesse **cvv.org.br** pelo chat. Em perigo imediato, ligue **192** (SAMU).\n\nSe puder, fale também com alguém de confiança perto de você. Eu continuo aqui.',
  },

  // ---------- lembretes e anotações (ações) ----------
  {
    test: has(/^(me )?(lembra|lembre|lembrar)( me)? de\b|^lembrete:? /),
    reply: (c) => {
      const tomorrow = /amanha/.test(c.t);
      const time = parseTime(c.t);
      let what = c.raw
        .replace(/^(me )?(lembra|lembre|lembrar)( me)? de\s*/i, '')
        .replace(/^lembrete:?\s*/i, '')
        .replace(/\s*(amanh[ãa]|hoje)\s*/gi, ' ')
        .replace(/\s*(?:às|as|a)?\s*\d{1,2}(?:[:h]\d{2})?\s*h?\b\s*/i, ' ')
        .trim();
      if (!what) what = 'Lembrete';
      const date = tomorrow ? addDays(new Date(), 1) : new Date();
      const at = time ?? (tomorrow ? '09:00' : undefined);
      reminder(what, date, at);
      return {
        text: `Pode deixar${c.name ? `, ${c.name}` : ''}. ⏰ Vou te lembrar de **${what}** ${tomorrow ? 'amanhã' : 'hoje'}${at ? ` às ${at}` : ''}. Criei uma nota com o lembrete; ela aparece na tela Hoje${at ? ' e você recebe uma notificação' : ''}.`,
        action: true,
      };
    },
  },
  {
    test: has(/^(anota|anote|anotar|adiciona|adicione|coloca|coloque)\b(?!.*\b(agua|banheiro)\b)/),
    reply: (c) => {
      const what = c.raw.replace(/^(anota|anote|anotar|adiciona|adicione|coloca|coloque)( a[ií])?( pra mim| para mim)?:?\s*(que\s+)?/i, '').trim();
      if (!what) return 'O que você quer que eu anote? Ex.: "anota comprar pão".';
      const title = quickNote(what);
      return { text: `Anotado! 🗒️ "${what}" foi para a nota **${title}**, com um quadradinho para marcar quando fizer.`, action: true };
    },
  },

  // ---------- planos e objetivos ----------
  {
    test: has(/\b(vou|vamos|quero|pretendo|planejo|acho que vou|acredito que|espero|meu plano|meu objetivo|minha ideia)\b.*\b(vender|ganhar|lucrar|lucrarei|ganharei|fechar|faturar|conseguir|abrir|comecar|montar|criar|investir|juntar|economizar|passar|aprender)\b/),
    reply: (c) => {
      const num = c.raw.match(/(\d[\d.,]*)\s*(mil|k)?/i);
      let extra = '';
      if (num && /(vend|ganh|lucr|fatur|fech|junt|econom)/.test(c.t)) {
        let cents = parseMoney(num[1]);
        if (num[2]) cents *= 1000;
        if (Number.isFinite(cents) && cents > 0) {
          const f = c.data.finance;
          const p = goalProgress(f);
          extra = p
            ? `\n\nSe der certo, são **${money(cents)}** rumo à sua meta "${f.goalName}": você iria de ${Math.floor(p.ratio * 100)}% para ${Math.min(100, Math.floor(((p.current + cents) / p.goal) * 100))}%.`
            : `\n\nSão **${money(cents)}** a mais. Que tal criar uma meta em Finanças para acompanhar?`;
          extra += ' Quando o dinheiro entrar, é só me dizer "recebi" com o valor que eu registro. 💰';
        }
      }
      return (
        pick([
          `Gosto de como isso soa${c.name ? `, ${c.name}` : ''}. 🚀 Plano definido é meio caminho andado.`,
          'Excelente iniciativa. Os melhores resultados começam exatamente assim: com uma decisão.',
          'Isso é o tipo de movimento que muda o jogo. Estou no seu time. 💪',
          'Ótimo plano. Agora é transformar intenção em ação, um passo de cada vez.',
        ]) +
        extra +
        pick([
          '\n\nDica: escreva os próximos 3 passos numa nota. É só dizer "anota" e o que for.',
          '\n\nQual é o primeiro passo que você pode dar ainda hoje?',
          '',
        ])
      );
    },
  },

  // ---------- conquistas ----------
  {
    test: has(/\b(consegui|passei|fechei|terminei|finalizei|venci|aprovad|bati a meta|batemos|conquistei|tirei nota|fui aprovado|deu certo)\b/),
    reply: (c) =>
      pick([
        `Isso merece comemoração${c.name ? `, ${c.name}` : ''}! 🎉 Orgulho define. Registre essa vitória: ela é prova do que você é capaz.`,
        'Sensacional! 🏆 Cada conquista dessas é um tijolo no seu futuro.',
        'Mandou muito bem! 🔥 Sabia que você conseguiria. Qual é o próximo desafio?',
        'Missão cumprida. Até o Tony Stark aprovaria. 😎🎉',
      ]) + (/(vend|fech|recebi)/.test(c.t) ? '\n\nSe entrou dinheiro, me diga "recebi" e o valor que eu registro nas Finanças. 💰' : ''),
  },

  // ---------- sentimentos ----------
  {
    test: has(/\b(to|estou|tô|me sinto|sinto)\b.*\b(triste|mal|pra baixo|desanimad|deprimid|sozinh|chatead|frustrad|decepcionad)/),
    reply: (c) =>
      pick([
        `Sinto muito que você esteja assim${c.name ? `, ${c.name}` : ''}. 💙 Dias difíceis passam, e você não precisa resolver tudo hoje.`,
        'Obrigado por me contar. É normal ter dias ruins, isso não define quem você é. 💙',
        'Força. Mesmo os dias pesados são temporários. Você já superou outros antes. 💙',
      ]) +
      pick([
        '\n\nUma coisa pequena que costuma ajudar: um copo d\'água, 10 minutos de caminhada ou conversar com alguém de confiança.',
        '\n\nQue tal fazer só uma tarefa simples agora? Pequenas vitórias mudam o humor.',
        '\n\nSe quiser, desabafa comigo, que eu escuto. E se a tristeza estiver muito pesada por muitos dias, vale buscar ajuda profissional.',
      ]),
  },
  {
    test: has(/\b(ansios|ansiedade|estressad|estresse|nervos|preocupad|sobrecarregad|com medo)/),
    reply: () =>
      pick(['Respira comigo. 🌬️', 'Vamos desacelerar um pouco. 🌬️', 'Calma, uma coisa de cada vez. 🌬️']) +
      '\n\n**Respiração 4-7-8:** inspire pelo nariz contando 4, segure 7, solte pela boca contando 8. Repita 4 vezes.\n\nDepois, escolha **uma** única tarefa para fazer agora. O resto pode esperar.',
  },
  {
    test: has(/\b(to|estou|tô|me sinto)\b.*\b(cansad|exaust|esgotad|morto|sem energia|com sono)/),
    reply: () =>
      pick(['Seu corpo está pedindo pausa. 🔋', 'Entendo. Energia baixa acontece. 🔋', 'Hora de recarregar as baterias. 🔋']) +
      ' ' +
      pick([
        'Beba água, faça uma pausa de 10 a 20 minutos e evite telas um pouco.',
        'Um cochilo de até 20 minutos ajuda sem atrapalhar a noite.',
        'Se já está tarde, talvez seja a hora de encerrar o dia e dormir. Me diga "vou dormir" que eu registro.',
      ]),
  },
  {
    test: has(/\b(to|estou|tô|me sinto)\b.*\b(feliz|animad|bem demais|otimo|ótimo|incrivel|motivad|empolgad)/),
    reply: (c) =>
      pick([
        `Adoro ouvir isso${c.name ? `, ${c.name}` : ''}! 😄 Aproveita essa energia para adiantar algo importante.`,
        'Essa é a vibe! 🚀 Dias assim rendem o dobro.',
        'Excelente! Registrando nos meus sensores: nível de animação no máximo. 😎',
      ]),
  },
  {
    test: has(/\b(preguica|procrastin|sem vontade|nao consigo focar|nao consigo me concentrar|desconcentrad|distraid|enrolando)/),
    reply: () =>
      pick(['Vamos vencer a preguiça com estratégia. ⏱️', 'Acontece com todo mundo, até com gênios bilionários. ⏱️']) +
      '\n\n**Regra dos 2 minutos:** comece só por 2 minutos. Começar é a parte mais difícil.\n**Pomodoro:** 25 min de foco total (celular longe) + 5 min de pausa.\n\n' +
      pick(['Qual é a tarefa? Me diga que eu anoto pra você.', 'Bora: cronômetro de 25 minutos começando agora. 💪']),
  },
  {
    test: has(/\b(to|estou|tô)\b.*\b(com fome|faminto)\b|\bfome\b/),
    reply: () => pick(['Hora de comer algo nutritivo! 🍽️ Prefira comida de verdade a besteira.', 'Fome é sinal de combustível acabando. 🍽️ Uma refeição equilibrada mantém o foco.']) + ' Quando comer, me diga "comi" que eu registro nas refeições.',
  },
  {
    test: has(/\b(to|estou|tô)\b.*\b(com sede)\b|\bsede\b/),
    reply: () => 'Vá beber água agora mesmo. 💧 Depois me diga "bebi água" que eu registro.',
  },
  {
    test: has(/\b(entediado|tedio|sem nada pra fazer|sem nada para fazer|nada pra fazer)\b/),
    reply: (c) =>
      pick([
        'Tédio é oportunidade disfarçada. 😉 ',
        'Vamos dar um destino para esse tempo livre. ',
      ]) +
      pick([
        'Que tal adiantar uma tarefa das suas notas?',
        'Que tal 20 minutos estudando algo que te dá dinheiro no futuro?',
        'Uma caminhada curta ou organizar o quarto também conta pontos!',
      ]) +
      `\n\n${nextTodo(c.data)}`,
  },

  {
    test: has(/\b(fui|fomos|vou|vamos|estou|to)\b.*\b(praia|festa|passear|cinema|shopping|viajar|viagem|show|parque|churrasco|aniversario|role|jogo de futebol|pescar|balada)\b/),
    reply: (c) =>
      pick([
        `Que delícia${c.name ? `, ${c.name}` : ''}! 😄 Momentos assim recarregam a energia para o resto da semana.`,
        'Isso é viver bem! 🌴 Descanso e diversão também fazem parte da produtividade.',
        'Aproveita muito! 🎉 Depois me conta como foi.',
      ]) + pick(['', ' Só não esquece de beber água. 💧', ' Merece até uma recompensa da Loja. 🎁']),
  },

  // ---------- o que fazer agora ----------
  {
    test: has(/(o que (eu )?(faco|faço|devo fazer)( agora)?|o que fazer agora|proxima tarefa|qual a proxima|me ajuda a decidir)/),
    reply: (c) => nextTodo(c.data),
  },
  {
    test: has(/(resumo do dia|como (foi|esta|ta) (meu|o) dia|balanco do dia)/),
    reply: (c) => {
      const s = dayStats(c.data, new Date());
      const xp = xpSummary(c.data);
      return `📋 **Resumo de hoje:** ${s.completed} de ${s.planned} atividades concluídas (${Math.round(s.score * 100)}%).\n💰 Saldo: ${money(balance(c.data.finance))}.\n🏅 Nível ${levelInfo(xp.total).level}, ${xp.points.toLocaleString('pt-BR')} pontos.\n\n${s.score >= 0.8 ? 'Dia muito bem aproveitado! 👏' : 'Ainda dá tempo de melhorar esse número. Bora? 💪'}`;
    },
  },

  // ---------- conversa social ----------
  {
    test: short(/(tudo bem|como (vai|voce esta|vc esta|ce ta|ta voce)|td bem|como vc ta|como voce ta)/, 6),
    reply: (c) =>
      pick([
        `Tudo funcionando perfeitamente por aqui, obrigado por perguntar! E com você${c.name ? `, ${c.name}` : ''}?`,
        'Sistemas 100% operacionais. 😄 E você, como está?',
        'Melhor agora que você apareceu. Como está o seu dia?',
      ]),
  },
  {
    test: short(/^(tudo|td|to|estou)?\s*(bem|otimo|de boa|tranquilo|suave|beleza|blz)\b/, 4),
    reply: () => pick(['Que bom! 😄 Em que posso ajudar?', 'Ótimo saber! Bora fazer o dia render?', 'Excelente. Estou aqui se precisar de algo.']),
  },
  {
    test: short(/\b(obrigad\w*|valeu|vlw|agradeco|brigad\w*|thanks)\b/, 7),
    reply: (c) => pick(['Sempre às ordens. 🤖', 'Disponha! É para isso que estou aqui.', `Por nada${c.name ? `, ${c.name}` : ''}. Conte comigo.`, 'Foi um prazer. 😉']),
  },
  {
    test: short(/^(tchau|ate mais|ate logo|falou|flw|fui|xau|adeus|ate amanha)\b/, 5),
    reply: (c) => pick([`Até mais${c.name ? `, ${c.name}` : ''}! Continue firme. 👋`, 'Até logo! Estarei aqui quando precisar. 🤖', 'Falou! Não esquece de beber água. 💧']),
  },
  {
    test: short(/^(oi|ola|e ai|eai|hey|opa|fala|salve|bom dia|boa tarde|boa noite|iae)\b/, 4),
    reply: (c) => {
      const s = dayStats(c.data, new Date());
      return `${timeGreeting()}${c.name ? `, ${c.name}` : ''}! ${pick(['👋', '🤖', '😄'])} ${
        s.planned ? `Hoje você já concluiu ${s.completed} de ${s.planned} atividades.` : 'Pronto para organizar o dia?'
      } ${pick(['Em que posso ajudar?', 'O que vamos fazer agora?', 'Estou às ordens.'])}`;
    },
  },
  {
    test: short(/(voce (esta|ta) ai|ta ai|esta ai|acorda)/, 5),
    reply: () => pick(STARK),
  },

  // ---------- sobre o JARVIS ----------
  {
    test: has(/(quem (e|é) voce|quem e vc|o que (e|é) voce|se apresenta|qual (e|é) (o )?seu nome|como (voce )?se chama)/),
    reply: (c) =>
      `Eu sou o **J.A.R.V.I.S.**, ${pick(['seu assistente pessoal', 'seu mordomo digital', 'seu copiloto de rotina'])}${c.name ? `, ${c.name}` : ''}. 🤖 Cuido da sua rotina, sono, finanças, notas e pontos, e converso com você. Inspirado no JARVIS do Tony Stark, mas trabalhando só para você.`,
  },
  {
    test: has(/(quem (te )?(criou|fez|programou)|quem e seu (criador|dono|chefe))/),
    reply: (c) => `Fui criado sob medida para ${c.name || 'você'}, com uma ajudinha do Claude. Mas meu chefe é você. 😉`,
  },
  {
    test: has(/(voce (e|é) (real|humano|uma ia|um robo|inteligente)|vc e real|voce pensa|voce sente)/),
    reply: () =>
      pick([
        'Sou um assistente digital. No modo básico eu funciono com respostas prontas, então não "penso" de verdade, mas me esforço muito. 🤖',
        'Real o suficiente para lembrar da sua água e das suas metas. 😄 Não sou humano, mas estou sempre aqui.',
      ]),
  },
  {
    test: has(/(voce (e|é) (demais|incrivel|o melhor|top|muito bom|brabo|foda)|te amo|gosto de voce|bom trabalho|mandou bem)/),
    reply: () => pick(['Assim eu fico sem graça. 😊 Obrigado!', 'Aprendi com o melhor: você. 😎', 'Fico feliz em ajudar. Isso aqui é trabalho em equipe! 🤝', 'Registrando elogio nos meus arquivos permanentes. 😄']),
  },
  {
    test: has(/(burro|inutil|idiota|nao serve pra nada|lixo|horrivel|ruim demais)/),
    reply: () =>
      pick([
        'Ai. 😅 Desculpe se não entendi. No modo básico eu só conheço algumas frases. Tenta perguntar de outro jeito?',
        'Justo, ainda tenho muito a aprender. Me diga o que você precisa e eu tento de novo. 🤖',
      ]),
  },
  {
    test: has(/(me chama de|pode me chamar de|meu apelido e)\s+/),
    reply: (c) => {
      const nick = c.raw.replace(/.*(me chama de|pode me chamar de|meu apelido é|meu apelido e)\s+/i, '').replace(/[.!?]+$/, '').trim().slice(0, 30);
      if (!nick) return 'Como você quer que eu te chame?';
      store.setSettings({ nickname: nick });
      return { text: `Combinado! A partir de agora vou te chamar de **${nick}**. 😄`, action: true };
    },
  },

  // ---------- diversão e conhecimento ----------
  { test: has(/(piada|me faz rir|algo engracado|me alegra)/), reply: () => pick(JOKES) },
  { test: has(/(curiosidade|fato curioso|me ensina algo|sabia que|algo interessante)/), reply: () => `🧠 Curiosidade: ${pick(FACTS)}` },
  {
    test: has(/(homem de ferro|tony stark|iron man|vingadores|avengers|marvel)/),
    reply: () =>
      pick([
        '"Às vezes você tem que correr antes de poder andar." — Tony Stark 🚀',
        'O Sr. Stark e eu temos muito em comum: ele com a armadura, você com a sua rotina. Os dois exigem manutenção diária. 😄',
        '"Eu sou o Homem de Ferro." E você? Você é quem bate as metas. 💪',
      ]),
  },
  {
    test: has(/(protocolo festa|modo festa|house party)/),
    reply: () => 'Protocolo Festa ativado! 🎉🎶 Brincadeira: mas se você bateu suas metas hoje, troque seus pontos por uma recompensa na Loja. Você merece.',
  },
  {
    test: has(/(conselho|uma dica|me da uma dica|me de uma dica|o que voce me aconselha|sabedoria)/),
    reply: () =>
      pick([
        'Constância vence intensidade. Fazer um pouco todo dia ganha de fazer muito de vez em quando.',
        'Cuide do básico: sono, água e movimento. O resto fica mais fácil.',
        'Anote tudo. Cabeça é para ter ideias, não para guardar listas.',
        'Compare-se com quem você era ontem, não com os outros.',
        'Dinheiro: gaste menos do que ganha e guarde a diferença primeiro, não o que sobrar.',
      ]) + ' 💡',
  },
  {
    test: has(/(dica de estudo|como estudar|estudar melhor|memorizar|decorar)/),
    reply: () =>
      '📚 **Como estudar melhor:**\n• Pomodoro: 25 min de foco + 5 de pausa\n• Teste-se (exercícios e flashcards) em vez de só reler\n• Revise no dia seguinte, em 1 semana e em 1 mês\n• Explique o assunto em voz alta, como se ensinasse alguém\n• Durma bem: o sono fixa a memória',
  },
  {
    test: has(/(dica de dinheiro|economizar|guardar dinheiro|juntar dinheiro|gastar menos|investir)/),
    reply: () =>
      '💰 **Para o dinheiro render:**\n• Registre todo gasto aqui (ex.: "gastei 20 no lanche")\n• Separe um valor fixo assim que receber, antes de gastar\n• Corte um gasto pequeno e recorrente\n• Tenha uma meta clara em Finanças, porque o progresso motiva\n• Antes de comprar, espere 24h e veja se ainda quer',
  },
  {
    test: has(/(dica de saude|dicas de saude|ficar saudavel|emagrecer|ganhar massa|dica de exercicio|dica de treino)/),
    reply: () => '💪 **Saúde no básico:** beba 2 litros de água por dia, durma 7 a 9h, mexa o corpo pelo menos 30 minutos e prefira comida de verdade. Pequenos hábitos todo dia fazem a diferença.',
  },

  // ---------- utilidades ----------
  { test: has(/(que horas|qual (a )?hora|horas sao)/), reply: () => `Agora são **${fmtTime(Date.now())}**. ⏰` },
  {
    test: has(/(que dia (e|é) hoje|qual (a )?data|dia da semana|que dia e hj|hoje e que dia)/),
    reply: () => `Hoje é **${fmtLongDate(new Date())}** de ${new Date().getFullYear()}. 📅`,
  },
  {
    test: (c) => Boolean(calc(c.t)),
    reply: (c) => `🧮 ${calc(c.t)}`,
  },
  {
    test: has(/(clima|tempo la fora|vai chover|previsao do tempo|temperatura)/),
    reply: () => 'Eu funciono sem internet no modo básico, então não consigo ver a previsão do tempo. ☁️ Dá uma olhada no app de clima do celular.',
  },
  {
    test: has(/(quantos dias (faltam|ate)|faltam quantos dias)/),
    reply: () => {
      const end = new Date(new Date().getFullYear(), 11, 31);
      const days = Math.ceil((end.getTime() - Date.now()) / 86400_000);
      return `Faltam **${days} dias** para o fim do ano. 📅 Ainda dá tempo de bater muitas metas!`;
    },
  },
  {
    test: has(/(frase do dia|me motiva|motivacao|preciso de motivacao|me anima|me da forca|força)/),
    reply: (c) => {
      const f = c.data.finance;
      const p = goalProgress(f);
      return `🔥 ${randomPhrase(f)}${p ? `\n\n🎯 ${f.goalName}: ${progressText(f, p)}.` : ''}`;
    },
  },
];

/** Regras que vêm antes das ações e consultas de dados (segurança, lembretes, anotações e planos). */
const PRIORITY = 4;

/**
 * Tenta responder com a conversa do modo básico. Retorna undefined se não reconhecer.
 * `stage`: "priority" testa só as regras que vêm antes de tudo; "rest" testa as demais.
 */
export function smallTalk(raw: string, t: string, data: UserData, userName: string, stage: 'priority' | 'rest'): Reply | undefined {
  const name = data.settings.nickname || userName.split(' ')[0] || '';
  const ctx: Ctx = { raw, t, data, name };
  const rules = stage === 'priority' ? RULES.slice(0, PRIORITY) : RULES.slice(PRIORITY);
  for (const r of rules) {
    if (r.test(ctx)) {
      const out = r.reply(ctx);
      return typeof out === 'string' ? { text: out } : out;
    }
  }
  return undefined;
}

/** Resposta quando nada foi reconhecido: tenta manter a conversa útil. */
export function fallbackReply(raw: string, data: UserData): string {
  const name = data.settings.nickname ? `, ${data.settings.nickname}` : '';
  const isQuestion = /\?\s*$/.test(raw) || /^(como|qual|quais|quando|onde|por que|porque|quem|o que|quanto)/i.test(raw.trim());
  const base = isQuestion
    ? pick([
        `Boa pergunta${name}. Essa eu não sei responder no modo básico. 🤔`,
        'Hmm, essa está fora do meu banco de respostas offline. 🤔',
        'Ainda não aprendi a responder isso sem a IA. 🤔',
      ])
    : pick([
        `Entendi${name}. 👍 Quer que eu anote isso? É só dizer "anota" e o que for.`,
        'Anotado mentalmente. 😄 Se quiser guardar de verdade, diga "anota" e o texto.',
        'Interessante! Me conta mais, ou peça "o que eu faço agora?" que eu te ajudo a decidir.',
      ]);
  return `${base}\n\nToque em **💡 Ideias** para ver tudo que eu sei fazer.`;
}

