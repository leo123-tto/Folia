import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_ID, getPreset } from './config';
import { markdownToDocx } from './parser';
import type { PresetConfig } from './types';

async function readDocxZip(markdown: string, preset: PresetConfig = getPreset(DEFAULT_PRESET_ID)): Promise<JSZip> {
  const blob = await markdownToDocx(markdown, preset);
  return JSZip.loadAsync(await blob.arrayBuffer());
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const text = await zip.file(path)?.async('string');
  if (!text) {
    throw new Error(`${path} not found in generated DOCX`);
  }
  return text;
}

async function optionalZipText(zip: JSZip, path: string): Promise<string | undefined> {
  return zip.file(path)?.async('string');
}

async function readDocumentXml(markdown: string, preset: PresetConfig = getPreset(DEFAULT_PRESET_ID)): Promise<string> {
  return readZipText(await readDocxZip(markdown, preset), 'word/document.xml');
}

async function readDocumentRelationships(markdown: string, preset: PresetConfig): Promise<{
  documentXml: string;
  headerXml?: string;
  footerXml?: string;
}> {
  const zip = await readDocxZip(markdown, preset);
  return {
    documentXml: await readZipText(zip, 'word/document.xml'),
    headerXml: await optionalZipText(zip, 'word/header1.xml'),
    footerXml: await optionalZipText(zip, 'word/footer1.xml'),
  };
}

function countXmlNodes(xml: string, nodeName: string): number {
  return xml.match(new RegExp(`<${nodeName}\\b`, 'g'))?.length ?? 0;
}

function xmlAttr(xml: string, tag: string, attr: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*${attr}="([^"]+)"`));
  return match?.[1];
}

function allXmlAttrs(xml: string, tag: string, attr: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*${attr}="([^"]+)"`, 'g'))].map((match) => match[1]);
}

describe('markdownToDocx XML output', () => {
  it('preserves key merge and header nodes for legal HTML tables', async () => {
    const markdown = readFileSync(
      join(process.cwd(), 'fixtures', 'legal-html-tables', 'evidence-directory.md'),
      'utf8',
    );

    const documentXml = await readDocumentXml(markdown);

    expect(documentXml).toMatch(/<w:gridSpan\b[^>]*w:val="3"/);
    expect(documentXml).toMatch(/<w:vMerge\b[^>]*w:val="restart"/);
    expect(documentXml).toMatch(/<w:vMerge\b(?![^>]*w:val="restart")/);
    expect(countXmlNodes(documentXml, 'w:tblHeader')).toBe(2);
    expect(countXmlNodes(documentXml, 'w:tr')).toBeGreaterThanOrEqual(7);
  });

  it('applies extended table and header page-number preset values to DOCX XML', async () => {
    const base = getPreset(DEFAULT_PRESET_ID);
    const preset: PresetConfig = {
      ...base,
      page_number: {
        enabled: true,
        format: '1',
        font: 'Times New Roman',
        size: 10.5,
        position: 'header',
        align: 'right',
      },
      table: {
        ...base.table,
        border_enabled: false,
        alignment: 'center',
        vertical_align: 'bottom',
        cell_margins: {
          top: 40 / 567,
          bottom: 40 / 567,
          left: 60 / 567,
          right: 60 / 567,
        },
        header_background_color: '1E3A5F',
        row_odd_background_color: 'F5F0ED',
        row_even_background_color: 'FFFFFF',
      },
    };

    const { documentXml, headerXml, footerXml } = await readDocumentRelationships([
      '| 事项 | 说明 |',
      '| --- | --- |',
      '| 第一行 | 奇数背景 |',
      '| 第二行 | 偶数背景 |',
    ].join('\n'), preset);

    expect(headerXml).toBeDefined();
    expect(footerXml).toBeUndefined();
    expect(headerXml).toMatch(/<w:jc\b[^>]*w:val="right"/);
    expect(headerXml).toMatch(/<w:instrText\b[^>]*>\s*PAGE\s*<\/w:instrText>/);
    expect(headerXml).not.toMatch(/NUMPAGES/);

    expect(documentXml).toMatch(/<w:jc\b[^>]*w:val="center"/);
    expect(documentXml).toMatch(/<w:vAlign\b[^>]*w:val="bottom"/);
    expect(documentXml).toMatch(/<w:top\b[^>]*w:val="none"/);
    expect(documentXml).toMatch(/<w:bottom\b[^>]*w:val="none"/);
    expect(xmlAttr(documentXml, 'w:top', 'w:w')).toBe('40');
    expect(xmlAttr(documentXml, 'w:left', 'w:w')).toBe('60');
    expect(allXmlAttrs(documentXml, 'w:shd', 'w:fill')).toEqual(expect.arrayContaining([
      '1E3A5F',
      'F5F0ED',
      'FFFFFF',
    ]));
  });

  it('exports image captions when enabled and alt text exists', async () => {
    const base = getPreset(DEFAULT_PRESET_ID);
    const preset: PresetConfig = {
      ...base,
      image: {
        ...base.image,
        show_caption: true,
      },
    };

    const documentXml = await readDocumentXml('![证据图片](https://example.com/image.png)', preset);

    expect(documentXml).toContain('[图片: 证据图片]');
    expect(documentXml).toContain('证据图片');
  });
});
