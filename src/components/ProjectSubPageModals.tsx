import React, { useState } from 'react';
import { Key, Plus, Save, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';
import {
  Person,
  Project,
  ProjectCollaborator,
  ProjectContentBlock,
  ProjectContentBlockType,
  ProjectCustomSubTab,
  ProjectInvestigator,
  ProjectReferenceLink,
  ResearchTheme,
  SubTabVisibility,
} from '../types';
import { BoxUploadButton, BoxUploadEntityContext } from './BoxUploadButton';
import type { BoxFileDestination, BoxImageCategory } from '../lib/boxSync';
import { ImageUploadField } from './ImageUploadField';
import {
  formatInvestigatorsSummary,
  parseLegacyInvestigators,
  SUBTAB_PRESETS,
  VISIBILITY_OPTIONS,
} from '../lib/projectSubPageUtils';
import { BLOCK_TYPE_OPTIONS } from './ProjectBlockRenderer';

interface ProjectInfoModalProps {
  project: Project;
  themes: ResearchTheme[];
  primaryColor: string;
  initialPiInfo: string;
  initialInvestigators?: ProjectInvestigator[];
  initialTimeline: string;
  initialBoxFolderUrl: string;
  initialHeaderBgColor: string;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    agency: string;
    details: string;
    link: string;
    themeIds: string[];
    piInfo: string;
    investigators: ProjectInvestigator[];
    timeline: string;
    boxFolderUrl?: string;
    headerBgColor?: string;
  }) => void;
}

