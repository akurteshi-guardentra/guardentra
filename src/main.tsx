import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// @ts-ignore
import './index.css';
// i18n loads with the authenticated shell (Layout) — not on public Landing.

const rootElement = document.getElementById('root');
if (!rootElement) {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
