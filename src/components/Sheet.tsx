import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Painéis abertos, do mais antigo ao mais novo: o "voltar" e o Esc fecham só o de cima. */
const openStack: number[] = [];
let nextId = 1;

/** Painel que sobe da parte de baixo da tela, com fundo de vidro. */
export function Sheet({ title, onClose, children }: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = nextId++;
    openStack.push(id);
    const isTop = () => openStack[openStack.length - 1] === id;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && isTop() && closeRef.current();
    const onBack = () => isTop() && setTimeout(() => closeRef.current(), 0);
    window.addEventListener('keydown', onKey);
    window.addEventListener('jarvis:back', onBack);
    document.body.classList.add('no-scroll');
    return () => {
      openStack.splice(openStack.indexOf(id), 1);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('jarvis:back', onBack);
      if (!openStack.length) document.body.classList.remove('no-scroll');
    };
  }, []);

  // portal: abre sempre por cima da tela inteira, mesmo se chamado de dentro de um cartão de vidro
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet glass-strong" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
