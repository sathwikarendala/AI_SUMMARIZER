import { useState, useCallback } from 'react';
import { analyzeText, humanizeText } from '../../api/client';
import toast from 'react-hot-toast';

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
            stroke="var(--glass-border)"
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
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.35s' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: 'var(--text-1)'
        }}>
          {value}%
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

export default function TextProcessorSection() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('grammar'); // 'grammar' | 'readability' | 'style' | 'vocabulary' | 'explanation'

  // FluentMind AI Humanizer states
  const [humanizing, setHumanizing] = useState(false);
  const [humanizedText, setHumanizedText] = useState('');

  const getWordCount = () => {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  };

  const wordCount = getWordCount();
  const isInputValid = wordCount >= 10 && wordCount <= 3000;

  const handleAnalyze = useCallback(async () => {
    if (!text.trim() || wordCount < 10) {
      toast.error('Please enter at least 10 words.');
      return;
    }
    if (wordCount > 3000) {
      toast.error('Text exceeds maximum limit of 3,000 words.');
      return;
    }

    setLoading(true);
    setResults(null);
    setHumanizedText('');
    try {
      const response = await analyzeText(text);
      if (response.success && response.results) {
        setResults(response.results);
        toast.success('Text analyzed successfully! 📝');
      } else {
        throw new Error('Malformed API response');
      }
    } catch (err) {
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [text, wordCount]);

  const handleHumanize = async () => {
    const sourceText = text;
    if (!sourceText || sourceText.trim().length < 50) {
      toast.error('Please enter or paste at least 50 characters of text to humanize.');
      return;
    }
    setHumanizing(true);
    setHumanizedText('');
    try {
      const res = await humanizeText(sourceText);
      setHumanizedText(res.humanized_text);
      toast.success('Text converted to human style with FluentMind AI! ✨');
    } catch (err) {
      toast.error(`Humanization failed: ${err.message}`);
    } finally {
      setHumanizing(false);
    }
  };

  const getReadabilityColor = (score) => {
    if (score > 70) return 'var(--success)';
    if (score > 40) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <section className="section" aria-labelledby="processor-title">
      <div className="section-header">
        <h1 className="section-title" id="processor-title">✍️ AI Grammar Checker</h1>
        <p className="section-subtitle">Proofread your text for grammar, spelling, style, tone, readability, and vocabulary suggestions.</p>
      </div>

      <div className="grid-2">
        {/* Input Panel */}
        <div className="card">
          <div className="card-title">
            <span className="title-icon">✍️</span> Input Document
          </div>

          <div className="unique-textbox-container" style={{ marginTop: 12 }}>
            <div className="textbox-toolbar">
              <span className="textbox-toolbar-title">Document Content</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard.readText()
                      .then(clipText => setText(clipText))
                      .catch(() => toast.error('Please use Ctrl+V to paste'));
                  }}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  📋 Paste
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setText('');
                    setResults(null);
                  }}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  🧹 Clear
                </button>
              </div>
            </div>

            <textarea
              className={`unique-textarea ${wordCount > 0 ? (isInputValid ? 'valid' : 'invalid') : ''}`}
              placeholder="Paste your text here to begin evaluating grammar, readability, and style (minimum 10 words, maximum 3,000 words)..."
              value={text}
              onChange={e => setText(e.target.value)}
              style={{ minHeight: 300, resize: 'vertical' }}
            />

            <div className="textbox-footer">
              <div className="stats-badge">
                ⏱️ {Math.ceil(wordCount / 200) || 1} min read
              </div>
              <div
                className="word-count-badge"
                style={{
                  color: wordCount === 0 ? 'var(--text-4)' : isInputValid ? 'var(--success)' : 'var(--error)',
                  fontWeight: 'bold'
                }}
              >
                {wordCount} / 3,000 words
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg w-full mt-lg"
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
          >
            {loading ? <><span className="spinner" /> Analyzing Document...</> : '⚡ Run Text Analysis'}
          </button>
        </div>

        {/* Results Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 450 }}>
          <div className="card-title"><span className="title-icon">📊</span> Analysis Dashboard</div>

          {!results ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-4)', textAlign: 'center', padding: 20 }}>
              <span style={{ fontSize: 48, marginBottom: 12 }}>📝</span>
              {loading ? (
                <div>Processing structural styles, grammar matrices, and tones...</div>
              ) : (
                <div>No analysis generated yet. Submit text in the editor to evaluate.</div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Tab Selector */}
              <div className="tab-container" style={{ display: 'flex', gap: 6, padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--r-sm)', overflowX: 'auto' }}>
                {['grammar', 'readability', 'style', 'vocabulary', 'explanation'].map(t => (
                  <button
                    key={t}
                    className={`btn btn-sm ${activeTab === t ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '6px 10px', fontSize: '11px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                    onClick={() => setActiveTab(t)}
                  >
                    {t === 'grammar' ? '✍️ Grammar' :
                     t === 'readability' ? '📊 Readability' :
                     t === 'style' ? '✨ Style & Tone' :
                     t === 'vocabulary' ? '📚 Vocabulary' : '💡 Reason'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'grammar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)' }}>Corrected Output</div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(results.grammar.corrected_text);
                        toast.success('Corrected text copied!');
                      }}
                      style={{ padding: '4px 10px', fontSize: 11 }}
                    >
                      📋 Copy Clean Text
                    </button>
                  </div>

                  <textarea
                    className="unique-textarea"
                    value={results.grammar.corrected_text}
                    readOnly
                    rows={6}
                    style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--text-1)', fontSize: 13, border: '1px solid var(--glass-border)', padding: 10, borderRadius: 'var(--r-sm)', resize: 'none', width: '100%', fontFamily: 'var(--font-sans)' }}
                  />

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                      Corrections List ({results.grammar.issues?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {results.grammar.issues && results.grammar.issues.length > 0 ? (
                        results.grammar.issues.map((issue, idx) => (
                          <div key={idx} style={{ padding: 10, background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ textDecoration: 'line-through', color: 'var(--error)', fontSize: 12 }}>{issue.original}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-4)' }}>➔</span>
                              <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: 12 }}>{issue.replacement}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', color: 'var(--text-3)' }}>
                                {issue.type}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{issue.explanation}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--success)', fontSize: 12, fontStyle: 'italic' }}>🟢 No grammar or spelling issues detected!</div>
                      )}
                    </div>
                  </div>

                  {/* FluentMind AI Humanizer option */}
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--glass-border)', paddingTop: 14 }}>
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
                                toast.success('Copied to input field. Click analyze to evaluate!');
                              }}
                              style={{ padding: '3px 8px', fontSize: 11 }}
                            >
                              🔄 Re-Analyze
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
                </div>
              )}

              {activeTab === 'readability' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' }}>
                    <CircularProgress
                      value={results.readability.score}
                      label="Readability Score"
                      color={getReadabilityColor(results.readability.score)}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grade Level</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>{results.readability.grade_level}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>({results.readability.complexity} complexity)</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>Complex & Long Sentences</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {results.readability.long_sentences && results.readability.long_sentences.length > 0 ? (
                        results.readability.long_sentences.map((sent, idx) => (
                          <div key={idx} style={{ padding: 10, background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--text-1)', lineHeight: '1.4' }}>
                            "{sent}"
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--success)', fontSize: 12, fontStyle: 'italic' }}>🟢 Clean flow. No extremely long or hard-to-read sentences detected.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'style' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ padding: 12, background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-md)' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tonal Profile</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {results.tone.detected_tones?.map((t, idx) => (
                        <div key={idx} style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 'var(--r-sm)', border: '1px solid var(--glass-border)' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-1)' }}>{t.name}</span>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--primary)', width: `${t.percentage}%` }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right' }}>{t.percentage}%</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-1)', marginTop: 10, fontStyle: 'italic', lineHeight: '1.4' }}>
                      💡 {results.tone.verdict}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Passive Voice & Clichés</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
                      {results.style.passive_voice?.map((sent, idx) => (
                        <div key={`passive-${idx}`} style={{ padding: 8, background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderLeft: '3px solid var(--error)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--text-1)' }}>
                          <strong>Passive Voice:</strong> "{sent}"
                        </div>
                      ))}
                      {results.style.cliches?.map((cliche, idx) => (
                        <div key={`cliche-${idx}`} style={{ padding: 8, background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--text-1)' }}>
                          <strong>Cliché found:</strong> "{cliche}"
                        </div>
                      ))}
                      {(!results.style.passive_voice?.length && !results.style.cliches?.length) && (
                        <div style={{ color: 'var(--success)', fontSize: 11, fontStyle: 'italic' }}>🟢 No passive voice structures or clichés detected.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Writing Style Improvements</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {results.style.suggestions?.map((sug, idx) => (
                        <div key={idx} style={{ fontSize: 12, color: 'var(--text-1)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--primary)' }}>•</span>
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vocabulary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Sophisticated Synonyms</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {results.vocabulary.sophisticated_synonyms && results.vocabulary.sophisticated_synonyms.length > 0 ? (
                        results.vocabulary.sophisticated_synonyms.map((syn, idx) => (
                          <div key={idx} style={{ padding: 8, background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-4)', textDecoration: 'line-through' }}>{syn.original}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-4)' }}>➔</span>
                            <span style={{ fontSize: 12, color: 'var(--cyan-light)', fontWeight: 'bold' }}>{syn.replacement}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ gridColumn: '1/-1', color: 'var(--text-4)', fontSize: 11, fontStyle: 'italic' }}>No synonym replacements recommended.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Repetitive Words</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {results.vocabulary.overused_words && results.vocabulary.overused_words.length > 0 ? (
                        results.vocabulary.overused_words.map((item, idx) => (
                          <div key={idx} style={{ padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>"{item.word}"</span>
                              <span style={{ fontSize: 10, color: 'var(--text-4)', marginLeft: 8 }}>Used {item.count} times</span>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              Try: <strong>{item.suggestions.join(', ')}</strong>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--success)', fontSize: 11, fontStyle: 'italic' }}>🟢 No repetitive or simple overused words detected.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'explanation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-2)', borderBottom: '1px solid var(--glass-border)', paddingBottom: 6 }}>
                    Proofreading Rationale
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: '1.5', background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', whiteSpace: 'pre-line' }}>
                    {results.explanation.summary}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </section>
  );
}
