import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { store, uid, useData } from '../lib/storage';
import { localAnswer } from '../lib/assistant';
import { canListen, listen, speak, stopSpeaking } from '../lib/voice';
import { Icon } from '../components/Icon';
import { askConfirm } from '../components/Dialog';
import { Sheet } from '../components/Sheet';
import type { ChatMsg } from '../lib/types';

const QUICK = [
  'O que eu faço agora?',
  'O que eu tenho hoje?',
  'Quanto falta hoje?',
  'Como está meu desempenho?',
  'Me motiva!',
  'Quanto eu tenho?',
  'Quantos pontos eu tenho?',
  'Como está meu sono?',
];

/** Mensagens prontas do botão "Ideias" (todas funcionam no modo básico, grátis). */
const IDEAS: { group: string; items: string[] }[] = [
  {
    group: '📋 Rotina',
    items: ['O que eu faço agora?', 'O que eu tenho hoje?', 'O que tenho amanhã?', 'Quanto falta hoje?', 'Resumo do dia', 'Bebi água', 'Fui ao banheiro', 'Quanto tempo sem ir ao banheiro?', 'Quantos dias seguidos eu tenho?'],
  },
  {
    group: '📈 Desempenho',
    items: ['Como está meu desempenho?', 'O que devo melhorar?', 'Quantos pontos eu tenho?', 'Qual meu nível?'],
  },
  {
    group: '💰 Dinheiro',
    items: ['Quanto eu tenho?', 'Como está minha meta?', 'Recebi 500 do cliente', 'Gastei 30 no lanche', 'Vou vender um site e acho que lucro 1000', 'Dica de dinheiro'],
  },
  {
    group: '📝 Notas e lembretes',
    items: ['O que falta estudar?', 'Anota comprar pão', 'Me lembra de ligar pro João às 15h', 'Me lembra de estudar amanhã às 19h', 'Dica de estudo'],
  },
  {
    group: '😴 Sono e saúde',
    items: ['Vou dormir', 'Acordei', 'Quanto eu dormi?', 'Como melhorar meu sono?', 'Tô cansado', 'Tô com fome', 'Dica de saúde'],
  },
  {
    group: '💬 Conversa',
    items: ['Oi, Jarvis!', 'Tudo bem?', 'Quem é você?', 'Você está aí?', 'Tô triste', 'Tô ansioso', 'Tô com preguiça', 'Tô entediado', 'Consegui fechar uma venda!', 'Obrigado!', 'Me chama de chefe'],
  },
  {
    group: '🔥 Motivação e diversão',
    items: ['Me motiva!', 'Me dá um conselho', 'Conta uma piada', 'Me conta uma curiosidade', 'Homem de Ferro', 'Protocolo festa'],
  },
  {
    group: '🧮 Utilidades',
    items: ['Que horas são?', 'Que dia é hoje?', 'Quanto é 125 * 4', '15% de 200', 'Quantos dias faltam para o fim do ano?'],
  },
];

/** Markdown bem simples: **negrito** e quebras de linha. */
function rich(text: string): ReactNode {
  return text.split('\n').map((line, i, arr) => (
    <Fragment key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
      )}
      {i < arr.length - 1 && <br />}
    </Fragment>
  ));
}

