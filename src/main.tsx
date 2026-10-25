import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { isDemoMode } from './demo/demoMode';

isDemoMode(); // /demo clears earlier runs before anything reads storage

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
