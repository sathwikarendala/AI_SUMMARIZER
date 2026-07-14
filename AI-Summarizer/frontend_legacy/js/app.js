/**
 * Main Application — AI Text Summarizer
 * Handles navigation, all section logic, and event binding.
 */
import {
  summarizeText, uploadFile, extractKeywords, analyzeSentiment,
  detectTopics, generateQuestions, runFullAnalysis,
  generateAudio, fetchLanguages,
  getHistory, deleteHistoryItem, clearHistory,
  checkHealth,
} from './api.js';

import {
  showToast, setButtonLoading, setLoading,
  renderStats, buildSummaryStats,
  copyToClipboard, downloadText,
  formatFileSize, renderKeywordChips,
  renderSentiment, renderTopics, renderQuestions,
  setSummaryOutput, createWaveBars, startWaveAnimation, stopWaveAnimation,
  renderHistoryItem, setupCharCounter,
} from './ui.js';

import { initAuth, logout } from './auth.js';

// ─────────────────────────────────────────────────────────
// App State
// ─────────────────────────────────────────────────────────
const state = {
  currentSummary: '',
  uploadedText: '',
  analysisText: '',
  theme: localStorage.getItem('theme') || 'dark',
};

// Helper to update active model badge in topbar
export function updateModelBadge(selectId) {
  const selectEl = document.getElementById(selectId);
  const badge = document.getElementById('active-model-badge');
  if (badge) {
    if (selectEl) {
      const selectedText = selectEl.options[selectEl.selectedIndex].text.split(' (')[0].split(' —')[0];
      badge.textContent = selectedText;
    } else {
      badge.textContent = '🔮 Smart Auto';
    }
  }
}

// ─────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────
function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarSubtitle = document.getElementById('topbar-subtitle');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.section;
      navItems.forEach(n => n.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`section-${target}`)?.classList.add('active');
      topbarTitle.textContent = item.querySelector('.nav-label')?.textContent || '';
      topbarSubtitle.textContent = item.dataset.subtitle || '';
      // Close mobile sidebar
      document.querySelector('.sidebar')?.classList.remove('open');

      // Update model badge
      if (target === 'summarize') {
        updateModelBadge('sum-model');
      } else if (target === 'upload') {
        updateModelBadge('upload-model');
      } else {
        const badge = document.getElementById('active-model-badge');
        if (badge) badge.textContent = '🤖 NLP Active';
      }
    });
  });

  // Hamburger
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });
}

