import { expect, type Page, test } from '@playwright/test';

async function openEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: '源码模式' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await page.locator('.cm-content').click();
}

async function typeMarkdown(page: Page, markdown: string): Promise<void> {
  await openEditor(page);
  await page.keyboard.insertText(markdown);
  await page.getByRole('button', { name: 'Word 预览' }).click();
  await expect(page.locator('.word-preview-panel')).toBeVisible();
}

test('default layout shows the WYSIWYG editor only', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.wysiwyg-editor-pane')).toBeVisible();
  await expect(page.locator('.word-preview-panel')).toHaveCount(0);
  await expect(page.locator('.cm-editor')).toHaveCount(0);
});

test('toolbar hides the app name and keeps draggable space around controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.wordmark')).toHaveCount(0);
  await expect(page.locator('.app-toolbar')).not.toContainText('Folia');
  const dragRegions = await page.evaluate(() => ({
    spacer: document.querySelector('.toolbar-spacer')?.hasAttribute('data-tauri-drag-region') ?? false,
    overlay: document.querySelector('.toolbar-drag-region')?.hasAttribute('data-tauri-drag-region') ?? false,
    fallback: document.querySelector('.app-toolbar')?.getAttribute('data-window-drag-fallback') ?? '',
  }));
  expect(dragRegions).toEqual({ spacer: true, overlay: true, fallback: 'manual' });
});

test('WYSIWYG editor uses the same warm page background as the shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.vditor-wysiwyg')).toBeVisible();

  const colors = await page.evaluate(() => {
    const editor = document.querySelector('.vditor-wysiwyg');
    const inner = document.querySelector('.vditor-wysiwyg > .vditor-reset');
    return {
      editor: editor ? getComputedStyle(editor).backgroundColor : '',
      inner: inner ? getComputedStyle(inner).backgroundColor : '',
      body: getComputedStyle(document.body).backgroundColor,
    };
  });

  expect(colors.editor).toBe(colors.body);
  expect(colors.inner).not.toBe('rgb(255, 255, 255)');
});

test('toolbar toggles source mode without showing Word preview', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '源码模式' }).click();
  await expect(page.locator('.editor-pane')).toBeVisible();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.word-preview-panel')).toHaveCount(0);

  await page.getByRole('button', { name: '源码模式' }).click();
  await expect(page.locator('.wysiwyg-editor-pane')).toBeVisible();
  await expect(page.locator('.cm-editor')).toHaveCount(0);
});

test('source mode keeps long documents scrollable', async ({ page }) => {
  await page.goto('/');
  await openEditor(page);
  await page.keyboard.insertText(
    Array.from({ length: 140 }, (_, index) => `第 ${index + 1} 行：源码模式滚动回归测试`).join('\n'),
  );

  const scrollMetrics = await page.locator('.cm-scroller').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return {
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
    };
  });

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight + 200);
  expect(scrollMetrics.scrollTop).toBeGreaterThan(120);
});

test('Word preview button opens and closes the right paper preview panel', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '导出 Word' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Word 预览' }).click();
  await expect(page.locator('.word-preview-panel')).toBeVisible();
  await expect(page.getByLabel('Word 导出预设')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 Word' })).toBeVisible();

  await page.getByRole('button', { name: 'Word 预览', exact: true }).click();
  await expect(page.locator('.word-preview-panel')).toHaveCount(0);
});

test('Word preview keeps a true A4 page and scales it to the side panel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Word 预览' }).click();
  await expect(page.locator('.word-rendered-paper')).toBeVisible();
  await expect(page.locator('.word-page-label').first()).toHaveText('第 1 页');

  const metrics = await page.locator('.word-rendered-paper').evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      paddingLeft: parseFloat(style.paddingLeft),
    };
  });
  const scale = await page.locator('.word-preview-stage').evaluate((el) => (
    parseFloat(getComputedStyle(el).getPropertyValue('--word-preview-scale') || '1')
  ));

  expect(metrics.width).toBeGreaterThan(780);
  expect(metrics.width).toBeLessThan(805);
  expect(metrics.height).toBeGreaterThan(1110);
  expect(metrics.paddingLeft).toBeGreaterThan(115);
  expect(scale).toBeGreaterThan(0.45);
  expect(scale).toBeLessThan(0.7);
});

test('Word preview paginates long documents with page labels', async ({ page }) => {
  await page.goto('/');
  await typeMarkdown(page, Array.from({ length: 90 }, (_, index) => (
    `## 第 ${index + 1} 段\n\n这是用于分页预览的较长段落，确保 Word 预览会拆分成多张 A4 纸。`
  )).join('\n\n'));

  await expect(page.locator('.word-page-label').nth(1)).toHaveText('第 2 页');
  const labels = await page.locator('.word-page-label').allTextContents();
  expect(labels.length).toBeGreaterThan(1);
});

test('Word preview resizer changes panel width', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Word 预览' }).click();

  const panel = page.locator('.word-preview-panel');
  const resizer = page.getByRole('separator', { name: '调整 Word 预览宽度' });
  const before = await panel.boundingBox();
  const handle = await resizer.boundingBox();

  expect(before).not.toBeNull();
  expect(handle).not.toBeNull();

  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x - 140, handle!.y + handle!.height / 2);
  await page.mouse.up();

  const after = await panel.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeGreaterThan(before!.width + 80);
});

test('source edits are reflected when switching back to WYSIWYG', async ({ page }) => {
  await page.goto('/');
  await openEditor(page);
  await page.keyboard.insertText('# 证据目录\n\n正文内容');

  await page.getByRole('button', { name: '源码模式' }).click();
  await expect(page.locator('.wysiwyg-editor-pane')).toContainText('证据目录');
});

