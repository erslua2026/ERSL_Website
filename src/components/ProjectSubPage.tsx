import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Code2,
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
  SubTabVisibility,
  User,
} from '../types';
import {
  buildNormalizedSubTabs,
  DEFAULT_PROJECT_SUBPAGE,
  getVisibilityMeta,
  PreviewRole,
  resolveProjectViewerAccess,
  VISIBILITY_OPTIONS,
} from '../lib/projectSubPageUtils';
import { ProjectBlockRenderer } from './ProjectBlockRenderer';
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

  const activeSubTabObj = customSubTabs.find(t => t.id === activeSubId) || customSubTabs[0];
  const activeTabIndex = customSubTabs.findIndex(t => t.id === activeSubTabObj?.id);

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

  const currentVisibility: SubTabVisibility = activeSubTabObj?.visibility || 'public';
  const hasAccess = (canEdit && effectivePreview === 'actual') || canViewVisibility(currentVisibility);
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
      {/* Top Crimson Project Banner + Customizable Sub-Pages Navigation */}
      <div className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
        <div className="p-5 md:p-6 space-y-4 text-white" style={{ backgroundColor: headerAccent }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-white/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Research Themes &amp; Projects</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-md border border-white/25 bg-white/15 text-white">
                {project.agency}
              </span>
              {subPage.timeline && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/20 bg-black/15 text-white/95">
                  {subPage.timeline}
                </span>
              )}
              <span className="text-[10px] font-mono text-white/85 bg-black/20 border border-white/20 px-2 py-1 rounded">
                UA-ERSL-{project.id.toUpperCase()}
              </span>

              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => setManagingCollaborators(true)}
                    className="text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/25 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Collaborators ({collaborators.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingInfo(true)}
                    className="text-xs font-bold bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    style={{ color: headerAccent }}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Project Info</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-black text-white leading-snug">{project.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {linkedThemes.map(t => (
                <span
                  key={t.id}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/25"
                >
                  {t.title}
                </span>
              ))}
              {project.details && (
                <span className="text-xs font-semibold text-red-100 ml-1">· {project.details}</span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Sub-Pages Navigation Strip */}
        <div className="px-5 md:px-6 py-3.5 bg-white space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {customSubTabs.map(tab => {
                const active = activeSubTabObj?.id === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSubId(tab.id);
                      setEmbeddedBoxUrl(null);
                    }}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      active ? 'text-white border-transparent shadow-xs' : 'text-slate-700 border-gray-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                    style={active ? { backgroundColor: headerAccent } : undefined}
                  >
                    {getSubTabIcon(tab.kind)}
                    <span>{tab.label}</span>
                    {getVisibilityIcon(tab.visibility, active)}
                  </button>
                );
              })}

              {showEditControls && (
                <button
                  type="button"
                  onClick={() => setSubTabModal({ open: true, existing: null })}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Sub-Page</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isLabMember && isLinkedCollaborator && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  <span>Collaborator Access Active</span>
                </span>
              )}
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${activeVisMeta.pillClass}`}>
                {getVisibilityIcon(currentVisibility, false)}
                <span>{activeVisMeta.shortLabel}</span>
              </span>

              {canEdit && (
                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-gray-200 text-[11px]">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-600">Preview:</span>
                  <select
                    value={previewRole}
                    onChange={e => setPreviewRole(e.target.value as PreviewRole)}
                    className="bg-transparent font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="actual">Editor View (All Tabs)</option>
                    <option value="public">Public Visitor</option>
                    <option value="collaborator">Linked Collaborator</option>
                    <option value="member">ERSL Lab Member</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Active Sub-Page Management Bar (visible in Edit Mode when not previewing) */}
          {showEditControls && activeSubTabObj && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-500">
                  Sub-Page Controls ({activeSubTabObj.label}):
                </span>
                <label className="inline-flex items-center gap-1.5 bg-slate-50 border border-gray-200 rounded-lg px-2.5 py-1">
                  <span className="font-bold text-slate-600">Access:</span>
                  <select
                    value={activeSubTabObj.visibility}
                    onChange={e => handleChangeSubTabVisibility(activeSubTabObj.id, e.target.value as SubTabVisibility)}
                    className="bg-transparent font-extrabold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    {VISIBILITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setSubTabModal({ open: true, existing: activeSubTabObj })}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" /> Rename / Edit Intro
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={activeTabIndex <= 0}
                  onClick={() => handleMoveSubTab(activeTabIndex, -1)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-35 cursor-pointer"
                  title="Move sub-page tab left"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={activeTabIndex >= customSubTabs.length - 1}
                  onClick={() => handleMoveSubTab(activeTabIndex, 1)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-35 cursor-pointer"
                  title="Move sub-page tab right"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={customSubTabs.length <= 1}
                  onClick={() => handleDeleteSubTab(activeSubTabObj)}
                  className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  title="Remove this sub-page"
                >
                  <Trash2 className="w-3 h-3" /> Remove Sub-Page
                </button>
              </div>
            </div>
          )}

          {isShowingPreviewAsOther && (
            <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
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
        </div>
      </div>

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
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {activeSubTabObj.description}
                  </p>
                )}
              </div>

              {showEditControls && (
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Content Section
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick-type pills in edit mode so users can add any block type with 1 click */}
          {showEditControls && (
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

          {/* Content Blocks Layout */}
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
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Investigators
                    </span>
                    <p className="font-bold text-slate-800 mt-0.5">{subPage.piInfo || project.details}</p>
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
                          className="text-[10px] font-extrabold text-blue-600 hover:underline cursor-pointer"
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
        </div>
      )}

      {/* Modals */}
      {editingInfo && (
        <ProjectInfoModal
          project={project}
          themes={themes}
          primaryColor={primaryColor}
          initialPiInfo={subPage.piInfo || project.details}
          initialTimeline={subPage.timeline || 'Active Research Grant'}
          initialBoxFolderUrl={subPage.boxFolderUrl || ''}
          initialHeaderBgColor={subPage.headerBgColor || primaryColor}
          onClose={() => setEditingInfo(false)}
          onSave={patch => {
            commitSubPageUpdate(
              customSubTabs,
              {
                piInfo: patch.piInfo,
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