// ─────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────
function initTheme() {
  applyTheme(state.theme);
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme(state.theme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─────────────────────────────────────────────────────────
// SECTION 1 — Summarize (Text Input)
// ─────────────────────────────────────────────────────────
function initSummarizeSection() {
  const textInput   = document.getElementById('sum-text-input');
  const charCounter = document.getElementById('sum-char-count');
  const submitBtn   = document.getElementById('sum-submit-btn');
  const clearBtn    = document.getElementById('sum-clear-btn');
  const outputEl    = document.getElementById('sum-output');
  const statsEl     = document.getElementById('sum-stats');
  const copyBtn     = document.getElementById('sum-copy-btn');
  const downloadBtn = document.getElementById('sum-download-btn');
  const analyzeBtn  = document.getElementById('sum-analyze-btn');

  setupCharCounter(textInput, charCounter);

  clearBtn?.addEventListener('click', () => {
    if (textInput) textInput.value = '';
    setSummaryOutput(outputEl, '');
    if (statsEl) statsEl.innerHTML = '';
    showToast('Cleared.', 'info', 1500);
  });

  // Model selection badge change
  const sumModel = document.getElementById('sum-model');
  sumModel?.addEventListener('change', () => {
    updateModelBadge('sum-model');
  });

  submitBtn?.addEventListener('click', async () => {
    const text = textInput?.value?.trim();
    if (!text || text.length < 30) {
      showToast('Please enter at least 30 characters.', 'warning');
      return;
    }

    setButtonLoading(submitBtn, true);
    setSummaryOutput(outputEl, '');

    try {
      const result = await summarizeText({
        text,
        modelName:    sumModel?.value,
        lengthMode:   document.querySelector('[name="sum-length"]:checked')?.value || 'medium',
        bulletPoints: document.getElementById('sum-bullets')?.checked,
        language:     'en',
      });

      state.currentSummary = result.summary;
      setSummaryOutput(outputEl, result.summary);
      renderStats('#sum-stats', buildSummaryStats(result));
      showToast('Summary generated! ✨', 'success');

    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setButtonLoading(submitBtn, false, '⚡ Summarize');
    }
  });

  copyBtn?.addEventListener('click', () => {
    if (state.currentSummary) copyToClipboard(state.currentSummary);
    else showToast('No summary to copy yet.', 'warning');
  });

  downloadBtn?.addEventListener('click', () => {
    if (state.currentSummary) downloadText(state.currentSummary, 'summary.txt');
    else showToast('No summary to download yet.', 'warning');
  });

  // Quick-analyze button — jump to keywords section with this text
  analyzeBtn?.addEventListener('click', () => {
    const text = textInput?.value?.trim();
    if (!text) { showToast('Enter text first.', 'warning'); return; }
    state.analysisText = text;
    document.querySelector('[data-section="keywords"]')?.click();
    document.getElementById('kw-text-input').value = text;
  });
}

// ─────────────────────────────────────────────────────────
// SECTION 2 — Upload
// ─────────────────────────────────────────────────────────
function initUploadSection() {
  const dropZone   = document.getElementById('upload-drop-zone');
  const fileInput  = document.getElementById('upload-file-input');
  const fileInfo   = document.getElementById('upload-file-info');
  const submitBtn  = document.getElementById('upload-submit-btn');
  const outputEl   = document.getElementById('upload-output');
  const statsEl    = document.getElementById('upload-stats');
  const copyBtn    = document.getElementById('upload-copy-btn');
  const downloadBtn= document.getElementById('upload-download-btn');

  let selectedFile = null;

  function handleFile(file) {
    selectedFile = file;
    if (fileInfo) {
      fileInfo.classList.add('visible');
      fileInfo.querySelector('.file-info-name').textContent = file.name;
      fileInfo.querySelector('.file-info-size').textContent = formatFileSize(file.size);
    }
  }

  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // Model selection badge change
  const uploadModel = document.getElementById('upload-model');
  uploadModel?.addEventListener('change', () => {
    updateModelBadge('upload-model');
  });

  submitBtn?.addEventListener('click', async () => {
    if (!selectedFile) { showToast('Please select a file first.', 'warning'); return; }

    setButtonLoading(submitBtn, true);
    setSummaryOutput(outputEl, '');

    try {
      const result = await uploadFile(selectedFile, {
        modelName:    document.getElementById('upload-model')?.value,
        lengthMode:   document.querySelector('[name="upload-length"]:checked')?.value || 'medium',
        bulletPoints: document.getElementById('upload-bullets')?.checked,
      });

      state.currentSummary = result.summary || '';
      setSummaryOutput(outputEl, result.summary);
      renderStats('#upload-stats', [
        { label: 'File Type',  value: (result.file_type || 'file').toUpperCase() },
        { label: 'Pages',      value: result.page_count || '—' },
        ...buildSummaryStats(result),
      ]);
      showToast('File summarized! 📄', 'success');

    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setButtonLoading(submitBtn, false, '⚡ Extract & Summarize');
    }
  });

  copyBtn?.addEventListener('click', () => {
    if (state.currentSummary) copyToClipboard(state.currentSummary);
    else showToast('No summary yet.', 'warning');
  });
  downloadBtn?.addEventListener('click', () => {
    if (state.currentSummary) downloadText(state.currentSummary, 'file_summary.txt');
    else showToast('No summary yet.', 'warning');
  });
}

// ─────────────────────────────────────────────────────────
// SECTION 3 — Keywords & NLP
// ─────────────────────────────────────────────────────────
function initKeywordsSection() {
  const textInput  = document.getElementById('kw-text-input');
  const charCounter= document.getElementById('kw-char-count');
  const analyzeBtn = document.getElementById('kw-analyze-btn');
  const keywordsEl = document.getElementById('kw-keywords');
  const sentimentEl= document.getElementById('kw-sentiment');
  const topicsEl   = document.getElementById('kw-topics');
  const questionsEl= document.getElementById('kw-questions');

  setupCharCounter(textInput, charCounter);

  analyzeBtn?.addEventListener('click', async () => {
    const text = textInput?.value?.trim();
    if (!text || text.length < 30) {
      showToast('Enter at least 30 characters.', 'warning');
      return;
    }

    setButtonLoading(analyzeBtn, true);

    // Clear results
    if (keywordsEl) keywordsEl.innerHTML = '<div class="skeleton" style="height:28px;width:80%"></div>';
    if (sentimentEl) sentimentEl.innerHTML = '<div class="skeleton" style="height:40px;width:60%"></div>';
    if (topicsEl) topicsEl.innerHTML = '<div class="skeleton" style="height:80px;width:100%"></div>';
    if (questionsEl) questionsEl.innerHTML = '<div class="skeleton" style="height:100px;width:100%"></div>';

    try {
      const result = await runFullAnalysis(text);

      renderKeywordChips(result.keywords, keywordsEl);
      renderSentiment(result.sentiment, sentimentEl);
      renderTopics(result.topics, topicsEl);

      // Highlights
      const highlightsEl = document.getElementById('kw-highlights');
      if (highlightsEl && result.highlighted_sentences) {
        highlightsEl.innerHTML = result.highlighted_sentences.map(s =>
          `<p style="padding:8px 12px;border-left:3px solid var(--violet);margin-bottom:8px;font-size:14px;color:var(--text-2);">${s}</p>`
        ).join('');
      }

      showToast('Analysis complete! 🔍', 'success');

    } catch (err) {
      showToast(`Analysis failed: ${err.message}`, 'error');
      if (keywordsEl) keywordsEl.innerHTML = '<span style="color:var(--error)">Failed to extract keywords.</span>';
    } finally {
      setButtonLoading(analyzeBtn, false, '🔍 Run Full Analysis');
    }

    // Questions separately (can be slow)
    try {
      const qResult = await generateQuestions(text, 5);
      renderQuestions(qResult.questions, questionsEl);
    } catch {
      if (questionsEl) questionsEl.innerHTML = '<span style="color:var(--text-4)">Question generation skipped.</span>';
    }
  });
}

// ─────────────────────────────────────────────────────────
// SECTION 4 — Audio TTS
// ─────────────────────────────────────────────────────────
function initAudioSection() {
  const textInput  = document.getElementById('audio-text-input');
  const langSelect = document.getElementById('audio-lang');
  const generateBtn= document.getElementById('audio-generate-btn');
  const playerEl   = document.getElementById('audio-player');
  const waveEl     = document.getElementById('audio-wave');
  const downloadEl = document.getElementById('audio-download-btn');

  createWaveBars(waveEl, 24);

  // Load languages from API into dropdown
  fetchLanguages().then(data => {
    if (!langSelect || !data.languages) return;
    langSelect.innerHTML = data.languages.map(l =>
      `<option value="${l.name}">${l.name}${l.translates ? ' 🌐' : ''}</option>`
    ).join('');
  }).catch(() => {
    // Fallback hardcoded list if API fails
    const fallback = ['English','Hindi','Telugu','German'];
    if (langSelect) langSelect.innerHTML = fallback.map(l =>
      `<option value="${l}">${l}${l !== 'English' ? ' 🌐' : ''}</option>`
    ).join('');
  });

  // Use current summary if available
  document.getElementById('audio-use-summary-btn')?.addEventListener('click', () => {
    if (!state.currentSummary) { showToast('Generate a summary first.', 'warning'); return; }
    if (textInput) textInput.value = state.currentSummary;
    showToast('Summary loaded!', 'success', 2000);
  });

  generateBtn?.addEventListener('click', async () => {
    const text = textInput?.value?.trim();
    if (!text || text.length < 10) {
      showToast('Enter text to convert to speech.', 'warning');
      return;
    }

    setButtonLoading(generateBtn, true);
    if (playerEl) playerEl.style.display = 'none';

    try {
      const result = await generateAudio(text, langSelect?.value || 'English');
      if (playerEl) {
        playerEl.src = result.audio_url;
        playerEl.style.display = 'block';
        playerEl.load();

        playerEl.addEventListener('play', () => startWaveAnimation(waveEl), { passive: true });
        playerEl.addEventListener('pause', () => stopWaveAnimation(waveEl), { passive: true });
        playerEl.addEventListener('ended', () => stopWaveAnimation(waveEl), { passive: true });
      }

      if (downloadEl) {
        downloadEl.href = result.audio_url;
        downloadEl.download = result.filename;
        downloadEl.style.display = 'inline-flex';
      }

      showToast(`Audio generated! Language: ${result.language} 🔊`, 'success');

    } catch (err) {
      showToast(`TTS failed: ${err.message}`, 'error');
    } finally {
      setButtonLoading(generateBtn, false, '🔊 Generate Audio');
    }
  });
}


// ─────────────────────────────────────────────────────────
// SECTION 7 — History
// ─────────────────────────────────────────────────────────
function initHistorySection() {
  const historyList = document.getElementById('history-list');
  const refreshBtn  = document.getElementById('history-refresh-btn');
  const clearBtn    = document.getElementById('history-clear-btn');

  async function loadHistory() {
    if (!historyList) return;
    historyList.innerHTML = '<div class="skeleton" style="height:80px;margin-bottom:12px;border-radius:12px;"></div>'.repeat(3);

    try {
      const result = await getHistory(30);
      if (!result.items || result.items.length === 0) {
        historyList.innerHTML = `
          <div class="history-empty">
            <div class="history-empty-icon">📭</div>
            <div class="history-empty-text">No summaries yet</div>
            <div style="font-size:13px;color:var(--text-4);">Start summarizing to build your history</div>
          </div>
        `;
        return;
      }

      historyList.innerHTML = result.items.map(renderHistoryItem).join('');

      // Bind delete buttons
      historyList.querySelectorAll('.history-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          try {
            await deleteHistoryItem(id);
            showToast('Deleted.', 'success', 2000);
            loadHistory();
          } catch (err) {
            showToast(`Delete failed: ${err.message}`, 'error');
          }
        });
      });

      // Bind copy buttons
      historyList.querySelectorAll('.history-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          const item = result.items.find(i => String(i.id) === id);
          if (item) copyToClipboard(item.summary);
        });
      });

    } catch (err) {
      historyList.innerHTML = `<div style="color:var(--error);padding:16px;">Failed to load history: ${err.message}</div>`;
    }
  }

  refreshBtn?.addEventListener('click', loadHistory);
  clearBtn?.addEventListener('click', async () => {
    if (!confirm('Clear ALL history? This cannot be undone.')) return;
    try {
      await clearHistory();
      showToast('History cleared.', 'success');
      loadHistory();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  });

  // Load on section activation
  document.querySelector('[data-section="history"]')?.addEventListener('click', () => {
    setTimeout(loadHistory, 100);
  });
}

// ─────────────────────────────────────────────────────────
// Health Check Indicator
// ─────────────────────────────────────────────────────────
async function checkAPIHealth() {
  const dot = document.getElementById('api-status-dot');
  const label = document.getElementById('api-status-label');
  try {
    await checkHealth();
    if (dot) { dot.style.background = 'var(--success)'; dot.style.boxShadow = '0 0 8px var(--success)'; }
    if (label) label.textContent = 'API Online';
  } catch {
    if (dot) { dot.style.background = 'var(--error)'; dot.style.boxShadow = '0 0 8px var(--error)'; }
    if (label) label.textContent = 'API Offline';
  }
}

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Initialize authentication
  initAuth();

  // Logout binding
  document.getElementById('auth-logout-btn')?.addEventListener('click', () => {
    logout();
  });

  initTheme();
  initNav();
  initSummarizeSection();
  initUploadSection();
  initKeywordsSection();
  initAudioSection();
  initHistorySection();
  checkAPIHealth();

  // Activate first section
  document.querySelector('.nav-item')?.click();

  console.log('🚀 AI Text Summarizer initialized');
});
