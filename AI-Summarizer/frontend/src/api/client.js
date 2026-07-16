/**
 * API Client — centralized fetch wrapper for the AI Text Summarizer API.
 * All backend calls go through this module.
 */

let BASE = import.meta.env.VITE_API_BASE_URL || '';
if (BASE.endsWith('/')) {
  BASE = BASE.slice(0, -1);
}

async function apiFetch(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = data.detail || data.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
}

// ─── Summarize ─────────────────────────────────────────
export async function summarizeText({ text, modelName, lengthMode, bulletPoints, language }) {
  return apiFetch('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({
      text,
      model_name: modelName || 'auto',
      length_mode: lengthMode || 'medium',
      bullet_points: bulletPoints || false,
      language: language || 'en',
      save_to_history: true,
    }),
  });
}

// ─── Upload ────────────────────────────────────────────
export async function uploadFile(file, { modelName, lengthMode, bulletPoints, language } = {}) {
  const form = new FormData();
  form.append('file', file);
  form.append('model_name', modelName || 'auto');
  form.append('length_mode', lengthMode || 'medium');
  form.append('bullet_points', String(bulletPoints || false));
  form.append('language', language || 'English');
  form.append('summarize', 'true');
  form.append('save_to_history', 'true');

  const response = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Upload failed (${response.status})`);
  return data;
}

// ─── Keywords & NLP ────────────────────────────────────
export async function extractKeywords(text, topN = 15) {
  return apiFetch('/api/keywords', {
    method: 'POST',
    body: JSON.stringify({ text, top_n: topN }),
  });
}

export async function analyzeSentiment(text) {
  return apiFetch('/api/sentiment', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function detectTopics(text) {
  return apiFetch('/api/topics', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function generateQuestions(text, num = 5) {
  return apiFetch('/api/questions', {
    method: 'POST',
    body: JSON.stringify({ text, top_n: num }),
  });
}

export async function runFullAnalysis(text) {
  return apiFetch('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ─── Audio TTS ─────────────────────────────────────────
export async function generateAudio(text, language = 'English') {
  const result = await apiFetch('/api/audio', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  });
  if (result && result.audio_url && !result.audio_url.startsWith('http')) {
    result.audio_url = `${BASE}${result.audio_url}`;
  }
  return result;
}

export async function fetchLanguages() {
  return apiFetch('/api/audio/languages/list');
}



// ─── History ───────────────────────────────────────────
export async function getHistory(limit = 20, offset = 0, sourceType = null) {
  let url = `/api/history?limit=${limit}&offset=${offset}`;
  if (sourceType) url += `&source_type=${sourceType}`;
  return apiFetch(url);
}

export async function deleteHistoryItem(id) {
  return apiFetch(`/api/history/${id}`, { method: 'DELETE' });
}

export async function clearHistory() {
  return apiFetch('/api/history', { method: 'DELETE' });
}

// ─── Plagiarism ───────────────────────────────────────
export async function checkPlagiarism({ text, file, mode }) {
  const form = new FormData();
  if (file) {
    form.append('file', file);
  } else {
    form.append('text', text || '');
  }
  form.append('mode', mode || 'both');

  const response = await fetch(`${BASE}/api/plagiarism/check`, {
    method: 'POST',
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Plagiarism check failed (${response.status})`);
  }
  return data;
}

export async function humanizeText(text) {
  return apiFetch('/api/plagiarism/humanize', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ─── Text Processor ────────────────────────────────────
export async function analyzeText(text) {
  return apiFetch('/api/text-processor/analyze', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// ─── Chat with AI (RAG) ───────────────────────────────
export async function uploadChatFile(file) {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${BASE}/api/chat/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Chat file upload failed (${response.status})`);
  }
  return data;
}

export async function queryChat(sessionId, query) {
  return apiFetch('/api/chat/query', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, query }),
  });
}

export async function deleteChatSession(sessionId) {
  return apiFetch(`/api/chat/session/${sessionId}`, {
    method: 'DELETE',
  });
}

// ─── Health ────────────────────────────────────────────
export async function checkHealth() {
  return apiFetch('/api/health');
}
