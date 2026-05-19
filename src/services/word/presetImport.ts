import { DEFAULT_PRESET_ID, deepMerge, getPreset, isBuiltInPresetId } from './config';
import type { BuiltInPresetId, CustomPresetId, PresetConfig } from './types';

export interface ImportablePresetJson {
  id?: string;
  name: string;
  description?: string;
  base?: BuiltInPresetId;
  config: Partial<PresetConfig>;
}

export interface ImportedPreset {
  id: CustomPresetId;
  config: PresetConfig;
}

export class PresetImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetImportError';
  }
}

const TEMPLATE: ImportablePresetJson = {
  id: 'my-legal-preset',
  name: '我的法律文书',
  description: '从 Folia JSON 模板导入的自定义 Word 导出预设',
  base: 'legal',
  config: {
    page: {
      width: 21,
      height: 29.7,
      margin_top: 2.54,
      margin_bottom: 2.54,
      margin_left: 3.18,
      margin_right: 3.18,
    },
    fonts: {
      default: { name: '仿宋_GB2312', ascii: 'Times New Roman', size: 12 },
    },
    paragraph: { line_spacing: 1.5, first_line_indent: 2, align: 'justify' },
    image: { display_ratio: 0.92, max_width_cm: 14.2, target_dpi: 260, show_caption: false },
  },
};

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PresetImportError('JSON 顶层必须是对象。');
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireString(value: unknown, label: string): string {
  const result = optionalString(value);
  if (!result) throw new PresetImportError(`${label} 不能为空。`);
  return result;
}

function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function assertPositiveNumber(source: unknown, path: string): void {
  const value = getPath(source, path);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PresetImportError(`${path} 必须是大于 0 的数字。`);
  }
}

function assertString(source: unknown, path: string): void {
  const value = getPath(source, path);
  if (typeof value !== 'string' || !value.trim()) {
    throw new PresetImportError(`${path} 必须是非空字符串。`);
  }
}

function validatePresetConfig(config: PresetConfig): void {
  assertString(config, 'name');
  assertString(config, 'description');
  [
    'page.width',
    'page.height',
    'page.margin_top',
    'page.margin_bottom',
    'page.margin_left',
    'page.margin_right',
    'fonts.default.size',
    'titles.level1.size',
    'titles.level2.size',
    'titles.level3.size',
    'titles.level4.size',
    'paragraph.line_spacing',
    'table.line_spacing',
    'table.cell_margin',
    'table.header_font.size',
    'table.body_font.size',
    'image.display_ratio',
    'image.max_width_cm',
    'image.target_dpi',
  ].forEach((path) => assertPositiveNumber(config, path));

  [
    'fonts.default.name',
    'fonts.default.ascii',
    'paragraph.align',
    'table.header_font.name',
    'table.header_font.ascii',
    'table.body_font.name',
    'table.body_font.ascii',
  ].forEach((path) => assertString(config, path));
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function toCustomPresetId(value: string | undefined, fallback: string): CustomPresetId {
  const raw = (value || fallback).replace(/^custom:/, '').trim();
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  return `custom:${slug || `preset-${hashString(raw || fallback)}`}`;
}

function readBasePresetId(value: unknown): BuiltInPresetId {
  if (typeof value === 'string' && isBuiltInPresetId(value)) {
    return value;
  }
  return DEFAULT_PRESET_ID;
}

export function createPresetTemplate(): ImportablePresetJson {
  return JSON.parse(JSON.stringify(TEMPLATE)) as ImportablePresetJson;
}

export function createPresetTemplateText(): string {
  return `${JSON.stringify(createPresetTemplate(), null, 2)}\n`;
}

export function importPresetFromJson(text: string): ImportedPreset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PresetImportError('JSON 解析失败，请检查文件格式。');
  }

  const input = readObject(parsed);
  const directConfig = input.config ? readObject(input.config) : input;
  const name = requireString(input.name ?? directConfig.name, 'name');
  const description = optionalString(input.description ?? directConfig.description) || '自定义 Word 导出预设';
  const baseId = readBasePresetId(input.base);
  const merged = deepMerge(getPreset(baseId), directConfig as Partial<PresetConfig>) as PresetConfig;
  const config: PresetConfig = {
    ...merged,
    name,
    description,
  };

  validatePresetConfig(config);

  return {
    id: toCustomPresetId(optionalString(input.id), name),
    config,
  };
}
