/**
 * UI helpers — toast notifications, loaders, DOM utilities.
 */

// ─────────────────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────────────────
const toastContainer = () => document.getElementById('toast-container');

export function showToast(message, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-dismiss" aria-label="Dismiss">✕</button>
  `;

  const dismiss = () => {
    toast.style.animation = 'none';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-dismiss').addEventListener('click', dismiss);
  toastContainer().appendChild(toast);

  if (duration > 0) setTimeout(dismiss, duration);
  return toast;
}

// ─────────────────────────────────────────────────────────
// Loading State Helpers
// ─────────────────────────────────────────────────────────
export function setButtonLoading(btn, loading, originalText = null) {
  if (!btn) return;
  if (loading) {
    btn._originalHTML = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Processing…`;
    btn.disabled = true;
  } else {
    btn.innerHTML = originalText || btn._originalHTML || btn.textContent;
    btn.disabled = false;
  }
}

export function setLoading(overlayEl, loading, text = 'Processing…') {
  if (!overlayEl) return;
  if (loading) {
    overlayEl.innerHTML = `
      <div class="spinner" style="width:32px;height:32px;border-width:3px;"></div>
      <span class="loading-text">${text}</span>
    `;
    overlayEl.classList.add('active');
  } else {
    overlayEl.classList.remove('active');
  }
}

// ─────────────────────────────────────────────────────────
// Stats Display
// ─────────────────────────────────────────────────────────
export function renderStats(containerSelector, stats) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.innerHTML = stats.map(({ label, value }) => `
    <div class="stat-item">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `).join('');
}

export function buildSummaryStats(result) {
  return [
    { label: 'Original Words', value: (result.original_words || 0).toLocaleString() },
    { label: 'Summary Words',  value: (result.summary_words  || 0).toLocaleString() },
    { label: 'Reduction',      value: `${result.reduction_pct || 0}%` },
    { label: 'Mode',           value: (result.length_mode || 'medium').charAt(0).toUpperCase() + (result.length_mode || 'medium').slice(1) },
  ];
}

// ─────────────────────────────────────────────────────────
// Copy to Clipboard
// ─────────────────────────────────────────────────────────
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success', 2000);
    return true;
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    showToast('Copied to clipboard!', 'success', 2000);
    return true;
  }
}

// ─────────────────────────────────────────────────────────
// Download Text
// ─────────────────────────────────────────────────────────
export function downloadText(text, filename = 'summary.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Downloaded as ${filename}`, 'success', 2000);
}

// ─────────────────────────────────────────────────────────
// Format Utilities
// ─────────────────────────────────────────────────────────
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str, maxLen = 100) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ─────────────────────────────────────────────────────────
// Source-type icons
// ─────────────────────────────────────────────────────────
export function sourceIcon(type) {
  const icons = {
    text: '📝',
    file: '📄',
    youtube: '▶️',
    webpage: '🌐',
  };
  return icons[type] || '📄';
}

// ─────────────────────────────────────────────────────────
// Keyword Chips
// ─────────────────────────────────────────────────────────
const CHIP_CLASSES = ['chip-violet', 'chip-cyan', 'chip-green', 'chip-amber'];

