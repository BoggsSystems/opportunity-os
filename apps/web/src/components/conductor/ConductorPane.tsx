import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, UserRound } from 'lucide-react';
import type { ConversationMessage } from '../../types';
import { ConductorChat } from './ConductorChat';

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
  activeDraftContext?: string | null;
}

export const ConductorPane: React.FC<ConductorPaneProps> = (props) => {
  const [isResizing, setIsResizing] = useState(false);
  const [paneWidth, setPaneWidth] = useState(420);
  const paneRef = useRef<HTMLElement | null>(null);


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
      className={`conductor-pane tour-region-conductor ${isResizing ? 'resizing' : ''} ${props.expanded ? 'expanded' : 'collapsed'}`}
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
        <div className="pane-content-wrapper">
          {props.currentReasoningSummary ? (
            <div className="reasoning-card">
              <p className="label">Current reasoning</p>
              <p>{props.currentReasoningSummary}</p>
            </div>
          ) : null}

          <ConductorChat
            messages={props.messages}
            isWorking={props.isWorking}
            onSend={props.onSend}
            suggestedPrompts={props.suggestedPrompts}
            activeDraftContext={props.activeDraftContext ?? null}
            variant="pane"
          />
        </div>
      )}
    </aside>
  );
};
