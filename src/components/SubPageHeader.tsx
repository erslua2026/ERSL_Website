import React, { useEffect, useState } from 'react';
import { Edit2, Palette, RotateCcw, Save, X } from 'lucide-react';
import { PageHeaderConfig } from '../types';

export interface SubPageHeaderPassProps {
  headerOverride?: PageHeaderConfig;
  accentColor?: string;
  showSubheadings?: boolean;
  canEditHeader?: boolean;
  onSaveHeader?: (tabId: string, next: PageHeaderConfig) => void;
}

interface SubPageHeaderProps {
  tabId: string;
  defaults: PageHeaderConfig;
  override?: PageHeaderConfig;
  accentColor: string;
  showSubtitle?: boolean;
  canEdit?: boolean;
  onSave?: (tabId: string, next: PageHeaderConfig) => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const HEADER_PRESETS: { label: string; bgColor: string; gradientEnd?: string }[] = [
  { label: 'UA Crimson', bgColor: '#9E1B32' },
  { label: 'Crimson → Slate', bgColor: '#9E1B32', gradientEnd: '#1e293b' },
  { label: 'Deep Ocean', bgColor: '#0f172a', gradientEnd: '#1e3a8a' },
  { label: 'Forest Teal', bgColor: '#065f46', gradientEnd: '#0f766e' },
];

export const SubPageHeader: React.FC<SubPageHeaderProps> = ({
  tabId,
  defaults,
  override,
  accentColor,
  showSubtitle = true,
  canEdit = false,
  onSave,
  actions,
  children,
}) => {
  const current: PageHeaderConfig = {
    badge: override?.badge ?? defaults.badge,
    title: override?.title ?? defaults.title,
    subtitle: override?.subtitle ?? defaults.subtitle,
    bgColor: override?.bgColor || defaults.bgColor || accentColor,
    gradientEnd: override?.gradientEnd ?? defaults.gradientEnd ?? '',
  };

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PageHeaderConfig>(current);

  useEffect(() => {
    if (!isEditing) {
      setDraft(current);
    }
  }, [override?.badge, override?.title, override?.subtitle, override?.bgColor, override?.gradientEnd, accentColor, isEditing]);

  const activeBg = isEditing ? (draft.bgColor || accentColor) : (current.bgColor || accentColor);
  const activeGradEnd = isEditing ? draft.gradientEnd : current.gradientEnd;

  const bannerStyle: React.CSSProperties = activeGradEnd
    ? { background: `linear-gradient(135deg, ${activeBg}, ${activeGradEnd})` }
    : { backgroundColor: activeBg };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSave) return;
    onSave(tabId, {
      badge: draft.badge.trim() || defaults.badge,
      title: draft.title.trim() || defaults.title,
      subtitle: draft.subtitle.trim(),
      bgColor: draft.bgColor || accentColor,
      gradientEnd: draft.gradientEnd?.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleReset = () => {
    const resetVal: PageHeaderConfig = {
      badge: defaults.badge,
      title: defaults.title,
      subtitle: defaults.subtitle,
      bgColor: accentColor,
      gradientEnd: undefined,
    };
    setDraft(resetVal);
    onSave?.(tabId, resetVal);
    setIsEditing(false);
  };

  return (
    <div
      className="rounded-2xl p-6 md:p-8 shadow-md text-left text-white transition-all"
      style={bannerStyle}
    >
      <div className="flex flex-wrap items-start md:items-center justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <span className="inline-block bg-white/15 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest text-white">
            {isEditing ? draft.badge || 'BADGE' : current.badge}
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold text-white mt-2 tracking-tight">
            {isEditing ? draft.title || defaults.title : current.title}
          </h2>
          {showSubtitle && (isEditing ? draft.subtitle : current.subtitle) && (
            <p className="text-xs md:text-sm text-white/90 mt-1 max-w-2xl leading-relaxed">
              {isEditing ? draft.subtitle : current.subtitle}
            </p>
          )}
        </div>

        {(actions || (canEdit && onSave)) && (
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {actions}
            {canEdit && onSave && !isEditing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(current);
                  setIsEditing(true);
                }}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                title="Customize this tab header text and color"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Header</span>
              </button>
            )}
          </div>
        )}
      </div>

      {children && <div className="mt-4">{children}</div>}

      {isEditing && (
        <form
          onSubmit={handleSave}
          className="mt-5 bg-white text-slate-800 rounded-xl p-4 shadow-lg border border-white/40 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="font-extrabold uppercase tracking-wider text-[#9E1B32] flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              Edit Sub-Page Header
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Eyebrow Badge</label>
              <input
                value={draft.badge}
                onChange={e => setDraft({ ...draft, badge: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-slate-50 font-semibold"
                placeholder="e.g., RESEARCH DIRECTORY"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Header Title</label>
              <input
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg bg-slate-50 font-bold"
                placeholder="Page Title"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Subtitle / Description</label>
            <textarea
              rows={2}
              value={draft.subtitle}
              onChange={e => setDraft({ ...draft, subtitle: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg bg-slate-50"
              placeholder="Short description below the heading..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>Primary Fill:</span>
                <input
                  type="color"
                  value={draft.bgColor || accentColor}
                  onChange={e => setDraft({ ...draft, bgColor: e.target.value })}
                  className="w-8 h-7 rounded border border-gray-300 cursor-pointer"
                />
              </label>
              <label className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>Gradient End (Optional):</span>
                <input
                  type="color"
                  value={draft.gradientEnd || draft.bgColor || accentColor}
                  onChange={e => setDraft({ ...draft, gradientEnd: e.target.value })}
                  className="w-8 h-7 rounded border border-gray-300 cursor-pointer"
                />
                {draft.gradientEnd && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, gradientEnd: '' })}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Solid
                  </button>
                )}
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
              {HEADER_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDraft({ ...draft, bgColor: preset.bgColor, gradientEnd: preset.gradientEnd || '' })}
                  className="px-2 py-1 rounded border border-gray-200 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Default
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="px-4 py-1.5 rounded-lg text-white font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Header
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
