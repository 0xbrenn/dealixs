import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { DealixProvider } from './contexts/DealixContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <DealixProvider>
      <App />
    </DealixProvider>
  </React.StrictMode>
);