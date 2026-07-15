import { useState, useRef, useCallback } from 'react';
import { summarizeText } from '../../api/client';
import toast from 'react-hot-toast';

export default function SummarizeSection({ onSummaryChange }) {
  const [text, setText] = useState('');
  const [lengthMode, setLengthMode] = useState('medium');
  const [bulletPoints, setBulletPoints] = useState(false);
  const [language, setLanguage] = useState('English');
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleSummarize = useCallback(async () => {
    if (!text.trim() || text.length < 30) {
      toast.error('Please enter at least 30 characters.');
      return;
    }
    setLoading(true);
    setSummary('');
    try {
      const result = await summarizeText({ text, modelName: 'auto', lengthMode, bulletPoints, language });
      setSummary(result.summary);
      setStats(result);
      onSummaryChange?.(result.summary);
      toast.success('Summary generated! ✨');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [text, lengthMode, bulletPoints, language, onSummaryChange]);

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      toast.success('Copied to clipboard!');
    } else toast('No summary to copy yet.', { icon: '⚠️' });
  };

  const handleDownload = () => {
    if (!summary) { toast('No summary to download.', { icon: '⚠️' }); return; }
    const blob = new Blob([summary], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'summary.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Downloaded!');
  };

  return (
    <section className="section" aria-labelledby="sum-title">
      <div className="section-header">
        <h1 className="section-title" id="sum-title">⚡ Text Summarizer</h1>
        <p className="section-subtitle">Paste any text and get an AI-generated summary in seconds.</p>
      </div>

      <div className="grid-2">
        {/* Input Card */}
        <div className="card">
          <div className="card-title"><span className="title-icon">✍️</span> Input Text</div>
          <div className="textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="input-area"
              placeholder="Paste your article, essay, research paper, or any text here (minimum 30 characters)…"
              rows={12}
              value={text}
              onChange={e => setText(e.target.value)}
              aria-label="Text to summarize"
            />
            <span className="char-count" style={{ color: text.length > 50000 ? 'var(--error)' : undefined }}>
              {text.length.toLocaleString()} chars | {wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Controls */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center justify-between gap-md">
              <label htmlFor="sum-lang" style={{ fontSize: 13, color: 'var(--text-3)' }}>Translate & Summarize To</label>
              <select id="sum-lang" className="styled-select" value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Telugu">Telugu</option>
                <option value="German">German</option>
              </select>
            </div>

            {language !== 'English' && (
              <div style={{ fontSize: 11, color: 'var(--violet-light)', marginTop: -4, display: 'flex', alignItems: 'center', gap: 4 }}>
                ℹ️ Text will be automatically translated/summarized in the target language.
              </div>
            )}

            <div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6 }}>Summary Length</div>
              <div className="radio-group" role="radiogroup" aria-label="Summary length">
                {['short', 'medium', 'detailed'].map(mode => (
                  <div className="radio-option" key={mode}>
                    <input type="radio" name="sum-length" id={`sum-${mode}`} value={mode}
                      checked={lengthMode === mode} onChange={() => setLengthMode(mode)} />
                    <label htmlFor={`sum-${mode}`}>
                      {mode === 'short' ? '📎 Short' : mode === 'medium' ? '📄 Medium' : '📚 Detailed'}
                    </label>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 8, lineHeight: '1.4' }}>
                {lengthMode === 'short' && '📎 Short Mode: Extracts and presents the core matter in a simple, clear, and easily understandable way.'}
                {lengthMode === 'medium' && '📄 Medium Mode: Extracts more content and answers from the given text, providing a distinct summary that is not identical to the Short summary.'}
                {lengthMode === 'detailed' && '📚 Detailed Mode: Explains the concepts in-depth conceptually, ensuring the user understands the key concepts in a detailed, conceptual way.'}
              </div>
            </div>

            <label className="toggle-group" htmlFor="sum-bullets">
              <input type="checkbox" id="sum-bullets" checked={bulletPoints} onChange={e => setBulletPoints(e.target.checked)} />
              <span className="toggle-pill" aria-hidden="true" />
              <span className="toggle-label">Bullet Point Format</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleSummarize} disabled={loading}>
              {loading ? <><span className="spinner" /> Processing…</> : '⚡ Summarize'}
            </button>
            <button className="btn btn-secondary btn-icon" title="Clear" onClick={() => { setText(''); setSummary(''); setStats(null); }}>🗑️</button>
          </div>
        </div>

        {/* Output Card */}
        <div className="card" style={{ position: 'relative' }}>
          <div className="card-title"><span className="title-icon">✨</span> Summary</div>
          <div className={`summary-output ${!summary ? 'empty' : ''}`} aria-live="polite">
            {summary || 'Your AI-generated summary will appear here…'}
          </div>

          {stats && (
            <div className="stats-grid" style={{ marginTop: 16 }}>
              <div className="stat-item"><div className="stat-value">{(stats.original_words || 0).toLocaleString()}</div><div className="stat-label">Original Words</div></div>
              <div className="stat-item"><div className="stat-value">{(stats.summary_words || 0).toLocaleString()}</div><div className="stat-label">Summary Words</div></div>
              <div className="stat-item"><div className="stat-value">{stats.reduction_pct || 0}%</div><div className="stat-label">Reduction</div></div>
              <div className="stat-item"><div className="stat-value">{(stats.length_mode || 'medium').charAt(0).toUpperCase() + (stats.length_mode || 'medium').slice(1)}</div><div className="stat-label">Mode</div></div>
            </div>
          )}

          <div className="summary-actions">
            <button className="btn btn-secondary" onClick={handleCopy}>📋 Copy</button>
            <button className="btn btn-secondary" onClick={handleDownload}>💾 Download</button>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid-3" style={{ marginTop: 8 }}>
        {[
          { icon: '🧠', title: 'BART & T5 Models', desc: 'State-of-the-art offline models' },
          { icon: '⚡', title: 'Smart Chunking', desc: 'Handles documents of any length' },
          { icon: '🌍', title: 'Multi-Language', desc: '20+ languages via Gemini' },
        ].map((f, i) => (
          <div className="card" key={i} style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{f.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
