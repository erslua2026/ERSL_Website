import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  FolderGit2,
  Plus,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { Project, Publication, ResearchTheme } from '../types';
import { openOrDownloadResource, resolveAssetUrl } from '../lib/boxUtils';
import { decodeHtmlEntities, resolvePublicationLinks } from '../lib/publicationUtils';
import { ImageUploadField } from './ImageUploadField';
import { LinkedReferenceText } from './LinkedReferenceText';
import { parseLegacyInvestigators } from '../lib/projectSubPageUtils';

interface ThemeSubPageProps {
  theme: ResearchTheme;
  projects: Project[];
  publications: Publication[];
  canEdit: boolean;
  canShareLink?: boolean;
  primaryColor?: string;
  resolveThemeImage: (imagePath: string) => string;
  onBack: () => void;
  onUpdateTheme: (updated: ResearchTheme) => void;
  onOpenProjectNewTab: (projectId: string) => void;
  onOpenAllProjects?: () => void;
}

type ThemeSubTabId = 'overview' | 'projects' | 'publications';

export const ThemeSubPage: React.FC<ThemeSubPageProps> = ({
  theme,
  projects,
  publications,
  canEdit,
  canShareLink = false,
  primaryColor = '#9E1B32',
  resolveThemeImage,
  onBack,
  onUpdateTheme,
  onOpenProjectNewTab,
  onOpenAllProjects,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ThemeSubTabId>('overview');
  const [imgFailed, setImgFailed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Theme overview editor modal
  const [editingOverview, setEditingOverview] = useState(false);
  const [draftTitle, setDraftTitle] = useState(theme.title);
  const [draftSummary, setDraftSummary] = useState(theme.description);
  const [draftOverviewBody, setDraftOverviewBody] = useState(theme.overviewBody || theme.description);
  const [draftKeywords, setDraftKeywords] = useState(theme.keywords.join(', '));
  const [draftImage, setDraftImage] = useState(theme.image);

  // Selected publications picker modal
  const [pickingPubs, setPickingPubs] = useState(false);
  const [pubSearchQuery, setPubSearchQuery] = useState('');
  const [draftSelectedPubIds, setDraftSelectedPubIds] = useState<string[]>(
    Array.isArray(theme.selectedPublicationIds) ? theme.selectedPublicationIds : []
  );

  const linkedProjects = projects.filter(
    p => Array.isArray(p.themeIds) && p.themeIds.includes(theme.id)
  );

  const autoMatchedPubs = publications.filter(pub =>
    theme.keywords.some(
      kw =>
        pub.title.toLowerCase().includes(kw.toLowerCase()) ||
        (pub.abstract && pub.abstract.toLowerCase().includes(kw.toLowerCase())) ||
        (pub.keywords && pub.keywords.some(pk => pk.toLowerCase() === kw.toLowerCase()))
    )
  );

  const hasPinnedPubs = Array.isArray(theme.selectedPublicationIds) && theme.selectedPublicationIds.length > 0;
  const displayedPublications = hasPinnedPubs
    ? theme.selectedPublicationIds!
        .map(id => publications.find(p => p.id === id))
        .filter((p): p is Publication => Boolean(p))
    : autoMatchedPubs;

  const overviewParagraphs = (theme.overviewBody || theme.description || '')
    .split(/\n{2,}|\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const openEditOverview = () => {
    setDraftTitle(theme.title);
    setDraftSummary(theme.description);
    setDraftOverviewBody(theme.overviewBody || theme.description);
    setDraftKeywords(theme.keywords.join(', '));
    setDraftImage(theme.image);
    setEditingOverview(true);
  };

  const handleSaveOverview = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedKeywords = draftKeywords
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    onUpdateTheme({
      ...theme,
      title: draftTitle.trim() || theme.title,
      description: draftSummary.trim() || theme.description,
      overviewBody: draftOverviewBody.trim() || draftSummary.trim(),
      keywords: cleanedKeywords,
      image: draftImage.trim(),
    });
    setImgFailed(false);
    setEditingOverview(false);
  };

  const openPublicationPicker = () => {
    const initialIds = hasPinnedPubs
      ? [...theme.selectedPublicationIds!]
      : autoMatchedPubs.map(p => p.id);
    setDraftSelectedPubIds(initialIds);
    setPubSearchQuery('');
    setPickingPubs(true);
  };

  const togglePubSelection = (pubId: string) => {
    setDraftSelectedPubIds(prev =>
      prev.includes(pubId) ? prev.filter(id => id !== pubId) : [...prev, pubId]
    );
  };

  const handleSaveSelectedPubs = () => {
    onUpdateTheme({
      ...theme,
      selectedPublicationIds: draftSelectedPubIds,
    });
    setPickingPubs(false);
  };

  const handleResetAutoMatchPubs = () => {
    onUpdateTheme({
      ...theme,
      selectedPublicationIds: [],
    });
    setPickingPubs(false);
  };

  const copyProjectLink = (projId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(projId)}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(projId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredPickerPubs = publications.filter(p => {
    const q = pubSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.authors.toLowerCase().includes(q) ||
      p.venue.toLowerCase().includes(q) ||
      String(p.year).includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* Top Crimson Theme Header */}
      <div className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
        <div className="p-5 md:p-7 space-y-4 text-white" style={{ backgroundColor: primaryColor }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-white/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Research Themes</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/25 bg-white/15 text-white">
                {linkedProjects.length} Project{linkedProjects.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/25 bg-black/15 text-white">
                {displayedPublications.length} Publication{displayedPublications.length !== 1 ? 's' : ''}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={openEditOverview}
                  className="text-xs font-bold bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  style={{ color: primaryColor }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Theme &amp; Overview</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-100 block mb-1">
              ERSL Research Theme
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{theme.title}</h2>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {theme.keywords.map(kw => (
                <span
                  key={kw}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/25"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-page navigation tabs: Overview | List of Projects | Selected Publications */}
        <div className="px-5 md:px-6 py-3 bg-slate-50/70 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSubTab === 'overview'
                  ? 'text-white border-transparent shadow-xs'
                  : 'text-slate-700 border-gray-200 bg-white hover:bg-slate-100'
              }`}
              style={activeSubTab === 'overview' ? { backgroundColor: primaryColor } : undefined}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('projects')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSubTab === 'projects'
                  ? 'text-white border-transparent shadow-xs'
                  : 'text-slate-700 border-gray-200 bg-white hover:bg-slate-100'
              }`}
              style={activeSubTab === 'projects' ? { backgroundColor: primaryColor } : undefined}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Projects ({linkedProjects.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('publications')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSubTab === 'publications'
                  ? 'text-white border-transparent shadow-xs'
                  : 'text-slate-700 border-gray-200 bg-white hover:bg-slate-100'
              }`}
              style={activeSubTab === 'publications' ? { backgroundColor: primaryColor } : undefined}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Selected Publications ({displayedPublications.length})</span>
            </button>
          </div>

          {onOpenAllProjects && (
            <button
              type="button"
              onClick={onOpenAllProjects}
              className="text-xs font-bold hover:underline cursor-pointer"
              style={{ color: primaryColor }}
            >
              View All Research Projects &rarr;
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-7 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-xl overflow-hidden border border-gray-200 bg-slate-900">
              {theme.image ? (
                <img
                  src={
                    imgFailed
                      ? 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'
                      : resolveAssetUrl(resolveThemeImage(theme.image))
                  }
                  onError={() => setImgFailed(true)}
                  alt={theme.title}
                  className="w-full max-h-80 object-contain bg-slate-950 mx-auto"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-64 flex items-center justify-center p-6 text-white font-bold text-sm">
                  {theme.title}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold uppercase tracking-wider" style={{ color: primaryColor }}>
                  Research Scope &amp; Scientific Overview
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={openEditOverview}
                    className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> Edit Narrative
                  </button>
                )}
              </div>

              <div className="space-y-3 text-sm text-slate-700 leading-relaxed text-justify">
                {overviewParagraphs.map((para, idx) => (
                  <p key={idx}><LinkedReferenceText text={para} /></p>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-100">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-2">
                  <Tag className="w-3 h-3" /> Focus Areas &amp; Keywords
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {theme.keywords.map(kw => (
                    <span
                      key={kw}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preview Strip for Projects & Publications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setActiveSubTab('projects')}
              className="p-4 rounded-xl border border-gray-200 bg-slate-50/70 hover:bg-white hover:border-[#9E1B32] text-left transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Theme Portfolio
                </span>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {linkedProjects.length} Active &amp; Funded Project{linkedProjects.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Open individual sponsor-ready project pages in new tabs</p>
              </div>
              <FolderGit2 className="w-6 h-6 shrink-0" style={{ color: primaryColor }} />
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('publications')}
              className="p-4 rounded-xl border border-gray-200 bg-slate-50/70 hover:bg-white hover:border-[#9E1B32] text-left transition-all cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Scholarly Output
                </span>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {displayedPublications.length} Selected Publication{displayedPublications.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hasPinnedPubs ? 'Curated by ERSL Lab Administrators' : 'Auto-matched via theme keywords'}
                </p>
              </div>
              <BookOpen className="w-6 h-6 shrink-0" style={{ color: primaryColor }} />
            </button>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CONNECTED PROJECTS (Each opens in a new tab) */}
      {activeSubTab === 'projects' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Projects Under {theme.title} ({linkedProjects.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Each project opens as a standalone branded webpage in a new tab for sharing with sponsors and collaborators.
              </p>
            </div>
          </div>

          {linkedProjects.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-gray-200 space-y-2">
              <p className="text-sm font-bold text-slate-600">No projects assigned to this theme yet.</p>
              <p className="text-xs text-slate-400">
                Edit a Research Project and tag it with &ldquo;{theme.title}&rdquo; to display it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {linkedProjects.map(proj => {
                const investigators = proj.subPage?.investigators?.length
                  ? proj.subPage.investigators
                  : parseLegacyInvestigators(proj.subPage?.piInfo);
                return (
                  <div
                    key={proj.id}
                    style={{ borderLeftColor: primaryColor }}
                    className="bg-slate-50/70 hover:bg-white p-5 rounded-xl border border-gray-200 border-l-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded border"
                          style={{
                            color: primaryColor,
                            backgroundColor: `${primaryColor}10`,
                            borderColor: `${primaryColor}30`,
                          }}
                        >
                          {proj.sponsor || proj.agency || 'ERSL Grant'}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          {proj.status || 'Active'}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-slate-900 text-sm mt-2.5 leading-snug">
                        {proj.title}
                      </h4>
                      <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-3 text-justify">
                        {proj.summary || proj.details}
                      </p>

                      {investigators.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {investigators.map((inv, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-slate-700"
                            >
                              {inv.role}: {inv.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 mt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProjectNewTab(proj.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-white px-3 py-1.5 rounded-lg cursor-pointer shadow-xs hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span>Open Project Page</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>

                      {canShareLink && (
                        <button
                          type="button"
                          onClick={() => copyProjectLink(proj.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                        >
                          {copiedId === proj.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Sponsor Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Sponsor Link</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: SELECTED PUBLICATIONS */}
      {activeSubTab === 'publications' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Selected Publications ({displayedPublications.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasPinnedPubs
                  ? 'Hand-curated key papers selected for this research theme.'
                  : 'Automatically matched using theme keywords (Edit Mode admins can curate exact selections).'}
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={openPublicationPicker}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2 rounded-lg cursor-pointer shadow-xs hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Curate Selected Publications</span>
              </button>
            )}
          </div>

          {displayedPublications.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-gray-200 space-y-2">
              <p className="text-sm font-bold text-slate-600">No publications linked to this theme yet.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={openPublicationPicker}
                  className="text-xs font-bold px-3.5 py-2 rounded-lg text-white cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Select Publications Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedPublications.map((pub, idx) => {
                const links = resolvePublicationLinks(pub);
                const cleanTitle = decodeHtmlEntities(pub.title);
                const cleanAuthors = decodeHtmlEntities(pub.authors);
                const cleanVenue = decodeHtmlEntities(pub.venue);
                const cleanAbstract = decodeHtmlEntities(pub.abstract);
                const titleTargetHref = links.primaryHref || links.scholarLookupUrl;

                return (
                <div
                  key={pub.id}
                  className="p-4 rounded-xl border border-gray-200 bg-slate-50/50 hover:bg-white transition-colors space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        #{idx + 1} · {pub.year}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-red-200 bg-red-50 text-[#9E1B32]">
                        {pub.type}
                      </span>
                      {links.doi && (
                        <a
                          href={links.doiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-[#9E1B32] inline-flex items-center gap-1 hover:underline"
                          style={{ color: primaryColor }}
                        >
                          <span>DOI: {links.doi}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    {pub.citations && pub.citations > 0 ? (
                      <span className="text-[11px] font-bold text-slate-500">
                        {pub.citations} citations
                      </span>
                    ) : null}
                  </div>

                  {links.isLocalFile && !links.doiUrl ? (
                    <button
                      type="button"
                      onClick={() => openOrDownloadResource(pub.link, cleanTitle)}
                      className="text-left text-sm font-extrabold text-slate-900 hover:text-[#9E1B32] hover:underline leading-snug inline-flex items-start gap-1.5 cursor-pointer"
                    >
                      <span>{cleanTitle}</span>
                      <Download className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    </button>
                  ) : titleTargetHref ? (
                    <a
                      href={titleTargetHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-extrabold text-slate-900 hover:text-[#9E1B32] hover:underline leading-snug inline-flex items-start gap-1.5"
                    >
                      <span>{cleanTitle}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                    </a>
                  ) : (
                    <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{cleanTitle}</h4>
                  )}

                  <p className="text-xs text-slate-600 font-medium">{cleanAuthors}</p>
                  <p className="text-xs italic font-semibold" style={{ color: primaryColor }}>
                    {cleanVenue}
                  </p>
                  {cleanAbstract && (
                    <p className="text-xs text-slate-600 leading-relaxed pt-1 line-clamp-3 text-justify">
                      {cleanAbstract}
                    </p>
                  )}

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    {links.doiUrl && (
                      <a
                        href={links.doiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                        style={{ color: primaryColor }}
                      >
                        <span>DOI / Full Text</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {links.externalUrl && links.externalUrl !== links.doiUrl && (
                      <a
                        href={links.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold inline-flex items-center gap-1 hover:underline"
                        style={{ color: primaryColor }}
                      >
                        <span>Open Paper Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {links.isLocalFile && (
                      <button
                        type="button"
                        onClick={() => openOrDownloadResource(pub.link, cleanTitle)}
                        className="text-xs font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
                        style={{ color: primaryColor }}
                      >
                        <span>Download Attached PDF / File</span>
                        <Download className="w-3 h-3" />
                      </button>
                    )}
                    {links.scholarUrl ? (
                      <a
                        href={links.scholarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 hover:underline"
                      >
                        <span>Google Scholar</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : !links.primaryHref && !links.isLocalFile && links.scholarLookupUrl ? (
                      <a
                        href={links.scholarLookupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 hover:underline"
                      >
                        <span>Find on Google Scholar</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: EDIT THEME & OVERVIEW */}
      {editingOverview && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 text-white flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
              <h3 className="text-sm font-black uppercase tracking-wider">Edit Research Theme &amp; Overview</h3>
              <button type="button" onClick={() => setEditingOverview(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveOverview} className="p-5 space-y-4 overflow-y-auto text-xs text-left">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Theme Title</label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={e => setDraftTitle(e.target.value)}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Card Summary (Short Preview)</label>
                <textarea
                  rows={2}
                  value={draftSummary}
                  onChange={e => setDraftSummary(e.target.value)}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Detailed Theme Overview (Multi-paragraph; displayed justified on this sub-page)
                </label>
                <textarea
                  rows={6}
                  value={draftOverviewBody}
                  onChange={e => setDraftOverviewBody(e.target.value)}
                  placeholder="Write detailed scientific overview, methodology, and objectives for this research theme..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Keywords (comma separated)</label>
                <input
                  type="text"
                  value={draftKeywords}
                  onChange={e => setDraftKeywords(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <ImageUploadField
                label="Theme Cover Image"
                category="Research"
                value={draftImage}
                onChange={setDraftImage}
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingOverview(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-white font-bold cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Save Theme Overview
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SELECT PUBLICATIONS FOR THIS THEME */}
      {pickingPubs && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 text-white flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Curate Selected Publications</h3>
                <p className="text-[11px] text-red-100">Choose papers to feature under {theme.title}</p>
              </div>
              <button type="button" onClick={() => setPickingPubs(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pubSearchQuery}
                  onChange={e => setPubSearchQuery(e.target.value)}
                  placeholder="Filter publications by title, author, venue, or year..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>
              <span className="text-xs font-extrabold text-slate-700">
                {draftSelectedPubIds.length} selected
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-left">
              {filteredPickerPubs.map(pub => {
                const checked = draftSelectedPubIds.includes(pub.id);
                const links = resolvePublicationLinks(pub);
                return (
                  <label
                    key={pub.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked ? 'bg-red-50/50 border-[#9E1B32]/40' : 'bg-white border-gray-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePubSelection(pub.id)}
                      className="mt-0.5 accent-[#9E1B32] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">
                        [{pub.year}] {decodeHtmlEntities(pub.title)}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {decodeHtmlEntities(pub.authors)} · {decodeHtmlEntities(pub.venue)}
                      </p>
                      {(links.doiUrl || links.externalUrl) && (
                        <a
                          href={links.doiUrl || links.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-bold hover:underline mt-0.5"
                          style={{ color: primaryColor }}
                        >
                          <span>{links.doi ? `DOI: ${links.doi}` : 'Open Paper Link'}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="px-5 py-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={handleResetAutoMatchPubs}
                className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
              >
                Use Auto-Matched Keywords Instead
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPickingPubs(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSelectedPubs}
                  className="px-5 py-2 rounded-lg text-white font-bold cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Save Selected ({draftSelectedPubIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
