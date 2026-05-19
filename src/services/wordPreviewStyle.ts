import type { PresetConfig } from './word/types';

export type WordPreviewStyle = Record<`--word-${string}`, string>;

function quoteFont(name: string): string {
  return `"${name}"`;
}

function alignToCss(align: string): string {
  if (align === 'both') return 'justify';
  return align;
}

function optionalColor(color?: string): string {
  return color ? `#${color}` : 'currentColor';
}

export function createWordPreviewStyle(config: PresetConfig): WordPreviewStyle {
  return {
    '--word-page-width': `${config.page.width}cm`,
    '--word-page-height': `${config.page.height}cm`,
    '--word-margin-top': `${config.page.margin_top}cm`,
    '--word-margin-right': `${config.page.margin_right}cm`,
    '--word-margin-bottom': `${config.page.margin_bottom}cm`,
    '--word-margin-left': `${config.page.margin_left}cm`,
    '--word-font-family': `${quoteFont(config.fonts.default.name)}, ${quoteFont(config.fonts.default.ascii)}, serif`,
    '--word-font-size': `${config.fonts.default.size}pt`,
    '--word-line-height': `${config.paragraph.line_spacing}`,
    '--word-paragraph-align': alignToCss(config.paragraph.align),
    '--word-paragraph-indent': `${config.paragraph.first_line_indent}em`,
    '--word-image-max-width': `min(${Math.round(config.image.display_ratio * 100)}%, ${config.image.max_width_cm}cm)`,
    '--word-table-header-font-family': `${quoteFont(config.table.header_font.name)}, ${quoteFont(config.table.header_font.ascii)}, sans-serif`,
    '--word-table-body-font-family': `${quoteFont(config.table.body_font.name)}, ${quoteFont(config.table.body_font.ascii)}, serif`,
    '--word-table-line-height': `${config.table.line_spacing}`,
    '--word-table-cell-padding': `${config.table.cell_margin}cm`,
    '--word-table-font-size': `${config.table.body_font.size}pt`,
    '--word-table-header-font-size': `${config.table.header_font.size}pt`,
    '--word-table-border-color': `#${config.table.border_color}`,
    '--word-heading-1-size': `${config.titles.level1.size}pt`,
    '--word-heading-1-align': alignToCss(config.titles.level1.align),
    '--word-heading-1-space-before': `${config.titles.level1.space_before}pt`,
    '--word-heading-1-space-after': `${config.titles.level1.space_after}pt`,
    '--word-heading-1-color': optionalColor(config.titles.level1.color),
    '--word-heading-2-size': `${config.titles.level2.size}pt`,
    '--word-heading-2-align': alignToCss(config.titles.level2.align),
    '--word-heading-2-space-before': `${config.titles.level2.space_before}pt`,
    '--word-heading-2-space-after': `${config.titles.level2.space_after}pt`,
    '--word-heading-2-color': optionalColor(config.titles.level2.color),
    '--word-heading-3-size': `${config.titles.level3.size}pt`,
    '--word-heading-3-align': alignToCss(config.titles.level3.align),
    '--word-heading-3-space-before': `${config.titles.level3.space_before}pt`,
    '--word-heading-3-space-after': `${config.titles.level3.space_after}pt`,
    '--word-heading-3-color': optionalColor(config.titles.level3.color),
    '--word-heading-4-size': `${config.titles.level4.size}pt`,
    '--word-heading-4-align': alignToCss(config.titles.level4.align),
    '--word-heading-4-space-before': `${config.titles.level4.space_before}pt`,
    '--word-heading-4-space-after': `${config.titles.level4.space_after}pt`,
    '--word-heading-4-color': optionalColor(config.titles.level4.color),
  };
}
