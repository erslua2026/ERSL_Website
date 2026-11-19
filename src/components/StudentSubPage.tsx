import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  ClipboardList,
  Copy,
  Edit2,
  Eye,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  HelpCircle,
  Layers,
  Lock,
  Mail,
  Plus,
  Save,
  Shield,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Person,
  ProjectContentBlock,
  ProjectContentBlockType,
  ProjectCustomSubTab,
  ProjectSubPageData,
  SiteConfig,
  SubTabVisibility,
  User,
} from '../types';
import { resolveAssetUrl, sanitizeExternalUrl } from '../lib/boxUtils';
import {
  buildNormalizedStudentSubTabs,
  DEFAULT_PROJECT_SUBPAGE,
  getStudentBoxSlug,
  getVisibilityMeta,
  PreviewRole,
  resolveProjectViewerAccess,
  STUDENT_SUBTAB_PRESETS,
  VISIBILITY_OPTIONS,
} from '../lib/projectSubPageUtils';
import { ProjectBlockRenderer } from './ProjectBlockRenderer';
import { BlockEditorModal, SubTabEditorModal } from './ProjectSubPageModals';

interface StudentSubPageProps {
  person: Person;
  workspaceData?: ProjectSubPageData;
  people?: Person[];
  currentUser: User | null;
  canEdit: boolean;
  isStandalone?: boolean;
  siteConfig?: SiteConfig;
  primaryColor?: string;
  initialSubTabId?: string;
  resolvePersonImage: (img: string) => string;
  onBack: () => void;
  onUpdateWorkspace: (personId: string, nextSubPage: ProjectSubPageData) => void;
  onLoginClick: () => void;
}

