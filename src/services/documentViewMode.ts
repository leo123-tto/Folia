import type { OpenedFile } from '../types/document';

type FileType = OpenedFile['fileType'];

function removeFencedCodeBlocks(source: string): string {
  const output: string[] = [];
  let activeFenceMarker: '`' | '~' | null = null;
  let activeFenceLength = 0;

  for (const line of source.split(/\r?\n/)) {
    if (activeFenceMarker) {
      const closeMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (
        closeMatch &&
        closeMatch[1][0] === activeFenceMarker &&
        closeMatch[1].length >= activeFenceLength
      ) {
        activeFenceMarker = null;
        activeFenceLength = 0;
      }
      continue;
    }

    const openMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openMatch) {
      activeFenceMarker = openMatch[1][0] as '`' | '~';
      activeFenceLength = openMatch[1].length;
      continue;
    }

    output.push(line);
  }

  return output.join('\n');
}

export function hasRawHtmlTable(source: string): boolean {
  return /<table(?:\s|>)/i.test(removeFencedCodeBlocks(source));
}

export function prefersStableHtmlPreview(source: string, fileType: FileType): boolean {
  if (fileType === 'docx') return false;
  if (fileType === 'html') return true;
  return hasRawHtmlTable(source);
}
