import { useState, useCallback } from 'react';
import { runFullAnalysis, generateQuestions } from '../../api/client';
import toast from 'react-hot-toast';

const CHIP_CLASSES = ['chip-violet', 'chip-cyan', 'chip-green', 'chip-amber'];

export default function KeywordsSection() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [topics, setTopics] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [questions, setQuestions] = useState(null);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || text.length < 30) {
      toast.error('Enter at least 30 characters.');
      return;
    }
    setLoading(true);
    setKeywords(null); setSentiment(null); setTopics(null); setHighlights(null); setQuestions(null);

    try {
      const result = await runFullAnalysis(text);
      setKeywords(result.keywords);
      setSentiment(result.sentiment);
      setTopics(result.topics);
      setHighlights(result.highlighted_sentences);
      toast.success('Analysis complete! 🔍');
    } catch (err) {
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }

    // Questions separately (can be slow)
    try {
      const qResult = await generateQuestions(text, 5);
      setQuestions(qResult.questions);
    } catch { setQuestions(null); }
  }, [text]);

  return (
    <section className="section" aria-labelledby="kw-title">
      <div className="section-header">
        <h1 className="section-title" id="kw-title">🔍 Keywords & NLP</h1>
        <p className="section-subtitle">Extract keywords, detect sentiment, topics, and auto-generate questions.</p>
      </div>

      {/* Input */}
      <div className="card">
        <div className="card-title"><span className="title-icon">✍️</span> Input Text</div>
        <div className="textarea-wrapper">
          <textarea className="input-area" placeholder="Paste text to analyze…" rows={7}
            value={text} onChange={e => setText(e.target.value)} aria-label="Text for NLP analysis" />
          <span className="char-count">{text.length.toLocaleString()} chars | {wordCount.toLocaleString()} words</span>
        </div>
        <button className="btn btn-primary btn-lg mt-md" onClick={handleAnalyze} disabled={loading}>
          {loading ? <><span className="spinner" /> Analyzing…</> : '🔍 Run Full Analysis'}
        </button>
      </div>

      {/* Results Grid */}
      <div className="grid-2">
        {/* Keywords */}
        <div className="card">
          <div className="card-title"><span className="title-icon">🏷️</span> Keywords & Keyphrases</div>
          <div className="keyword-cloud">
            {keywords ? keywords.map((kw, i) => (
              <span key={i} className={`keyword-chip ${CHIP_CLASSES[i % CHIP_CLASSES.length]}`}
                title={`Score: ${kw.score !== undefined ? Math.round(kw.score * 100) + '%' : '—'}`}>
                {kw.keyword || kw}
              </span>
            )) : <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Run analysis to see keywords…</span>}
          </div>
        </div>

        {/* Sentiment */}
        <div className="card">
          <div className="card-title"><span className="title-icon">💭</span> Sentiment Analysis</div>
          {sentiment ? (
            <>
              <div className="sentiment-badge" style={{ background: `${sentiment.color}22`, border: `1px solid ${sentiment.color}44`, color: sentiment.color }}>
                {sentiment.emoji} <span>{sentiment.label}</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>{Math.round((sentiment.score || 0.5) * 100)}% confidence</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${Math.round((sentiment.score || 0.5) * 100)}%`, background: sentiment.color }} />
                </div>
              </div>
            </>
          ) : <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Run analysis to see sentiment…</span>}
        </div>

        {/* Topics */}
        <div className="card">
          <div className="card-title"><span className="title-icon">📌</span> Topic Detection</div>
          {topics ? (
            <div className="topic-list">
              {topics.map((t, i) => (
                <div className="topic-item" key={i}>
                  <span className="topic-name">{t.topic}</span>
                  <div className="topic-bar-track">
                    <div className="topic-bar-fill" style={{ width: `${Math.round((t.confidence || 0) * 100)}%` }} />
                  </div>
                  <span className="topic-pct">{Math.round((t.confidence || 0) * 100)}%</span>
                </div>
              ))}
            </div>
          ) : <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Run analysis to detect topics…</span>}
        </div>

        {/* Highlighted Sentences */}
        <div className="card">
          <div className="card-title"><span className="title-icon">✏️</span> Key Sentences</div>
          {highlights ? highlights.map((s, i) => (
            <p key={i} style={{ padding: '8px 12px', borderLeft: '3px solid var(--violet)', marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>{s}</p>
          )) : <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Run analysis to highlight sentences…</span>}
        </div>
      </div>

      {/* Questions */}
      <div className="card">
        <div className="card-title"><span className="title-icon">❓</span> Auto-Generated Questions</div>
        {questions ? (
          <div className="question-list">
            {questions.map((q, i) => (
              <div className="question-item" key={i}>
                <span className="question-num">{i + 1}</span>
                <span>{q}</span>
              </div>
            ))}
          </div>
        ) : <span style={{ color: 'var(--text-4)', fontSize: 13 }}>Run analysis to generate questions…</span>}
      </div>
    </section>
  );
}
