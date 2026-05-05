import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';

const QUICK_PROMPTS = [
  'Kya hai aaj due? 📅',
  'Pending assignments 📚',
  'Aaj ka schedule 🗓️',
  'Koi urgent cheez? ⚡',
];

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderMarkdown(text) {
  const lines = String(text || '').split('\n');
  const output = [];
  let bulletItems = [];

  const flushBullets = () => {
    if (!bulletItems.length) return;
    output.push(
      <ul key={`ul-${output.length}`} className="chat-md-list">
        {bulletItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    bulletItems = [];
  };

  lines.forEach((line, index) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (bulletMatch) {
      bulletItems.push(bulletMatch[1]);
      return;
    }

    flushBullets();
    if (!line.trim()) {
      output.push(<br key={`br-${index}`} />);
      return;
    }
    output.push(
      <p key={`p-${index}`} className="chat-md-paragraph">
        {renderInlineMarkdown(line)}
      </p>,
    );
  });

  flushBullets();
  return output;
}

function renderInlineMarkdown(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function TypingIndicator() {
  return (
    <div className="chat-message-row bot">
      <div className="chat-bubble bot typing">
        <span>Thinking</span>
        <span className="typing-dots" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </span>
      </div>
    </div>
  );
}

function ChatMessage({ message, onRetry }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message-row ${isUser ? 'user' : 'bot'}`}>
      <div className={`chat-bubble ${isUser ? 'user' : 'bot'} ${message.error ? 'error' : ''}`}>
        <div className="chat-message-content">{renderMarkdown(message.text)}</div>
        {message.error && (
          <button className="chat-retry-btn" type="button" onClick={() => onRetry(message.retryPrompt)}>
            Retry
          </button>
        )}
      </div>
      <div className={`chat-timestamp ${isUser ? 'user' : 'bot'}`}>{message.time}</div>
    </div>
  );
}

export default function Chatbot({ open, onClose }) {
  const { apiFetch, refreshNotifications } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('idle');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const nextMessageIdRef = useRef(0);

  const isSending = status === 'sending';
  const canSend = input.trim().length > 0 && !isSending;

  const history = useMemo(
    () => messages
      .filter((message) => !message.error)
      .slice(-10)
      .map((message) => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.text,
      })),
    [messages],
  );

  useEffect(() => {
    if (!open) {
      window.setTimeout(() => {
        setMessages([]);
        setInput('');
        setStatus('idle');
      }, 0);
      return;
    }

    window.setTimeout(() => textareaRef.current?.focus(), 120);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending, open]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 112)}px`;
  }, [input]);

  const sendPrompt = async (promptText) => {
    const prompt = promptText.trim();
    if (!prompt || isSending) return;

    const userMessage = {
      id: `user-${nextMessageIdRef.current++}`,
      role: 'user',
      text: prompt,
      time: formatTime(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setStatus('sending');

    try {
      const payload = await apiFetch('/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          user_id: 1,
          history,
        }),
      }, false);

      const botMessage = {
        id: `assistant-${nextMessageIdRef.current++}`,
        role: 'assistant',
        text: payload?.response || 'mujhe nahi pata, context mein nahi hai',
        time: formatTime(),
      };

      setMessages((current) => [...current, botMessage]);

      if (payload?.action && payload.action !== 'none') {
        refreshNotifications().catch(() => {});
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${nextMessageIdRef.current++}`,
          role: 'assistant',
          text: 'Oops, kuch masla hua. Please try again.',
          time: formatTime(),
          error: true,
          retryPrompt: prompt,
        },
      ]);
    } finally {
      setStatus('idle');
      window.setTimeout(() => textareaRef.current?.focus(), 80);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendPrompt(input);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendPrompt(input);
    }
  };

  return (
    <div className={`chat-overlay-root ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button className="chat-backdrop" type="button" aria-label="Close chatbot" onClick={onClose}></button>
      <aside className="chat-panel" aria-label="AcadPulse AI chat panel">
        <header className="chat-panel-header">
          <div className="chat-title-block">
            <div className="chat-title-row">
              <span className="chat-ready-dot"></span>
              <h2>AcadPulse AI</h2>
            </div>
            <p>Ask me anything about your academics</p>
          </div>
          <button className="chat-close-btn" type="button" onClick={onClose} aria-label="Close chatbot">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div className="chat-message-area">
          {messages.length === 0 && !isSending ? (
            <div className="chat-empty-prompts">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="chat-prompt-pill"
                  type="button"
                  onClick={() => sendPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} onRetry={sendPrompt} />
            ))
          )}
          {isSending && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-bar" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask in English ya Roman Urdu..."
            rows={1}
            disabled={isSending}
          />
          <button className="chat-send-btn" type="submit" disabled={!canSend} aria-label="Send message">
            {isSending ? <span className="chat-send-spinner"></span> : <i className="fa-solid fa-paper-plane"></i>}
          </button>
        </form>
      </aside>
    </div>
  );
}
