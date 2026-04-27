import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, UserRound, Loader2, Send } from 'lucide-react';
import type { ConversationMessage } from '../../types';

interface ConductorPaneProps {
  userEmail: string;
  messages: ConversationMessage[];
  suggestedPrompts: string[];
  currentReasoningSummary: string | null;
  isWorking: boolean;
  onSend: (message: string) => Promise<void>;
  onLogout: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  onboardingActive?: boolean;
  onboardingComponent?: React.ReactNode;
}

export const ConductorPane: React.FC<ConductorPaneProps> = (props) => {
  const [draftMessage, setDraftMessage] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [paneWidth, setPaneWidth] = useState(420);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [props.messages]);

  // Set CSS variable for grid layout
  useEffect(() => {
    if (props.expanded) {
      document.documentElement.style.setProperty('--conductor-width', `${paneWidth}px`);
    }
  }, [paneWidth, props.expanded]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = paneWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(300, Math.min(600, startWidth + deltaX));
      setPaneWidth(newWidth);
      
      // Update CSS variable for dynamic width
      document.documentElement.style.setProperty('--conductor-width', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <aside 
      ref={paneRef}
      className={`conductor-pane ${isResizing ? 'resizing' : ''} ${props.expanded ? 'expanded' : 'collapsed'}`}
      style={{ width: props.expanded ? `${paneWidth}px` : '60px' }}
    >
      <header className="conductor-header">
        <div className="conductor-title">
          <div className="assistant-mark">
            <Bot size={21} />
          </div>
          {props.expanded && (
            <div>
              <p className="eyebrow">The Conductor</p>
              <h2>Strategic operator</h2>
            </div>
          )}
        </div>
        <div className="conductor-actions">
            <button 
              className="icon-button" 
              onClick={props.onToggleExpanded} 
              title={props.expanded ? "Collapse conductor" : "Expand conductor"}
              type="button"
            >
              {props.expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          {props.expanded && (
            <button className="icon-button" onClick={props.onLogout} title="Log out" type="button">
              <UserRound size={18} />
            </button>
          )}
        </div>
      </header>

      {props.expanded && (
        <>
          <div className="account-chip">{props.userEmail}</div>
        </>
      )}

      {props.expanded && (
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        />
      )}

      {props.expanded && (
        <>
          {props.currentReasoningSummary ? (
            <div className="reasoning-card">
              <p className="label">Current reasoning</p>
              <p>{props.currentReasoningSummary}</p>
            </div>
          ) : null}

          <div ref={scrollRef} className="conversation-thread">
            {props.onboardingActive && props.onboardingComponent ? (
              <div className="onboarding-embedded">
                {props.onboardingComponent}
              </div>
            ) : (
              <>
                {props.messages.map((message) => (
                  <article key={message.id} className={`message ${message.role}`}>
                    <p>{message.text}</p>
                  </article>
                ))}
                {props.isWorking ? (
                  <article className="message assistant pending">
                    <Loader2 className="spin" size={16} />
                    <p>Working through the current cycle...</p>
                  </article>
                ) : null}
              </>
            )}
          </div>

          <div className="prompt-row">
            {props.suggestedPrompts.slice(0, 3).map((prompt) => (
              <button key={prompt} onClick={() => void props.onSend(prompt)} type="button">
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              const message = draftMessage.trim();
              setDraftMessage('');
              void props.onSend(message);
            }}
          >
            <textarea
              aria-label="Message the Conductor"
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Tell the assistant what you want to create, review, or execute..."
              rows={3}
              value={draftMessage}
            />
            <button className="send-button" disabled={!draftMessage.trim() || props.isWorking} title="Send message" type="submit">
              <Send size={18} />
            </button>
          </form>
        </>
      )}
    </aside>
  );
};
