import { useState } from 'react';

interface Notice {
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface UpgradePromptState {
  featureKey: string;
  reason?: string;
  hint?: string;
}

type SettingsSection = 'profile' | 'connectors' | 'connections' | 'usage' | 'notifications';

interface UseUIStateReturn {
  // Settings state
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  setSettingsOpen: (open: boolean) => void;
  setSettingsSection: (section: SettingsSection) => void;
  
  // Loading states
  isBooting: boolean;
  isWorking: boolean;
  setIsBooting: (booting: boolean) => void;
  setIsWorking: (working: boolean) => void;
  
  // Notice and upgrade states
  notice: Notice | null;
  upgradePrompt: UpgradePromptState | null;
  setNotice: (notice: Notice | null) => void;
  setUpgradePrompt: (prompt: UpgradePromptState | null) => void;
}

export const useUIState = (): UseUIStateReturn => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [isBooting, setIsBooting] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptState | null>(null);

  return {
    // Settings state
    settingsOpen,
    settingsSection,
    setSettingsOpen,
    setSettingsSection,
    
    // Loading states
    isBooting,
    isWorking,
    setIsBooting,
    setIsWorking,
    
    // Notice and upgrade states
    notice,
    upgradePrompt,
    setNotice,
    setUpgradePrompt,
  };
};
