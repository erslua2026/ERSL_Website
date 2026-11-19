import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Plus, Trash2, Lock, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { SubPageHeader, SubPageHeaderPassProps } from './SubPageHeader';
import { sanitizeExternalUrl, toBoxEmbedUrl } from '../lib/boxUtils';

interface BoxFolder {
  id: string;
  name: string;
  description: string;
  share_url: string;
  visibility: 'public' | 'private' | 'members' | 'admin';
}

export const BoxFolders: React.FC<{ currentUser: User | null } & SubPageHeaderPassProps> = ({
  currentUser,
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
          badge: 'BOX WORKSPACE',
          title: 'Lab Box Folders',
          subtitle: 'Shared lab folders from Box, opened right inside the website.',
        }}
        override={headerOverride}
        accentColor={accentColor}
        showSubtitle={showSubheadings}
        canEdit={canEditHeader || isAdmin}
        onSave={onSaveHeader}
      />
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
