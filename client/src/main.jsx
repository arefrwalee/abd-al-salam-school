import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ModalHost, Toaster } from './components/modals.jsx';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/sync.css';
import './styles/print.css';
import './styles/responsive.css';

document.documentElement.lang = 'ar';
document.documentElement.dir = 'rtl';

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App />
    <ModalHost />
    <Toaster />
  </StrictMode>
);
