import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* Mantine */
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

/* Your project styles (as before) */
import './index.css';
import './google_calendar_theme.css';
import './hourly_lines_15m.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={{ primaryColor: 'indigo' }}>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);