export const ProjectInfoModal: React.FC<ProjectInfoModalProps> = ({
  project,
  themes,
  primaryColor,
  initialPiInfo,
  initialInvestigators,
  initialTimeline,
  initialBoxFolderUrl,
  initialHeaderBgColor,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(project.title);
  const [agency, setAgency] = useState(project.agency);
  const [details, setDetails] = useState(project.details);
  const [investigators, setInvestigators] = useState<ProjectInvestigator[]>(() => {
    if (Array.isArray(initialInvestigators) && initialInvestigators.length > 0) {
      return initialInvestigators;
    }
    const parsed = parseLegacyInvestigators(initialPiInfo, project.details);
    return parsed.length > 0
      ? parsed
      : [{ id: `inv-${Date.now()}`, name: '', role: 'PI', affiliation: 'The University of Alabama' }];
  });
  const [timeline, setTimeline] = useState(initialTimeline);
  const [boxFolderUrl, setBoxFolderUrl] = useState(initialBoxFolderUrl);
  const [link, setLink] = useState(project.link || '');
  const [headerBgColor, setHeaderBgColor] = useState(initialHeaderBgColor || primaryColor);
  const [themeIds, setThemeIds] = useState<string[]>(
    project.themeIds?.length ? project.themeIds : [themes[0]?.id].filter(Boolean)
  );

  const toggleTheme = (id: string) => {
    setThemeIds(prev => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter(t => t !== id);
      }
      return [...prev, id];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (themeIds.length === 0) {
      alert('Every research project must be connected to at least one Research Theme.');
      return;
    }
    const cleanInvestigators = investigators
      .map(inv => ({
        ...inv,
        name: inv.name.trim(),
        role: (inv.role || 'PI').trim(),
        affiliation: inv.affiliation?.trim() || undefined,
      }))
      .filter(inv => inv.name);
    const formattedPiInfo = formatInvestigatorsSummary(cleanInvestigators) || initialPiInfo.trim();

    onSave({
      title: title.trim() || project.title,
      agency: agency.trim() || project.agency,
      details: details.trim(),
      link: link.trim() || '#',
      themeIds,
      piInfo: formattedPiInfo,
      investigators: cleanInvestigators,
      timeline: timeline.trim(),
      boxFolderUrl: boxFolderUrl.trim() || undefined,
      headerBgColor: headerBgColor && headerBgColor !== primaryColor ? headerBgColor : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
        <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: headerBgColor || primaryColor }}>
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" /> Edit Project Metadata &amp; Banner Settings
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs max-h-[82vh] overflow-y-auto">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Project Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Sponsor / Agency *</label>
              <input value={agency} onChange={e => setAgency(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Timeline / Status</label>
              <input value={timeline} onChange={e => setTimeline(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Banner Subtitle / Short Details</label>
            <input value={details} onChange={e => setDetails(e.target.value)} placeholder="e.g., NASA SWOT Science Team / Project Short Name" className="w-full p-2 border border-gray-300 rounded-lg" />
          </div>

          <div className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="font-extrabold text-slate-800 text-xs">
                Principal Investigators (PI, Co-PIs &amp; Leads)
              </label>
              <button
                type="button"
                onClick={() =>
                  setInvestigators(prev => [
                    ...prev,
                    { id: `inv-${Date.now()}-${prev.length}`, name: '', role: 'Co-PI', affiliation: '' },
                  ])
                }
                className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Investigator
              </button>
            </div>

            <div className="space-y-2">
              {investigators.map((inv, idx) => (
                <div key={inv.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-gray-200">
                  <select
                    value={inv.role}
                    onChange={e => {
                      const val = e.target.value;
                      setInvestigators(prev => prev.map((x, i) => (i === idx ? { ...x, role: val } : x)));
                    }}
                    className="sm:col-span-3 p-1.5 border border-gray-300 rounded text-xs font-bold bg-slate-50"
                  >
                    <option value="PI">PI</option>
                    <option value="Co-PI">Co-PI</option>
                    <option value="Co-Investigator">Co-Investigator</option>
                    <option value="Lead Researcher">Lead Researcher</option>
                    <option value="Senior Personnel">Senior Personnel</option>
                    <option value="Collaborator">Collaborator</option>
                  </select>
                  <input
                    value={inv.name}
                    onChange={e => {
                      const val = e.target.value;
                      setInvestigators(prev => prev.map((x, i) => (i === idx ? { ...x, name: val } : x)));
                    }}
                    placeholder="Full Name (e.g., Dr. Hongxing Liu)"
                    className="sm:col-span-4 p-1.5 border border-gray-300 rounded text-xs"
                  />
                  <input
                    value={inv.affiliation || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setInvestigators(prev => prev.map((x, i) => (i === idx ? { ...x, affiliation: val } : x)));
                    }}
                    placeholder="Institution (Optional)"
                    className="sm:col-span-4 p-1.5 border border-gray-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    disabled={investigators.length <= 1}
                    onClick={() => setInvestigators(prev => prev.filter((_, i) => i !== idx))}
                    className="sm:col-span-1 p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 cursor-pointer flex justify-center"
                    title="Remove investigator"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Connected Research Themes (Select at least 1) *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {themes.map(th => {
                const checked = themeIds.includes(th.id);
                return (
                  <label
                    key={th.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${checked ? 'bg-red-50/50 border-[#9E1B32] font-bold text-slate-900' : 'bg-slate-50 border-gray-200 text-slate-600'
                      }`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleTheme(th.id)} />
                    <span>{th.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Main UA Box Folder Link</label>
              <input value={boxFolderUrl} onChange={e => setBoxFolderUrl(e.target.value)} placeholder="https://alabama.box.com/s/..." className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">External Award URL</label>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-gray-200 rounded-xl p-3">
            <div>
              <span className="font-bold text-gray-700 block">Project Banner Accent Color</span>
              <span className="text-[11px] text-gray-500">Defaults to site Crimson if reset.</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={headerBgColor || primaryColor}
                onChange={e => setHeaderBgColor(e.target.value)}
                className="w-9 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setHeaderBgColor(primaryColor)}
                className="px-2.5 py-1 rounded border border-gray-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg text-white font-bold flex items-center gap-1.5 cursor-pointer" style={{ backgroundColor: primaryColor }}>
              <Save className="w-3.5 h-3.5" /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SubTabEditorModalProps {
  existing?: ProjectCustomSubTab | null;
  primaryColor: string;
  presets?: Array<{
    kind: NonNullable<ProjectCustomSubTab['kind']>;
    defaultLabel: string;
    defaultVisibility: SubTabVisibility;
    description: string;
  }>;
  onClose: () => void;
  onSave: (tab: ProjectCustomSubTab) => void;
}

export const SubTabEditorModal: React.FC<SubTabEditorModalProps> = ({
  existing,
  primaryColor,
  presets = SUBTAB_PRESETS,
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState(existing?.label || '');
  const [kind, setKind] = useState<NonNullable<ProjectCustomSubTab['kind']>>(existing?.kind || 'information');
  const [visibility, setVisibility] = useState<SubTabVisibility>(existing?.visibility || 'public');
  const [description, setDescription] = useState(existing?.description || '');

  const applyPreset = (preset: (typeof presets)[number]) => {
    setKind(preset.kind);
    if (!existing) {
      setLabel(preset.defaultLabel);
      setVisibility(preset.defaultVisibility);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onSave({
      id: existing?.id || `subtab-${Date.now()}`,
      label: label.trim(),
      kind,
      visibility,
      description: description.trim() || undefined,
      blocks: existing?.blocks || [],
      workplanRounds: existing?.workplanRounds,
      workplanConfig: existing?.workplanConfig,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
        <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
          <h3 className="font-extrabold text-sm">
            {existing ? `Edit Sub-Page: ${existing.label}` : 'Add Project Sub-Page'}
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          {!existing && (
            <div>
              <label className="font-bold text-gray-700 block mb-1.5">Quick Sub-Page Templates</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {presets.map(p => (
                  <button
                    key={p.kind}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`text-left p-2 rounded-lg border cursor-pointer transition-colors ${kind === p.kind
                        ? 'bg-red-50/70 border-[#9E1B32] text-slate-900 font-bold'
                        : 'bg-slate-50 border-gray-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <div className="text-[11px] font-extrabold">{p.defaultLabel}</div>
                    <div className="text-[10px] text-slate-500 capitalize">Default: {p.defaultVisibility}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-gray-700 block mb-1">Sub-Page Tab Name *</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
              placeholder="e.g., Datasets, Software & Scripts, Meeting Notes, SOPs"
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1.5">Who Can Access This Sub-Page?</label>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer ${visibility === opt.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 border-gray-200 text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <input
                    type="radio"
                    name="subtab-vis"
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-extrabold text-xs">{opt.label}</div>
                    <div className={`text-[11px] ${visibility === opt.value ? 'text-slate-300' : 'text-slate-500'}`}>
                      {opt.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Sub-Page Intro Note (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional summary paragraph shown at the top of this sub-page..."
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg text-white font-bold flex items-center gap-1.5 cursor-pointer" style={{ backgroundColor: primaryColor }}>
              <Save className="w-3.5 h-3.5" /> {existing ? 'Update Sub-Page' : 'Create Sub-Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BlockEditorModalProps {
  initialType: ProjectContentBlockType;
  existing?: ProjectContentBlock | null;
  initialDefaults?: {
    date?: string;
    category?: string;
    title?: string;
    priority?: 'low' | 'medium' | 'high';
    sectionLevel?: 'section' | 'subsection';
  };
  primaryColor: string;
  uploadDestination?: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>;
  entityContext?: BoxUploadEntityContext;
  onClose: () => void;
  onSave: (block: ProjectContentBlock) => void;
}

export const BlockEditorModal: React.FC<BlockEditorModalProps> = ({
  initialType,
  existing,
  initialDefaults,
  primaryColor,
  uploadDestination,
  entityContext,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<ProjectContentBlockType>(existing?.type || initialType);
  const [title, setTitle] = useState(existing?.title || initialDefaults?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [url, setUrl] = useState(existing?.url || '');
  const [boxUrl, setBoxUrl] = useState(existing?.boxUrl || '');
  const [category, setCategory] = useState(existing?.category || initialDefaults?.category || '');
  const [date, setDate] = useState(existing?.date || initialDefaults?.date || '');
  const [startTime, setStartTime] = useState(existing?.startTime || '');
  const [endTime, setEndTime] = useState(existing?.endTime || '');
  const [location, setLocation] = useState(existing?.location || '');
  const [availability, setAvailability] = useState(existing?.availability || 'Public');
  const [attendees, setAttendees] = useState(existing?.attendees || '');
  const [language, setLanguage] = useState(existing?.language || 'Python');
  const [version, setVersion] = useState(existing?.version || '');
  const [caption, setCaption] = useState(existing?.caption || '');
  const [highlight, setHighlight] = useState(Boolean(existing?.highlight));
  const [sectionLevel, setSectionLevel] = useState<'section' | 'subsection'>(
    existing?.sectionLevel || initialDefaults?.sectionLevel || 'section'
  );
  const [contextNote, setContextNote] = useState(existing?.contextNote || '');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl || '');
  const [figureSize, setFigureSize] = useState<'full' | 'compact'>(existing?.figureSize || 'full');
  const [references, setReferences] = useState<ProjectReferenceLink[]>(
    Array.isArray(existing?.references) ? existing.references : []
  );
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(
    existing?.priority || initialDefaults?.priority || 'medium'
  );
  const [completed, setCompleted] = useState(Boolean(existing?.completed));

  const isTodoBlock =
    category.trim() === 'Weekly To-Do' ||
    initialDefaults?.category === 'Weekly To-Do' ||
    existing?.completed !== undefined ||
    existing?.priority !== undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (type === 'image' && !url.trim()) {
      alert('Please upload a local photo, paste from clipboard, or enter an image URL.');
      return;
    }
    const cleanedRefs = references
      .filter(r => r.url.trim())
      .map(r => ({
        id: r.id || `ref-${Date.now()}`,
        label: r.label.trim() || 'Reference Link',
        url: r.url.trim(),
        kind: r.kind || 'other',
      }));
    onSave({
      ...(existing || {}),
      id: existing?.id || `blk-${Date.now()}`,
      type,
      title: title.trim(),
      body: body.trim() || undefined,
      url: url.trim() || undefined,
      boxUrl: boxUrl.trim() || undefined,
      category: category.trim() || undefined,
      date: date.trim() || undefined,
      startTime: type === 'event' ? (startTime.trim() || undefined) : existing?.startTime,
      endTime: type === 'event' ? (endTime.trim() || undefined) : existing?.endTime,
      location: location.trim() || undefined,
      availability: type === 'dataset' ? availability : undefined,
      attendees: type === 'meeting-note' ? (attendees.trim() || undefined) : undefined,
      language: type === 'software' ? (language.trim() || undefined) : undefined,
      version: type === 'software' ? (version.trim() || undefined) : undefined,
      caption: type === 'image' ? (caption.trim() || title.trim()) : (imageUrl.trim() ? (caption.trim() || undefined) : undefined),
      highlight: type === 'paragraph' ? highlight : undefined,
      sectionLevel,
      contextNote: contextNote.trim() || undefined,
      imageUrl: type !== 'image' ? (imageUrl.trim() || undefined) : undefined,
      figureSize: (type === 'image' || imageUrl.trim()) ? figureSize : undefined,
      references: cleanedRefs.length > 0 ? cleanedRefs : undefined,
      priority: isTodoBlock ? priority : existing?.priority,
      completed: isTodoBlock ? completed : existing?.completed,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
        <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
          <h3 className="font-extrabold text-sm">
            {existing ? 'Edit Content Section' : 'Add Content Section'}
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs max-h-[82vh] overflow-y-auto">
          <div>
            <label className="font-bold text-gray-700 block mb-1">Content Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ProjectContentBlockType)}
              className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
            >
              {BLOCK_TYPE_OPTIONS.map(opt => (
                <option key={opt.type} value={opt.type}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">
              {type === 'paragraph' ? 'Section Heading *' : type === 'image' ? 'Photo Title *' : 'Title *'}
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder={
                type === 'paragraph'
                  ? 'e.g., About This Project, Research Scope, Data Access Policy'
                  : type === 'meeting-note'
                    ? 'e.g., Q3 USGS / UA Sync Call'
                    : type === 'software'
                      ? 'e.g., RS-FloodXDepth Inference Pipeline'
                      : 'Enter title...'
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>

          {type !== 'image' && (
            <div>
              <label className="font-bold text-gray-700 block mb-1">
                {type === 'objectives'
                  ? 'Items (one bullet per line)'
                  : type === 'meeting-note'
                    ? 'Discussion Notes & Action Items'
                    : 'Text / Description (supports multiple paragraphs)'}
              </label>
              <textarea
                rows={type === 'paragraph' || type === 'meeting-note' || type === 'objectives' ? 6 : 3}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={
                  type === 'objectives'
                    ? 'Enter each objective or deliverable on its own line...'
                    : 'Write detailed text paragraphs or description...'
                }
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>
          )}

          {type === 'paragraph' && (
            <div className="space-y-3 bg-slate-50 border border-gray-200 rounded-xl p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Outline Level</label>
                  <select
                    value={sectionLevel}
                    onChange={e => setSectionLevel(e.target.value as 'section' | 'subsection')}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="section">Main Section (1., 2., 3.)</option>
                    <option value="subsection">Sub-Section / Sub-Content (1.1, 1.2)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Section Tag / Topic (Optional)</label>
                  <input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="e.g., Architecture, Validation, Discussion"
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Context / Key Takeaway Callout (Optional)</label>
                <textarea
                  rows={2}
                  value={contextNote}
                  onChange={e => setContextNote(e.target.value)}
                  placeholder="Short context banner highlighted before the prose (e.g., model domain, resolution, headline metric)..."
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <ImageUploadField
                  value={imageUrl}
                  onChange={setImageUrl}
                  category="Projects"
                  entityContext={entityContext}
                  label="Inline Result Figure / Image (Optional)"
                />
                {imageUrl && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      placeholder="Figure caption (e.g., Fig. 1: Validation scatter plots)..."
                      className="sm:col-span-2 p-2 border border-gray-300 rounded-lg bg-white"
                    />
                    <select
                      value={figureSize}
                      onChange={e => setFigureSize(e.target.value as 'full' | 'compact')}
                      className="p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                    >
                      <option value="full">Full Article Width</option>
                      <option value="compact">Scatter Plot (78% Centered)</option>
                    </select>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input type="checkbox" checked={highlight} onChange={e => setHighlight(e.target.checked)} />
                <span className="font-bold text-slate-700">Highlight narrative text with subtle Crimson accent tint</span>
              </label>
            </div>
          )}

          {/* Corresponding Result Reference Links Builder (Paper / Dataset / Code / Demo App / Box) */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="font-bold text-slate-800">
                Linked Results &amp; Reference Links (Paper / Dataset / Code / App)
              </label>
              <button
                type="button"
                onClick={() =>
                  setReferences(prev => [
                    ...prev,
                    { id: `ref-${Date.now()}-${prev.length}`, label: '', url: '', kind: 'paper' },
                  ])
                }
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Reference Link
              </button>
            </div>
            {references.length === 0 ? (
              <p className="text-[10px] text-slate-500">
                Optional: attach direct links to papers (DOI), datasets, GitHub repos, interactive result apps, or Box files for this section.
              </p>
            ) : (
              <div className="space-y-1.5">
                {references.map((r, idx) => (
                  <div key={r.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-lg border border-gray-200">
                    <select
                      value={r.kind || 'other'}
                      onChange={e =>
                        setReferences(prev =>
                          prev.map((x, i) => (i === idx ? { ...x, kind: e.target.value as ProjectReferenceLink['kind'] } : x))
                        )
                      }
                      className="sm:col-span-3 p-1.5 border border-gray-300 rounded text-[11px] font-bold bg-slate-50"
                    >
                      <option value="paper">Paper / DOI</option>
                      <option value="dataset">Dataset</option>
                      <option value="code">Code / Model</option>
                      <option value="demo">Live Result / App</option>
                      <option value="box">Box Archive</option>
                      <option value="other">Other Link</option>
                    </select>
                    <input
                      value={r.label}
                      onChange={e =>
                        setReferences(prev => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="Label (e.g., Full Manuscript DOI)"
                      className="sm:col-span-4 p-1.5 border border-gray-300 rounded text-[11px]"
                    />
                    <input
                      value={r.url}
                      onChange={e =>
                        setReferences(prev => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                      }
                      placeholder="https://... or 10.1016/..."
                      className="sm:col-span-4 p-1.5 border border-gray-300 rounded text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => setReferences(prev => prev.filter((_, i) => i !== idx))}
                      className="sm:col-span-1 p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer flex justify-center font-bold"
                      title="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {type === 'dataset' && (
            <div>
              <label className="font-bold text-gray-700 block mb-1">Availability Rights</label>
              <select value={availability} onChange={e => setAvailability(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white">
                <option value="Public">Public</option>
                <option value="Collaborators Only">Collaborators Only</option>
                <option value="Members Only">Members Only</option>
                <option value="Upon Request">Upon Request</option>
              </select>
            </div>
          )}

          {type === 'software' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Language / Platform</label>
                <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Python / R / GEE" className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Version (Optional)</label>
                <input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g., 1.2.0" className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
            </div>
          )}

          {type === 'meeting-note' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Meeting Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Attendees</label>
                <input value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="Dr. Liu, Collaborators..." className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
            </div>
          )}

          {type === 'event' && (
            <div className="space-y-3 bg-slate-50 border border-gray-200 rounded-xl p-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Event Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white" />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Start Time (Optional)</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white" />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">End Time (Optional)</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Schedule Type</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="">General Event</option>
                    <option value="Lab Meeting">Lab Meeting</option>
                    <option value="Course / Class">Course / Exam</option>
                    <option value="Field Survey">Field Survey</option>
                    <option value="Deadline / Talk">Deadline / Talk</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Location / Room / Zoom</label>
                  <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Farrah Hall 208 / Zoom / Field Site" className="w-full p-2 border border-gray-300 rounded-lg bg-white" />
                </div>
              </div>
            </div>
          )}

          {isTodoBlock && type !== 'event' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-gray-200 rounded-xl p-3">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Target Due Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white" />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                >
                  <option value="low">Low</option>
                  <option value="medium">Normal</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              <label className="flex items-center gap-2 font-bold text-gray-700 pt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={e => setCompleted(e.target.checked)}
                />
                Mark completed
              </label>
            </div>
          )}

          {(type === 'link' || type === 'box-folder') && (
            <div>
              <label className="font-bold text-gray-700 block mb-1">Badge / Category (Optional)</label>
              <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Paper, SOP, GitHub, Box Guide" className="w-full p-2 border border-gray-300 rounded-lg" />
            </div>
          )}

          {type === 'image' && (
            <>
              <ImageUploadField
                value={url}
                onChange={setUrl}
                category="Projects"
                entityContext={entityContext}
                label="Project Photo (Upload from Computer, Paste Clipboard, or Paste URL)"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-gray-700 block mb-1">Caption</label>
                  <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Figure or field site description..." className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Figure Layout Size</label>
                  <select
                    value={figureSize}
                    onChange={e => setFigureSize(e.target.value as 'full' | 'compact')}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="full">Full Article Width</option>
                    <option value="compact">Scatter Plot (78% Centered)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Additional Notes (Optional)</label>
                <textarea rows={2} value={body} onChange={e => setBody(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
            </>
          )}

          {type !== 'image' && (
            <>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Attachment File or UA Box Folder/File Link (Optional)</label>
                <input
                  value={boxUrl.startsWith('data:') ? '' : boxUrl}
                  onChange={e => setBoxUrl(e.target.value)}
                  placeholder="https://alabama.box.com/s/... or upload a local file below"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
                <BoxUploadButton
                  destination={
                    uploadDestination ||
                    (type === 'dataset' ? 'datasets' : type === 'software' ? 'software' : 'projects')
                  }
                  entityContext={entityContext}
                  label="Upload Local Document / Archive / Image"
                  currentValue={boxUrl}
                  onClear={() => setBoxUrl('')}
                  onUploaded={uploadedUrl => setBoxUrl(uploadedUrl)}
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">External URL / GitHub / Portal (Optional)</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-lg text-white font-bold flex items-center gap-1.5 cursor-pointer" style={{ backgroundColor: primaryColor }}>
              <Save className="w-3.5 h-3.5" /> Save Section
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CollaboratorsModalProps {
  people: Person[];
  initialCollaborators: ProjectCollaborator[];
  initialAccessCode: string;
  primaryColor: string;
  onClose: () => void;
  onSave: (collaborators: ProjectCollaborator[], accessCode: string) => void;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({
  people,
  initialCollaborators,
  initialAccessCode,
  primaryColor,
  onClose,
  onSave,
}) => {
  const [list, setList] = useState<ProjectCollaborator[]>(initialCollaborators);
  const [accessCode, setAccessCode] = useState(initialAccessCode);
  const [cName, setCName] = useState('');
  const [cAffiliation, setCAffiliation] = useState('');
  const [cRole, setCRole] = useState('Collaborator');
  const [cEmail, setCEmail] = useState('');
  const [cUrl, setCUrl] = useState('');

  const directoryCollaborators = people.filter(p => p.group === 'collaborator');
  const isLinkedPerson = (personId: string) => list.some(c => c.personId === personId);

  const toggleDirectoryPerson = (person: Person) => {
    if (isLinkedPerson(person.id)) {
      setList(prev => prev.filter(c => c.personId !== person.id));
    } else {
      setList(prev => [
        ...prev,
        {
          id: `collab-${person.id}`,
          personId: person.id,
          name: person.name,
          affiliation: person.researchFocus || person.role,
          role: person.role || 'Collaborator',
          email: person.email || undefined,
          url: person.scholar || person.linkedin || undefined,
        },
      ]);
    }
  };

  const addCustomCollaborator = () => {
    if (!cName.trim()) return;
    setList(prev => [
      ...prev,
      {
        id: `collab-${Date.now()}`,
        name: cName.trim(),
        affiliation: cAffiliation.trim() || undefined,
        role: cRole.trim() || 'Collaborator',
        email: cEmail.trim() || undefined,
        url: cUrl.trim() || undefined,
      },
    ]);
    setCName('');
    setCAffiliation('');
    setCRole('Collaborator');
    setCEmail('');
    setCUrl('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
        <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Manage Project Collaborators &amp; Access
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed space-y-1">
            <p className="font-extrabold text-slate-800">How External Project PIs &amp; Shared Collaborators Enter:</p>
            <p>
              <strong>Option 1 — Multi-Project Partner Login (Recommended):</strong> Add recurring PIs/collaborators once in{' '}
              <strong>People → Collaborators</strong> with their email, click <strong>Link</strong> below on each project they share, and have them sign up via{' '}
              <strong>Login → Request access</strong> (approve as <strong>Collaborator / PI</strong> in Control Panel). One sign-in unlocks all their linked projects without exposing internal ERSL lab tabs.
            </p>
            <p>
              <strong>Option 2 — Project Passkey (No login needed):</strong> Set a passkey at the bottom and send the standalone <code>?project=...</code> share link.
            </p>
          </div>

          {/* Quick Link from People -> Collaborators */}
          {directoryCollaborators.length > 0 && (
            <div className="space-y-2">
              <label className="font-extrabold text-slate-800 block">
                Link from ERSL Collaborators Directory ({directoryCollaborators.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {directoryCollaborators.map(person => {
                  const active = isLinkedPerson(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggleDirectoryPerson(person)}
                      className={`text-left p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${active
                          ? 'bg-blue-50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-gray-200 text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{person.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{person.role}</div>
                        <div className={`text-[10px] truncate ${person.email ? 'text-blue-700 font-mono' : 'text-amber-700 font-semibold'}`}>
                          {person.email || 'Add email in People -> Collaborators for login unlock'}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-slate-600'}`}>
                        {active ? 'Linked' : 'Link'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Custom Project Collaborator */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-3.5 space-y-2.5">
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-blue-600" /> Add Project Collaborator
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Full Name * (e.g., Dr. Ximing Cai)" className="p-2 bg-white border border-gray-300 rounded-lg" />
              <input value={cAffiliation} onChange={e => setCAffiliation(e.target.value)} placeholder="Agency / University (e.g., USGS, UIUC)" className="p-2 bg-white border border-gray-300 rounded-lg" />
              <input value={cRole} onChange={e => setCRole(e.target.value)} placeholder="Role (e.g., Co-PI, Agency Liaison)" className="p-2 bg-white border border-gray-300 rounded-lg" />
              <input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="Email (used for signed-in access match)" className="p-2 bg-white border border-gray-300 rounded-lg" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={cUrl} onChange={e => setCUrl(e.target.value)} placeholder="Profile / Lab Website URL (Optional)" className="flex-1 p-2 bg-white border border-gray-300 rounded-lg" />
              <button
                type="button"
                onClick={addCustomCollaborator}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add to Project
              </button>
            </div>
          </div>

          {/* Currently Linked Collaborators */}
          <div className="space-y-2">
            <span className="font-extrabold text-slate-800 block">
              Linked to This Project ({list.length})
            </span>
            {list.length === 0 ? (
              <p className="text-slate-400 italic">No collaborators linked to this project yet.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
                {list.map(col => (
                  <div key={col.id} className="p-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">
                        {col.name}{' '}
                        {col.role && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 ml-1">{col.role}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {[col.affiliation, col.email].filter(Boolean).join(' · ') || 'External Partner'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setList(prev => prev.filter(x => x.id !== col.id))}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer shrink-0"
                      title="Unlink collaborator"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Collaborator Access Passkey */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
            <label className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-700" />
              Project Collaborator Access Passkey (Optional)
            </label>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Share this optional project passkey with external partners so they can unlock <strong>Collaborators-only</strong> sub-pages for this project without accessing ERSL Member-only tabs or other projects. Signed-in accounts whose email is listed above unlock automatically.
            </p>
            <input
              value={accessCode}
              onChange={e => setAccessCode(e.target.value)}
              placeholder="e.g., SWOT-2026-PARTNER (leave blank to require signed-in account)"
              className="w-full p-2 bg-white border border-blue-200 rounded-lg font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(list, accessCode.trim())}
              className="px-5 py-2 rounded-lg text-white font-bold flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Save className="w-3.5 h-3.5" /> Save Collaborators &amp; Access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
