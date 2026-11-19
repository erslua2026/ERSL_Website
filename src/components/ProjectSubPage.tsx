import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  Code2,
  Copy,
  Database,
  Edit2,
  Eye,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  Key,
  Layers,
  Lock,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Person,
  Project,
  ProjectCollaborator,
  ProjectContentBlock,
  ProjectContentBlockType,
  ProjectCustomSubTab,
  ProjectSubPageData,
  ResearchTheme,
  SiteConfig,
  SubTabVisibility,
  User,
} from '../types';
import { resolveAssetUrl } from '../lib/boxUtils';
import {
  buildNormalizedSubTabs,
  DEFAULT_PROJECT_SUBPAGE,
  getVisibilityMeta,
  parseLegacyInvestigators,
  PreviewRole,
  resolveProjectViewerAccess,
  VISIBILITY_OPTIONS,
} from '../lib/projectSubPageUtils';
import { ProjectBlockRenderer } from './ProjectBlockRenderer';
import { ProjectWorkplanTracker } from './ProjectWorkplanTracker';
import { ReservoirProject } from './ReservoirProject';
import {
  BlockEditorModal,
  CollaboratorsModal,
  ProjectInfoModal,
  SubTabEditorModal,
} from './ProjectSubPageModals';

interface ProjectSubPageProps {
  project: Project;
  themes: ResearchTheme[];
  people?: Person[];
  currentUser: User | null;
  canEdit: boolean;
  isStandalone?: boolean;
  siteConfig?: SiteConfig;
  primaryColor?: string;
  initialSubTabId?: string;
  onBack: () => void;
  onUpdateProject: (updated: Project) => void;
  onLoginClick: () => void;
}

function getSubTabIcon(kind?: ProjectCustomSubTab['kind']) {
  switch (kind) {
    case 'overview':
    case 'information':
      return <BookOpen className="w-3.5 h-3.5" />;
    case 'datasets':
      return <Database className="w-3.5 h-3.5" />;
    case 'software':
      return <Code2 className="w-3.5 h-3.5" />;
    case 'meeting-notes':
      return <FileText className="w-3.5 h-3.5" />;
    case 'events':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'reservoir-tracker':
      return <BarChart3 className="w-3.5 h-3.5" />;
    case 'workplan-tracker':
      return <CheckSquare className="w-3.5 h-3.5" />;
    case 'resources':
      return <ExternalLink className="w-3.5 h-3.5" />;
    default:
      return <Layers className="w-3.5 h-3.5" />;
  }
}

function getVisibilityIcon(vis: SubTabVisibility, active: boolean) {
  const cls = 'w-3 h-3';
  if (vis === 'admin') return <Lock className={`${cls} ${active ? 'text-white/90' : 'text-rose-600'}`} />;
  if (vis === 'members') return <Shield className={`${cls} ${active ? 'text-white/90' : 'text-amber-600'}`} />;
  if (vis === 'collaborators') return <Users className={`${cls} ${active ? 'text-white/90' : 'text-blue-600'}`} />;
  return <Globe className={`${cls} ${active ? 'text-white/90' : 'text-emerald-600'}`} />;
}

function defaultBlockTypeForTab(kind?: ProjectCustomSubTab['kind']): ProjectContentBlockType {
  switch (kind) {
    case 'datasets':
      return 'dataset';
    case 'software':
      return 'software';
    case 'meeting-notes':
      return 'meeting-note';
    case 'events':
      return 'event';
    case 'resources':
      return 'link';
    default:
      return 'paragraph';
  }
}

