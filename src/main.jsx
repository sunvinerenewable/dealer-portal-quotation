import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initCrashReporter } from './services/crashReporter.js';

// Initialize Slack Crash Reporter for unhandled runtime exceptions & unhandled promises
initCrashReporter();
// Register Service Worker after initial load to avoid competing with critical path
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerSW({ immediate: true });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
