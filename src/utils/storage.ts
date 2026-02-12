const HIGH_SCORE_KEY = 'nebula-defender-high-score';
const SETTINGS_KEY = 'nebula-defender-settings';

export type Settings = {
  soundEnabled: boolean;
  screenshake: boolean;
};

const defaultSettings: Settings = {
  soundEnabled: true,
  screenshake: true,
};

export const loadHighScore = (): number => {
  const value = localStorage.getItem(HIGH_SCORE_KEY);
  return value ? Number(value) || 0 : 0;
};

export const saveHighScore = (score: number): void => {
  localStorage.setItem(HIGH_SCORE_KEY, String(score));
};

export const loadSettings = (): Settings => {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      soundEnabled: parsed.soundEnabled ?? defaultSettings.soundEnabled,
      screenshake: parsed.screenshake ?? defaultSettings.screenshake,
    };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: Settings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
