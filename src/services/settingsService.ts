import {
  DEFAULT_PRESET_ID,
  getPreset,
  hasPreset,
  isCustomPresetId,
  type CustomPresetId,
  type CustomPresetRegistry,
  type PresetConfig,
  type PresetId,
} from './word';

const STORAGE_KEY = 'folia-settings';
const LEGACY_KEY = 'folia-export-settings';
const LAST_FILE_KEY = 'folia-last-opened-file';

export const SETTINGS_CHANGED_EVENT = 'folia-settings-changed';

export type EditorFontFamily = 'IBM Plex Mono' | 'JetBrains Mono' | 'SF Mono' | 'System Default';
export type PreviewFontFamily = 'Iowan Old Style' | 'Georgia' | 'System Default';
export type DefaultEncoding = 'UTF-8' | 'GBK' | 'GB18030';
export type PreviewWidth = 640 | 680 | 720 | 800;

export interface AppSettings {
  // 通用
  autoSave: boolean;
  autoUpdateCheck: boolean;
  defaultEncoding: DefaultEncoding;
  reopenLastFile: boolean;
  // 导出
  exportPresetId: PresetId;
  customExportPresets: CustomPresetRegistry;
  // 编辑器
  editorFontFamily: EditorFontFamily;
  editorFontSize: number;
  editorTabSize: number;
  editorWordWrap: boolean;
  editorLineNumbers: boolean;
  editorSpellCheck: boolean;
  // 预览
  previewFontFamily: PreviewFontFamily;
  previewFontSize: number;
  previewLineHeight: number;
  previewWidth: PreviewWidth;
  // 外观
  theme: 'light' | 'dark';
  zoomLevel: number;
}

const defaults: AppSettings = {
  autoSave: false,
  autoUpdateCheck: true,
  defaultEncoding: 'UTF-8',
  reopenLastFile: true,
  exportPresetId: 'legal',
  customExportPresets: {} as CustomPresetRegistry,
  editorFontFamily: 'IBM Plex Mono',
  editorFontSize: 13,
  editorTabSize: 4,
  editorWordWrap: true,
  editorLineNumbers: true,
  editorSpellCheck: false,
  previewFontFamily: 'Iowan Old Style',
  previewFontSize: 15,
  previewLineHeight: 1.7,
  previewWidth: 680,
  theme: 'light',
  zoomLevel: 100,
};

function readStoredSettings(): Partial<AppSettings> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function normalizeCustomExportPresets(value: unknown): CustomPresetRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as CustomPresetRegistry;
  }

  const result: Partial<CustomPresetRegistry> = {};
  for (const [id, config] of Object.entries(value)) {
    if (isCustomPresetId(id) && config && typeof config === 'object' && !Array.isArray(config)) {
      result[id as CustomPresetId] = config as PresetConfig;
    }
  }
  return result as CustomPresetRegistry;
}

function migrateLegacySettings(stored: Partial<AppSettings>): Partial<AppSettings> {
  const next = { ...stored };
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy.defaultPresetId) {
        next.exportPresetId = legacy.defaultPresetId;
      }
      localStorage.removeItem(LEGACY_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, ...next }));
    }
  } catch {
    // 迁移失败不影响正常使用
  }
  return next;
}

function emitSettingsChanged(settings: AppSettings): void {
  window.dispatchEvent(new CustomEvent<AppSettings>(SETTINGS_CHANGED_EVENT, { detail: settings }));
}

export function getSettings(): AppSettings {
  try {
    const stored = migrateLegacySettings(readStoredSettings());
    const customExportPresets = normalizeCustomExportPresets(stored.customExportPresets);
    const exportPresetId = stored.exportPresetId && hasPreset(stored.exportPresetId, customExportPresets)
      ? stored.exportPresetId
      : DEFAULT_PRESET_ID;

    return {
      ...defaults,
      ...stored,
      exportPresetId,
      customExportPresets,
    };
  } catch {
    return { ...defaults };
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const customExportPresets = normalizeCustomExportPresets(patch.customExportPresets ?? current.customExportPresets);
  const requestedPresetId = patch.exportPresetId ?? current.exportPresetId;
  const merged = {
    ...current,
    ...patch,
    customExportPresets,
    exportPresetId: hasPreset(requestedPresetId, customExportPresets) ? requestedPresetId : DEFAULT_PRESET_ID,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  emitSettingsChanged(merged);
  return merged;
}

export function getLastOpenedPath(): string | null {
  return localStorage.getItem(LAST_FILE_KEY);
}

export function setLastOpenedPath(path: string): void {
  localStorage.setItem(LAST_FILE_KEY, path);
}

export function clearLastOpenedPath(): void {
  localStorage.removeItem(LAST_FILE_KEY);
}

// ---- Backward-compatible API ----

export function getExportSettings(): { defaultPresetId: PresetId } {
  return { defaultPresetId: getSettings().exportPresetId };
}

export function setExportSettings(settings: { defaultPresetId: PresetId }): void {
  updateSettings({ exportPresetId: settings.defaultPresetId });
}

export function getExportPreset(): PresetId {
  return getSettings().exportPresetId;
}

export function setExportPreset(id: PresetId): void {
  updateSettings({ exportPresetId: id });
}

export function getExportPresetConfig(): PresetConfig {
  const settings = getSettings();
  return getPreset(settings.exportPresetId, settings.customExportPresets);
}

export function addCustomExportPreset(id: CustomPresetId, config: PresetConfig): AppSettings {
  const settings = getSettings();
  return updateSettings({
    customExportPresets: {
      ...settings.customExportPresets,
      [id]: config,
    },
    exportPresetId: id,
  });
}

export function removeCustomExportPreset(id: CustomPresetId): AppSettings {
  const settings = getSettings();
  const next = { ...settings.customExportPresets };
  delete next[id];
  return updateSettings({
    customExportPresets: next,
    exportPresetId: settings.exportPresetId === id ? DEFAULT_PRESET_ID : settings.exportPresetId,
  });
}
