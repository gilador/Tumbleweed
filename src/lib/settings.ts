const SETTINGS_KEY = "tumbleweed-settings";

interface AppSettings {
  shareDebugInfo: boolean;
}

const defaults: AppSettings = {
  shareDebugInfo: false,
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function save(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return load()[key];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const settings = load();
  settings[key] = value;
  save(settings);
}
