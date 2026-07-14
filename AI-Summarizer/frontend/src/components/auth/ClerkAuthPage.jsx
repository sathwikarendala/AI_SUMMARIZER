import { SignIn } from '@clerk/react';

export default function ClerkAuthPage() {
  return (
    <div className="auth-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, var(--bg-1), var(--bg-2))',
      padding: '20px'
    }}>
      <div className="auth-card" style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-lg)',
        padding: '30px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '40px' }}>🤖</span>
          <h2 style={{ fontSize: '20px', color: 'var(--text-1)', marginTop: '10px' }}>Welcome to AI Summarizer</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-4)' }}>Sign in to access your dashboard</p>
        </div>
        <SignIn appearance={{
          elements: {
            rootBox: 'clerk-root',
            card: 'clerk-card',
            formButtonPrimary: 'clerk-button-primary',
          }
        }} />
        <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '10px' }}>
          Powered by Clerk Authentication
        </div>
      </div>
    </div>
  );
}