export function Assistant({ onSettings, userName }: { onSettings: () => void; userName: string }) {
  const data = useData();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [ideasOpen, setIdeasOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ai = data.settings.aiEnabled && Boolean(data.settings.apiKey);
  const voiceReplies = data.settings.voiceReplies;

  useEffect(() => {
    canListen().then(setMicOk);
    return () => {
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [data.chat.length, busy]);

  const push = (m: Omit<ChatMsg, 'id' | 'at'>) =>
    store.update((d) => ({ ...d, chat: [...d.chat, { ...m, id: uid(), at: Date.now() }].slice(-200) }));

  const reply = (m: Omit<ChatMsg, 'id' | 'at' | 'role'>, byVoice: boolean) => {
    push({ role: 'assistant', ...m });
    // responde falando se a pessoa falou, ou se a voz estiver ligada
    if (byVoice || store.get().settings.voiceReplies) speak(m.text);
  };

  const send = async (raw: string, byVoice = false) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    stopSpeaking();
    const history = store.get().chat;
    push({ role: 'user', text, voice: byVoice || undefined });
    setBusy(true);

    if (!ai) {
      const local = localAnswer(text, userName);
      setTimeout(() => {
        reply({ text: local.text, source: 'local' }, byVoice);
        setBusy(false);
      }, 350);
      return;
    }

    try {
      // carrega o SDK do Claude só quando a IA é usada (deixa o app mais leve)
      const { askClaude } = await import('../lib/claude');
      const answer = await askClaude(store.get(), userName, history, text);
      reply({ text: answer.text, source: 'ai', actions: answer.actions.length ? answer.actions : undefined }, byVoice);
    } catch (e) {
      const msg = e instanceof Error && e.name === 'AiError' ? e.message : 'Não consegui falar com a IA agora.';
      const local = localAnswer(text, userName);
      reply({ text: `⚠️ ${msg}\n\nResposta do modo local:\n\n${local.text}`, source: 'local' }, false);
    } finally {
      setBusy(false);
    }
  };

  const talk = async () => {
    if (busy || listening) return;
    setVoiceError('');
    await stopSpeaking();
    setListening(true);
    try {
      const said = await listen();
      setListening(false);
      send(said, true);
    } catch (e) {
      setListening(false);
      setVoiceError(e instanceof Error ? e.message : 'Não consegui ouvir.');
    }
  };

  return (
    <div className="screen chat-screen">
      <header className="top">
        <div className="row">
          <div className={`jarvis-orb ${listening ? 'listening' : ''}`} aria-hidden="true" />
          <div>
            <h1>JARVIS</h1>
            <p className="muted small">{listening ? '🎙️ Ouvindo…' : ai ? '✨ Conversa inteligente ativada' : 'Modo básico · grátis e offline'}</p>
          </div>
        </div>
        <div className="row">
          <button
            className={`icon-btn glass ${voiceReplies ? 'active' : ''}`}
            aria-label={voiceReplies ? 'Desligar respostas em voz' : 'Ligar respostas em voz'}
            onClick={() => {
              if (voiceReplies) stopSpeaking();
              store.setSettings({ voiceReplies: !voiceReplies });
            }}
          >
            <Icon name={voiceReplies ? 'volume' : 'volumeOff'} size={18} />
          </button>
          {data.chat.length > 0 && (
            <button
              className="icon-btn glass"
              aria-label="Limpar conversa"
              onClick={async () => (await askConfirm('Apagar a conversa?', { confirmLabel: 'Apagar', danger: true })) && store.update((d) => ({ ...d, chat: [] }))}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button className="icon-btn glass" onClick={onSettings} aria-label="Ajustes do assistente">
            <Icon name="settings" size={18} />
          </button>
        </div>
      </header>

      {!ai && !data.settings.aiBannerHidden && (
        <div className="glass ai-banner">
          <button className="ai-banner-main" onClick={onSettings}>
            <span className="ai-banner-icon">🧠</span>
            <span>
              <strong>Modo básico: grátis e offline</strong>
              <span className="tiny muted d-block">
                Entendo dezenas de mensagens prontas (toque em 💡 Ideias). Se um dia quiser conversa livre sobre qualquer assunto, dá para ativar a IA paga em
                Ajustes.
              </span>
            </span>
          </button>
          <button className="icon-btn" onClick={() => store.setSettings({ aiBannerHidden: true })} aria-label="Fechar aviso">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className="chat">
        {data.chat.length === 0 && (
          <div className="chat-hello glass">
            <p>
              Olá{userName ? `, ${userName.split(' ')[0]}` : ''}! Eu sou o <strong>JARVIS</strong>.{' '}
              {ai
                ? 'Pode falar comigo sobre qualquer coisa: seus planos, estudos, dinheiro, rotina. Também posso registrar coisas por você, é só dizer "bebi água", "recebi 300 do cliente" ou "anota estudar genética no simulado".'
                : 'Pergunte sobre sua rotina, seu desempenho ou peça dicas. Também registro coisas: diga "bebi água" ou "fui ao banheiro".'}
            </p>
            {micOk && <p className="small muted">🎤 Toque no microfone para falar comigo por voz.</p>}
          </div>
        )}
        {data.chat.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.voice && <span className="bubble-voice">🎤 </span>}
            {rich(m.text)}
            {m.actions && (
              <span className="bubble-actions">
                {m.actions.map((a, i) => (
                  <span key={i} className="action-chip">
                    ✓ {a}
                  </span>
                ))}
              </span>
            )}
            {m.role === 'assistant' && (
              <span className="bubble-foot">
                {m.source === 'ai' && <span className="bubble-tag">Claude</span>}
                <button className="bubble-speak" onClick={() => speak(m.text)} aria-label="Ouvir resposta">
                  <Icon name="volume" size={14} />
                </button>
              </span>
            )}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        <div ref={endRef} className="chat-end" />
      </div>

      <div className="chat-dock">
        {voiceError && <p className="small error center">{voiceError}</p>}
        <div className="chips scroll-x">
          <button className="chip ideas-chip" onClick={() => setIdeasOpen(true)}>
            💡 Ideias
          </button>
          {QUICK.map((q) => (
            <button key={q} className="chip" onClick={() => send(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="chat-input glass-strong"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Ouvindo…' : 'Fale ou escreva para o JARVIS…'} aria-label="Mensagem" />
          {input.trim() || !micOk ? (
            <button className="send-btn" type="submit" disabled={!input.trim() || busy} aria-label="Enviar">
              <Icon name="send" size={20} />
            </button>
          ) : (
            <button className={`send-btn mic ${listening ? 'on' : ''}`} type="button" onClick={talk} disabled={busy} aria-label="Falar com o JARVIS">
              <Icon name="mic" size={20} />
            </button>
          )}
        </form>
      </div>

      {ideasOpen && (
        <Sheet title="O que dá para falar com o JARVIS" onClose={() => setIdeasOpen(false)}>
          <p className="small muted">
            Toque numa mensagem para enviar. Tudo isso funciona {ai ? '' : 'de graça, '}mesmo sem a IA. Você também pode escrever do seu jeito ou falar pelo 🎤.
          </p>
          {IDEAS.map((g) => (
            <div key={g.group} className="ideas-group">
              <h3 className="section-title">{g.group}</h3>
              <div className="chips wrap">
                {g.items.map((q) => (
                  <button
                    key={q}
                    className="chip"
                    onClick={() => {
                      setIdeasOpen(false);
                      send(q);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Sheet>
      )}
    </div>
  );
}
