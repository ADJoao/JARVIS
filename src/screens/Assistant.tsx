import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { store, uid, useData } from '../lib/storage';
import { localAnswer } from '../lib/assistant';
import { Icon } from '../components/Icon';
import { askConfirm } from '../components/Dialog';
import type { ChatMsg } from '../lib/types';

const QUICK = [
  'O que eu tenho hoje?',
  'Quanto falta hoje?',
  'Como está meu desempenho?',
  'O que devo melhorar?',
  'Como está meu sono?',
  'Quanto tempo sem ir ao banheiro?',
  'O que tenho amanhã?',
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

export function Assistant({ onSettings }: { onSettings: () => void }) {
  const data = useData();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const ai = data.settings.aiEnabled && Boolean(data.settings.apiKey);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [data.chat.length, streaming]);

  const push = (m: Omit<ChatMsg, 'id' | 'at'>) =>
    store.update((d) => ({ ...d, chat: [...d.chat, { ...m, id: uid(), at: Date.now() }].slice(-200) }));

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    const history = store.get().chat;
    push({ role: 'user', text });

    const local = localAnswer(text);
    if (!ai || local.action) {
      setBusy(true);
      setTimeout(() => {
        push({ role: 'assistant', text: local.text, source: 'local' });
        setBusy(false);
      }, 350);
      return;
    }

    setBusy(true);
    setStreaming('');
    try {
      // carrega o SDK do Claude só quando a IA é usada (deixa o app mais leve)
      const { askClaude } = await import('../lib/claude');
      const answer = await askClaude(store.get(), history, text, (p) => setStreaming(p));
      push({ role: 'assistant', text: answer, source: 'ai' });
    } catch (e) {
      const msg = e instanceof Error && e.name === 'AiError' ? e.message : 'Não consegui falar com a IA agora.';
      push({ role: 'assistant', text: `⚠️ ${msg}\n\nResposta do modo local:\n\n${local.text}`, source: 'local' });
    } finally {
      setStreaming(null);
      setBusy(false);
    }
  };

  return (
    <div className="screen chat-screen">
      <header className="top">
        <div className="row">
          <div className="jarvis-orb" aria-hidden="true" />
          <div>
            <h1>JARVIS</h1>
            <p className="muted small">{ai ? '✨ IA (Claude) ativada' : 'Assistente local · grátis e offline'}</p>
          </div>
        </div>
        <div className="row">
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

      <div className="chat">
        {data.chat.length === 0 && (
          <div className="chat-hello glass">
            <p>
              Olá! Eu sou o <strong>JARVIS</strong>. Pergunte sobre sua rotina, seu desempenho ou peça dicas. Também posso registrar coisas: diga
              "bebi água" ou "fui ao banheiro".
            </p>
            {!ai && <p className="small muted">Quer respostas mais inteligentes e livres? Ative a IA do Claude em Ajustes (precisa de uma chave de API).</p>}
          </div>
        )}
        {data.chat.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {rich(m.text)}
            {m.role === 'assistant' && m.source === 'ai' && <span className="bubble-tag">Claude</span>}
          </div>
        ))}
        {streaming !== null && <div className="bubble assistant">{streaming ? rich(streaming) : <span className="typing"><i /><i /><i /></span>}</div>}
        {busy && streaming === null && (
          <div className="bubble assistant">
            <span className="typing"><i /><i /><i /></span>
          </div>
        )}
        <div ref={endRef} className="chat-end" />
      </div>

      <div className="chat-dock">
        <div className="chips scroll-x">
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
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao JARVIS…" aria-label="Mensagem" />
          <button className="send-btn" type="submit" disabled={!input.trim() || busy} aria-label="Enviar">
            <Icon name="send" size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
