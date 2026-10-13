import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA Service Worker 등록 (오프라인 지도 및 리소스 영구 캐싱)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker 등록 완료:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker 등록 실패:', err);
      });
  });
}
