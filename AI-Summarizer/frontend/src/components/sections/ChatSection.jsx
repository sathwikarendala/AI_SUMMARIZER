import { useState, useRef, useEffect, useCallback } from 'react';
import { uploadChatFile, queryChat, deleteChatSession } from '../../api/client';
import toast from 'react-hot-toast';
import './ChatSection.css';

export default function ChatSection() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Chat States
  const [sessionId, setSessionId] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, queryLoading]);

  // Clean up session on unmount if it exists
  useEffect(() => {
    return () => {
      if (sessionId) {
        deleteChatSession(sessionId).catch(err => console.error("Failed to clean up session:", err));
      }
    };
  }, [sessionId]);

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
        toast.error('Only PDF files are supported for RAG Chat.');
        return;
      }
      setFile(selectedFile);
      triggerUpload(selectedFile);
    }
  };

  const triggerUpload = async (fileToUpload) => {
    setUploading(true);
    const toastId = toast.loading('Uploading and indexing PDF... 🚀');
    try {
      const data = await uploadChatFile(fileToUpload);
      setSessionId(data.session_id);
      setPdfInfo({
        filename: data.filename,
        chunkCount: data.chunk_count,
        wordCount: data.word_count,
        pageCount: data.page_count
      });
      
      // Add initial greeting from system/assistant
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Hi! I have processed and indexed your document **${data.filename}** (${data.page_count || 1} page(s), ${data.chunk_count} text fragments). Ask me anything about it! 📄✨`,
          sources: []
        }
      ]);
      
      toast.success('PDF processed! Let\'s chat. 💬', { id: toastId });
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`, { id: toastId });
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || queryLoading) return;

    const userMessageText = input.trim();
    setInput('');
    
    // Add user message
    const userMsgId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userMessageText }]);
    
    setQueryLoading(true);
    try {
      const data = await queryChat(sessionId, userMessageText);
      const aiMsgId = `ai-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: aiMsgId,
        sender: 'assistant',
        text: data.answer,
        sources: data.sources || []
      }]);
    } catch (err) {
      toast.error(`Error getting response: ${err.message}`);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!sessionId) return;
    const toastId = toast.loading('Closing session...');
    try {
      await deleteChatSession(sessionId);
      toast.success('Session cleared.', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
    } finally {
      setSessionId(null);
      setFile(null);
      setPdfInfo(null);
      setMessages([]);
    }
  };

  return (
    <section className="section" aria-labelledby="chat-title">
      <div className="section-header">
        <h1 className="section-title" id="chat-title">💬 Chat with AI</h1>
        <p className="section-subtitle">
          Query your documents in real-time. Upload a PDF, and chat interactively with its content.
        </p>
      </div>

      {!sessionId ? (
        <div className="chat-upload-container">
          <div className="card chat-upload-card">
            <div className="chat-intro-illustration">
              <span className="illustration-icon">🧠</span>
              <div className="pulse-circle"></div>
            </div>
            
            <h2 className="upload-card-title">Upload a PDF to Start</h2>
            <p className="upload-card-desc">
              Your document is chunked and semantically indexed locally using dense embeddings. None of your document text is uploaded to any public database.
            </p>

            <div 
              className={`chat-drop-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'disabled' : ''}`}
              onDragOver={e => { e.preventDefault(); if (!uploading) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { 
                e.preventDefault(); 
                setDragOver(false); 
                if (!uploading) handleFileSelect(e.dataTransfer.files[0]); 
              }}
            >
              <input 
                type="file" 
                accept=".pdf" 
                disabled={uploading} 
                onChange={e => handleFileSelect(e.target.files[0])} 
              />
              <span className="drop-icon" aria-hidden="true">📥</span>
              <div className="drop-title">Drag & drop your PDF here</div>
              <div className="drop-subtitle">or click to browse local files</div>
              <div className="file-limit-badge">Max 50MB • PDF only</div>
            </div>

            {uploading && (
              <div className="upload-progress-container">
                <span className="spinner"></span>
                <span className="progress-text">Analyzing layout & computing semantic embeddings...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="chat-interface-container card">
          {/* Active File Header */}
          <div className="chat-header">
            <div className="chat-file-details">
              <span className="chat-file-icon">📄</span>
              <div className="chat-file-meta">
                <h3 className="chat-file-name" title={pdfInfo?.filename}>{pdfInfo?.filename}</h3>
                <span className="chat-file-stats">
                  {pdfInfo?.pageCount ? `${pdfInfo.pageCount} page(s) • ` : ''}
                  {pdfInfo?.chunkCount} fragments • {pdfInfo?.wordCount.toLocaleString()} words
                </span>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm close-session-btn" onClick={handleCloseSession}>
              🔄 Upload New PDF
            </button>
          </div>

          {/* Messages Area */}
          <div className="chat-messages-area">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content-wrapper">
                  <div className="message-bubble">
                    <p className="message-text">{msg.text}</p>
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="message-sources">
                      <summary className="sources-summary">
                        🔍 Verified Sources ({msg.sources.length})
                      </summary>
                      <div className="sources-list">
                        {msg.sources.map((src, i) => (
                          <div key={i} className="source-item">
                            <div className="source-item-header">
                              <span className="source-item-index">Excerpt #{src.index + 1}</span>
                              <span className="source-item-score">
                                Match: {Math.round(src.score * 100)}%
                              </span>
                            </div>
                            <p className="source-item-text">"{src.text}"</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            
            {queryLoading && (
              <div className="message-row assistant typing">
                <div className="message-avatar">🤖</div>
                <div className="message-content-wrapper">
                  <div className="message-bubble typing-bubble">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                  <span className="typing-indicator-label">Scanning document matching nodes...</span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="chat-text-input"
              placeholder="Ask a question about the PDF..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={queryLoading}
              required
            />
            <button className="chat-send-btn" type="submit" disabled={queryLoading || !input.trim()}>
              <span className="btn-send-icon">➔</span>
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
