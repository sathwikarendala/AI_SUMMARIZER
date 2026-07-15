import { useState, useCallback } from 'react';
import { uploadFile } from '../../api/client';
import toast from 'react-hot-toast';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadSection({ onSummaryChange }) {
  const [file, setFile] = useState(null);
  const [lengthMode, setLengthMode] = useState('medium');
  const [bulletPoints, setBulletPoints] = useState(false);
  const [language, setLanguage] = useState('English');
  const [summary, setSummary] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f) => { if (f) setFile(f); };

  const handleSubmit = useCallback(async () => {
    if (!file) { toast.error('Please select a file first.'); return; }
    setLoading(true);
    setSummary('');
    try {
      const result = await uploadFile(file, { modelName: 'auto', lengthMode, bulletPoints, language });
      setSummary(result.summary || '');
      setStats(result);
      onSummaryChange?.(result.summary);
      toast.success('File summarized! 📄');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [file, lengthMode, bulletPoints, language, onSummaryChange]);

  const handleCopy = () => {
    if (summary) { navigator.clipboard.writeText(summary); toast.success('Copied!'); }
    else toast('No summary yet.', { icon: '⚠️' });
  };

  const handleDownload = () => {
    if (!summary) { toast('No summary yet.', { icon: '⚠️' }); return; }
    const blob = new Blob([summary], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'file_summary.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="section" aria-labelledby="upload-title">
      <div className="section-header">
        <h1 className="section-title" id="upload-title">📄 File Upload</h1>
        <p className="section-subtitle">Upload PDF, DOCX, or TXT files — extract text and summarize.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          {/* Drop Zone */}
          <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          >
            <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={e => handleFile(e.target.files[0])} />
            <span className="drop-icon" aria-hidden="true">📂</span>
            <div className="drop-title">Drop your file here</div>
            <div className="drop-subtitle">or click to browse</div>
            <div className="drop-formats">
              <span className="format-badge">PDF</span>
              <span className="format-badge">DOCX</span>
              <span className="format-badge">TXT</span>
            </div>
          </div>

          {file && (
            <div className="file-info-bar" style={{ marginTop: 12, display: 'flex' }}>
              <span className="file-info-icon">📄</span>
              <div>
                <div className="file-info-name">{file.name}</div>
                <div className="file-info-size">{formatFileSize(file.size)}</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center justify-between gap-md">
              <label htmlFor="upload-lang" style={{ fontSize: 13, color: 'var(--text-3)' }}>Translate & Summarize To</label>
              <select id="upload-lang" className="styled-select" value={language} onChange={e => setLanguage(e.target.value)}>
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
              <div className="radio-group" role="radiogroup">
                {['short', 'medium', 'detailed'].map(m => (
                  <div className="radio-option" key={m}>
                    <input type="radio" name="upload-length" id={`upload-${m}`} value={m}
                      checked={lengthMode === m} onChange={() => setLengthMode(m)} />
                    <label htmlFor={`upload-${m}`}>{m === 'short' ? '📎 Short' : m === 'medium' ? '📄 Medium' : '📚 Detailed'}</label>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 8, lineHeight: '1.4' }}>
                {lengthMode === 'short' && '📎 Short Mode: Extracts and presents the core matter in a simple, clear, and easily understandable way.'}
                {lengthMode === 'medium' && '📄 Medium Mode: Extracts more content and answers from the given text, providing a distinct summary that is not identical to the Short summary.'}
                {lengthMode === 'detailed' && '📚 Detailed Mode: Explains the concepts in-depth conceptually, ensuring the user understands the key concepts in a detailed, conceptual way.'}
              </div>
            </div>
            <label className="toggle-group" htmlFor="upload-bullets">
              <input type="checkbox" id="upload-bullets" checked={bulletPoints} onChange={e => setBulletPoints(e.target.checked)} />
              <span className="toggle-pill" />
              <span className="toggle-label">Bullet Point Format</span>
            </label>
          </div>

          <button className="btn btn-primary btn-lg w-full mt-lg" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" /> Processing…</> : '⚡ Extract & Summarize'}
          </button>
        </div>

        {/* Output */}
        <div className="card" style={{ position: 'relative' }}>
          <div className="card-title"><span className="title-icon">✨</span> Summary</div>
          <div className={`summary-output ${!summary ? 'empty' : ''}`} aria-live="polite">
            {summary || 'Upload a file to see the summary here…'}
          </div>
          {stats && (
            <div className="stats-grid" style={{ marginTop: 16 }}>
              <div className="stat-item"><div className="stat-value">{(stats.file_type || 'file').toUpperCase()}</div><div className="stat-label">File Type</div></div>
              <div className="stat-item"><div className="stat-value">{stats.page_count || '—'}</div><div className="stat-label">Pages</div></div>
              <div className="stat-item"><div className="stat-value">{(stats.original_words || 0).toLocaleString()}</div><div className="stat-label">Original Words</div></div>
              <div className="stat-item"><div className="stat-value">{stats.reduction_pct || 0}%</div><div className="stat-label">Reduction</div></div>
            </div>
          )}
          <div className="summary-actions">
            <button className="btn btn-secondary" onClick={handleCopy}>📋 Copy</button>
            <button className="btn btn-secondary" onClick={handleDownload}>💾 Download</button>
          </div>
        </div>
      </div>
    </section>
  );
}
