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
import './modal_fix.css';
import './calendar.css';
import "./themes/theme-light.css";
import "./themes/theme-dark.css";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={{ primaryColor: 'indigo' }}>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);