export const ProjectSubPage: React.FC<ProjectSubPageProps> = ({
  project,
  themes,
  people = [],
  currentUser,
  canEdit,
  isStandalone = false,
  siteConfig,
  primaryColor = '#9E1B32',
  initialSubTabId,
  onBack,
  onUpdateProject,
  onLoginClick,
}) => {
  const subPage: ProjectSubPageData = {
    ...DEFAULT_PROJECT_SUBPAGE,
    ...(project.subPage || {}),
    tabVisibility: {
      ...DEFAULT_PROJECT_SUBPAGE.tabVisibility,
      ...(project.subPage?.tabVisibility || {}),
    },
    objectives: project.subPage?.objectives || [],
    resources: project.subPage?.resources || [],
    events: project.subPage?.events || [],
    datasets: project.subPage?.datasets || [],
    collaborators: project.subPage?.collaborators || [],
  };

  const customSubTabs = buildNormalizedSubTabs(project, subPage);
  const collaborators = subPage.collaborators || [];
  const headerAccent = subPage.headerBgColor || primaryColor;

  const [activeSubId, setActiveSubId] = useState<string>(customSubTabs[0]?.id || 'overview');
  const [previewRole, setPreviewRole] = useState<PreviewRole>('actual');
  const [embeddedBoxUrl, setEmbeddedBoxUrl] = useState<string | null>(null);
  const [copiedSponsorLink, setCopiedSponsorLink] = useState(false);

  const shareableUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(project.id)}`
      : `?project=${encodeURIComponent(project.id)}`;

  const handleCopySponsorLink = () => {
    try {
      navigator.clipboard?.writeText(shareableUrl);
      setCopiedSponsorLink(true);
      setTimeout(() => setCopiedSponsorLink(false), 2200);
    } catch {}
  };

  const rawLogo = siteConfig?.logoUrl?.trim();
  const base = import.meta.env.BASE_URL;
  const resolvedLogoSrc = rawLogo
    ? rawLogo.startsWith('/images/')
      ? `${base}${rawLogo.slice(1)}`
      : resolveAssetUrl(rawLogo)
    : 'https://alabama.box.com/shared/static/bl5k9qrcbymh4xgvlt03u8fdw81j8vlq.jpg';

  // Modals
  const [editingInfo, setEditingInfo] = useState(false);
  const [managingCollaborators, setManagingCollaborators] = useState(false);
  const [subTabModal, setSubTabModal] = useState<{ open: boolean; existing: ProjectCustomSubTab | null }>({
    open: false,
    existing: null,
  });
  const [blockModal, setBlockModal] = useState<{
    open: boolean;
    initialType: ProjectContentBlockType;
    existing: ProjectContentBlock | null;
  }>({
    open: false,
    initialType: 'paragraph',
    existing: null,
  });

  // External collaborator passkey session unlock (scoped strictly to this project.id)
  const storageKey = `ersl_collab_unlock_${project.id}`;
  const [passkeyUnlocked, setPasskeyUnlocked] = useState<boolean>(() => {
    try {
      return Boolean(subPage.collaboratorAccessCode && sessionStorage.getItem(storageKey) === '1');
    } catch {
      return false;
    }
  });
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');

  useEffect(() => {
    const preferred =
      initialSubTabId && customSubTabs.some(t => t.id === initialSubTabId)
        ? initialSubTabId
        : (customSubTabs[0]?.id || 'overview');
    setActiveSubId(preferred);
    setEmbeddedBoxUrl(null);
    setPasskeyInput('');
    setPasskeyError('');
    try {
      setPasskeyUnlocked(Boolean(subPage.collaboratorAccessCode && sessionStorage.getItem(storageKey) === '1'));
    } catch {
      setPasskeyUnlocked(false);
    }
  }, [project.id, initialSubTabId]);

  const effectivePreview: PreviewRole = canEdit ? previewRole : 'actual';
  const isShowingPreviewAsOther = canEdit && effectivePreview !== 'actual';
  const showEditControls = canEdit && !isShowingPreviewAsOther;

  const { isAdmin, isLabMember, isLinkedCollaborator, canViewVisibility } = resolveProjectViewerAccess({
    currentUser,
    people,
    collaborators,
    passkeyUnlocked,
    previewRole: effectivePreview,
  });

  const visibleSubTabs = showEditControls
    ? customSubTabs
    : customSubTabs.filter(tab => canViewVisibility(tab.visibility));

  const fallbackVisibleTab =
    visibleSubTabs[0] || customSubTabs.find(t => t.visibility === 'public') || customSubTabs[0];
  const activeSubTabObj = visibleSubTabs.find(t => t.id === activeSubId) || fallbackVisibleTab;
  const activeTabIndex = customSubTabs.findIndex(t => t.id === activeSubTabObj?.id);

  const currentVisibility: SubTabVisibility = activeSubTabObj?.visibility || 'public';
  const hasAccess = (canEdit && effectivePreview === 'actual') || canViewVisibility(currentVisibility);
  const hasPasskeyCollaboratorTabs =
    !showEditControls &&
    !passkeyUnlocked &&
    Boolean(subPage.collaboratorAccessCode) &&
    customSubTabs.some(t => t.visibility === 'collaborators' && !canViewVisibility('collaborators'));
  const linkedThemes = themes.filter(t => (project.themeIds || []).includes(t.id));

  // Persist helper keeping legacy fields & home-page fieldPhotos reel synchronized
  const commitSubPageUpdate = (
    nextTabs: ProjectCustomSubTab[],
    extraSubPagePatch?: Partial<ProjectSubPageData>,
    projectPatch?: Partial<Project>
  ) => {
    const nextTabVis: Record<string, SubTabVisibility> = {};
    nextTabs.forEach(t => {
      nextTabVis[t.id] = t.visibility;
    });

    const overviewTab = nextTabs.find(t => t.kind === 'overview' || t.id === 'overview');
    const firstParagraph = overviewTab?.blocks.find(b => b.type === 'paragraph');
    const overviewPhotos = (overviewTab?.blocks || [])
      .filter(b => b.type === 'image' && (b.url || b.boxUrl))
      .map(b => ({
        id: b.id,
        url: b.url || b.boxUrl || '',
        caption: b.caption || b.title,
      }));

    const nextSubPage: ProjectSubPageData = {
      ...subPage,
      ...(extraSubPagePatch || {}),
      customSubTabs: nextTabs,
      tabVisibility: nextTabVis,
      summary: firstParagraph?.body ?? subPage.summary,
      fieldPhotos: overviewTab ? overviewPhotos : subPage.fieldPhotos,
    };

    onUpdateProject({
      ...project,
      ...(projectPatch || {}),
      subPage: nextSubPage,
    });
  };

  const handleSaveWorkplanTrackerRounds = (nextRounds: NonNullable<ProjectCustomSubTab['workplanRounds']>) => {
    if (!activeSubTabObj) return;
    const nextTabs = customSubTabs.map(t =>
      t.id === activeSubTabObj.id ? { ...t, workplanRounds: nextRounds } : t
    );
    commitSubPageUpdate(nextTabs);
  };

  // Sub-tab actions
  const handleSaveSubTab = (savedTab: ProjectCustomSubTab) => {
    const exists = customSubTabs.some(t => t.id === savedTab.id);
    const nextTabs = exists
      ? customSubTabs.map(t => (t.id === savedTab.id ? savedTab : t))
      : [...customSubTabs, savedTab];
    commitSubPageUpdate(nextTabs);
    setActiveSubId(savedTab.id);
    setSubTabModal({ open: false, existing: null });
  };

  const handleChangeSubTabVisibility = (tabId: string, nextVis: SubTabVisibility) => {
    const nextTabs = customSubTabs.map(t => (t.id === tabId ? { ...t, visibility: nextVis } : t));
    commitSubPageUpdate(nextTabs);
  };

  const handleMoveSubTab = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= customSubTabs.length) return;
    const nextTabs = [...customSubTabs];
    const [moved] = nextTabs.splice(index, 1);
    nextTabs.splice(target, 0, moved);
    commitSubPageUpdate(nextTabs);
  };

  const handleDeleteSubTab = (tab: ProjectCustomSubTab) => {
    if (customSubTabs.length <= 1) {
      alert('Every project page must keep at least one sub-page.');
      return;
    }
    if (!confirm(`Remove the "${tab.label}" sub-page and all blocks inside it from this project?`)) return;
    const nextTabs = customSubTabs.filter(t => t.id !== tab.id);
    commitSubPageUpdate(nextTabs);
    if (activeSubTabObj?.id === tab.id) {
      setActiveSubId(nextTabs[0]?.id || 'overview');
    }
  };

  // Content block actions
  const handleSaveBlock = (savedBlock: ProjectContentBlock) => {
    if (!activeSubTabObj) return;
    const exists = activeSubTabObj.blocks.some(b => b.id === savedBlock.id);
    const nextBlocks = exists
      ? activeSubTabObj.blocks.map(b => (b.id === savedBlock.id ? savedBlock : b))
      : [...activeSubTabObj.blocks, savedBlock];
    const nextTabs = customSubTabs.map(t => (t.id === activeSubTabObj.id ? { ...t, blocks: nextBlocks } : t));
    commitSubPageUpdate(nextTabs);
    setBlockModal({ open: false, initialType: 'paragraph', existing: null });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!activeSubTabObj || !confirm('Remove this content section from the sub-page?')) return;
    const nextTabs = customSubTabs.map(t =>
      t.id === activeSubTabObj.id ? { ...t, blocks: t.blocks.filter(b => b.id !== blockId) } : t
    );
    commitSubPageUpdate(nextTabs);
  };

  const handleMoveBlock = (index: number, delta: -1 | 1) => {
    if (!activeSubTabObj) return;
    const target = index + delta;
    if (target < 0 || target >= activeSubTabObj.blocks.length) return;
    const nextBlocks = [...activeSubTabObj.blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(target, 0, moved);
    const nextTabs = customSubTabs.map(t => (t.id === activeSubTabObj.id ? { ...t, blocks: nextBlocks } : t));
    commitSubPageUpdate(nextTabs);
  };

  const handleUnlockWithPasskey = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = (subPage.collaboratorAccessCode || '').trim();
    if (!expected) {
      setPasskeyError('Passkey unlock is not enabled for this project. Please sign in with your linked collaborator account.');
      return;
    }
    if (passkeyInput.trim() === expected) {
      try {
        sessionStorage.setItem(storageKey, '1');
      } catch {}
      setPasskeyUnlocked(true);
      setPasskeyError('');
    } else {
      setPasskeyError('Incorrect project collaborator passkey. Please verify with Dr. Liu or the project PI.');
    }
  };

  const activeVisMeta = getVisibilityMeta(currentVisibility);
  const isOverviewLayout = activeSubTabObj?.kind === 'overview' || activeSubTabObj?.id === 'overview';
  const showCollaboratorEmails = isAdmin || isLabMember;

  return (
    <div className="space-y-5 animate-in fade-in duration-200 text-left">
      {/* Standalone Lab Brand & Authorization Strip (Crimson Red Lab Banner) */}
      {isStandalone && (
        <div
          className="rounded-2xl shadow-sm px-4 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-white"
          style={{ backgroundColor: headerAccent }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-3.5 sm:gap-4 text-left cursor-pointer group min-w-0 flex-1"
            title="Return to ERSL Lab Website"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={resolvedLogoSrc}
                alt="ERSL Lab Logo"
                className="w-full h-full object-contain rounded-full"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (!img.dataset.fallbackUsed) {
                    img.dataset.fallbackUsed = '1';
                    img.src = `${base}images/logo/logo.jpg`;
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider block leading-snug text-red-100">
                {siteConfig?.departmentName || 'Department of Geography & the Environment'} · The University of Alabama
              </span>
              <h1 className="text-base sm:text-2xl font-black text-white leading-tight mt-0.5 group-hover:underline">
                {siteConfig?.labFullName || 'Environmental Remote Sensing Laboratory (ERSL)'}
              </h1>
            </div>
          </button>

          {!currentUser && (
            <div className="shrink-0 flex justify-end">
              <button
                type="button"
                onClick={onLoginClick}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2 rounded-lg bg-white hover:bg-red-50 cursor-pointer shadow-xs"
                style={{ color: headerAccent }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Member Login</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Clean White Project Title Banner */}
      <div className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
        <div className="p-5 md:p-6 space-y-3.5 text-slate-900">
          {!isStandalone && (
            <div>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-gray-200"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Research Projects</span>
              </button>
            </div>
          )}

          <div>
            <h2 className="text-xl md:text-2xl font-black leading-snug" style={{ color: headerAccent }}>
              {project.title}
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-2">
                {linkedThemes.map(t => (
                  <span
                    key={t.id}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-50/70 border border-red-200"
                    style={{ color: headerAccent }}
                  >
                    {t.title}
                  </span>
                ))}
                {project.details && (
                  <span className="text-xs font-semibold text-slate-600 ml-1">· {project.details}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-md text-white shadow-2xs"
                  style={{ backgroundColor: headerAccent }}
                >
                  {project.agency}
                </span>
                {subPage.timeline && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-200 bg-slate-100 text-slate-800">
                    {subPage.timeline}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vertical Left Sidebar (Sub-Tabs + Member Share Link + Edit Controls) + Main Project Content Area */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-200 shadow-xs p-3.5 space-y-4">
          {/* Vertical Sub-Page Navigation (Protected tabs hidden from public) */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2 block mb-1.5">
              Project Sections
            </span>
            {visibleSubTabs.map(tab => {
              const active = activeSubTabObj?.id === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSubId(tab.id);
                    setEmbeddedBoxUrl(null);
                  }}
                  className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                    active ? 'text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={active ? { backgroundColor: headerAccent } : undefined}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0">{getSubTabIcon(tab.kind)}</span>
                    <span className="truncate">{tab.label}</span>
                  </span>
                  {showEditControls && (
                    <span className="shrink-0">{getVisibilityIcon(tab.visibility, active)}</span>
                  )}
                </button>
              );
            })}

            {showEditControls && (
              <button
                type="button"
                onClick={() => setSubTabModal({ open: true, existing: null })}
                className="w-full mt-2 px-3 py-2 text-xs font-bold rounded-xl border border-dashed border-slate-300 text-slate-700 hover:border-[#9E1B32] hover:bg-red-50/60 hover:text-[#9E1B32] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Sub-Page</span>
              </button>
            )}
          </div>

          {/* Copy Share Link inside Vertical Sidebar — Visible Only After Member Login */}
          {currentUser && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <button
                type="button"
                onClick={handleCopySponsorLink}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                title="Copy direct shareable URL for sponsors and collaborators"
              >
                {copiedSponsorLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Share Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Share Link</span>
                  </>
                )}
              </button>

              {!isLabMember && isLinkedCollaborator && (
                <div className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3 h-3 shrink-0" style={{ color: headerAccent }} />
                  <span>Collaborator Access</span>
                </div>
              )}

              {showEditControls && (
                <div className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-center gap-1.5">
                  {getVisibilityIcon(currentVisibility, false)}
                  <span>{activeVisMeta.shortLabel}</span>
                </div>
              )}
            </div>
          )}

          {/* Optional Collaborator Passkey Unlock in Sidebar (only if project has a passkey & locked tabs exist) */}
          {hasPasskeyCollaboratorTabs && (
            <form onSubmit={handleUnlockWithPasskey} className="pt-3 border-t border-gray-100 space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <Key className="w-3 h-3" style={{ color: headerAccent }} /> Collaborator Passkey
              </label>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={passkeyInput}
                  onChange={e => setPasskeyInput(e.target.value)}
                  placeholder="Enter passkey..."
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-50 border border-gray-200 rounded-lg focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: headerAccent }}
                >
                  Go
                </button>
              </div>
              {passkeyError && <p className="text-[10px] font-bold text-red-600">{passkeyError}</p>}
            </form>
          )}

          {/* Vertical Sub-Page Edit Tools (Visible when Edit Mode active) */}
          {showEditControls && activeSubTabObj && (
            <div className="pt-3 border-t border-gray-100 space-y-2.5 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 block">
                Edit Sub-Page: {activeSubTabObj.label}
              </span>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 block px-1">Visibility Access</label>
                <select
                  value={activeSubTabObj.visibility}
                  onChange={e => handleChangeSubTabVisibility(activeSubTabObj.id, e.target.value as SubTabVisibility)}
                  className="w-full p-2 text-xs bg-slate-50 border border-gray-200 rounded-lg font-extrabold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {VISIBILITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setSubTabModal({ open: true, existing: activeSubTabObj })}
                className="w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" style={{ color: headerAccent }} />
                <span>Rename / Edit Intro</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={activeTabIndex <= 0}
                  onClick={() => handleMoveSubTab(activeTabIndex, -1)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center gap-1 disabled:opacity-35 cursor-pointer"
                  title="Move sub-page up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Up</span>
                </button>
                <button
                  type="button"
                  disabled={activeTabIndex >= customSubTabs.length - 1}
                  onClick={() => handleMoveSubTab(activeTabIndex, 1)}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center gap-1 disabled:opacity-35 cursor-pointer"
                  title="Move sub-page down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Down</span>
                </button>
              </div>

              <button
                type="button"
                disabled={customSubTabs.length <= 1}
                onClick={() => handleDeleteSubTab(activeSubTabObj)}
                className="w-full px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Sub-Page</span>
              </button>
            </div>
          )}

          {/* Vertical Project Settings & Role Preview (Admins / Member Editors) */}
          {canEdit && (
            <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 block">
                Project Admin Tools
              </span>

              <button
                type="button"
                onClick={() => setEditingInfo(true)}
                className="w-full px-3 py-2 rounded-lg border font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-red-50/60 hover:bg-red-50 border-red-200"
                style={{ color: headerAccent }}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Project Info</span>
              </button>

              <button
                type="button"
                onClick={() => setManagingCollaborators(true)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Collaborators ({collaborators.length})</span>
              </button>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 px-1">
                  <Eye className="w-3 h-3" /> Preview View As
                </label>
                <select
                  value={previewRole}
                  onChange={e => setPreviewRole(e.target.value as PreviewRole)}
                  className="w-full p-2 text-xs bg-slate-50 border border-gray-200 rounded-lg font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="actual">Editor View (All Tabs)</option>
                  <option value="public">Public Visitor</option>
                  <option value="collaborator">Linked Collaborator</option>
                  <option value="member">ERSL Lab Member</option>
                </select>
              </div>
            </div>
          )}
        </aside>

        {/* Right Main Sub-Page Canvas */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {isShowingPreviewAsOther && (
            <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs">
              <span className="font-bold text-amber-900">
                Previewing sub-page access as: <strong className="uppercase">{effectivePreview}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPreviewRole('actual')}
                className="font-extrabold text-amber-900 underline cursor-pointer"
              >
                Return to Editor View
              </button>
            </div>
          )}

          {/* Sub-Page Body OR Tiered Access Lock Screen */}
          {!hasAccess ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-10 text-center max-w-lg mx-auto shadow-xs space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
                {currentVisibility === 'collaborators' ? (
                  <Users className="w-6 h-6 text-blue-700" />
                ) : currentVisibility === 'admin' ? (
                  <Lock className="w-6 h-6 text-rose-700" />
                ) : (
                  <Shield className="w-6 h-6 text-amber-700" />
                )}
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {currentVisibility === 'collaborators'
                    ? 'Project Collaborators & Lab Team Section'
                    : currentVisibility === 'admin'
                      ? 'Lab Administrators Only'
                      : 'ERSL Lab Members & Admins Only'}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  The <strong>{activeSubTabObj?.label}</strong> sub-page for this project{' '}
                  {currentVisibility === 'collaborators'
                    ? 'is restricted to linked collaborators on this project, ERSL lab members, and lab admins.'
                    : currentVisibility === 'admin'
                      ? 'is restricted strictly to ERSL lab administrators.'
                      : 'is restricted to internal ERSL lab members and administrators.'}
                </p>
              </div>

              {currentVisibility === 'collaborators' && subPage.collaboratorAccessCode && (
                <form onSubmit={handleUnlockWithPasskey} className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-left space-y-2.5">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-700" />
                    External Collaborator Passkey Unlock
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={passkeyInput}
                      onChange={e => setPasskeyInput(e.target.value)}
                      placeholder="Enter project collaborator passkey..."
                      className="flex-1 p-2 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Unlock
                    </button>
                  </div>
                  {passkeyError && <p className="text-[11px] font-bold text-red-600">{passkeyError}</p>}
                </form>
              )}

              {currentVisibility !== 'admin' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onLoginClick}
                    className="text-white text-xs font-bold py-2 px-5 rounded-lg cursor-pointer shadow-xs"
                    style={{ backgroundColor: headerAccent }}
                  >
                    {currentVisibility === 'collaborators' ? 'Collaborator / Member Sign In' : 'ERSL Member Login'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6 space-y-5">
          {/* Sub-Page Intro Paragraph & Quick-Add Content Toolbar */}
          {(activeSubTabObj?.description || showEditControls) && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold" style={{ color: headerAccent }}>
                  {activeSubTabObj?.label}
                </h3>
                {activeSubTabObj?.description && (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line text-justify">
                    {activeSubTabObj.description}
                  </p>
                )}
              </div>

              {showEditControls && activeSubTabObj?.kind !== 'reservoir-tracker' && activeSubTabObj?.kind !== 'workplan-tracker' && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBlockModal({ open: true, initialType: 'paragraph', existing: null })}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Text Paragraph
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBlockModal({
                        open: true,
                        initialType: defaultBlockTypeForTab(activeSubTabObj?.kind),
                        existing: null,
                      })
                    }
                    className="text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer hover:opacity-90"
                    style={{ backgroundColor: headerAccent }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Content Section
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick-type pills in edit mode so users can add any block type with 1 click */}
          {showEditControls && activeSubTabObj?.kind !== 'reservoir-tracker' && activeSubTabObj?.kind !== 'workplan-tracker' && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-gray-200 rounded-xl p-2.5 text-[11px]">
              <span className="font-extrabold text-slate-500 px-1.5">Quick Add:</span>
              {(
                [
                  ['paragraph', 'Paragraph'],
                  ['objectives', 'Checklist / Objectives'],
                  ['dataset', 'Dataset'],
                  ['software', 'Software / Code'],
                  ['meeting-note', 'Meeting Note'],
                  ['link', 'Resource / Link'],
                  ['event', 'Event'],
                  ['image', 'Photo'],
                ] as const
              ).map(([blkType, lbl]) => (
                <button
                  key={blkType}
                  type="button"
                  onClick={() => setBlockModal({ open: true, initialType: blkType, existing: null })}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-gray-200 font-bold text-slate-700 cursor-pointer"
                >
                  + {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Specialized Trackers vs Standard Content Blocks */}
          {activeSubTabObj?.kind === 'reservoir-tracker' ? (
            currentUser ? (
              <ReservoirProject
                currentUser={currentUser}
                projects={[]}
                accentColor={headerAccent}
                embedded
              />
            ) : (
              <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center text-xs text-slate-500 space-y-3">
                <p className="font-bold text-slate-700">Sign in as an ERSL Member to open the live Reservoir Project Management Matrix.</p>
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                  style={{ backgroundColor: headerAccent }}
                >
                  ERSL Member Login
                </button>
              </div>
            )
          ) : activeSubTabObj?.kind === 'workplan-tracker' ? (
            <ProjectWorkplanTracker
              rounds={activeSubTabObj.workplanRounds || []}
              people={people}
              canEdit={showEditControls || Boolean(currentUser && (isLabMember || isAdmin))}
              isAdmin={Boolean(isAdmin && showEditControls)}
              primaryColor={headerAccent}
              projectTitle={project.title}
              onChangeRounds={handleSaveWorkplanTrackerRounds}
            />
          ) : (
          <div className={isOverviewLayout ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : 'space-y-4'}>
            <div className={isOverviewLayout ? 'lg:col-span-8 space-y-4' : 'space-y-4'}>
              {(!activeSubTabObj?.blocks || activeSubTabObj.blocks.length === 0) ? (
                <div className="p-8 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500 space-y-2">
                  <p>
                    No sections added to <strong>{activeSubTabObj?.label}</strong> yet.
                  </p>
                  {showEditControls && (
                    <p className="text-[11px] text-slate-400">
                      Use <strong>+ Add Text Paragraph</strong> or the Quick Add buttons above to customize this sub-page.
                    </p>
                  )}
                </div>
              ) : (
                activeSubTabObj.blocks.map((block, idx) => (
                  <ProjectBlockRenderer
                    key={block.id}
                    block={block}
                    index={idx}
                    total={activeSubTabObj.blocks.length}
                    canEdit={showEditControls}
                    primaryColor={headerAccent}
                    embeddedBoxUrl={embeddedBoxUrl}
                    onToggleEmbed={url => setEmbeddedBoxUrl(prev => (prev === url ? null : url))}
                    onEdit={blk => setBlockModal({ open: true, initialType: blk.type, existing: blk })}
                    onDelete={handleDeleteBlock}
                    onMove={handleMoveBlock}
                  />
                ))
              )}
            </div>

            {/* Project Snapshot & Linked Collaborators Sidebar on Overview Sub-Page */}
            {isOverviewLayout && (
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 text-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Investigators (PI &amp; Co-PIs)
                      </span>
                      {showEditControls && (
                        <button
                          type="button"
                          onClick={() => setEditingInfo(true)}
                          className="text-[10px] font-extrabold hover:underline cursor-pointer"
                          style={{ color: headerAccent }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {(() => {
                      const invList =
                        Array.isArray(subPage.investigators) && subPage.investigators.length > 0
                          ? subPage.investigators
                          : parseLegacyInvestigators(subPage.piInfo, project.details);
                      if (invList.length > 0) {
                        return (
                          <div className="space-y-1.5 mt-1.5">
                            {invList.map(inv => (
                              <div key={inv.id} className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900">{inv.name}</div>
                                  {inv.affiliation && (
                                    <div className="text-[11px] text-slate-500">{inv.affiliation}</div>
                                  )}
                                </div>
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 border ${
                                    inv.role === 'PI'
                                      ? 'bg-red-50 text-[#9E1B32] border-red-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {inv.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <p className="font-bold text-slate-800 mt-0.5">{subPage.piInfo || project.details}</p>
                      );
                    })()}
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Status / Timeline
                    </span>
                    <p className="font-bold text-slate-800 mt-0.5">{subPage.timeline || 'Active Research Grant'}</p>
                  </div>

                  {/* Linked Collaborators */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Project Collaborators ({collaborators.length})
                      </span>
                      {showEditControls && (
                        <button
                          type="button"
                          onClick={() => setManagingCollaborators(true)}
                          className="text-[10px] font-extrabold hover:underline cursor-pointer"
                          style={{ color: headerAccent }}
                        >
                          Manage
                        </button>
                      )}
                    </div>

                    {collaborators.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic mt-1">
                        No external collaborators linked yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 mt-1.5">
                        {collaborators.map(col => (
                          <div key={col.id} className="bg-white border border-slate-200 rounded-lg p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{col.name}</span>
                              {col.role && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                  {col.role}
                                </span>
                              )}
                            </div>
                            {col.affiliation && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{col.affiliation}</p>
                            )}
                            {showCollaboratorEmails && col.email && (
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{col.email}</p>
                            )}
                            {col.url && (
                              <a
                                href={col.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline mt-1"
                              >
                                <ExternalLink className="w-2.5 h-2.5" /> Profile
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Connected Themes
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {linkedThemes.map(t => (
                        <span
                          key={t.id}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                        >
                          {t.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  {subPage.boxFolderUrl && (
                    <a
                      href={subPage.boxFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors"
                    >
                      <FolderGit2 className="w-3.5 h-3.5" />
                      <span>Open Project Box Folder</span>
                    </a>
                  )}
                  {project.link && project.link !== '#' && (
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Agency Award Page</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}
        </div>
      </div>

      {/* Modals */}
      {editingInfo && (
        <ProjectInfoModal
          project={project}
          themes={themes}
          primaryColor={primaryColor}
          initialPiInfo={subPage.piInfo || project.details}
          initialInvestigators={subPage.investigators}
          initialTimeline={subPage.timeline || 'Active Research Grant'}
          initialBoxFolderUrl={subPage.boxFolderUrl || ''}
          initialHeaderBgColor={subPage.headerBgColor || primaryColor}
          onClose={() => setEditingInfo(false)}
          onSave={patch => {
            commitSubPageUpdate(
              customSubTabs,
              {
                piInfo: patch.piInfo,
                investigators: patch.investigators,
                timeline: patch.timeline,
                boxFolderUrl: patch.boxFolderUrl,
                headerBgColor: patch.headerBgColor,
              },
              {
                title: patch.title,
                agency: patch.agency,
                details: patch.details,
                link: patch.link,
                themeIds: patch.themeIds,
              }
            );
            setEditingInfo(false);
          }}
        />
      )}

      {managingCollaborators && (
        <CollaboratorsModal
          people={people}
          initialCollaborators={collaborators}
          initialAccessCode={subPage.collaboratorAccessCode || ''}
          primaryColor={headerAccent}
          onClose={() => setManagingCollaborators(false)}
          onSave={(nextCollabs: ProjectCollaborator[], nextPasskey: string) => {
            commitSubPageUpdate(customSubTabs, {
              collaborators: nextCollabs,
              collaboratorAccessCode: nextPasskey || undefined,
            });
            setManagingCollaborators(false);
          }}
        />
      )}

      {subTabModal.open && (
        <SubTabEditorModal
          existing={subTabModal.existing}
          primaryColor={headerAccent}
          onClose={() => setSubTabModal({ open: false, existing: null })}
          onSave={handleSaveSubTab}
        />
      )}

      {blockModal.open && (
        <BlockEditorModal
          initialType={blockModal.initialType}
          existing={blockModal.existing}
          primaryColor={headerAccent}
          onClose={() => setBlockModal({ open: false, initialType: 'paragraph', existing: null })}
          onSave={handleSaveBlock}
        />
      )}
    </div>
  );
};
