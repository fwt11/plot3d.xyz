import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useChartStore, selectActiveChart } from '@/store/chartStore';
import { useToastStore } from '@/store/toastStore';
import {
  JOURNAL_TEMPLATES,
  loadCustomTemplates,
  saveCustomTemplates,
  applyTemplate,
  templateFromConfig,
  type JournalTemplate,
} from '@/utils/journalTemplates';
import { Bookmark, Plus, Trash2, Check } from 'lucide-react';

export default function TemplatePanel() {
  const { t } = useTranslation();
  const chartConfig = useChartStore(selectActiveChart);
  const applyConfigPatch = useChartStore((s) => s.applyConfigPatch);
  const addToast = useToastStore((s) => s.addToast);

  const [customTemplates, setCustomTemplates] = useState<JournalTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateWidth, setNewTemplateWidth] = useState(3.5);
  const [newTemplateHeight, setNewTemplateHeight] = useState(2.6);

  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
  }, []);

  const handleApply = useCallback(
    (template: JournalTemplate) => {
      const patch = applyTemplate(chartConfig, template);
      applyConfigPatch(patch);
      addToast(t('toast.templateApplied', { defaultValue: 'Template applied' }), 'success');
    },
    [chartConfig, applyConfigPatch, addToast, t],
  );

  const handleSaveCustom = useCallback(() => {
    const name = newTemplateName.trim();
    if (!name) {
      addToast(t('toast.templateNameRequired', { defaultValue: 'Template name is required' }), 'warning');
      return;
    }
    const tpl = templateFromConfig(chartConfig, name, newTemplateWidth, newTemplateHeight);
    const updated = [...customTemplates, tpl];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setShowSaveDialog(false);
    setNewTemplateName('');
    addToast(t('toast.templateSaved', { defaultValue: 'Template saved' }), 'success');
  }, [chartConfig, newTemplateName, newTemplateWidth, newTemplateHeight, customTemplates, addToast, t]);

  const handleDeleteCustom = useCallback(
    (id: string) => {
      const updated = customTemplates.filter((tpl) => tpl.id !== id);
      setCustomTemplates(updated);
      saveCustomTemplates(updated);
      addToast(t('toast.templateDeleted', { defaultValue: 'Template deleted' }), 'success');
    },
    [customTemplates, addToast, t],
  );

  const renderTemplateCard = (template: JournalTemplate, isCustom: boolean) => (
    <div
      key={template.id}
      className="border rounded p-2 transition-colors"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {template.name}
        </span>
        {isCustom && (
          <button
            onClick={() => handleDeleteCustom(template.id)}
            className="shrink-0 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            title={t('template.delete', { defaultValue: 'Delete' })}
            aria-label={t('template.delete', { defaultValue: 'Delete' })}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {template.widthInches}" × {template.heightInches}" · {template.dpi} DPI · {template.fontSize}pt
      </div>
      <div className="flex gap-0.5 mb-1.5">
        {template.colorPalette.slice(0, 8).map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
        ))}
      </div>
      <button
        onClick={() => handleApply(template)}
        className="w-full text-[11px] py-1 rounded transition-colors flex items-center justify-center gap-1"
        style={{
          background: 'rgba(14, 165, 233, 0.12)',
          color: '#0ea5e9',
          border: '1px solid rgba(14, 165, 233, 0.25)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.22)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(14, 165, 233, 0.12)'; }}
        aria-label={t('template.apply', { defaultValue: 'Apply' })}
      >
        <Check size={11} />
        {t('template.apply', { defaultValue: 'Apply' })}
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <Bookmark size={12} />
          {t('template.journalPresets', { defaultValue: 'Journal Presets' })}
        </div>
        <button
          onClick={() => setShowSaveDialog((v) => !v)}
          className="text-[11px] px-2 py-0.5 rounded transition-colors flex items-center gap-1"
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.25)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.22)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.12)'; }}
          aria-label={t('template.saveCurrent', { defaultValue: 'Save Current as Template' })}
        >
          <Plus size={11} />
          {t('template.save', { defaultValue: 'Save' })}
        </button>
      </div>

      {showSaveDialog && (
        <div className="border rounded p-2 space-y-1.5" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)' }}>
          <label className="grid grid-cols-[50px_1fr] items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>{t('template.name', { defaultValue: 'Name' })}</span>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="My Template"
              className="border rounded px-2 py-0.5 outline-none focus:border-sky-500/50"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              aria-label={t('template.name', { defaultValue: 'Name' })}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('template.width', { defaultValue: 'W' })}
              <input
                type="number"
                step="0.1"
                value={newTemplateWidth}
                onChange={(e) => setNewTemplateWidth(Number(e.target.value))}
                className="w-14 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                aria-label={t('template.width', { defaultValue: 'Width inches' })}
              />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('template.height', { defaultValue: 'H' })}
              <input
                type="number"
                step="0.1"
                value={newTemplateHeight}
                onChange={(e) => setNewTemplateHeight(Number(e.target.value))}
                className="w-14 border rounded px-1.5 py-0.5 outline-none focus:border-sky-500/50"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                aria-label={t('template.height', { defaultValue: 'Height inches' })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveCustom}
              className="flex-1 text-[11px] py-1 rounded transition-colors"
              style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)' }}
              aria-label={t('template.confirmSave', { defaultValue: 'Save' })}
            >
              {t('template.confirmSave', { defaultValue: 'Save' })}
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="flex-1 text-[11px] py-1 rounded transition-colors"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              aria-label={t('template.cancel', { defaultValue: 'Cancel' })}
            >
              {t('template.cancel', { defaultValue: 'Cancel' })}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {JOURNAL_TEMPLATES.map((tpl) => renderTemplateCard(tpl, false))}
      </div>

      {customTemplates.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wider flex items-center gap-1 pt-1" style={{ color: 'var(--text-muted)' }}>
            <Bookmark size={12} />
            {t('template.custom', { defaultValue: 'Custom Templates' })}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {customTemplates.map((tpl) => renderTemplateCard(tpl, true))}
          </div>
        </>
      )}
    </div>
  );
}
