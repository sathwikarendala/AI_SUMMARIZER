import { useState, useCallback, useEffect } from 'react';
import { checkPlagiarism, humanizeText } from '../../api/client';
import toast from 'react-hot-toast';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CircularProgress({ value, label, color }) {
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: radius * 2, height: radius * 2 }}>
        <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            stroke="var(--bg-3)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease-in-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 'bold', color: 'var(--text-1)'
        }}>
          {value}%
        </div>
      </div>
      <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

export default function PlagiarismSection() {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'file'
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('both'); // 'local' | 'global' | 'both'
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Advanced Interactive States
  const [activeResultTab, setActiveResultTab] = useState('summary'); // 'summary' | 'interactive'
  const [activePassageIndex, setActivePassageIndex] = useState(null);
  const [currentStep, setCurrentStep] = useState('');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [scannedText, setScannedText] = useState('');

  // AI Humanizer feature states
  const [humanizing, setHumanizing] = useState(false);
  const [humanizedText, setHumanizedText] = useState('');

  // Session scan counter & localStorage history
  const [scanCount, setScanCount] = useState(() => {
    return parseInt(localStorage.getItem('plag_scan_count') || '0', 10);
  });
  const [scanHistory, setScanHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('plag_scan_history') || '[]');
    } catch {
      return [];
    }
  });

  const handleFile = (f) => { if (f) setFile(f); };

  const getWordCount = () => {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  };

  const wordCount = getWordCount();
  const isWordCountValid = wordCount >= 10 && wordCount <= 10000;
  
  const getWordCountFeedback = () => {
    if (wordCount === 0) return { text: 'Empty', color: 'var(--text-4)' };
    if (wordCount < 10) return { text: `${wordCount} / 10 min words`, color: 'var(--warning)' };
    if (wordCount > 10000) return { text: `${wordCount} / 10000 max words`, color: 'var(--error)' };
    return { text: `${wordCount} words (Ready to scan)`, color: 'var(--success)' };
  };

  const feedback = getWordCountFeedback();

  const getScoreColor = (score) => {
    if (score < 15) return 'var(--success)';
    if (score < 45) return 'var(--warning)';
    return 'var(--error)';
  };

  const getHumanScoreColor = (score) => {
    if (score > 80) return 'var(--success)';
    if (score > 50) return 'var(--warning)';
    return 'var(--error)';
  };

  const handleLoadFromHistory = (item) => {
    setResults(item.results);
    setText(item.text || '');
    setScannedText(item.results.full_text || item.text || '');
    setMode(item.mode);
    setActiveResultTab('summary');
    setActivePassageIndex(null);
    setHumanizedText('');
    toast.success('Originality report loaded from history.');
  };

  const handleHumanize = async () => {
    const sourceText = scannedText || text;
    if (!sourceText || sourceText.trim().length < 50) {
      toast.error('Please enter or scan at least 50 characters of text to humanize.');
      return;
    }
    setHumanizing(true);
    setHumanizedText('');
    try {
      const res = await humanizeText(sourceText);
      setHumanizedText(res.humanized_text);
      toast.success('AI text converted to human style! ✨');
    } catch (err) {
      toast.error(`Humanization failed: ${err.message}`);
    } finally {
      setHumanizing(false);
    }
  };

  const handleDeleteHistoryItem = (id, e) => {
    e.stopPropagation();
    const updated = scanHistory.filter(h => h.id !== id);
    setScanHistory(updated);
    localStorage.setItem('plag_scan_history', JSON.stringify(updated));
    toast.success('History item deleted.');
  };

  const handleSubmit = useCallback(async () => {
    if (activeTab === 'text') {
      if (!text) {
        toast.error('Please paste some text.');
        return;
      }
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      if (words < 10) {
        toast.error(`Please provide at least 10 words (currently ${words} words).`);
        return;
      }
      if (words > 10000) {
        toast.error(`Text exceeds maximum limit of 10000 words (currently ${words} words).`);
        return;
      }
    }
    if (activeTab === 'file' && !file) {
      toast.error('Please select or upload a document.');
      return;
    }

    setLoading(true);
    setResults(null);
    setActivePassageIndex(null);
    setCompletedSteps([]);
    setCurrentStep('extract');
    setHumanizedText('');

    // Simulate progress log step ticks
    const timers = [];
    
    // Step 1 -> Step 2
    timers.push(setTimeout(() => {
      setCompletedSteps(prev => [...prev, 'extract']);
      setCurrentStep('local');
    }, 800));

    // Step 2 -> Step 3 or 4
    timers.push(setTimeout(() => {
      setCompletedSteps(prev => [...prev, 'local']);
      if (mode !== 'local') {
        setCurrentStep('global');
      } else {
        setCurrentStep('compile');
      }
    }, 1800));

    // Step 3 -> Step 4
    if (mode !== 'local') {
      timers.push(setTimeout(() => {
        setCompletedSteps(prev => [...prev, 'global']);
        setCurrentStep('compile');
      }, 3000));
    }

    try {
      const payload = activeTab === 'text' 
        ? { text, mode } 
        : { file, mode };
        
      const response = await checkPlagiarism(payload);
      
      // Stop timers & mark all relevant steps done
      timers.forEach(t => clearTimeout(t));
      const finalCompleted = ['extract', 'local'];
      if (mode !== 'local') finalCompleted.push('global');
      finalCompleted.push('compile');
      setCompletedSteps(finalCompleted);
      setCurrentStep('');

      setResults(response);
      setScannedText(response.full_text || text);
      toast.success('Originality report generated successfully! 🛡️');

      // Update Session Stats & Local Storage History
      const nextCount = scanCount + 1;
      setScanCount(nextCount);
      localStorage.setItem('plag_scan_count', nextCount.toString());

      // Save full text parsed from document or text pasted
      let savedText = response.full_text || text;

      const newItem = {
        id: Date.now().toString(),
        name: response.filename || (text ? (text.substring(0, 30) + '...') : 'Pasted Text'),
        score: response.similarity_score,
        aiScore: response.ai_percentage,
        mode: response.mode || mode,
        date: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
        results: response,
        text: savedText
      };

      const updatedHistory = [newItem, ...scanHistory.slice(0, 5)];
      setScanHistory(updatedHistory);
      localStorage.setItem('plag_scan_history', JSON.stringify(updatedHistory));

    } catch (err) {
      toast.error(err.message || 'Plagiarism scan failed.');
    } finally {
      timers.forEach(t => clearTimeout(t));
      setLoading(false);
      setCurrentStep('');
    }
  }, [activeTab, text, file, mode, scanCount, scanHistory]);

  const handleExportReport = () => {
    if (!results) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Originality Report - ${results.filename || 'Pasted Text'}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 20px; font-size: 24px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; color: #64748b; }
            .metrics-grid { display: flex; gap: 20px; margin-bottom: 30px; }
            .metric-card { flex: 1; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; text-align: center; }
            .metric-val { font-size: 32px; font-weight: 800; margin-bottom: 4px; }
            .metric-lbl { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; }
            .verdict { background: #f8fafc; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 4px; margin-bottom: 30px; font-size: 15px; font-weight: 500; }
            .section-title { font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; margin-bottom: 16px; color: #334155; }
            .passage-card { border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; margin-bottom: 12px; background: #fafafa; }
            .passage-text { font-style: italic; margin-bottom: 8px; font-size: 14px; color: #0f172a; }
            .passage-meta { display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
            .source-badge { background: #fee2e2; color: #ef4444; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
            .source-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .source-table th, .source-table td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 14px; }
            .source-table th { background: #f8fafc; font-weight: 600; color: #475569; }
          </style>
        </head>
        <body>
          <h1>🛡️ Plagiarism & Originality Checker Report</h1>
          <div class="header-info">
            <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Scan Mode:</strong> ${results.mode?.toUpperCase() || 'BOTH'}</div>
          </div>
          
          <div class="metrics-grid">
            <div class="metric-card" style="border-color: ${results.similarity_score > 30 ? '#ef4444' : '#10b981'}">
              <div class="metric-val" style="color: ${results.similarity_score > 30 ? '#ef4444' : '#10b981'}">${results.similarity_score}%</div>
              <div class="metric-lbl">Similarity Score</div>
            </div>
            ${results.ai_percentage !== undefined ? `
            <div class="metric-card">
              <div class="metric-val" style="color: #3b82f6">${results.ai_percentage}%</div>
              <div class="metric-lbl">AI Content Probability</div>
            </div>
            ` : ''}
          </div>

          <div class="verdict">
            <strong>Verdict:</strong> ${results.verdict}
          </div>

          <div class="section-title">Flagged Passages (${results.flagged_passages?.length || 0})</div>
          ${(results.flagged_passages || []).map(p => `
            <div class="passage-card">
              <div class="passage-text">"${p.text}"</div>
              <div class="passage-meta">
                <span>Source: <strong>${p.source}</strong></span>
                <span class="source-badge">${p.reason}</span>
              </div>
            </div>
          `).join('')}

          <div class="section-title">Matching Sources</div>
          ${results.matched_sources && results.matched_sources.length > 0 ? `
            <table class="source-table">
              <thead>
                <tr>
                  <th>Source Title</th>
                  <th>URL</th>
                  <th>Match %</th>
                </tr>
              </thead>
              <tbody>
                ${results.matched_sources.map(s => `
                  <tr>
                    <td><strong>${s.title}</strong></td>
                    <td>${s.url ? `<a href="${s.url}" target="_blank">${s.url}</a>` : '—'}</td>
                    <td><span style="font-weight:700">${s.match_percentage}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="font-size:14px;color:#64748b;">No direct source matches flagged.</p>'}
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderHighlightedText = () => {
    if (!results || !scannedText) return <div className="highlighter-container" style={{ fontStyle: 'italic', color: 'var(--text-4)' }}>No text available for highlight preview.</div>;
    const passages = results.flagged_passages || [];
    if (passages.length === 0) {
      return (
        <div className="highlighter-container">
          <span className="plag-highlight safe" title="Original / Clean content">
            {scannedText}
          </span>
        </div>
      );
    }

    // Find occurrences of passages and map indices
    let occurrences = [];
    passages.forEach((p, idx) => {
      const pText = p.text;
      if (!pText) return;
      let startIdx = scannedText.indexOf(pText);
      while (startIdx !== -1) {
        occurrences.push({
          start: startIdx,
          end: startIdx + pText.length,
          passage: p,
          index: idx
        });
        startIdx = scannedText.indexOf(pText, startIdx + 1);
      }
    });

    // Sort by start index
    occurrences.sort((a, b) => a.start - b.start);

    // Remove overlaps
    let nonOverlapping = [];
    let lastEnd = 0;
    for (let occ of occurrences) {
      if (occ.start >= lastEnd) {
        nonOverlapping.push(occ);
        lastEnd = occ.end;
      }
    }

    if (nonOverlapping.length === 0) {
      return (
        <div className="highlighter-container">
          <span className="plag-highlight safe" title="Original / Clean content">
            {scannedText}
          </span>
        </div>
      );
    }

    const parts = [];
    let currentIdx = 0;
    nonOverlapping.forEach((occ, i) => {
      // Normal/Safe text before match
      if (occ.start > currentIdx) {
        parts.push(
          <span key={`safe-${i}`} className="plag-highlight safe" title="Original / Clean content">
            {scannedText.substring(currentIdx, occ.start)}
          </span>
        );
      }
      
      const typeClass = occ.passage.source === 'AI Generator' ? 'ai' : 
                        (occ.passage.reason?.toLowerCase().includes('local') ? 'local' : 'global');
      
      parts.push(
        <span 
          key={`flagged-${i}`} 
          className={`plag-highlight ${typeClass} ${activePassageIndex === occ.index ? 'active' : ''}`}
          onClick={() => setActivePassageIndex(occ.index)}
          title={`Flagged segment: ${occ.passage.reason}`}
        >
          {scannedText.substring(occ.start, occ.end)}
        </span>
      );
      currentIdx = occ.end;
    });

    if (currentIdx < scannedText.length) {
      parts.push(
        <span key="safe-end" className="plag-highlight safe" title="Original / Clean content">
          {scannedText.substring(currentIdx)}
        </span>
      );
    }

    return <div className="highlighter-container">{parts}</div>;
  };

  return (
    <section className="section" aria-labelledby="plagiarism-title">
      {/* Premium Trial Widget */}
      <div className="trial-banner-card">
        <div className="trial-banner-info">
          <div className="trial-banner-title">
            <span>🛡️ Plagiarism Checker Pro Tier</span>
            <span className="trial-banner-badge">Unlimited Free Trial</span>
          </div>
          <div className="trial-banner-desc">
            Enjoy full access to our offline Local Database scanner & advanced Global AI checking indices.
          </div>
        </div>
        <div className="trial-banner-stats">
          <div className="trial-banner-stats-val">{scanCount} Scans</div>
          <div className="trial-banner-stats-lbl">Total Scans Run</div>
        </div>
      </div>

      <div className="section-header">
        <h1 className="section-title" id="plagiarism-title">🛡️ Plagiarism & Originality Checker</h1>
        <p className="section-subtitle">Scan your content against local document library and global AI indices to verify text uniqueness.</p>
      </div>

      <div className="grid-2">
        {/* Input Panel */}
        <div className="card">
          <div className="tab-container" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button 
              className={`btn ${activeTab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('text')}
              style={{ flex: 1 }}
            >
              📝 Paste Text
            </button>
            <button 
              className={`btn ${activeTab === 'file' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('file')}
              style={{ flex: 1 }}
            >
              📂 Upload File
            </button>
          </div>

          {activeTab === 'text' ? (
            <div className="unique-textbox-container">
              <div className="textbox-toolbar">
                <span className="textbox-toolbar-title">Originality Input Box</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => {
                      navigator.clipboard.readText()
                        .then(clipText => setText(clipText))
                        .catch(() => toast.error('Please use Ctrl+V to paste content'));
                    }}
                    title="Paste from clipboard"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    📋 Paste
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setText('')}
                    title="Clear content"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    🧹 Clear
                  </button>
                </div>
              </div>
              
              <textarea
                className={`unique-textarea ${wordCount > 0 ? (isWordCountValid ? 'valid' : 'invalid') : ''}`}
                placeholder="Paste text here to evaluate originality (minimum 1,500 words, maximum 10,000 words)..."
                value={text}
                onChange={e => setText(e.target.value)}
                style={{ minHeight: 220, resize: 'vertical' }}
              />
              
              <div className="textbox-footer">
                <div className="stats-badge">
                  ⏱️ {Math.ceil(wordCount / 200)} min read
                </div>
                <div className="word-count-badge" style={{ color: feedback.color, fontWeight: 'bold' }}>
                  {feedback.text}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div 
                className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                style={{ height: 220, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
              >
                <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={e => handleFile(e.target.files[0])} />
                <span className="drop-icon" aria-hidden="true" style={{ fontSize: 40, marginBottom: 10 }}>📁</span>
                <div className="drop-title">Drop your document here</div>
                <div className="drop-subtitle">or click to browse</div>
                <div className="drop-formats" style={{ marginTop: 10 }}>
                  <span className="format-badge">PDF</span>
                  <span className="format-badge">DOCX</span>
                  <span className="format-badge">TXT</span>
                </div>
              </div>

              {file && (
                <div className="file-info-bar" style={{ marginTop: 12, display: 'flex', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
                  <span className="file-info-icon" style={{ fontSize: 20, marginRight: 10 }}>📄</span>
                  <div>
                    <div className="file-info-name" style={{ fontWeight: 600, fontSize: 13 }}>{file.name}</div>
                    <div className="file-info-size" style={{ fontSize: 11, color: 'var(--text-4)' }}>{formatFileSize(file.size)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Check Button */}
          <button className="btn btn-primary btn-lg w-full mt-lg" onClick={handleSubmit} disabled={loading} style={{ marginTop: 20 }}>
            {loading ? <><span className="spinner" /> Analyzing content originality...</> : '🛡️ Check Originality'}
          </button>

          {/* Step-by-Step Progress tracker when loading */}
          {loading && (
            <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>Scan Progress Tracker</div>
              <div className="progress-log-list">
                <div className={`progress-log-item ${currentStep === 'extract' ? 'active' : ''} ${completedSteps.includes('extract') ? 'done' : ''}`}>
                  <span className={`progress-log-icon ${completedSteps.includes('extract') ? 'done' : currentStep === 'extract' ? 'active' : 'pending'}`}>
                    {completedSteps.includes('extract') ? '✓' : ''}
                  </span>
                  <span>Extracting and parsing document text</span>
                </div>
                <div className={`progress-log-item ${currentStep === 'local' ? 'active' : ''} ${completedSteps.includes('local') ? 'done' : ''}`}>
                  <span className={`progress-log-icon ${completedSteps.includes('local') ? 'done' : currentStep === 'local' ? 'active' : 'pending'}`}>
                    {completedSteps.includes('local') ? '✓' : ''}
                  </span>
                  <span>Searching local document index</span>
                </div>
                {mode !== 'local' && (
                  <div className={`progress-log-item ${currentStep === 'global' ? 'active' : ''} ${completedSteps.includes('global') ? 'done' : ''}`}>
                    <span className={`progress-log-icon ${completedSteps.includes('global') ? 'done' : currentStep === 'global' ? 'active' : 'pending'}`}>
                      {completedSteps.includes('global') ? '✓' : ''}
                    </span>
                    <span>Analyzing global AI style patterns</span>
                  </div>
                )}
                <div className={`progress-log-item ${currentStep === 'compile' ? 'active' : ''} ${completedSteps.includes('compile') ? 'done' : ''}`}>
                  <span className={`progress-log-icon ${completedSteps.includes('compile') ? 'done' : currentStep === 'compile' ? 'active' : 'pending'}`}>
                    {completedSteps.includes('compile') ? '✓' : ''}
                  </span>
                  <span>Compiling originality metrics & report</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}><span className="title-icon">📊</span> Originality Report</div>
            {results && (
              <button className="btn btn-secondary btn-sm" onClick={handleExportReport} style={{ padding: '6px 12px', fontSize: 12 }}>
                📥 Export PDF
              </button>
            )}
          </div>
          
          {!results ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-4)', textAlign: 'center', padding: 20 }}>
              <span style={{ fontSize: 48, marginBottom: 12 }}>🛡️</span>
              <div>No report generated yet. Submit text or upload a document to begin analysis.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Score Board Title */}
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px', marginTop: '4px' }}>
                📊 SCORE BOARD
              </div>

              {/* Score Meters */}
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '15px 0', borderBottom: '1px solid var(--glass-border)', gap: 10 }}>
                <CircularProgress 
                  value={mode === 'local' ? 0 : results.ai_percentage} 
                  label="AI SCORE" 
                  color={getScoreColor(mode === 'local' ? 0 : results.ai_percentage)} 
                />
                
                <CircularProgress 
                  value={results.similarity_score} 
                  label="PLAGIARISM PERCENTAGE" 
                  color={getScoreColor(results.similarity_score)} 
                />
                
                <CircularProgress 
                  value={mode === 'local' ? 100 : (100 - results.ai_percentage)} 
                  label="HUMAN PERCENTAGE" 
                  color={getHumanScoreColor(mode === 'local' ? 100 : (100 - results.ai_percentage))} 
                />
              </div>

              {/* Tab selector for summary / interactive highlighter */}
              <div className="tab-container" style={{ display: 'flex', gap: 8, padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--r-sm)' }}>
                <button 
                  className={`btn btn-sm ${activeResultTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                  onClick={() => setActiveResultTab('summary')}
                >
                  📝 Report Summary
                </button>
                <button 
                  className={`btn btn-sm ${activeResultTab === 'interactive' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                  onClick={() => setActiveResultTab('interactive')}
                >
                  🔍 Flagged Passages (Interactive)
                </button>
              </div>

              {activeResultTab === 'summary' ? (
                <>
                  {/* Verdict Summary */}
                  <div style={{ background: 'var(--bg-2)', padding: '12px 16px', borderRadius: 'var(--r-md)', borderLeft: `4px solid ${getScoreColor(results.similarity_score)}` }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Verdict</div>
                    <div style={{ fontSize: 13, lineHeight: '1.4', color: 'var(--text-1)' }}>{results.verdict}</div>
                  </div>

                  {/* Flagged Passages list */}
                  {results.flagged_passages && results.flagged_passages.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Flagged Passages ({results.flagged_passages.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                        {results.flagged_passages.map((passage, i) => (
                          <div 
                            key={i} 
                            style={{ 
                              padding: 10, 
                              background: activePassageIndex === i ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-3)', 
                              border: activePassageIndex === i ? '1.5px solid var(--violet-light)' : '1px solid var(--glass-border)', 
                              borderRadius: 'var(--r-sm)',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              setActiveResultTab('interactive');
                              setActivePassageIndex(i);
                            }}
                          >
                            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--text-1)' }}>"{passage.text}"</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11 }}>
                              <span style={{ color: 'var(--text-3)' }}>Source: <strong>{passage.source}</strong></span>
                              <span style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 4 }}>{passage.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matched Sources */}
                  {results.matched_sources && results.matched_sources.length > 0 ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Matching Sources</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                        {results.matched_sources.map((src, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, marginRight: 10 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {src.title}
                              </span>
                              {src.url && (
                                <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                                  🔗 {src.url}
                                </a>
                              )}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: getScoreColor(src.match_percentage) }}>
                              {src.match_percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    results.similarity_score > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-4)', textAlign: 'center', padding: 10 }}>
                        Sources matched via style analysis.
                      </div>
                    )
                  )}

                  {/* AI Humanizer Option */}
                  {mode !== 'local' && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!humanizedText ? (
                        <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.08)', border: '1px dashed var(--violet-light)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>✨</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--violet-light)' }}>FluentMind AI Humanizer</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Convert AI-written phrasing into human style to bypass AI classifiers.</div>
                            </div>
                          </div>
                          <button 
                            className="btn btn-primary btn-sm w-full"
                            onClick={handleHumanize}
                            disabled={humanizing}
                          >
                            {humanizing ? <><span className="spinner" /> Converting with FluentMind AI...</> : '✨ Convert with FluentMind AI'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              🟢 Humanized Version Ready
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(humanizedText);
                                  toast.success('Humanized text copied to clipboard!');
                                }}
                                style={{ padding: '3px 8px', fontSize: 11 }}
                              >
                                📋 Copy
                              </button>
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setText(humanizedText);
                                  setHumanizedText('');
                                  toast.success('Copied to input field. Click scan to evaluate!');
                                }}
                                style={{ padding: '3px 8px', fontSize: 11 }}
                              >
                                🔄 Re-Scan
                              </button>
                            </div>
                          </div>
                          <textarea
                            className="unique-textarea"
                            value={humanizedText}
                            readOnly
                            rows={6}
                            style={{ background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-1)', fontSize: 12, border: '1px solid var(--glass-border)', padding: 10, borderRadius: 'var(--r-sm)', resize: 'none', width: '100%', fontFamily: 'var(--font-sans)' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>
                    💡 Click on any highlighted sentence to inspect similarity details.
                  </div>
                  
                  {renderHighlightedText()}
                  
                  {activePassageIndex !== null && results.flagged_passages?.[activePassageIndex] && (
                    <div style={{ 
                      background: 'var(--bg-3)', 
                      border: `1.5px dashed ${getScoreColor(results.similarity_score)}`, 
                      padding: 12, 
                      borderRadius: 'var(--r-md)', 
                      marginTop: 10,
                      position: 'relative'
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                        Selected Flagged Passage Details
                      </div>
                      <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--text-1)', marginBottom: 8 }}>
                        "{results.flagged_passages[activePassageIndex].text}"
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: 12 }}>
                        <span>Source: <strong>{results.flagged_passages[activePassageIndex].source}</strong></span>
                        <span style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          {results.flagged_passages[activePassageIndex].reason}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Local Scan History List */}
      {scanHistory.length > 0 && (
        <div className="plag-history-container">
          <div className="plag-history-header">
            <span className="plag-history-title">🕐 Recent Plagiarism Scan Reports</span>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Stored locally on your device</span>
          </div>
          <div className="plag-history-grid">
            {scanHistory.map((item) => (
              <div 
                key={item.id} 
                className="plag-history-card"
                onClick={() => handleLoadFromHistory(item)}
              >
                <div className="plag-history-card-top">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="plag-history-card-name" title={item.name}>{item.name}</div>
                    <div className="plag-history-card-meta">{item.date} · {item.mode?.toUpperCase()}</div>
                  </div>
                  <span className="plag-history-card-score" style={{ color: getScoreColor(item.score) }}>
                    {item.score}% Match
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {item.aiScore !== undefined ? `AI: ${item.aiScore}%` : 'Offline check'}
                  </span>
                  <button 
                    className="plag-history-delete-btn"
                    onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                    title="Delete record"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
