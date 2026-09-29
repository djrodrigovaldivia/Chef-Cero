import './utils/fixFetch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registro no bloqueante del Service Worker para PWA y modo Offline
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[Chef Cero PWA] Nueva versión lista en segundo plano.');
              }
            };
          }
        };
      })
      .catch((err) => {
        console.warn('[Chef Cero PWA] Registro de SW omitido o fallido:', err);
      });
  });
}
