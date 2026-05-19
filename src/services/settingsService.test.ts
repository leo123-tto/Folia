// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCustomExportPreset,
  getExportPreset,
  getExportPresetConfig,
  getSettings,
  removeCustomExportPreset,
  setExportPreset,
  updateSettings,
} from './settingsService';
import { importPresetFromJson } from './word';

describe('settingsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when persisted settings are missing or invalid', () => {
    expect(getSettings().exportPresetId).toBe('legal');
    expect(getSettings().autoUpdateCheck).toBe(true);

    localStorage.setItem('folia-settings', '{invalid json');

    expect(getSettings().exportPresetId).toBe('legal');
    expect(getSettings().autoUpdateCheck).toBe(true);
  });

  it('migrates legacy export settings without recursive reads', () => {
    localStorage.setItem('folia-export-settings', JSON.stringify({ defaultPresetId: 'academic' }));

    expect(getExportPreset()).toBe('academic');
    expect(localStorage.getItem('folia-export-settings')).toBeNull();
    expect(JSON.parse(localStorage.getItem('folia-settings') || '{}')).toMatchObject({
      exportPresetId: 'academic',
    });
  });

  it('persists partial updates while preserving existing settings', () => {
    setExportPreset('report');
    updateSettings({ editorFontSize: 16 });

    expect(getSettings()).toMatchObject({
      exportPresetId: 'report',
      editorFontSize: 16,
      previewWidth: 680,
    });
  });

  it('stores custom export presets and falls back when one is removed', () => {
    const imported = importPresetFromJson(JSON.stringify({
      id: 'court-brief',
      name: '庭审提纲',
      description: '庭审提纲导出样式',
      base: 'legal',
      config: {
        fonts: { default: { name: '宋体', ascii: 'Times New Roman', size: 11 } },
      },
    }));

    addCustomExportPreset(imported.id, imported.config);

    expect(getExportPreset()).toBe('custom:court-brief');
    expect(getExportPresetConfig().name).toBe('庭审提纲');
    expect(getSettings().customExportPresets['custom:court-brief'].fonts.default.size).toBe(11);

    removeCustomExportPreset('custom:court-brief');

    expect(getExportPreset()).toBe('legal');
    expect(getSettings().customExportPresets['custom:court-brief']).toBeUndefined();
  });
});
