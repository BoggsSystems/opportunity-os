import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquareText, Send, Zap } from 'lucide-react';
import type { ConversationMessage } from '../../types';

interface ConductorChatProps {
  messages: ConversationMessage[];
  isWorking: boolean;
  onSend: (message: string) => void;
  placeholder?: string;
  variant?: 'pane' | 'wizard';
  suggestedPrompts?: string[];
  activeDraftContext?: string | null;
}

export const ConductorChat: React.FC<ConductorChatProps> = ({
  messages,
  isWorking,
  onSend,
  placeholder = "Tell the assistant what you want to create, review, or execute...",
  variant = 'pane',
  suggestedPrompts = [],
  activeDraftContext = null
}) => {
  const [draftMessage, setDraftMessage] = useState('');
  const [promptsExpanded, setPromptsExpanded] = useState(false);
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

      <div className={`conductor-interactions ${promptsExpanded ? 'prompts-expanded' : ''}`}>
        {activeDraftContext && variant === 'pane' ? (
          <div className="active-draft-context">
            <MessageSquareText size={15} />
            <span>{activeDraftContext}</span>
          </div>
        ) : null}

        {suggestedPrompts.length ? (
          <div className="prompts-panel">
            <div className="prompts-header">
              <span>Suggested actions</span>
              <button type="button" onClick={() => setPromptsExpanded(false)} className="close-prompts">
                Hide
              </button>
            </div>
            <div className="prompt-row">
              {suggestedPrompts.map((prompt) => (
                <button key={prompt} onClick={() => { onSend(prompt); setPromptsExpanded(false); }} type="button">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form className="composer-vertical" onSubmit={handleSubmit}>
          <textarea
            aria-label="Message the Conductor"
            onChange={(event) => setDraftMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={variant === 'wizard' ? 1 : 3}
            value={draftMessage}
          />
          <div className="composer-actions">
            <div className="actions-left">
              {!!suggestedPrompts.length && (
                <button 
                  type="button" 
                  className={`expand-prompts-btn ${promptsExpanded ? 'active' : ''}`}
                  onClick={() => setPromptsExpanded(!promptsExpanded)}
                  title={promptsExpanded ? "Hide suggested actions" : "View suggested actions"}
                >
                  <Zap size={14} />
                </button>
              )}
            </div>
            <div className="actions-right">
              <button 
                className="send-button" 
                disabled={!draftMessage.trim() || isWorking} 
                title="Send message" 
                type="submit"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