export function renderKeywordChips(keywords, containerEl) {
  if (!containerEl) return;
  if (!keywords || keywords.length === 0) {
    containerEl.innerHTML = '<span style="color:var(--text-4);font-size:13px;">No keywords found.</span>';
    return;
  }
  containerEl.innerHTML = keywords.map((kw, i) => {
    const chipClass = CHIP_CLASSES[i % CHIP_CLASSES.length];
    const label = kw.keyword || kw;
    const score = kw.score !== undefined ? ` (${Math.round(kw.score * 100)}%)` : '';
    return `<span class="keyword-chip ${chipClass}" title="Score${score}">${label}</span>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// Sentiment Badge
// ─────────────────────────────────────────────────────────
export function renderSentiment(sentiment, containerEl) {
  if (!containerEl || !sentiment) return;
  const pct = Math.round((sentiment.score || 0.5) * 100);
  containerEl.innerHTML = `
    <div class="sentiment-badge" style="background: ${sentiment.color}22; border: 1px solid ${sentiment.color}44; color: ${sentiment.color};">
      ${sentiment.emoji} <span>${sentiment.label}</span> <span style="font-size:13px;opacity:0.7;">${pct}% confidence</span>
    </div>
    <div class="sentiment-bar-wrapper mt-md">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${pct}%;background:${sentiment.color};"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// Topics
// ─────────────────────────────────────────────────────────
export function renderTopics(topics, containerEl) {
  if (!containerEl) return;
  if (!topics || topics.length === 0) {
    containerEl.innerHTML = '<span style="color:var(--text-4);font-size:13px;">No topics detected.</span>';
    return;
  }
  containerEl.innerHTML = `
    <div class="topic-list">
      ${topics.map(t => `
        <div class="topic-item">
          <span class="topic-name">${t.topic}</span>
          <div class="topic-bar-track">
            <div class="topic-bar-fill" style="width:${Math.round((t.confidence || 0) * 100)}%"></div>
          </div>
          <span class="topic-pct">${Math.round((t.confidence || 0) * 100)}%</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────
export function renderQuestions(questions, containerEl) {
  if (!containerEl) return;
  if (!questions || questions.length === 0) {
    containerEl.innerHTML = '<span style="color:var(--text-4);font-size:13px;">No questions generated.</span>';
    return;
  }
  containerEl.innerHTML = `
    <div class="question-list">
      ${questions.map((q, i) => `
        <div class="question-item">
          <span class="question-num">${i + 1}</span>
          <span>${q}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// Summary Output
// ─────────────────────────────────────────────────────────
export function setSummaryOutput(el, text) {
  if (!el) return;
  if (!text) {
    el.textContent = '';
    el.classList.add('empty');
    return;
  }
  el.textContent = text;
  el.classList.remove('empty');
}

// ─────────────────────────────────────────────────────────
// Waveform Animation
// ─────────────────────────────────────────────────────────
export function startWaveAnimation(containerEl) {
  if (!containerEl) return;
  const bars = containerEl.querySelectorAll('.wave-bar');
  bars.forEach(bar => bar.classList.add('playing'));
}

export function stopWaveAnimation(containerEl) {
  if (!containerEl) return;
  const bars = containerEl.querySelectorAll('.wave-bar');
  bars.forEach(bar => bar.classList.remove('playing'));
}

export function createWaveBars(containerEl, count = 20) {
  if (!containerEl) return;
  containerEl.innerHTML = Array.from({ length: count }, (_, i) => {
    const maxH = 15 + Math.random() * 35;
    const delay = (i * 0.05).toFixed(2);
    return `<div class="wave-bar" style="--delay:${delay}s;--max-h:${maxH}px;height:8px;"></div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// History Item Render
// ─────────────────────────────────────────────────────────
export function renderHistoryItem(item) {
  const icon = sourceIcon(item.source_type);
  const date = formatDate(item.created_at);
  const title = item.source_name || (item.text_preview ? truncate(item.text_preview, 60) : 'Text Summary');

  return `
    <div class="history-item" data-id="${item.id}">
      <div class="history-source-icon">${icon}</div>
      <div class="history-content">
        <div class="history-title">${title}</div>
        <div class="history-preview">${truncate(item.summary, 120)}</div>
        <div class="history-meta">
          <span class="history-tag">${item.source_type}</span>
          <span>🤖 ${item.model_used?.split('/').pop() || 'BART'}</span>
          <span>📉 ${item.reduction_pct || 0}% reduction</span>
          <span>🕐 ${date}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-icon history-copy-btn" title="Copy summary" data-id="${item.id}">📋</button>
        <button class="btn btn-danger btn-icon history-delete-btn" title="Delete" data-id="${item.id}">🗑️</button>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// Char Counter
// ─────────────────────────────────────────────────────────
export function setupCharCounter(textareaEl, counterEl) {
  if (!textareaEl || !counterEl) return;
  const update = () => {
    const text = textareaEl.value;
    const charCount = text.length;
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    counterEl.textContent = `${charCount.toLocaleString()} chars | ${wordCount.toLocaleString()} words`;
    counterEl.style.color = charCount > 50000 ? 'var(--error)' : 'var(--text-4)';
  };
  textareaEl.addEventListener('input', update);
  update();
}
