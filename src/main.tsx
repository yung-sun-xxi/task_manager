import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* Mantine styles must come before app styles */
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

/* базовые стили проекта */
import './index.css';

/* ваши календарные темы, если подключаете из файлов */
import './google_calendar_theme.css';
import './hourly_lines_15m.css';

/* фикс модалок — ДОЛЖЕН идти ПОСЛЕ остальных css */
import './modal_fix.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={{ primaryColor: 'indigo' }}>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
