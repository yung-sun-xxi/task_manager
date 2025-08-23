import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* Mantine styles must come before app styles */
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

/* base project styles */
import './index.css';

/* calendar themes if imported from files */
import './google_calendar_theme.css';
import './hourly_lines_15m.css';

/* modal fix — MUST come AFTER other css */
import './modal_fix.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={{ primaryColor: 'indigo' }}>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
