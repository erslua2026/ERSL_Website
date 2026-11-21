import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderSync,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  BoxEntityCategory,
  DataLayer,
  Instrument,
  Person,
  Project,
  Software,
  User,
} from '../types';
import { SubPageHeader, SubPageHeaderPassProps } from './SubPageHeader';
import { sanitizeExternalUrl, toBoxEmbedUrl } from '../lib/boxUtils';
import {
  BoxEntityFolderResult,
  BoxFolderEntry,
  buildEntityBoxFolderName,
  cleanupLegacyBoxFolders,
  deleteBoxFileById,
  ENTITY_CATEGORY_ROOTS,
  formatBoxFileSize,
  getBoxFileShareLinks,
  getExpectedBoxFolderPath,
  invokeBoxUpload,
  listBoxFolderContents,
  syncAllEntityBoxFolders,
} from '../lib/boxSync';

interface BoxFolder {
  id: string;
  name: string;
  description: string;
  share_url: string;
  visibility: 'public' | 'private' | 'members' | 'admin';
}

interface BoxFoldersProps extends SubPageHeaderPassProps {
  currentUser: User | null;
  people?: Person[];
  projects?: Project[];
  instruments?: Instrument[];
  datasets?: DataLayer[];
  softwareList?: Software[];
  onApplySyncedEntityFolders?: (results: BoxEntityFolderResult[]) => void;
}

