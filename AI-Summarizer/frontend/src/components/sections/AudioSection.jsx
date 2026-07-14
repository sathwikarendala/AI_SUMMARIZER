import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { generateAudio, fetchLanguages } from '../../api/client';
import toast from 'react-hot-toast';

export default function AudioSection({ sharedSummary }) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMeta, setAudioMeta] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Use shared summary as default text
  useEffect(() => { if (sharedSummary) setText(sharedSummary); }, [sharedSummary]);

  // Load languages from API
  useEffect(() => {
    fetchLanguages()
      .then(res => setLanguages(res.languages || []))
      .catch(() => setLanguages([{ name: 'English', voice: 'en-US-AriaNeural', translates: false }]));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim() || text.length < 10) {
      toast.error('Enter at least 10 characters.');
      return;
    }
    setLoading(true);
    setAudioUrl(null);
    try {
      const result = await generateAudio(text, language);
      setAudioUrl(result.audio_url);
      setAudioMeta(result);
      toast.success('Audio generated! 🔊');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [text, language]);

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = audioMeta?.filename || 'audio.mp3';
    a.click();
    toast.success('Downloading MP3…');
  };

  const waveBars = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    delay: `${i * 0.05}s`,
    maxH: `${Math.random() * 30 + 10}px`,
  })), []);

  return (
    <section className="section" aria-labelledby="audio-title">
      <div className="section-header">
        <h1 className="section-title" id="audio-title">🔊 Audio TTS</h1>
        <p className="section-subtitle">Convert your summary to speech in 20+ languages with neural voices.</p>
      </div>

      <div className="grid-2">
        {/* Input */}
        <div className="card">
          <div className="card-title"><span className="title-icon">✍️</span> Text to Speak</div>
          <div className="textarea-wrapper">
            <textarea className="input-area" placeholder="Paste text or use your latest summary…" rows={8}
              value={text} onChange={e => setText(e.target.value)} aria-label="Text for TTS" />
            <span className="char-count">{text.length.toLocaleString()} / 5000</span>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center justify-between gap-md">
              <label htmlFor="tts-lang" style={{ fontSize: 13, color: 'var(--text-3)' }}>Language & Voice</label>
              <select id="tts-lang" className="styled-select" value={language} onChange={e => setLanguage(e.target.value)}>
                {languages.length > 0 ? languages.map(l => (
                  <option key={l.name} value={l.name}>{l.name} {l.translates ? '(auto-translate)' : ''}</option>
                )) : <option value="English">English</option>}
              </select>
            </div>
          </div>

          <button className="btn btn-primary btn-lg w-full mt-lg" onClick={handleGenerate} disabled={loading}>
            {loading ? <><span className="spinner" /> Generating…</> : '🔊 Generate Audio'}
          </button>
        </div>

        {/* Player */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          {audioUrl ? (
            <>
              {/* Waveform Visualizer */}
              <div className="audio-visualizer">
                {waveBars.map((bar, i) => (
                  <div key={i} className={`wave-bar ${isPlaying ? 'playing' : ''}`}
                    style={{ '--delay': bar.delay, '--max-h': bar.maxH, height: isPlaying ? undefined : '4px' }} />
                ))}
              </div>

              <audio ref={audioRef} src={audioUrl} preload="auto"
                onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)} />

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={handlePlay}>
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button className="btn btn-secondary" onClick={handleDownload}>💾 Download MP3</button>
              </div>

              {audioMeta && (
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-4)', textAlign: 'center' }}>
                  {audioMeta.language} · {audioMeta.voice} · {audioMeta.char_count} chars
                  {audioMeta.translated && <span style={{ color: 'var(--cyan-light)' }}> · Auto-translated</span>}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-4)' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎵</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-3)' }}>No Audio Generated Yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Enter text and click Generate to create audio</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
