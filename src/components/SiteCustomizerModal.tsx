import React, { useState } from 'react';
import {
  X, Palette, Layout, ListOrdered, Home, Plus, ArrowUp, ArrowDown,
  Trash2, RotateCcw, Save, Globe, Lock, EyeOff, FolderGit2
} from 'lucide-react';
import {
  CustomPageData, LayoutMode, SiteConfig, TabConfig, TabPosition, TabVisibility
} from '../types';
import { defaultSiteConfig } from '../data/defaultSiteConfig';
import { ImageUploadField } from './ImageUploadField';

interface SiteCustomizerModalProps {
  config: SiteConfig;
  customPages: Record<string, CustomPageData>;
  onSaveConfig: (next: SiteConfig) => void;
  onCreateCustomPage: (tab: TabConfig, page: CustomPageData) => void;
  onDeleteCustomTab: (tabId: string) => void;
  onClose: () => void;
}

const COLOR_PRESETS = [
  {
    name: 'UA Crimson (Swapped Subheading)',
    primaryColor: '#9E1B32',
    subheadingColor: '#9E1B32',
    headerBgColor: '#ffffff',
    headerTextColor: '#0f172a',
    pageBgColor: '#f8fafc',
    swapHomeColors: true,
  },
  {
    name: 'Classic Crimson Sidebar',
    primaryColor: '#9E1B32',
    subheadingColor: '#be123c',
    headerBgColor: '#7a1325',
    headerTextColor: '#ffffff',
    pageBgColor: '#f8fafc',
    swapHomeColors: false,
  },
  {
    name: 'Ocean Hydrology Blue',
    primaryColor: '#0369a1',
    subheadingColor: '#0284c7',
    headerBgColor: '#ffffff',
    headerTextColor: '#0f172a',
    pageBgColor: '#f0f9ff',
    swapHomeColors: true,
  },
  {
    name: 'GeoAI Slate Dark',
    primaryColor: '#9E1B32',
    subheadingColor: '#e11d48',
    headerBgColor: '#0f172a',
    headerTextColor: '#f8fafc',
    pageBgColor: '#f1f5f9',
    swapHomeColors: true,
  },
];

