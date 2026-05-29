import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET_ID, getPreset } from './config';
import { markdownToDocx } from './parser';

async function readDocumentXml(markdown: string): Promise<string> {
  const blob = await markdownToDocx(markdown, getPreset(DEFAULT_PRESET_ID));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('word/document.xml not found in generated DOCX');
  }
  return documentXml;
}

function countXmlNodes(xml: string, nodeName: string): number {
  return xml.match(new RegExp(`<${nodeName}\\b`, 'g'))?.length ?? 0;
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
});
