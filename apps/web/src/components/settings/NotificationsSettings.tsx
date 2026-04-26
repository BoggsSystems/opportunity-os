import React from 'react';

export const NotificationsSettings: React.FC = () => {
  return (
    <div className="settings-section">
      <div className="surface-card">
        <p className="label">Notifications</p>
        <h3>Coaching and momentum prompts</h3>
        <p>
          Notification preferences are not configurable yet. This section will hold delivery controls for coaching nudges,
          momentum reminders, and blocked-action prompts.
        </p>
      </div>
      <div className="settings-detail-list muted-panel">
        <div>
          <span>Current state</span>
          <strong>Using in-product notices and signals</strong>
        </div>
        <div>
          <span>Next step</span>
          <strong>Add delivery preferences and reactivation controls</strong>
        </div>
      </div>
    </div>
  );
};
