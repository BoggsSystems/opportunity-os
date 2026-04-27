import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Zap } from 'lucide-react';
import type { ConversationMessage } from '../../types';

interface ConductorChatProps {
  messages: ConversationMessage[];
  isWorking: boolean;
  onSend: (message: string) => void;
  placeholder?: string;
  variant?: 'pane' | 'wizard';
  suggestedPrompts?: string[];
}

export const ConductorChat: React.FC<ConductorChatProps> = ({
  messages,
  isWorking,
  onSend,
  placeholder = "Tell the assistant what you want to create, review, or execute...",
  variant = 'pane',
  suggestedPrompts = []
}) => {
  const [draftMessage, setDraftMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = draftMessage.trim();
    if (!message || isWorking) return;
    setDraftMessage('');
    onSend(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`conductor-chat-container ${variant}`}>
      <div ref={scrollRef} className="conversation-thread">
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            {variant === 'wizard' && message.role === 'assistant' && (
              <div className="conductor-avatar"><Zap size={14} /></div>
            )}
            <div className="message-content">
              <p>{message.text}</p>
            </div>
          </article>
        ))}
        {isWorking ? (
          <article className="message assistant pending">
            {variant === 'wizard' ? (
              <>
                <div className="conductor-avatar"><Zap size={14} /></div>
                <div className="message-content">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="spin" size={16} />
                <p>Working through the current cycle...</p>
              </>
            )}
          </article>
        ) : null}
      </div>

      <div className="prompt-row">
        {suggestedPrompts.slice(0, 3).map((prompt) => (
          <button key={prompt} onClick={() => onSend(prompt)} type="button">
            {prompt}
          </button>
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          aria-label="Message the Conductor"
          onChange={(event) => setDraftMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={variant === 'wizard' ? 1 : 3}
          value={draftMessage}
        />
        <button 
          className="send-button" 
          disabled={!draftMessage.trim() || isWorking} 
          title="Send message" 
          type="submit"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
