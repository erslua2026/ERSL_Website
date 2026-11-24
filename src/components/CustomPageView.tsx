import React, { useState } from 'react';
import {
  Plus, Edit2, Trash2, Lock, Globe, ExternalLink, FolderGit2,
  Database, FileText, Image as ImageIcon, X, Save
} from 'lucide-react';
import { CustomBlock, CustomPageData, CustomSubTab, SubTabVisibility, User } from '../types';
import {
  isBoxUrl,
  isSafeDataDocumentUrl,
  openOrDownloadResource,
  resolveAssetUrl,
  resolveReferenceUrl,
  toBoxEmbedUrl,
} from '../lib/boxUtils';
import { ImageUploadField } from './ImageUploadField';
import { BoxUploadButton } from './BoxUploadButton';
import { LinkedReferenceText } from './LinkedReferenceText';
import { RichBlogContent } from './RichBlogContent';
import { RichBlogEditor } from './RichBlogEditor';
import { stripRichHtmlToPlainText } from '../lib/richTextUtils';

interface CustomPageViewProps {
  page: CustomPageData;
  currentUser: User | null;
  canEdit: boolean;
  primaryColor?: string;
  onUpdatePage: (updated: CustomPageData) => void;
  onLoginClick: () => void;
}

export const CustomPageView: React.FC<CustomPageViewProps> = ({
  page,
  currentUser,
  canEdit,
  primaryColor = '#9E1B32',
  onUpdatePage,
  onLoginClick,
}) => {
  const subTabs = page.subTabs && page.subTabs.length > 0
    ? page.subTabs
    : [{ id: 'overview', label: 'Overview', visibility: 'public' as SubTabVisibility, blocks: [] }];

  const [activeSubId, setActiveSubId] = useState<string>(subTabs[0].id);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CustomBlock | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);

  const [headerTitle, setHeaderTitle] = useState(page.title);
  const [headerSubtitle, setHeaderSubtitle] = useState(page.subtitle || '');
  const [headerBoxUrl, setHeaderBoxUrl] = useState(page.boxFolderUrl || '');

  const [bType, setBType] = useState<CustomBlock['type']>('text');
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bUrl, setBUrl] = useState('');
  const [bTag, setBTag] = useState('');

  const activeSub = subTabs.find(s => s.id === activeSubId) || subTabs[0];
  const isAdmin = currentUser?.role === 'Admin';
  const isLocked =
    (activeSub.visibility === 'members' && !currentUser) ||
    (activeSub.visibility === 'admin' && !isAdmin);

  const addSubTab = () => {
    const label = prompt('New sub-tab name (e.g. Overview, Useful Links, Datasets):')?.trim();
    if (!label) return;
    const newSub: CustomSubTab = {
      id: `sub-${Date.now()}`,
      label,
      visibility: 'public',
      blocks: [],
    };
    onUpdatePage({ ...page, subTabs: [...subTabs, newSub] });
    setActiveSubId(newSub.id);
  };

  const renameSubTab = (sub: CustomSubTab) => {
    const label = prompt('Rename sub-tab:', sub.label)?.trim();
    if (!label) return;
    onUpdatePage({
      ...page,
      subTabs: subTabs.map(s => (s.id === sub.id ? { ...s, label } : s)),
    });
  };

  const deleteSubTab = (sub: CustomSubTab) => {
    if (subTabs.length <= 1) {
      alert('A page must keep at least one sub-tab.');
      return;
    }
    if (!confirm(`Delete sub-tab "${sub.label}"?`)) return;
    const next = subTabs.filter(s => s.id !== sub.id);
    onUpdatePage({ ...page, subTabs: next });
    if (activeSubId === sub.id) setActiveSubId(next[0].id);
  };

  const toggleSubTabVisibility = (sub: CustomSubTab) => {
    const nextVis: SubTabVisibility =
      sub.visibility === 'public' ? 'members' : sub.visibility === 'members' ? 'admin' : 'public';
    onUpdatePage({
      ...page,
      subTabs: subTabs.map(s => (s.id === sub.id ? { ...s, visibility: nextVis } : s)),
    });
  };

  const openBlockModal = (existing?: CustomBlock) => {
    setEditingBlock(existing || null);
    setBType(existing?.type || 'text');
    setBTitle(existing?.title || '');
    setBBody(existing?.body || '');
    setBUrl(existing?.url || '');
    setBTag(existing?.tag || '');
    setBlockModalOpen(true);
  };

  const saveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bTitle.trim()) return;
    const nextBlock: CustomBlock = {
      id: editingBlock?.id || `blk-${Date.now()}`,
      type: bType,
      title: bTitle.trim(),
      body: bBody.trim(),
      url: bUrl.trim() || undefined,
      tag: bTag.trim() || undefined,
    };
    const nextBlocks = editingBlock
      ? activeSub.blocks.map(b => (b.id === editingBlock.id ? nextBlock : b))
      : [...activeSub.blocks, nextBlock];

    onUpdatePage({
      ...page,
      subTabs: subTabs.map(s => (s.id === activeSub.id ? { ...s, blocks: nextBlocks } : s)),
    });
    setBlockModalOpen(false);
    setEditingBlock(null);
  };

  const deleteBlock = (blockId: string) => {
    if (!confirm('Delete this content block?')) return;
    onUpdatePage({
      ...page,
      subTabs: subTabs.map(s =>
        s.id === activeSub.id ? { ...s, blocks: s.blocks.filter(b => b.id !== blockId) } : s
      ),
    });
  };

  const saveHeader = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePage({
      ...page,
      title: headerTitle.trim() || page.title,
      subtitle: headerSubtitle.trim() || undefined,
      boxFolderUrl: headerBoxUrl.trim() || undefined,
    });
    setEditingHeader(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 text-left">
      <div className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
        <div
          className="p-5 md:p-6 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white">{page.title}</h2>
              {page.subtitle && <p className="text-xs text-red-100 mt-1">{page.subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {page.boxFolderUrl && (
                <a
                  href={page.boxFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                >
                  <FolderGit2 className="w-3.5 h-3.5" /> Open Linked Box Folder
                </a>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePage({
                        ...page,
                        subTabLayout: page.subTabLayout === 'vertical' ? 'horizontal' : 'vertical',
                      })
                    }
                    className="bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                    title="Switch sub-tabs layout between horizontal and vertical"
                  >
                    Sub-Tabs: {page.subTabLayout === 'vertical' ? 'Vertical' : 'Horizontal'}
                  </button>
                  <button
                    onClick={() => {
                      setHeaderTitle(page.title);
                      setHeaderSubtitle(page.subtitle || '');
                      setHeaderBoxUrl(page.boxFolderUrl || '');
                      setEditingHeader(true);
                    }}
                    className="bg-white hover:bg-red-50 text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    style={{ color: primaryColor }}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Page Info
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Tabs Bar (supports Horizontal top bar; vertical renders side-by-side below) */}
        {page.subTabLayout !== 'vertical' && (
          <div className="px-5 py-2.5 bg-white flex flex-wrap items-center gap-1.5 border-t border-gray-100">
            {subTabs.map(sub => {
              const active = sub.id === activeSub.id;
              return (
                <div key={sub.id} className="inline-flex items-center rounded-lg overflow-hidden border border-gray-200 bg-slate-50">
                  <button
                    onClick={() => setActiveSubId(sub.id)}
                    className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      active ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : undefined}
                  >
                    <span>{sub.label}</span>
                    {sub.visibility === 'public' ? (
                      <Globe className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => toggleSubTabVisibility(sub)}
                        title="Cycle Public / Members / Private (Admin Only)"
                        className={`px-2 py-1.5 text-[10px] font-bold border-l border-gray-200 cursor-pointer ${
                          sub.visibility === 'public'
                            ? 'bg-emerald-50 text-emerald-700'
                            : sub.visibility === 'admin'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {sub.visibility === 'public' ? 'Public' : sub.visibility === 'admin' ? 'Private' : 'Members'}
                      </button>
                      <button
                        onClick={() => renameSubTab(sub)}
                        title="Rename sub-tab"
                        className="px-1.5 py-1.5 text-slate-500 hover:text-blue-600 border-l border-gray-200 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteSubTab(sub)}
                        title="Delete sub-tab"
                        className="px-1.5 py-1.5 text-slate-400 hover:text-red-600 border-l border-gray-200 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <button
                onClick={addSubTab}
                className="px-2.5 py-1.5 rounded-lg border border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-bold cursor-pointer"
              >
                + Sub-Tab
              </button>
            )}
          </div>
        )}
      </div>

      <div className={page.subTabLayout === 'vertical' ? 'flex flex-col lg:flex-row gap-4 items-start' : ''}>
        {page.subTabLayout === 'vertical' && (
          <aside className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-200 shadow-xs p-3 space-y-1.5">
            {subTabs.map(sub => {
              const active = sub.id === activeSub.id;
              return (
                <div key={sub.id} className="flex items-center rounded-xl overflow-hidden border border-gray-200 bg-slate-50">
                  <button
                    onClick={() => setActiveSubId(sub.id)}
                    className={`flex-1 min-w-0 px-3 py-2 text-xs font-bold flex items-center justify-between gap-1.5 cursor-pointer text-left ${
                      active ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    style={active ? { backgroundColor: primaryColor } : undefined}
                  >
                    <span className="truncate">{sub.label}</span>
                    {sub.visibility === 'public' ? <Globe className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => toggleSubTabVisibility(sub)}
                        title="Cycle Public / Members / Private"
                        className={`px-1.5 py-2 text-[9px] font-bold border-l border-gray-200 cursor-pointer ${
                          sub.visibility === 'public'
                            ? 'bg-emerald-50 text-emerald-700'
                            : sub.visibility === 'admin'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {sub.visibility === 'public' ? 'Pub' : sub.visibility === 'admin' ? 'Pvt' : 'Mem'}
                      </button>
                      <button onClick={() => renameSubTab(sub)} className="px-1.5 py-2 text-slate-500 hover:text-blue-600 border-l border-gray-200 cursor-pointer"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => deleteSubTab(sub)} className="px-1.5 py-2 text-slate-400 hover:text-red-600 border-l border-gray-200 cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <button
                onClick={addSubTab}
                className="w-full px-3 py-2 rounded-xl border border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-bold cursor-pointer"
              >
                + Add Sub-Tab
              </button>
            )}
          </aside>
        )}

      <div className="flex-1 min-w-0 w-full">
      {isLocked ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-lg mx-auto shadow-xs space-y-3">
          <Lock className="w-9 h-9 text-amber-600 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900">
            {activeSub.visibility === 'admin' ? 'Private (Admin Only) Sub-Tab' : 'Members Only Sub-Tab'}
          </h3>
          <p className="text-xs text-slate-500">
            {activeSub.visibility === 'admin'
              ? 'This folder/section is restricted to lab administrators.'
              : 'Sign in as an approved ERSL member to view this content.'}
          </p>
          {activeSub.visibility !== 'admin' && (
            <button onClick={onLoginClick} className="text-white text-xs font-bold px-5 py-2 rounded-lg cursor-pointer" style={{ backgroundColor: primaryColor }}>
              Member Login
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => openBlockModal()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Content / Link / File
              </button>
            </div>
          )}

          {activeSub.blocks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-xs text-slate-500">
              No content blocks in <strong>{activeSub.label}</strong> yet.
              {canEdit && ' Click "+ Add Content / Link / File" above to add text, Box folders, datasets, images, or links.'}
            </div>
          ) : (() => {
            const linkListBlocks = activeSub.blocks.filter(b => b.type === 'link' || b.type === 'dataset');
            const richBlocks = activeSub.blocks.filter(b => b.type !== 'link' && b.type !== 'dataset');
            return (
              <div className="space-y-3">
                {/* Compact Direct-Click List for Useful Links & Datasets */}
                {linkListBlocks.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-2xs">
                    {linkListBlocks.map(block => {
                      const isFile = Boolean(block.url && isSafeDataDocumentUrl(block.url));
                      const safeUrl = block.url ? resolveReferenceUrl(block.url) : '';
                      return (
                        <div key={block.id} className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                          <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                            {block.type === 'dataset' ? (
                              <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: primaryColor }} />
                            )}
                            {isFile ? (
                              <button
                                type="button"
                                onClick={() => openOrDownloadResource(block.url, block.title)}
                                className="text-xs font-extrabold hover:underline text-left cursor-pointer"
                                style={{ color: primaryColor }}
                              >
                                {block.title}
                              </button>
                            ) : safeUrl ? (
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-extrabold hover:underline"
                                style={{ color: primaryColor }}
                              >
                                {block.title}
                              </a>
                            ) : (
                              <span className="text-xs font-extrabold text-slate-900">{block.title}</span>
                            )}
                            {block.tag && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {block.tag}
                              </span>
                            )}
                            {block.body && (
                              <span className="text-[11px] text-slate-500 truncate max-w-xl">
                                — {stripRichHtmlToPlainText(block.body)}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => openBlockModal(block)} className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteBlock(block.id)} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {richBlocks.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {richBlocks.map(block => (
                      <div
                        key={block.id}
                        className={`bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-2 ${
                          block.type === 'box-folder' || block.type === 'text' ? 'md:col-span-2' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {block.type === 'box-folder' && <FolderGit2 className="w-4 h-4 text-blue-600" />}
                            {block.type === 'image' && <ImageIcon className="w-4 h-4 text-purple-600" />}
                            {block.type === 'text' && <FileText className="w-4 h-4 text-slate-600" />}
                            <h4 className="font-extrabold text-sm text-slate-900">{block.title}</h4>
                            {block.tag && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {block.tag}
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <button onClick={() => openBlockModal(block)} className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteBlock(block.id)} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>

                        {block.type === 'image' && block.url && (
                          <img src={resolveAssetUrl(block.url)} alt={block.title} className="w-full max-h-72 object-contain bg-slate-50 rounded-lg border border-gray-100" />
                        )}

                        {block.body && (
                          <RichBlogContent
                            content={block.body}
                            className="text-xs text-slate-600 leading-relaxed"
                            justifyByDefault
                          />
                        )}

                        {block.type === 'box-folder' && block.url && isBoxUrl(block.url) && toBoxEmbedUrl(block.url) && (
                          <iframe title={block.title} src={toBoxEmbedUrl(block.url)} className="w-full h-[460px] rounded-lg border border-gray-200" allowFullScreen />
                        )}

                        {block.url && block.type !== 'image' && (
                          isSafeDataDocumentUrl(block.url) ? (
                            <button
                              type="button"
                              onClick={() => openOrDownloadResource(block.url, block.title)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline cursor-pointer"
                              style={{ color: primaryColor }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open / Download Attached File</span>
                            </button>
                          ) : resolveReferenceUrl(block.url) ? (
                            <a
                              href={resolveReferenceUrl(block.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
                              style={{ color: primaryColor }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open {block.type === 'box-folder' ? 'in UA Box' : 'Resource / DOI'}</span>
                            </a>
                          ) : null
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      </div>
      </div>

      {/* Edit Header Modal */}
      {editingHeader && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <h3 className="font-extrabold text-sm">Edit Custom Page Details</h3>
              <button onClick={() => setEditingHeader(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={saveHeader} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Page Title</label>
                <input value={headerTitle} onChange={e => setHeaderTitle(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Subtitle (Optional)</label>
                <input value={headerSubtitle} onChange={e => setHeaderSubtitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Linked UA Box Folder URL (Optional)</label>
                <input value={headerBoxUrl} onChange={e => setHeaderBoxUrl(e.target.value)} placeholder="https://ua.box.com/s/..." className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingHeader(false)} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg text-white font-bold cursor-pointer" style={{ backgroundColor: primaryColor }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Content Block Modal */}
      {blockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <h3 className="font-extrabold text-sm">{editingBlock ? 'Edit Content Block' : 'Add Content Block'}</h3>
              <button onClick={() => setBlockModalOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={saveBlock} className="p-5 space-y-3 text-xs max-h-[84vh] overflow-y-auto">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Block Type</label>
                <select value={bType} onChange={e => setBType(e.target.value as any)} className="w-full p-2 border border-gray-300 rounded-lg">
                  <option value="text">Text / Note Section</option>
                  <option value="box-folder">Embedded UA Box Folder</option>
                  <option value="dataset">Dataset Link (Box / Repository)</option>
                  <option value="link">Useful Link / Document / Tool</option>
                  <option value="image">Photo / Image (Upload, Paste Clipboard, or URL)</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Title *</label>
                <input value={bTitle} onChange={e => setBTitle(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Description / Rich Content (Word-Style Formatting, Tables &amp; Equations)</label>
                <RichBlogEditor
                  value={bBody}
                  onChange={setBBody}
                  minHeightClass="min-h-[160px]"
                  placeholder="Write formatted prose, insert tables, LaTeX equations, fonts, colors, or justify text..."
                />
              </div>
              {bType === 'image' ? (
                <div className="space-y-3">
                  <ImageUploadField
                    value={bUrl}
                    onChange={setBUrl}
                    category="General"
                    label="Image (Upload from Computer, Paste Clipboard, or URL)"
                  />
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Tag / Badge (Optional)</label>
                    <input value={bTag} onChange={e => setBTag(e.target.value)} placeholder="e.g. Public, Figure, Map" className="w-full p-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">External URL / Box Link (Optional)</label>
                      <input
                        value={bUrl.startsWith('data:') ? '' : bUrl}
                        onChange={e => setBUrl(e.target.value)}
                        placeholder="https://... or upload a file below"
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Tag / Badge (Optional)</label>
                      <input value={bTag} onChange={e => setBTag(e.target.value)} placeholder="e.g. Public, Box, Guide" className="w-full p-2 border border-gray-300 rounded-lg" />
                    </div>
                  </div>
                  <BoxUploadButton
                    destination={bType === 'dataset' ? 'datasets' : 'general'}
                    label="Upload Local Document / File / Image"
                    currentValue={bUrl}
                    onClear={() => setBUrl('')}
                    onUploaded={(uploadedUrl) => setBUrl(uploadedUrl)}
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setBlockModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-lg text-white font-bold flex items-center gap-1 cursor-pointer" style={{ backgroundColor: primaryColor }}>
                  <Save className="w-3.5 h-3.5" /> Save Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

