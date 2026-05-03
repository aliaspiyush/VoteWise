import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../api';
import { useApp } from '../context';
import type { ChatMessage } from '../types';
import './ChatPanel.css';

const SUGGESTED_QUESTIONS = [
  'What is NOTA and how do I use it?',
  'How do I check my voter registration?',
  'What is the Model Code of Conduct (MCC)?',
  'What documents do I need on voting day?',
  'How does an EVM work?',
  'What happens if my name is not on the voter list?',
];

interface Props {
  userState?: string;
  isFirstTime?: boolean;
}

let msgIdCounter = 0;
function genId() { return `msg_${++msgIdCounter}_${Date.now()}`; }

// Simple markdown-like formatting
function formatText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

export default function ChatPanel({ userState, isFirstTime }: Props) {
  const { chatHistory, addToChatHistory } = useApp();
  const welcomeText = [
    '\uD83D\uDC4B Namaste! I\u2019m **VoteWise**, your AI election guide.',
    '',
    'You\u2019re registered in **' + (userState || 'your state') + '**' +
      (isFirstTime ? ' and I see this is your first time voting \u2014 welcome to India\u2019s democracy! \uD83C\uDDEE\uD83C\uDDF3' : '.'),
    '',
    'Ask me anything about the election process, voter rights, or how to cast your vote. I\u2019m here to help!',
  ].join('\n');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: welcomeText,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    const botMsgId = genId();
    const botMsg: ChatMessage = {
      id: botMsgId,
      role: 'model',
      text: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
    setIsLoading(true);

    addToChatHistory('user', text.trim());

    await sendChatMessage(
      text.trim(),
      chatHistory,
      { userState, isFirstTime, currentPhase: 'Nomination Filing' },
      // onChunk
      (chunk) => {
        setMessages(prev => prev.map(m =>
          m.id === botMsgId ? { ...m, text: m.text + chunk } : m
        ));
      },
      // onDone
      (fullText, fnCall) => {
        setMessages(prev => prev.map(m =>
          m.id === botMsgId
            ? { ...m, text: fullText || m.text, isStreaming: false, functionCall: fnCall as any }
            : m
        ));
        addToChatHistory('model', fullText);
        setIsLoading(false);
      },
      // onError
      (errMsg) => {
        setMessages(prev => prev.map(m =>
          m.id === botMsgId
            ? { ...m, text: `⚠️ ${errMsg}`, isStreaming: false }
            : m
        ));
        setIsLoading(false);
      }
    );
  }, [chatHistory, isLoading, userState, isFirstTime, addToChatHistory]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function startVoiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in your browser. Try Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <div className="chat-panel" aria-label="VoteWise chat">
      {/* Messages */}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-message ${msg.role}`}
            aria-label={`${msg.role === 'model' ? 'VoteWise' : 'You'}: ${msg.text.slice(0, 50)}`}
          >
              <div className="bot-avatar" aria-hidden="true">V</div>
            <div className="message-bubble">
              {msg.isStreaming && msg.text === '' ? (
                <div className="typing-indicator" aria-label="VoteWise is typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              ) : (
                <div
                  className="message-text"
                  dangerouslySetInnerHTML={{ __html: `<p>${formatText(msg.text)}</p>` }}
                />
              )}
              {msg.isStreaming && msg.text !== '' && (
                <span className="streaming-cursor" aria-hidden="true" />
              )}
              <time className="message-time" dateTime={msg.timestamp.toISOString()}>
                {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="suggested-chips" aria-label="Suggested questions">
          <p className="chips-label">Try asking:</p>
          <div className="chips-row">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                className="chip"
                onClick={() => sendMessage(q)}
                disabled={isLoading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="input-row">
          <textarea
            ref={inputRef}
            id="chat-input"
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about Indian elections…"
            rows={1}
            disabled={isLoading}
            aria-label="Type your question"
          />
          <button
            id="voice-input-btn"
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={startVoiceInput}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            title="Voice input (en-IN)"
          >
            {isListening ? '🔴' : '🎙️'}
          </button>
          <button
            id="send-btn"
            className="send-btn btn btn-primary"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            {isLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '↑'}
          </button>
        </div>
        <p className="input-hint">
          Press Enter to send · Shift+Enter for new line · 🎙️ for voice
        </p>
      </div>
    </div>
  );
}