test('raw HTML tables use the stable reading preview instead of WYSIWYG editing', async ({ page }) => {
  await page.goto('/');
  await openEditor(page);
  await page.keyboard.insertText([
    '<table>',
    '<tr><th rowspan="2">序号</th><th colspan="2">证据</th></tr>',
    '<tr><th>名称</th><th>证明目的</th></tr>',
    '<tr><td>1</td><td>合同</td><td>证明合同关系</td></tr>',
    '</table>',
  ].join('\n'));

  await page.getByRole('button', { name: '源码模式' }).click();
  const table = page.locator('.html-preview-pane table').first();
  await expect(table).toBeVisible();
  await expect(page.locator('.html-preview-pane th[colspan="2"]')).toBeVisible();
  await expect(page.locator('.html-preview-pane th[rowspan="2"]')).toBeVisible();
  await expect(page.locator('.wysiwyg-editor-pane')).toHaveCount(0);

  const tableWidth = await table.evaluate((el) => el.getBoundingClientRect().width);
  expect(tableWidth).toBeGreaterThan(560);
});

test('legacy Markdown preview is not mounted by default', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.preview-area')).toHaveCount(0);
  await expect(page.locator('.preview-content')).toHaveCount(0);
});

test('Word preview uses the right panel instead of replacing the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Word 预览' }).click();

  await expect(page.locator('.wysiwyg-editor-pane')).toBeVisible();
  await expect(page.locator('.word-preview-panel')).toBeVisible();
});

test('Word preview panel keeps the editor visible while resizing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Word 预览' }).click();

  const editor = page.locator('.wysiwyg-editor-pane');
  const resizer = page.getByRole('separator', { name: '调整 Word 预览宽度' });
  const before = await editor.boundingBox();
  const handle = await resizer.boundingBox();

  expect(before).not.toBeNull();
  expect(handle).not.toBeNull();

  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x - 120, handle!.y + handle!.height / 2);
  await page.mouse.up();

  const after = await editor.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBeLessThan(before!.width - 60);
});

test('settings modal keeps a fixed size across sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置' }).click();

  const modal = page.locator('.settings-modal');
  const before = await modal.boundingBox();
  expect(before).not.toBeNull();

  await page.getByRole('button', { name: '导出', exact: true }).click();
  const after = await modal.boundingBox();
  expect(after).not.toBeNull();

  expect(Math.round(after!.width)).toBe(Math.round(before!.width));
  expect(Math.round(after!.height)).toBe(Math.round(before!.height));
});

test('settings about section exposes update controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('button', { name: '关于' }).click();

  await expect(page.getByText('自动检查更新')).toBeVisible();
  await expect(page.getByRole('button', { name: '检查更新', exact: true })).toBeVisible();
  await expect(page.getByText('GitHub Releases')).toBeVisible();
});

test('long HTML evidence tables wrap inside the preview pane', async ({ page }) => {
  await page.goto('/');
  await typeMarkdown(
    page,
    [
      '<table>',
      '<thead><tr><th>序号</th><th>证据名称</th><th>证明目的</th><th>备注</th></tr></thead>',
      '<tbody>',
      '<tr>',
      '<td>1</td>',
      '<td>关于项目付款、交付、验收及后续沟通记录的完整证据目录附件一二三四五六七八九十</td>',
      '<td>证明双方在合同履行过程中已经就付款节点、交付范围、验收方式及违约责任进行了连续沟通并形成明确意思表示</td>',
      '<td>file:///Users/example/Documents/case-materials/very-long-folder-name/evidence-index-with-extra-long-name-and-no-natural-breakpoints.pdf</td>',
      '</tr>',
      '</tbody>',
      '</table>',
    ].join('\n'),
  );

  const table = page.locator('.word-rendered-paper .word-paper-content table').first();
  const shell = page.locator('.word-rendered-paper').first();
  await expect(table).toBeVisible();

  const horizontalOverflow = await shell.evaluate((el) => el.scrollWidth - el.clientWidth);
  const cellWhiteSpace = await page.locator('.word-rendered-paper .word-paper-content td').first()
    .evaluate((el) => getComputedStyle(el).whiteSpace);

  expect(horizontalOverflow).toBeLessThanOrEqual(2);
  expect(cellWhiteSpace).toBe('normal');
});

test('toc pane uses a larger readable default scale', async ({ page }) => {
  await page.goto('/');
  await openEditor(page);
  await page.keyboard.insertText('# 证据目录\n\n## 第一组 权利基础\n\n### 登记证书');
  await page.getByRole('button', { name: '大纲' }).click();

  const metrics = await page.locator('.toc-pane').evaluate((el) => {
    const item = el.querySelector('.toc-item');
    const header = el.querySelector('.toc-header');
    const itemStyle = item ? getComputedStyle(item) : null;
    const headerStyle = header ? getComputedStyle(header) : null;
    return {
      width: el.getBoundingClientRect().width,
      itemFontSize: itemStyle ? parseFloat(itemStyle.fontSize) : 0,
      itemLineHeight: itemStyle ? parseFloat(itemStyle.lineHeight) : 0,
      headerFontSize: headerStyle ? parseFloat(headerStyle.fontSize) : 0,
    };
  });

  expect(metrics.width).toBeGreaterThanOrEqual(220);
  expect(metrics.itemFontSize).toBeGreaterThanOrEqual(13);
  expect(metrics.itemLineHeight).toBeGreaterThanOrEqual(19);
  expect(metrics.headerFontSize).toBeGreaterThanOrEqual(10);
});
