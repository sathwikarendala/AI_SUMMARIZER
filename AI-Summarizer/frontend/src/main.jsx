import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import './styles/global.css';
import './styles/components.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_cmVsYXRlZC1tYWNhdy0zMy5jbGVyay5hY2NvdW50cy5kZXYk"} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>
);
