import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* базовые стили проекта */
import './index.css';

/* ваши календарные темы, если подключаете из файлов */
import './google_calendar_theme.css';
import './hourly_lines_15m.css';

/* фикс модалок — ДОЛЖЕН идти ПОСЛЕ остальных css */
import './modal_fix.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);