export const BoxFolders: React.FC<BoxFoldersProps> = ({
  currentUser,
  people = [],
  projects = [],
  instruments = [],
  datasets = [],
  softwareList = [],
  onApplySyncedEntityFolders,
  headerOverride,
  accentColor = '#9E1B32',
  showSubheadings = true,
  canEditHeader = false,
  onSaveHeader,
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [folders, setFolders] = useState<BoxFolder[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', share_url: '', visibility: 'members' as 'public' | 'members' | 'admin' });

  // Live Structured Box <-> Web Explorer state
  const [selectedCat, setSelectedCat] = useState<BoxEntityCategory>('projects');
  const [explorerFolderId, setExplorerFolderId] = useState<string | undefined>(undefined);
  const [explorerPath, setExplorerPath] = useState('Projects');
  const [explorerShareUrl, setExplorerShareUrl] = useState('');
  const [explorerEntries, setExplorerEntries] = useState<BoxFolderEntry[]>([]);
  const [explorerHistory, setExplorerHistory] = useState<Array<{ folderId?: string; path: string }>>([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerError, setExplorerError] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [uploadingToBox, setUploadingToBox] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  const defaultBoxFolders: BoxFolder[] = [
    {
      id: 'box-pub-pdf',
      name: 'ERSL Publications & Manuscripts PDF Vault',
      description: 'Full-text peer-reviewed articles, author response letters, and high-res vector figures.',
      share_url: 'https://ua.box.com/s/ersl-publications-pdf',
      visibility: 'public'
    },
    {
      id: 'box-field-raw',
      name: 'Raw UAV LiDAR, Multispectral & ADCP River Survey Datasets',
      description: 'High-volume point clouds, orthomosaics, and SonTek M9 ADCP hydrographic field logs.',
      share_url: 'https://ua.box.com/s/ersl-raw-uav-field-data',
      visibility: 'private'
    },
    {
      id: 'box-[#teach-gym]',
      name: 'GY 404/504 Teaching Materials & Lab Manuals',
      description: 'Course syllabi, GEE lab guides, Python tutorials, and student dataset downloads.',
      share_url: 'https://ua.box.com/s/ersl-teaching-materials',
      visibility: 'public'
    },
    {
      id: 'box-ciroh-noaa',
      name: 'CIROH & NOAA National Water Center Project Deliverables',
      description: 'Annual project progress reports, RS-FloodXDepth validation charts, and code archives.',
      share_url: 'https://ua.box.com/s/ersl-ciroh-deliverables',
      visibility: 'private'
    },
    {
      id: 'box-geoai-weights',
      name: 'Geospatial AI & SAM2 Machine Learning Model Weights',
      description: 'Pre-trained PyTorch weights, river channel segmentation masks, and GEE scripts.',
      share_url: 'https://ua.box.com/s/ersl-geoai-models',
      visibility: 'private'
    }
  ];

  const load = useCallback(async () => {
    if (!supabase) {
      setFolders(defaultBoxFolders);
      return;
    }
    const { data, error: err } = await supabase.from('box_folders').select('*').order('created_at');
    if (err || !data || data.length === 0) {
      setFolders(defaultBoxFolders);
    } else {
      setFolders(data as BoxFolder[]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadExplorer = useCallback(
    async (opts: {
      category?: BoxEntityCategory;
      folderId?: string;
      folderPath?: string;
      pushHistory?: boolean;
    }) => {
      setExplorerLoading(true);
      setExplorerError('');
      const res = await listBoxFolderContents({
        category: opts.folderId ? undefined : (opts.category || selectedCat),
        folderId: opts.folderId,
        folderPath: opts.folderPath,
      });
      setExplorerLoading(false);
      if (!res.ok) {
        setExplorerError(res.error || 'Live UA Box folder listing unavailable until Box credentials are configured.');
        setExplorerEntries([]);
        return;
      }
      if (opts.pushHistory) {
        setExplorerHistory(prev => [...prev, { folderId: explorerFolderId, path: explorerPath }]);
      }
      setExplorerFolderId(res.folderId);
      setExplorerPath(res.folderPath || ENTITY_CATEGORY_ROOTS[opts.category || selectedCat]);
      setExplorerShareUrl(res.shareUrl || '');
      setExplorerEntries(res.entries || []);
    },
    [selectedCat, explorerFolderId, explorerPath]
  );

  useEffect(() => {
    loadExplorer({ category: 'projects' });
  }, []);

  const handleSyncAllFolders = async () => {
    setSyncingAll(true);
    setSyncStatus(null);
    const res = await syncAllEntityBoxFolders({
      people,
      projects,
      instruments,
      datasets,
      software: softwareList,
      cleanupLegacy: true,
    });
    setSyncingAll(false);

    if (!res.ok) {
      setSyncStatus({
        type: 'warn',
        text: res.error || 'Box auto-folder sync requires UA Box OAuth credentials on box-sync.',
      });
      return;
    }

    if (res.results && res.results.length > 0 && onApplySyncedEntityFolders) {
      onApplySyncedEntityFolders(res.results);
    }

    setSyncStatus({
      type: 'ok',
      text: `Box folders organized uniformly: ${res.results?.length || 0} folders synced (${res.createdCount || 0} newly created) with Public / Private separation.`,
    });
    loadExplorer({ category: selectedCat });
  };

  const handleCleanupLegacy = async () => {
    setSyncingAll(true);
    setSyncStatus(null);
    const res = await cleanupLegacyBoxFolders();
    setSyncingAll(false);
    if (!res.ok) {
      setSyncStatus({ type: 'warn', text: res.error || 'Legacy folder cleanup failed.' });
      return;
    }
    setSyncStatus({
      type: 'ok',
      text: `Legacy Box cleanup finished: archived ${res.archivedFiles || 0} old items into 06_Website_Data_Sync${res.cleaned?.length ? ` & removed empty duplicates (${res.cleaned.join(', ')})` : ''}.`,
    });
    loadExplorer({ category: selectedCat });
  };

  const handleDirectUploadToExplorer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingToBox(true);
    setExplorerError('');
    try {
      const dest = (explorerFolderId
        ? `${selectedCat}/Explorer`
        : selectedCat) as any;
      await invokeBoxUpload(file, dest, {
        folderId: explorerFolderId,
        isPrivate: selectedCat === 'people' || selectedCat === 'projects',
      });
      await loadExplorer({ category: selectedCat, folderId: explorerFolderId, folderPath: explorerPath });
    } catch (err: any) {
      setExplorerError(err?.message || 'Upload to UA Box failed.');
    } finally {
      setUploadingToBox(false);
    }
  };

  const handleCopyFileLink = async (entry: BoxFolderEntry) => {
    const res = await getBoxFileShareLinks(entry.id, selectedCat === 'people' || selectedCat === 'projects');
    const url = res.shareUrl || res.directUrl || entry.shareUrl || entry.directUrl;
    if (url && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopiedFileId(entry.id);
      setTimeout(() => setCopiedFileId(null), 2200);
    } else if (!res.ok) {
      setExplorerError(res.error || 'Could not generate shared link.');
    }
  };

  const localEntityDirectories: Record<
    BoxEntityCategory,
    Array<{ id: string; label: string; folderName: string; boxFolderUrl?: string; isPrivate: boolean; expectedPath: string }>
  > = {
    people: people.map(p => ({
      id: p.id,
      label: p.name,
      folderName: buildEntityBoxFolderName(p.name, p.id),
      boxFolderUrl: p.subPage?.boxFolderUrl,
      isPrivate: true,
      expectedPath: `${ENTITY_CATEGORY_ROOTS.people}/${buildEntityBoxFolderName(p.name, p.id)}/{01_Public, 02_Private_Members}`,
    })),
    projects: projects.map(p => ({
      id: p.id,
      label: p.title,
      folderName: buildEntityBoxFolderName(p.title, p.id),
      boxFolderUrl: p.subPage?.boxFolderUrl,
      isPrivate: true,
      expectedPath: `${ENTITY_CATEGORY_ROOTS.projects}/${buildEntityBoxFolderName(p.title, p.id)}/{01_Public, 02_Private_Members}`,
    })),
    instruments: instruments.map(i => ({
      id: i.id,
      label: i.name,
      folderName: buildEntityBoxFolderName(i.name, i.id),
      boxFolderUrl: i.boxFolderUrl,
      isPrivate: false,
      expectedPath: `${ENTITY_CATEGORY_ROOTS.instruments}/${buildEntityBoxFolderName(i.name, i.id)}/{01_Public, 02_Private_Members}`,
    })),
    datasets: datasets.map(d => {
      const priv = d.availability !== 'Public';
      return {
        id: d.id,
        label: d.name,
        folderName: buildEntityBoxFolderName(d.name, d.id),
        boxFolderUrl: d.boxFolderUrl,
        isPrivate: priv,
        expectedPath: getExpectedBoxFolderPath('datasets', d.name, d.id, priv),
      };
    }),
    software: softwareList.map(s => {
      const priv = Boolean(s.visibility && s.visibility !== 'public');
      return {
        id: s.id,
        label: s.title,
        folderName: buildEntityBoxFolderName(s.title, s.id),
        boxFolderUrl: s.boxFolderUrl,
        isPrivate: priv,
        expectedPath: getExpectedBoxFolderPath('software', s.title, s.id, priv),
      };
    }),
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error: err } = await supabase!.from('box_folders').insert(form);
    if (err) {
      // Compatibility fallback if Postgres check constraint still restricts visibility to 'public'|'private'
      if (form.visibility !== 'public') {
        const retry = await supabase!.from('box_folders').insert({ ...form, visibility: 'private' });
        if (!retry.error) {
          setForm({ name: '', description: '', share_url: '', visibility: 'members' });
          load();
          return;
        }
      }
      setError(err.message);
    } else {
      setForm({ name: '', description: '', share_url: '', visibility: 'members' });
      load();
    }
  };
  const remove = async (f: BoxFolder) => {
    if (!confirm(`Remove folder "${f.name}" from the site? (The Box folder itself is not touched.)`)) return;
    await supabase!.from('box_folders').delete().eq('id', f.id);
    if (active === f.id) setActive(null);
    load();
  };

  const visibleFolders = folders.filter(f => {
    if (f.visibility === 'admin') return isAdmin;
    if (f.visibility === 'private' || f.visibility === 'members') return Boolean(currentUser);
    return true;
  });
  const current = visibleFolders.find(f => f.id === active);

  return (
    <div className="space-y-6 text-left">
      <SubPageHeader
        tabId="box"
        defaults={{
          badge: 'BOX WORKSPACE · TWO-WAY SYNC',
          title: 'Lab Box Folders & Web Bridge',
          subtitle: 'Dedicated folders for People, Projects, Instruments, Datasets & Software — move files Box ↔ Website seamlessly even above 3MB.',
        }}
        override={headerOverride}
        accentColor={accentColor}
        showSubtitle={showSubheadings}
        canEdit={canEditHeader || isAdmin}
        onSave={onSaveHeader}
      />

      {/* Structured 5-Category Box Directory + Box <-> Web Browser */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Uniform Box Folder Structure (Public vs. Private Separated)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              <strong>Datasets &amp; Software</strong> organize cleanly into <code>01_Public/</code> vs. <code>02_Private_Members/</code>. <strong>People, Projects &amp; Instruments</strong> each contain <code>01_Public/</code> &amp; <code>02_Private_Members/</code> inside their folder. System JSON backups stay isolated inside <code>06_Website_Data_Sync/JSON_Backups</code>.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={syncingAll}
                onClick={handleCleanupLegacy}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-gray-300 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Archive old 02_Datasets_Public, 03_Datasets_Members, 04_Projects, 05_Softwares_And_Guides folders into 06_Website_Data_Sync and remove empty duplicates"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Clean Up Legacy Folders</span>
              </button>
              <button
                type="button"
                disabled={syncingAll}
                onClick={handleSyncAllFolders}
                className="px-3.5 py-2 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSync className="w-3.5 h-3.5" />}
                <span>{syncingAll ? 'Organizing Box...' : 'Sync & Organize All Box Folders'}</span>
              </button>
            </div>
          )}
        </div>

        {syncStatus && (
          <div
            className={`mx-4 mt-3 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
              syncStatus.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {syncStatus.text}
          </div>
        )}

        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {(['people', 'projects', 'instruments', 'datasets', 'software'] as BoxEntityCategory[]).map(cat => {
            const items = localEntityDirectories[cat];
            const isSel = selectedCat === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCat(cat);
                  setExplorerHistory([]);
                  setExplorerFolderId(undefined);
                  loadExplorer({ category: cat });
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSel ? 'border-[#9E1B32] bg-red-50/40 ring-1 ring-[#9E1B32]/20' : 'border-gray-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-slate-900">📁 {ENTITY_CATEGORY_ROOTS[cat]}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {items.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 truncate">
                  {items.filter(x => x.boxFolderUrl).length}/{items.length} linked
                </p>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Website Entity Directory for Selected Category */}
          <div className="lg:col-span-5 border border-gray-200 rounded-xl overflow-hidden bg-slate-50/50">
            <div className="px-3.5 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800">
                {ENTITY_CATEGORY_ROOTS[selectedCat]} Item Folders ({localEntityDirectories[selectedCat].length})
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {localEntityDirectories[selectedCat].map(item => (
                <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-white">
                  <button
                    type="button"
                    onClick={async () => {
                      setExplorerLoading(true);
                      setExplorerError('');
                      const res = await listBoxFolderContents({
                        category: selectedCat,
                        folderName: item.folderName,
                        isPrivate: item.isPrivate,
                      });
                      setExplorerLoading(false);
                      if (res.ok) {
                        setExplorerHistory([{ path: ENTITY_CATEGORY_ROOTS[selectedCat] }]);
                        setExplorerFolderId(res.folderId);
                        setExplorerPath(res.folderPath || item.expectedPath);
                        setExplorerShareUrl(res.shareUrl || item.boxFolderUrl || '');
                        setExplorerEntries(res.entries || []);
                      } else {
                        setExplorerError(res.error || 'Could not load Box folder.');
                      }
                    }}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.label}</p>
                      {(selectedCat === 'datasets' || selectedCat === 'software') ? (
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 inline-flex items-center gap-0.5 ${
                            item.isPrivate
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {item.isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                          <span>{item.isPrivate ? 'Private' : 'Public'}</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                          Public + Private
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                      /{item.expectedPath}
                    </p>
                  </button>
                  {item.boxFolderUrl && sanitizeExternalUrl(item.boxFolderUrl) && (
                    <a
                      href={sanitizeExternalUrl(item.boxFolderUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold shrink-0 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Box
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Box Folder Contents & Web <-> Box Upload/Copy */}
          <div className="lg:col-span-7 border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col">
            <div className="px-3.5 py-2 border-b border-gray-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {explorerHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const prev = explorerHistory[explorerHistory.length - 1];
                      setExplorerHistory(h => h.slice(0, -1));
                      loadExplorer({
                        category: selectedCat,
                        folderId: prev.folderId,
                        folderPath: prev.path,
                      });
                    }}
                    className="p-1 rounded bg-white border border-gray-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Back"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-xs font-bold text-slate-800 font-mono truncate">
                  📁 ERSL_Website_Storage / {explorerPath}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer">
                  {uploadingToBox ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                  <span>Web &rarr; Box Upload</span>
                  <input type="file" onChange={handleDirectUploadToExplorer} disabled={uploadingToBox} className="hidden" />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    loadExplorer({ category: selectedCat, folderId: explorerFolderId, folderPath: explorerPath })
                  }
                  className="px-2 py-1 rounded-lg bg-white border border-gray-200 hover:bg-slate-100 text-slate-700 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${explorerLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>

                {sanitizeExternalUrl(explorerShareUrl) && (
                  <a
                    href={sanitizeExternalUrl(explorerShareUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Open in Box
                  </a>
                )}
              </div>
            </div>

            <div className="p-2 flex-1 max-h-72 overflow-y-auto">
              {explorerLoading ? (
                <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading live UA Box folder...</span>
                </div>
              ) : explorerError ? (
                <div className="m-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <p className="font-bold">Live Box Folder Connection Notice</p>
                  <p className="text-[11px]">{explorerError}</p>
                  <p className="text-[11px] text-amber-800">
                    Once `box-sync` secrets (`BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_ENTERPRISE_ID`, `BOX_ROOT_FOLDER_ID`) are active, this browser reads &amp; uploads directly to UA Box.
                  </p>
                </div>
              ) : explorerEntries.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-10">
                  No files inside this Box folder yet. Upload here or drop large files (&gt;3MB) in UA Box and click Refresh.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {explorerEntries.map(entry =>
                    entry.type === 'folder' ? (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() =>
                          loadExplorer({
                            folderId: entry.id,
                            folderPath: `${explorerPath}/${entry.name}`,
                            pushHistory: true,
                          })
                        }
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-blue-50/50 text-left cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-800 truncate flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 shrink-0">Open Folder &rarr;</span>
                      </button>
                    ) : (
                      <div key={entry.id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{entry.name}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 pl-5">
                            {formatBoxFileSize(entry.size)}
                            {entry.modifiedAt ? ` · Updated ${entry.modifiedAt.slice(0, 10)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyFileLink(entry)}
                            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedFileId === entry.id ? (
                              <>
                                <Check className="w-3 h-3" /> Copied Link!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Copy Box &rarr; Web Link
                              </>
                            )}
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm(`Delete "${entry.name}" from UA Box? (Remember to also remove any broken link on the website.)`)) return;
                                const ok = await deleteBoxFileById(entry.id);
                                if (ok) {
                                  setExplorerEntries(prev => prev.filter(x => x.id !== entry.id));
                                } else {
                                  setExplorerError(`Could not delete "${entry.name}" from UA Box.`);
                                }
                              }}
                              className="p-1.5 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 cursor-pointer"
                              title="Delete this file in UA Box"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</p>}

      {isAdmin && (
        <form onSubmit={add} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
          <div className="md:col-span-3 space-y-1"><label className="font-bold text-gray-700">Folder name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded" /></div>
          <div className="md:col-span-4 space-y-1"><label className="font-bold text-gray-700">Box shared link</label>
            <input required type="url" value={form.share_url} onChange={e => setForm({ ...form, share_url: e.target.value })} placeholder="https://ua.box.com/s/..." className="w-full p-2 border border-gray-300 rounded" /></div>
          <div className="md:col-span-2 space-y-1"><label className="font-bold text-gray-700">Visibility</label>
            <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as any })} className="w-full p-2 border border-gray-300 rounded">
              <option value="public">Public</option>
              <option value="members">Members Only</option>
              <option value="admin">Private (Admin Only)</option>
            </select></div>
          <div className="md:col-span-3"><button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add folder</button></div>
          <div className="md:col-span-12 space-y-1"><label className="font-bold text-gray-700">Project / Student Scope & Description (optional)</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g., NASA SERVIR · Hydrology datasets" className="w-full p-2 border border-gray-300 rounded" /></div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visibleFolders.map(f => {
          const badgeCls =
            f.visibility === 'public'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : f.visibility === 'admin'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';
          const badgeLabel = f.visibility === 'public' ? 'Public' : f.visibility === 'admin' ? 'Private' : 'Members';
          return (
            <div key={f.id} className={`bg-white rounded-xl border p-3.5 shadow-2xs cursor-pointer hover:shadow-md transition-shadow ${active === f.id ? 'border-[#9E1B32] ring-1 ring-[#9E1B32]/20' : 'border-gray-100'}`}
              onClick={() => setActive(f.id)}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">📁 {f.name}</p>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border shrink-0 ${badgeCls}`}>
                  {badgeLabel}
                </span>
              </div>
              {f.description && <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{f.description}</p>}
              <div className="mt-2.5 flex items-center justify-between text-xs">
                {sanitizeExternalUrl(f.share_url) ? (
                  <a href={sanitizeExternalUrl(f.share_url)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 font-semibold inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" /> Open in Box</a>
                ) : (
                  <span className="text-gray-400 italic">Invalid Box link</span>
                )}
                {isAdmin && <button onClick={e => { e.stopPropagation(); remove(f); }} className="text-red-500 p-1 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          );
        })}
        {visibleFolders.length === 0 && <div className="md:col-span-3 bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500">No folders accessible for your account yet.</div>}
      </div>

      {current && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 text-xs font-bold text-gray-600">{current.name}</div>
          {toBoxEmbedUrl(current.share_url) ? (
            <iframe title={current.name} src={toBoxEmbedUrl(current.share_url)} className="w-full h-[600px]" allowFullScreen />
          ) : (
            <div className="p-8 text-center text-xs text-amber-700 bg-amber-50">
              Preview unavailable: only verified <code>box.com</code> / <code>boxcloud.com</code> URLs can be embedded.
            </div>
          )}
          <p className="text-[11px] text-gray-400 p-2">If the folder shows a sign-in prompt or is blank, the Box link requires a UA login or embedding is disabled — use “Open in Box”.</p>
        </div>
      )}
    </div>
  );
};
