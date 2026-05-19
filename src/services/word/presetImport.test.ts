import { describe, expect, it } from 'vitest';
import { createPresetTemplateText, importPresetFromJson, PresetImportError } from './presetImport';

describe('presetImport', () => {
  it('imports a JSON preset by merging it with a built-in base', () => {
    const imported = importPresetFromJson(JSON.stringify({
      id: 'compact-legal',
      name: '紧凑法律文书',
      description: '更小页边距的法律文书预设',
      base: 'legal',
      config: {
        page: { margin_left: 2.4, margin_right: 2.4 },
        paragraph: { line_spacing: 1.35, first_line_indent: 2, align: 'justify' },
      },
    }));

    expect(imported.id).toBe('custom:compact-legal');
    expect(imported.config.name).toBe('紧凑法律文书');
    expect(imported.config.page.margin_left).toBe(2.4);
    expect(imported.config.fonts.default.name).toBe('仿宋_GB2312');
  });

  it('creates a usable template document', () => {
    const imported = importPresetFromJson(createPresetTemplateText());

    expect(imported.id).toBe('custom:my-legal-preset');
    expect(imported.config.page.width).toBe(21);
  });

  it('rejects malformed preset files', () => {
    expect(() => importPresetFromJson('{broken')).toThrow(PresetImportError);
    expect(() => importPresetFromJson(JSON.stringify({ config: { page: { width: -1 } } }))).toThrow(PresetImportError);
  });
});