function getStudentSubTabIcon(kind?: ProjectCustomSubTab['kind']) {
  switch (kind) {
    case 'plan':
    case 'overview':
    case 'information':
      return <BookOpen className="w-3.5 h-3.5" />;
    case 'progress':
      return <TrendingUp className="w-3.5 h-3.5" />;
    case 'schedules':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'questions':
      return <HelpCircle className="w-3.5 h-3.5" />;
    case 'todo':
      return <CheckSquare className="w-3.5 h-3.5" />;
    case 'resources':
      return <ExternalLink className="w-3.5 h-3.5" />;
    case 'meeting-notes':
      return <FileText className="w-3.5 h-3.5" />;
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

function defaultBlockTypeForStudentTab(kind?: ProjectCustomSubTab['kind']): ProjectContentBlockType {
  switch (kind) {
    case 'todo':
      return 'objectives';
    case 'resources':
      return 'link';
    case 'meeting-notes':
      return 'meeting-note';
    case 'schedules':
      return 'event';
    default:
      return 'paragraph';
  }
}

export const StudentSubPage: React.FC<StudentSubPageProps> = ({
  person,
  workspaceData,
  people = [],
  currentUser,
  canEdit,
  isStandalone = false,
  siteConfig,
  primaryColor = '#9E1B32',
  initialSubTabId,
  resolvePersonImage,
  onBack,
  onUpdateWorkspace,
  onLoginClick,
}) => {
  const rawSubPage: ProjectSubPageData = workspaceData || person.subPage || DEFAULT_PROJECT_SUBPAGE;
  const customSubTabs = buildNormalizedStudentSubTabs(person, rawSubPage);
  const studentBoxSlug = getStudentBoxSlug(person.name);

  const [activeSubId, setActiveSubId] = useState<string>(
    initialSubTabId && customSubTabs.some(t => t.id === initialSubTabId)
      ? initialSubTabId
      : customSubTabs[0]?.id || 'plan'
  );
  const [embeddedBoxUrl, setEmbeddedBoxUrl] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [previewRole, setPreviewRole] = useState<PreviewRole>('actual');
  const [editingSettings, setEditingSettings] = useState(false);
  const [draftBoxUrl, setDraftBoxUrl] = useState(rawSubPage.boxFolderUrl || '');
  const [draftBannerColor, setDraftBannerColor] = useState(rawSubPage.headerBgColor || primaryColor);
  const [subTabModal, setSubTabModal] = useState<{
    open: boolean;
    existing: ProjectCustomSubTab | null;
  }>({ open: false, existing: null });
  const [blockModal, setBlockModal] = useState<{
    open: boolean;
    initialType: ProjectContentBlockType;
    existing: ProjectContentBlock | null;
  }>({ open: false, initialType: 'paragraph', existing: null });

  const access = resolveProjectViewerAccess({
    currentUser,
    people,
    collaborators: [],
    passkeyUnlocked: false,
    previewRole: canEdit ? previewRole : 'actual',
  });

  const isOwnStudentProfile = Boolean(
    currentUser?.email &&
      person.email &&
      currentUser.email.trim().toLowerCase() === person.email.trim().toLowerCase()
  );
  const canEditWorkspace = Boolean(canEdit || access.isAdmin || isOwnStudentProfile);
  const showEditControls = canEditWorkspace && previewRole === 'actual';

  useEffect(() => {
    if (initialSubTabId && customSubTabs.some(t => t.id === initialSubTabId)) {
      setActiveSubId(initialSubTabId);
    }
  }, [person.id, initialSubTabId]);

  const activeSubTabObj =
    customSubTabs.find(t => t.id === activeSubId) || customSubTabs[0];
  const activeTabIndex = customSubTabs.findIndex(t => t.id === activeSubTabObj?.id);
  const currentVisibility: SubTabVisibility = activeSubTabObj?.visibility || 'members';
  const hasAccess = access.canViewVisibility(currentVisibility);
  const headerAccent = rawSubPage.headerBgColor || primaryColor;
  const activeVisMeta = getVisibilityMeta(currentVisibility);

  const commitWorkspaceUpdate = (
    nextTabs: ProjectCustomSubTab[],
    patch?: Partial<ProjectSubPageData>
  ) => {
    const nextSubPage: ProjectSubPageData = {
      ...DEFAULT_PROJECT_SUBPAGE,
      ...rawSubPage,
      ...(patch || {}),
      customSubTabs: nextTabs,
    };
    onUpdateWorkspace(person.id, nextSubPage);
  };

  const handleSaveSubTab = (savedTab: ProjectCustomSubTab) => {
    const exists = customSubTabs.some(t => t.id === savedTab.id);
    const nextTabs = exists
      ? customSubTabs.map(t => (t.id === savedTab.id ? savedTab : t))
      : [...customSubTabs, savedTab];
    commitWorkspaceUpdate(nextTabs);
    setActiveSubId(savedTab.id);
    setSubTabModal({ open: false, existing: null });
  };

  const handleDeleteSubTab = (tab: ProjectCustomSubTab) => {
    if (customSubTabs.length <= 1) {
      alert('At least one sub-page tab must remain.');
      return;
    }
    if (!confirm(`Delete the "${tab.label}" sub-page and its items?`)) return;
    const nextTabs = customSubTabs.filter(t => t.id !== tab.id);
    commitWorkspaceUpdate(nextTabs);
    if (activeSubTabObj?.id === tab.id) {
      setActiveSubId(nextTabs[0].id);
    }
  };

  const handleMoveSubTab = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= customSubTabs.length) return;
    const next = [...customSubTabs];
    [next[idx], next[target]] = [next[target], next[idx]];
    commitWorkspaceUpdate(next);
  };

  const handleChangeSubTabVisibility = (tabId: string, vis: SubTabVisibility) => {
    const nextTabs = customSubTabs.map(t => (t.id === tabId ? { ...t, visibility: vis } : t));
    commitWorkspaceUpdate(nextTabs);
  };

  const handleSaveBlock = (savedBlock: ProjectContentBlock) => {
    if (!activeSubTabObj) return;
    const exists = activeSubTabObj.blocks.some(b => b.id === savedBlock.id);
    const nextBlocks = exists
      ? activeSubTabObj.blocks.map(b => (b.id === savedBlock.id ? savedBlock : b))
      : [...activeSubTabObj.blocks, savedBlock];
    const nextTabs = customSubTabs.map(t =>
      t.id === activeSubTabObj.id ? { ...t, blocks: nextBlocks } : t
    );
    commitWorkspaceUpdate(nextTabs);
    setBlockModal({ open: false, initialType: 'paragraph', existing: null });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!activeSubTabObj) return;
    if (!confirm('Remove this entry from the sub-page?')) return;
    const nextTabs = customSubTabs.map(t =>
      t.id === activeSubTabObj.id
        ? { ...t, blocks: t.blocks.filter(b => b.id !== blockId) }
        : t
    );
    commitWorkspaceUpdate(nextTabs);
  };

  const handleMoveBlock = (idx: number, dir: -1 | 1) => {
    if (!activeSubTabObj) return;
    const target = idx + dir;
    if (target < 0 || target >= activeSubTabObj.blocks.length) return;
    const nextBlocks = [...activeSubTabObj.blocks];
    [nextBlocks[idx], nextBlocks[target]] = [nextBlocks[target], nextBlocks[idx]];
    const nextTabs = customSubTabs.map(t =>
      t.id === activeSubTabObj.id ? { ...t, blocks: nextBlocks } : t
    );
    commitWorkspaceUpdate(nextTabs);
  };

  const buildShareUrl = () => {
    const params = new URLSearchParams();
    params.set('student', person.id);
    if (activeSubTabObj?.id) params.set('subtab', activeSubTabObj.id);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  };

  const handleCopyShareLink = async () => {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2500);
    } catch {
      window.prompt('Copy student workspace URL:', url);
    }
  };

  const labTitle = siteConfig?.labFullName || 'Environmental Remote Sensing Laboratory';
  const deptName = siteConfig?.departmentName || 'Department of Geography & the Environment · The University of Alabama';
  const portraitSrc = resolveAssetUrl(resolvePersonImage(person.image));

  return (
    <div className="space-y-4 animate-in fade-in duration-200 text-left">
      {isStandalone && (
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={resolveAssetUrl(
                siteConfig?.logoUrl || 'https://alabama.box.com/shared/static/bl5k9qrcbymh4xgvlt03u8fdw81j8vlq.jpg'
              )}
              alt="ERSL Logo"
              className="w-12 h-12 object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9E1B32] truncate">{deptName}</p>
              <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">{labTitle}</h1>
            </div>
          </div>
          {!currentUser && (
            <button
              type="button"
              onClick={onLoginClick}
              className="text-xs font-bold px-3.5 py-2 rounded-lg text-white cursor-pointer"
              style={{ backgroundColor: headerAccent }}
            >
              Member Login
            </button>
          )}
        </div>
      )}

      {/* Compact Student Header Banner */}
      <div className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
        <div className="px-5 py-4 text-white space-y-2.5" style={{ backgroundColor: headerAccent }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg cursor-pointer border border-white/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isStandalone ? 'ERSL Website' : 'Back to Team'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/25 bg-white/15 text-white">
                {person.role}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/25 bg-black/20 text-white inline-flex items-center gap-1">
                <FolderGit2 className="w-3 h-3" />
                <span>Box: 07_Students/{studentBoxSlug}</span>
              </span>
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => window.open(buildShareUrl(), '_blank', 'noopener,noreferrer')}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-white text-slate-900 hover:bg-red-50 cursor-pointer inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> New Tab
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="w-14 h-16 rounded-lg overflow-hidden bg-white/15 border border-white/25 shrink-0 flex items-center justify-center">
              {portraitSrc && !imgFailed ? (
                <img
                  src={portraitSrc}
                  alt={person.name}
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover object-[50%_20%]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-lg font-black text-white">{person.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight">{person.name}</h2>
              {person.researchFocus && (
                <p className="text-xs text-red-100 line-clamp-2">{person.researchFocus}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                {person.email && (
                  <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1 text-white/90 hover:underline">
                    <Mail className="w-3 h-3" /> {person.email}
                  </a>
                )}
                {person.scholar && sanitizeExternalUrl(person.scholar) && (
                  <a href={sanitizeExternalUrl(person.scholar)} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 font-bold">
                    Scholar
                  </a>
                )}
                {person.linkedin && sanitizeExternalUrl(person.linkedin) && (
                  <a href={sanitizeExternalUrl(person.linkedin)} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 font-bold">
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Vertical Left Sidebar + Right Content Canvas */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-200 shadow-xs p-3 space-y-3 lg:sticky lg:top-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2 block pb-1">
              Student Sections
            </span>
            {customSubTabs.map(tab => {
              const active = tab.id === activeSubTabObj?.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSubId(tab.id);
                    setEmbeddedBoxUrl(null);
                  }}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                    active ? 'text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={active ? { backgroundColor: headerAccent } : undefined}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0">{getStudentSubTabIcon(tab.kind)}</span>
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
                className="w-full mt-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-dashed border-slate-300 text-slate-700 hover:border-[#9E1B32] hover:bg-red-50/60 hover:text-[#9E1B32] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Sub-Page</span>
              </button>
            )}
          </div>

          {rawSubPage.boxFolderUrl && sanitizeExternalUrl(rawSubPage.boxFolderUrl) && (
            <a
              href={sanitizeExternalUrl(rawSubPage.boxFolderUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Open {person.name.split(' ')[0]}'s Box</span>
            </a>
          )}

          {currentUser && (
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedShareLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedShareLink ? 'Share Link Copied!' : 'Copy Share Link'}</span>
              </button>
              {showEditControls && (
                <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 flex items-center gap-1.5">
                  {getVisibilityIcon(currentVisibility, false)}
                  <span>{activeVisMeta.shortLabel}</span>
                </div>
              )}
            </div>
          )}

          {showEditControls && activeSubTabObj && (
            <div className="pt-2 border-t border-gray-100 space-y-2 text-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 block">
                Edit: {activeSubTabObj.label}
              </span>
              <select
                value={activeSubTabObj.visibility}
                onChange={e => handleChangeSubTabVisibility(activeSubTabObj.id, e.target.value as SubTabVisibility)}
                className="w-full p-2 text-xs bg-slate-50 border border-gray-200 rounded-lg font-bold text-slate-900 cursor-pointer"
              >
                {VISIBILITY_OPTIONS.filter(v => v.value !== 'collaborators').map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setSubTabModal({ open: true, existing: activeSubTabObj })}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" style={{ color: headerAccent }} /> Rename / Intro
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={activeTabIndex <= 0}
                  onClick={() => handleMoveSubTab(activeTabIndex, -1)}
                  className="px-2 py-1 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 font-bold flex items-center justify-center gap-1 disabled:opacity-35 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" /> Up
                </button>
                <button
                  type="button"
                  disabled={activeTabIndex >= customSubTabs.length - 1}
                  onClick={() => handleMoveSubTab(activeTabIndex, 1)}
                  className="px-2 py-1 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 font-bold flex items-center justify-center gap-1 disabled:opacity-35 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" /> Down
                </button>
              </div>

              <button
                type="button"
                disabled={customSubTabs.length <= 1}
                onClick={() => handleDeleteSubTab(activeSubTabObj)}
                className="w-full px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Remove Section
              </button>
            </div>
          )}

          {canEditWorkspace && (
            <div className="pt-2 border-t border-gray-100 space-y-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDraftBoxUrl(rawSubPage.boxFolderUrl || '');
                  setDraftBannerColor(rawSubPage.headerBgColor || primaryColor);
                  setEditingSettings(true);
                }}
                className="w-full px-3 py-1.5 rounded-lg border font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-red-50/60 hover:bg-red-50 border-red-200"
                style={{ color: headerAccent }}
              >
                <FolderGit2 className="w-3.5 h-3.5" /> Student Box Link & Theme
              </button>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 px-1">
                  <Eye className="w-3 h-3" /> Preview View As
                </label>
                <select
                  value={previewRole}
                  onChange={e => setPreviewRole(e.target.value as PreviewRole)}
                  className="w-full p-1.5 text-xs bg-slate-50 border border-gray-200 rounded-lg font-bold text-slate-800 cursor-pointer"
                >
                  <option value="actual">Editor View</option>
                  <option value="public">Public Visitor</option>
                  <option value="member">Members Only View</option>
                  <option value="admin">Admin Only View</option>
                </select>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Canvas */}
        <div className="flex-1 min-w-0 w-full space-y-3">
          {!hasAccess ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-lg mx-auto shadow-xs space-y-4">
              <Lock className="w-10 h-10 mx-auto text-amber-600" />
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {currentVisibility === 'admin' ? 'Private (Admin Only) Section' : 'Members-Only Student Section'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {currentVisibility === 'admin'
                    ? 'This section is reserved strictly for lab administrators.'
                    : 'Sign in as an approved ERSL member to view this student workspace section.'}
                </p>
              </div>
              {currentVisibility !== 'admin' && (
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="text-white text-xs font-bold py-2 px-5 rounded-lg cursor-pointer"
                  style={{ backgroundColor: headerAccent }}
                >
                  ERSL Member Login
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 md:p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: headerAccent }}>
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <span>{activeSubTabObj?.label}</span>
                  </h3>
                  {activeSubTabObj?.description && (
                    <p className="text-xs text-slate-600">{activeSubTabObj.description}</p>
                  )}
                </div>

                {showEditControls && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBlockModal({ open: true, initialType: 'link', existing: null })}
                      className="text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                      style={{ backgroundColor: headerAccent }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Reference / Link / File
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBlockModal({
                          open: true,
                          initialType: defaultBlockTypeForStudentTab(activeSubTabObj?.kind),
                          existing: null,
                        })
                      }
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Note / Task
                    </button>
                  </div>
                )}
              </div>

              {showEditControls && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-gray-200 rounded-xl px-2.5 py-2 text-[11px]">
                  <span className="font-extrabold text-slate-500 px-1">Quick Add:</span>
                  {(
                    [
                      ['link', 'Paper / Web Link'],
                      ['paragraph', 'Note / Paragraph'],
                      ['objectives', 'Checklist / To-Do'],
                      ['dataset', 'Dataset'],
                      ['software', 'Code / Tool'],
                      ['meeting-note', 'Meeting Note'],
                      ['event', 'Schedule / Event'],
                      ['image', 'Figure / Photo'],
                    ] as const
                  ).map(([blkType, lbl]) => (
                    <button
                      key={blkType}
                      type="button"
                      onClick={() => setBlockModal({ open: true, initialType: blkType, existing: null })}
                      className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 border border-gray-200 font-bold text-slate-700 cursor-pointer"
                    >
                      + {lbl}
                    </button>
                  ))}
                </div>
              )}

              {(!activeSubTabObj?.blocks || activeSubTabObj.blocks.length === 0) ? (
                <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
                  No items in <strong>{activeSubTabObj?.label}</strong> yet.
                  {showEditControls && ' Use Quick Add above to post reference papers, links, checklists, figures, or files (routed to 07_Students/' + studentBoxSlug + ').'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeSubTabObj.blocks.map((block, idx) => (
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Student Box Link & Theme Modal */}
      {editingSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: headerAccent }}>
              <h3 className="font-extrabold text-sm">Student Box Folder & Banner Color</h3>
              <button type="button" onClick={() => setEditingSettings(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                commitWorkspaceUpdate(customSubTabs, {
                  boxFolderUrl: draftBoxUrl.trim() || undefined,
                  headerBgColor: draftBannerColor !== primaryColor ? draftBannerColor : undefined,
                });
                setEditingSettings(false);
              }}
              className="p-5 space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Student UA Box Folder Link (Default upload path: 07_Students/{studentBoxSlug})
                </label>
                <input
                  value={draftBoxUrl}
                  onChange={e => setDraftBoxUrl(e.target.value)}
                  placeholder="https://alabama.box.com/s/..."
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-gray-200 rounded-xl p-3">
                <span className="font-bold text-gray-700">Banner Accent Color</span>
                <input
                  type="color"
                  value={draftBannerColor || primaryColor}
                  onChange={e => setDraftBannerColor(e.target.value)}
                  className="w-9 h-8 rounded border border-gray-300 cursor-pointer"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingSettings(false)} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-lg text-white font-bold flex items-center gap-1.5 cursor-pointer" style={{ backgroundColor: headerAccent }}>
                  <Save className="w-3.5 h-3.5" /> Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {subTabModal.open && (
        <SubTabEditorModal
          existing={subTabModal.existing}
          primaryColor={headerAccent}
          presets={STUDENT_SUBTAB_PRESETS}
          onClose={() => setSubTabModal({ open: false, existing: null })}
          onSave={handleSaveSubTab}
        />
      )}

      {blockModal.open && (
        <BlockEditorModal
          initialType={blockModal.initialType}
          existing={blockModal.existing}
          primaryColor={headerAccent}
          uploadDestination={`students/${studentBoxSlug}`}
          onClose={() => setBlockModal({ open: false, initialType: 'paragraph', existing: null })}
          onSave={handleSaveBlock}
        />
      )}
    </div>
  );
};
