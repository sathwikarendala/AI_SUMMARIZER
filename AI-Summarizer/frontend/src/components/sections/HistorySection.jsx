import { useState, useEffect, useCallback } from 'react';
import { getHistory, deleteHistoryItem, clearHistory } from '../../api/client';
import toast from 'react-hot-toast';

const SOURCE_ICONS = {
  text: '📝',
  file: '📄',
  youtube: '▶',
  webpage: '🌐',
};

export default function HistorySection() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 15;

  const loadHistory = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const result = await getHistory(limit, offset, filter || null);
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (err) {
      toast.error(`Failed to load history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setPage(0); loadHistory(0); }, [filter, loadHistory]);

  const handleNextPage = () => {
    const nextOffset = (page + 1) * limit;
    if (nextOffset < total) { setPage(p => p + 1); loadHistory(nextOffset); }
  };

  const handlePrevPage = () => {
    if (page > 0) { const p = page - 1; setPage(p); loadHistory(p * limit); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteHistoryItem(id);
      toast.success('Deleted!');
      loadHistory(page * limit);
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL history items?')) return;
    try {
      await clearHistory();
      toast.success('History cleared!');
      setItems([]);
      setTotal(0);
      setPage(0);
    } catch (err) {
      toast.error(`Clear failed: ${err.message}`);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Summary copied!');
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  return (
    <section className="section" aria-labelledby="history-title">
      <div className="section-header">
        <h1 className="section-title" id="history-title">🕐 Summary History</h1>
        <p className="section-subtitle">Browse, copy, and manage your past summaries.</p>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="tab-pills">
          {[
            { key: '', label: 'All' },
            { key: 'text', label: '📝 Text' },
            { key: 'file', label: '📄 File' },
          ].map(f => (
            <button key={f.key} className={`tab-pill ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => loadHistory(page * limit)} disabled={loading}>
            {loading ? <span className="spinner" /> : '🔄 Refresh'}
          </button>
          <button className="btn btn-danger" onClick={handleClearAll} disabled={items.length === 0}>🗑️ Clear All</button>
        </div>
      </div>

      {/* List */}
      <div className="history-list">
        {loading && items.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--r-lg)' }} />
          ))
        ) : items.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty-icon">🕐</span>
            <div className="history-empty-text">No summaries found</div>
            <p style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>Generate summaries to build your history.</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="history-item">
              <span className="history-source-icon">{SOURCE_ICONS[item.source_type] || '📝'}</span>
              <div className="history-content">
                <div className="history-title">
                  {item.source_name || item.source_type?.toUpperCase() || 'Text Summary'}
                </div>
                <div className="history-preview">{item.summary}</div>
                <div className="history-meta">
                  <span className="history-tag">{item.source_type}</span>
                  <span>{item.model_used}</span>
                  <span>{item.original_words}→{item.summary_words} words ({item.reduction_pct}%)</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
              <div className="history-actions">
                <button className="btn btn-secondary btn-icon" title="Copy summary" onClick={() => handleCopy(item.summary)}>📋</button>
                <button className="btn btn-danger btn-icon" title="Delete" onClick={() => handleDelete(item.id)}>🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary" onClick={handlePrevPage} disabled={page === 0}>← Previous</button>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Page {page + 1} of {Math.ceil(total / limit)}</span>
          <button className="btn btn-secondary" onClick={handleNextPage} disabled={(page + 1) * limit >= total}>Next →</button>
        </div>
      )}
    </section>
  );
}
