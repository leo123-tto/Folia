import { useRef, useState } from 'react';
import { Clipboard, FileUp, Trash2 } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import {
  addCustomExportPreset,
  removeCustomExportPreset,
  setExportPreset,
} from '../../services/settingsService';
import { listPresets } from '../../services/word/config';
import { createPresetTemplateText, importPresetFromJson, isCustomPresetId, PresetImportError } from '../../services/word';
import type { PresetId } from '../../services/word/types';

export function ExportSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const presets = listPresets(settings.customExportPresets);
  const selected = settings.exportPresetId;
  const selectedIsCustom = isCustomPresetId(selected);

  const handleChange = (id: PresetId) => {
    setExportPreset(id);
    setMessage(null);
  };

  const handleImportFile = async (file: File) => {
    try {
      const imported = importPresetFromJson(await file.text());
      addCustomExportPreset(imported.id, imported.config);
      setMessage({ tone: 'ok', text: `已导入「${imported.config.name}」` });
    } catch (error) {
      const text = error instanceof PresetImportError ? error.message : '导入失败，请检查 JSON 文件。';
      setMessage({ tone: 'error', text });
    }
  };

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(createPresetTemplateText());
      setMessage({ tone: 'ok', text: 'JSON 模板已复制' });
    } catch {
      setMessage({ tone: 'error', text: '无法复制模板' });
    }
  };

  const handleRemoveSelected = () => {
    if (!selectedIsCustom) return;
    removeCustomExportPreset(selected);
    setMessage({ tone: 'ok', text: '已删除自定义预设' });
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">导出预设</h3>
      <div className="settings-section-actions">
        <button type="button" className="primary-action-button" onClick={() => inputRef.current?.click()}>
          <FileUp size={15} />
          导入 JSON
        </button>
        <button type="button" className="settings-action-button" onClick={handleCopyTemplate}>
          <Clipboard size={14} />
          复制模板
        </button>
        <button
          type="button"
          className="settings-action-button"
          onClick={handleRemoveSelected}
          disabled={!selectedIsCustom}
        >
          <Trash2 size={14} />
          删除自定义
        </button>
        <input
          ref={inputRef}
          className="settings-file-input"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
            event.currentTarget.value = '';
          }}
        />
      </div>
      {message && <div className={`settings-message ${message.tone}`}>{message.text}</div>}
      <div className="settings-preset-list">
        {presets.map((preset) => (
          <label
            key={preset.id}
            className={`settings-preset-item ${selected === preset.id ? 'active' : ''}`}
          >
            <input
              type="radio"
              name="export-preset"
              value={preset.id}
              checked={selected === preset.id}
              onChange={() => handleChange(preset.id)}
              className="settings-preset-radio"
            />
            <span className="settings-preset-indicator" />
            <span className="settings-preset-content">
              <span className="settings-preset-name">
                {preset.name}
                {preset.source === 'custom' && <span className="settings-preset-badge">自定义</span>}
              </span>
              <span className="settings-preset-desc">{preset.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
