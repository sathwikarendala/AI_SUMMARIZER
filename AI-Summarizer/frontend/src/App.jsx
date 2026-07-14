import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { Show } from '@clerk/react';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar, { NAV_ITEMS } from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ClerkAuthPage from './components/auth/ClerkAuthPage';
import SummarizeSection from './components/sections/SummarizeSection';
import UploadSection from './components/sections/UploadSection';
import KeywordsSection from './components/sections/KeywordsSection';
import AudioSection from './components/sections/AudioSection';
import HistorySection from './components/sections/HistorySection';
import PlagiarismSection from './components/sections/PlagiarismSection';
import TextProcessorSection from './components/sections/TextProcessorSection';
import ChatSection from './components/sections/ChatSection';

function AppContent() {
  const [activeSection, setActiveSection] = useState('summarize');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [latestSummary, setLatestSummary] = useState('');

  const handleSummaryChange = useCallback((s) => setLatestSummary(s), []);

  const currentNav = NAV_ITEMS.find(n => n.key === activeSection) || NAV_ITEMS[0];

  const renderSection = () => {
    switch (activeSection) {
      case 'summarize':  return <SummarizeSection onSummaryChange={handleSummaryChange} />;
      case 'upload':     return <UploadSection onSummaryChange={handleSummaryChange} />;
      case 'chat':       return <ChatSection />;
      case 'keywords':   return <KeywordsSection />;
      case 'processor':  return <TextProcessorSection />;
      case 'audio':      return <AudioSection sharedSummary={latestSummary} />;
      case 'plagiarism': return <PlagiarismSection />;
      case 'history':    return <HistorySection />;
      default:           return <SummarizeSection onSummaryChange={handleSummaryChange} />;
    }
  };

  return (
    <>
      <Show when="signed-out">
        <ClerkAuthPage />
      </Show>

      <Show when="signed-in">
        <div className="app-layout">
          <Sidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="main-content">
            <Topbar
              title={`${currentNav.icon} ${currentNav.label}`}
              subtitle={currentNav.subtitle}
              onHamburgerClick={() => setSidebarOpen(prev => !prev)}
            />
            {renderSection()}
          </main>
        </div>
      </Show>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-3)',
            color: 'var(--text-1)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-md)',
            fontSize: '13px',
            backdropFilter: 'blur(16px)',
          },
        }}
      />
      <AppContent />
    </ThemeProvider>
  );
}