export const SiteCustomizerModal: React.FC<SiteCustomizerModalProps> = ({
  config,
  customPages,
  onSaveConfig,
  onCreateCustomPage,
  onDeleteCustomTab,
  onClose,
}) => {
  const [section, setSection] = useState<'layout' | 'colors' | 'tabs' | 'home'>('layout');
  const [draft, setDraft] = useState<SiteConfig>(JSON.parse(JSON.stringify(config)));

  // New Custom Tab / Sub-Webpage form
  const [newTabLabel, setNewTabLabel] = useState('');
  const [newTabIcon, setNewTabIcon] = useState('📄');
  const [newTabVis, setNewTabVis] = useState<TabVisibility>('public');
  const [newTabBoxUrl, setNewTabBoxUrl] = useState('');

  const moveTab = (index: number, dir: -1 | 1) => {
    const nextTabs = [...draft.tabs];
    const target = index + dir;
    if (target < 0 || target >= nextTabs.length) return;
    [nextTabs[index], nextTabs[target]] = [nextTabs[target], nextTabs[index]];
    setDraft({ ...draft, tabs: nextTabs });
  };

  const updateTab = (idx: number, patch: Partial<TabConfig>) => {
    const nextTabs = draft.tabs.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setDraft({ ...draft, tabs: nextTabs });
  };

  const handleAddCustomTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTabLabel.trim()) return;
    const slug = `custom-${newTabLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const newTab: TabConfig = {
      id: slug,
      label: newTabLabel.trim(),
      icon: newTabIcon.trim() || '📄',
      visibility: newTabVis,
      isCustom: true,
    };
    const newPage: CustomPageData = {
      tabId: slug,
      title: newTabLabel.trim(),
      boxFolderUrl: newTabBoxUrl.trim() || undefined,
      subTabs: [
        { id: 'overview', label: 'Overview', visibility: 'public', blocks: [] },
        { id: 'resources', label: 'Useful Links & Docs', visibility: 'public', blocks: [] },
        { id: 'datasets', label: 'Datasets (Box)', visibility: newTabVis === 'members' ? 'members' : 'public', blocks: [] },
      ],
    };

    const nextDraft = { ...draft, tabs: [...draft.tabs, newTab] };
    setDraft(nextDraft);
    onCreateCustomPage(newTab, newPage);
    onSaveConfig(nextDraft);
    setNewTabLabel('');
    setNewTabBoxUrl('');
  };

  const applySave = () => {
    onSaveConfig(draft);
    onClose();
  };

  const handleReset = () => {
    if (!confirm('Reset site layout, colors, and navigation tabs back to default ERSL configuration?')) return;
    setDraft(JSON.parse(JSON.stringify(defaultSiteConfig)));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 z-[70]">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 text-left">
        {/* Header */}
        <div className="p-4 md:p-5 text-white flex items-center justify-between shrink-0" style={{ backgroundColor: draft.primaryColor }}>
          <div>
            <h2 className="text-base md:text-lg font-black tracking-tight">ERSL Site Designer & Content Studio</h2>
            <p className="text-[11px] text-white/85">
              Customize layout orientation, colors, navigation tab positions, custom sub-pages, and homepage content. Synced to cloud.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/15 hover:bg-white/25 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Selector */}
        <div className="flex flex-wrap gap-1.5 px-5 py-3 bg-slate-50 border-b border-gray-200 shrink-0 text-xs">
          {[
            { id: 'layout', label: 'Layout & Spacing', icon: <Layout className="w-3.5 h-3.5" /> },
            { id: 'colors', label: 'Colors & Branding', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'tabs', label: 'Tabs & Custom Pages', icon: <ListOrdered className="w-3.5 h-3.5" /> },
            { id: 'home', label: 'Home Slides & Mission', icon: <Home className="w-3.5 h-3.5" /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id as any)}
              className={`px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                section === item.id ? 'text-white shadow-xs' : 'bg-white text-slate-700 border border-gray-200 hover:bg-slate-100'
              }`}
              style={section === item.id ? { backgroundColor: draft.primaryColor } : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* 1. LAYOUT & SPACING */}
          {section === 'layout' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 mb-1">Visual Theme Style</h3>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Try the translucent Apple macOS Crystal Glass surface look or switch back to Classic Solid cards anytime.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {([
                    {
                      id: 'macos-glass',
                      title: 'Apple macOS Crystal Glass',
                      desc: 'Translucent frosted blur, ambient light canvas, specular crystal borders & Crimson sub-headers',
                    },
                    {
                      id: 'classic',
                      title: 'Classic UA Academic Solid',
                      desc: 'Crisp opaque white cards with high-contrast UA Crimson accents',
                    },
                  ] as const).map(t => {
                    const active = (draft.themeStyle || 'macos-glass') === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, themeStyle: t.id })}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active ? 'border-2 bg-red-50/40 shadow-xs' : 'border-gray-200 bg-white hover:bg-slate-50'
                        }`}
                        style={active ? { borderColor: draft.primaryColor } : undefined}
                      >
                        <p className="font-extrabold text-slate-900">{t.title}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <h3 className="font-extrabold text-sm text-slate-900 mb-1">Member &amp; Admin Navigation Orientation</h3>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Public visitors always see a clean Horizontal Top bar (with ERSL as Home). Signed-in Members &amp; Admins use the layout selected below:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    { id: 'vertical-left', title: 'Vertical Left Panel', desc: 'Recommended for 14+ member/admin tabs' },
                    { id: 'vertical-right', title: 'Vertical Right Panel', desc: 'ERSL crest & member tabs on the right' },
                    { id: 'horizontal-top', title: 'Horizontal Top Bar', desc: 'Top navigation bar for members too' },
                    { id: 'horizontal-compact', title: 'Horizontal Compact', desc: 'Slim single-row top navigation bar' },
                  ] as { id: LayoutMode; title: string; desc: string }[]).map(opt => {
                    const currentMemberLayout = draft.memberLayoutMode || draft.layoutMode;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraft({ ...draft, layoutMode: opt.id, memberLayoutMode: opt.id })}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          currentMemberLayout === opt.id
                            ? 'border-2 bg-red-50/40 shadow-xs'
                            : 'border-gray-200 bg-white hover:bg-slate-50'
                        }`}
                        style={currentMemberLayout === opt.id ? { borderColor: draft.primaryColor } : undefined}
                      >
                        <p className="font-extrabold text-slate-900">{opt.title}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <label className="font-extrabold text-slate-800 block">Tab Alignment Position</label>
                  <select
                    value={draft.tabPosition}
                    onChange={e => setDraft({ ...draft, tabPosition: e.target.value as TabPosition })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg font-semibold"
                  >
                    <option value="start">Start (Top / Left aligned)</option>
                    <option value="center">Center aligned</option>
                    <option value="end">End (Bottom / Right aligned)</option>
                  </select>
                </div>

                <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-800">Space-Optimized Compact Mode</span>
                    <input
                      type="checkbox"
                      checked={draft.compactMode}
                      onChange={e => setDraft({ ...draft, compactMode: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-slate-800">Show Descriptive Page Subheadings</span>
                    <input
                      type="checkbox"
                      checked={draft.showSubheadings}
                      onChange={e => setDraft({ ...draft, showSubheadings: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 2. COLORS & BRANDING */}
          {section === 'colors' && (
            <div className="space-y-5">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 mb-2">1-Click Theme Presets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {COLOR_PRESETS.map(p => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setDraft({
                        ...draft,
                        primaryColor: p.primaryColor,
                        subheadingColor: p.subheadingColor,
                        headerBgColor: p.headerBgColor,
                        headerTextColor: p.headerTextColor,
                        pageBgColor: p.pageBgColor,
                        swapHomeColors: p.swapHomeColors,
                      })}
                      className="p-3 rounded-xl border border-gray-200 hover:border-slate-400 bg-white flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: p.primaryColor }} />
                        <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: p.headerBgColor }} />
                        <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: p.subheadingColor }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 border border-gray-200 rounded-xl p-4">
                {[
                  { key: 'primaryColor', label: 'Primary Accent Color' },
                  { key: 'subheadingColor', label: 'Subheading / Badge Color' },
                  { key: 'headerBgColor', label: 'Nav / Sidebar Background' },
                  { key: 'headerTextColor', label: 'Nav / Sidebar Text' },
                  { key: 'pageBgColor', label: 'Page Background' },
                ].map(item => (
                  <div key={item.key} className="space-y-1">
                    <label className="font-bold text-slate-700 block">{item.label}</label>
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-300">
                      <input
                        type="color"
                        value={(draft as any)[item.key]}
                        onChange={e => setDraft({ ...draft, [item.key]: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={(draft as any)[item.key]}
                        onChange={e => setDraft({ ...draft, [item.key]: e.target.value })}
                        className="w-full text-[11px] font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Short Brand Title</label>
                  <input value={draft.labShortName} onChange={e => setDraft({ ...draft, labShortName: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Full Laboratory Name</label>
                  <input value={draft.labFullName} onChange={e => setDraft({ ...draft, labFullName: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}

          {/* 3. TABS & CUSTOM SUB-PAGES */}
          {section === 'tabs' && (
            <div className="space-y-5">
              {/* Create new custom tab / sub-page */}
              <form onSubmit={handleAddCustomTab} className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                <h3 className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Create New Custom Tab / Sub-Webpage (Cloud & Box Ready)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    value={newTabIcon}
                    onChange={e => setNewTabIcon(e.target.value)}
                    placeholder="Icon"
                    className="sm:col-span-1 p-2 bg-white border border-gray-300 rounded-lg text-center"
                  />
                  <input
                    value={newTabLabel}
                    onChange={e => setNewTabLabel(e.target.value)}
                    placeholder="Tab Name (e.g. SWOT Campaign, Training Hub)"
                    required
                    className="sm:col-span-4 p-2 bg-white border border-gray-300 rounded-lg"
                  />
                  <input
                    value={newTabBoxUrl}
                    onChange={e => setNewTabBoxUrl(e.target.value)}
                    placeholder="Linked UA Box Folder URL (Optional)"
                    className="sm:col-span-4 p-2 bg-white border border-gray-300 rounded-lg"
                  />
                  <select
                    value={newTabVis}
                    onChange={e => setNewTabVis(e.target.value as TabVisibility)}
                    className="sm:col-span-2 p-2 bg-white border border-gray-300 rounded-lg font-semibold"
                  >
                    <option value="public">Public</option>
                    <option value="members">Members Only</option>
                  </select>
                  <button type="submit" className="sm:col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg p-2 cursor-pointer">
                    Add
                  </button>
                </div>
              </form>

              {/* Existing tabs list (reorder, rename, visibility) */}
              <div className="space-y-2">
                <h3 className="font-extrabold text-slate-900">Reorder, Rename, or Set Visibility for All Tabs</h3>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                  {draft.tabs.map((tab, idx) => (
                    <div key={tab.id} className="p-2.5 bg-white flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveTab(idx, -1)} disabled={idx === 0} className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => moveTab(idx, 1)} disabled={idx === draft.tabs.length - 1} className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <input
                        value={tab.icon || ''}
                        onChange={e => updateTab(idx, { icon: e.target.value })}
                        className="w-10 p-1.5 border border-gray-200 rounded text-center"
                      />
                      <input
                        value={tab.label}
                        onChange={e => updateTab(idx, { label: e.target.value })}
                        className="flex-1 min-w-[140px] p-1.5 border border-gray-200 rounded font-bold text-slate-800"
                      />
                      <select
                        value={tab.visibility}
                        onChange={e => updateTab(idx, { visibility: e.target.value as TabVisibility })}
                        className="p-1.5 border border-gray-200 rounded font-semibold bg-slate-50"
                      >
                        <option value="public">🌐 Public</option>
                        <option value="members">🔒 Members Only</option>
                        <option value="hidden">🚫 Hidden</option>
                      </select>
                      {tab.isCustom && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Delete custom tab "${tab.label}"?`)) return;
                            setDraft({ ...draft, tabs: draft.tabs.filter(t => t.id !== tab.id) });
                            onDeleteCustomTab(tab.id);
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. HOME SLIDES & MISSION */}
          {section === 'home' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-900">Home Hero Slideshow ({draft.homeSlides.length})</h3>
                  <button
                    type="button"
                    onClick={() => setDraft({
                      ...draft,
                      homeSlides: [
                        ...draft.homeSlides,
                        {
                          id: `slide-${Date.now()}`,
                          title: 'New ERSL Highlight',
                          desc: 'Describe your remote sensing project or field campaign.',
                          image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
                        },
                      ],
                    })}
                    className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Slide
                  </button>
                </div>

                {draft.homeSlides.map((slide, sIdx) => (
                  <div key={slide.id} className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-700">Slide {sIdx + 1}</span>
                      {draft.homeSlides.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, homeSlides: draft.homeSlides.filter((_, i) => i !== sIdx) })}
                          className="text-red-500 hover:underline font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      value={slide.title}
                      onChange={e => {
                        const next = [...draft.homeSlides];
                        next[sIdx] = { ...slide, title: e.target.value };
                        setDraft({ ...draft, homeSlides: next });
                      }}
                      placeholder="Slide Title"
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold"
                    />
                    <ImageUploadField
                      value={slide.image}
                      onChange={nextImg => {
                        const next = [...draft.homeSlides];
                        next[sIdx] = { ...slide, image: nextImg };
                        setDraft({ ...draft, homeSlides: next });
                      }}
                      category="Research"
                      label={`Slide ${sIdx + 1} Photo (Upload, Paste Clipboard, or URL)`}
                    />
                    <textarea
                      rows={2}
                      value={slide.desc}
                      onChange={e => {
                        const next = [...draft.homeSlides];
                        next[sIdx] = { ...slide, desc: e.target.value };
                        setDraft({ ...draft, homeSlides: next });
                      }}
                      placeholder="Slide description"
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="font-extrabold text-sm text-slate-900">Home Aims &amp; Mission, Logo, News &amp; Footer</h3>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mission Badge</label>
                  <input
                    value={draft.homeMission.badge}
                    onChange={e => setDraft({ ...draft, homeMission: { ...draft.homeMission, badge: e.target.value } })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                  />
                </div>
                <ImageUploadField
                  value={draft.logoUrl || ''}
                  onChange={nextLogo => setDraft(prev => ({ ...prev, logoUrl: nextLogo }))}
                  category="Logos"
                  previewShape="circle"
                  label="Lab Logo (Upload, Paste Clipboard, or URL)"
                />
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mission Heading</label>
                  <input
                    value={draft.homeMission.heading}
                    onChange={e => setDraft({ ...draft, homeMission: { ...draft.homeMission, heading: e.target.value } })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mission Description</label>
                  <textarea
                    rows={3}
                    value={draft.homeMission.description}
                    onChange={e => setDraft({ ...draft, homeMission: { ...draft.homeMission, description: e.target.value } })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">News Eyebrow</label>
                    <input
                      value={draft.newsEyebrow || ''}
                      onChange={e => setDraft({ ...draft, newsEyebrow: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">News Section Heading</label>
                    <input
                      value={draft.newsHeading || ''}
                      onChange={e => setDraft({ ...draft, newsHeading: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Footer Lab Title</label>
                    <input
                      value={draft.footerTitle || ''}
                      onChange={e => setDraft({ ...draft, footerTitle: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Footer Location</label>
                    <input
                      value={draft.footerLocation || ''}
                      onChange={e => setDraft({ ...draft, footerLocation: e.target.value })}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={applySave}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              style={{ backgroundColor: draft.primaryColor }}
            >
              <Save className="w-3.5 h-3.5" /> Save & Sync to Cloud
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

