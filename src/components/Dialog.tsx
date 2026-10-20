import { useEffect, useState } from 'react';

interface Request {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Só um botão "Ok" (aviso). */
  notice?: boolean;
  resolve: (ok: boolean) => void;
}

let push: ((r: Request) => void) | null = null;

/** Caixa de confirmação do próprio app (no lugar do confirm() do navegador). */
export function askConfirm(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false);
    push({ message, ...opts, resolve });
  });
}

/** Aviso com um botão "Ok" (no lugar do alert() do navegador). */
export function notify(message: string): Promise<void> {
  return new Promise((resolve) => {
    if (!push) return resolve();
    push({ message, notice: true, resolve: () => resolve() });
  });
}

export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    push = setReq;
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };

  return (
    <div className="dialog-backdrop" onClick={() => close(false)}>
      <div className="dialog glass-strong" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{req.message}</p>
        <div className={req.notice ? 'dialog-actions single' : 'dialog-actions'}>
          {!req.notice && (
            <button className="btn ghost" onClick={() => close(false)}>
              Cancelar
            </button>
          )}
          <button className={`btn ${req.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>
            {req.notice ? 'Ok' : (req.confirmLabel ?? 'Confirmar')}
          </button>
        </div>
      </div>
    </div>
  );
}
