import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { DialogHost } from './components/Dialog';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <DialogHost />
  </StrictMode>,
);

// PWA: permite instalar pelo navegador e abrir offline (não usado dentro do APK)
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform() && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
