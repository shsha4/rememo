import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initTheme } from './stores/theme.store';
import './index.css';

// 저장된 테마 선호로 <html data-theme>를 렌더 전에 맞춘다(플래시 방지).
initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
