import React from 'react';

interface ProfileSettingsProps {
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user }) => {
  return (
    <div className="settings-section">
      <div className="surface-card">
        <p className="label">Profile</p>
        <h3>{user.fullName ?? 'Operator'}</h3>
        <div className="settings-detail-list">
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Timezone</span>
            <strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>
          </div>
          <div>
            <span>User ID</span>
            <strong>{user.id}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
