import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ClipboardPaste,
  ExternalLink,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BoxFolderEntry,
  BoxImageCategory,
  buildEntityBoxFolderName,
  deleteBoxFileFromUrl,
  formatBoxFileSize,
  getBoxFileShareLinks,
  getExpectedBoxFolderPath,
  isDeletableBoxFileUrl,
  listBoxFolderContents,
  uploadImageWithBoxFallback,
} from '../lib/boxSync';
import { isBoxSharePageNotDirectFile, resolveAssetUrl, sanitizeExternalUrl } from '../lib/boxUtils';
import type { BoxUploadEntityContext } from './BoxUploadButton';

interface ImageUploadFieldProps {
  value: string;
  onChange: (nextUrl: string) => void;
  category: BoxImageCategory;
  entityContext?: BoxUploadEntityContext;
  label?: string;
  previewShape?: 'rect' | 'circle';
  placeholder?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  value,
  onChange,
  category,
  entityContext,
  label = 'Photo (Upload Local File, Paste from Clipboard, or Paste URL)',
  previewShape = 'rect',
  placeholder = 'Optional: https://alabama.box.com/shared/static/... or image URL',
}) => {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'info' | 'err'; text: string } | null>(null);
  const [uploadAsPrivate, setUploadAsPrivate] = useState<boolean>(Boolean(entityContext?.isPrivate));

  // Optional Box -> Web Image Picker when linked to an entity folder
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerPath, setPickerPath] = useState('');
  const [pickerShareUrl, setPickerShareUrl] = useState(entityContext?.boxFolderUrl || '');
  const [pickerEntries, setPickerEntries] = useState<BoxFolderEntry[]>([]);
  const [folderHistory, setFolderHistory] = useState<Array<{ folderId: string; path: string }>>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    setUploadAsPrivate(Boolean(entityContext?.isPrivate));
  }, [entityContext?.isPrivate]);

  const targetBoxPathPreview = entityContext?.category
    ? getExpectedBoxFolderPath(
        entityContext.category,
        entityContext.itemName || category,
        entityContext.itemId || 'Item',
        uploadAsPrivate
      )
    : `01_Website_Images/${category}`;

  const processFile = async (file: File) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await uploadImageWithBoxFallback(
        file,
        category,
        entityContext
          ? {
              category: entityContext.category,
              itemId: entityContext.itemId,
              itemName: entityContext.itemName,
              isPrivate: uploadAsPrivate,
            }
          : undefined
      );
      onChange(res.url);
      setStatusMsg({
        type: 'ok',
        text: res.uploadedToBox
          ? `Uploaded to UA Box (${targetBoxPathPreview}) & ready to save.`
          : 'Loaded image locally & ready to save.',
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'err',
        text: err?.message || 'Image upload failed. Try a smaller image (<5MB) or paste a URL.',
      });
    } finally {
      setBusy(false);
    }
  };

  const loadEntityBoxImages = async (opts?: { folderId?: string; folderPath?: string; pushHistory?: boolean }) => {
    if (!entityContext?.category) return;
    setPickerLoading(true);
    setPickerError('');
    const subName =
      entityContext.itemName || entityContext.itemId
        ? buildEntityBoxFolderName(entityContext.itemName, entityContext.itemId || 'Item')
        : undefined;
    const res = await listBoxFolderContents({
      folderId: opts?.folderId,
      category: opts?.folderId ? undefined : entityContext.category,
      folderName: opts?.folderId ? undefined : subName,
      folderPath: opts?.folderPath,
      isPrivate: uploadAsPrivate,
    });
    setPickerLoading(false);
    if (!res.ok) {
      setPickerError(res.error || 'Could not browse Box folder yet.');
      setPickerEntries([]);
      return;
    }
    if (opts?.pushHistory && res.folderId) {
      setFolderHistory(prev => [...prev, { folderId: res.folderId!, path: res.folderPath || 'Box' }]);
    }
    setPickerPath(res.folderPath || targetBoxPathPreview);
    if (res.shareUrl) setPickerShareUrl(res.shareUrl);
    setPickerEntries(res.entries || []);
  };

  const handleAttachBoxImage = async (entry: BoxFolderEntry) => {
    setLinkingId(entry.id);
    const linkRes = await getBoxFileShareLinks(entry.id, uploadAsPrivate);
    setLinkingId(null);
    const chosenUrl = linkRes.directUrl || linkRes.shareUrl || entry.directUrl || entry.shareUrl || '';
    if (!linkRes.ok || !chosenUrl) {
      setPickerError(linkRes.error || 'Unable to generate image link from Box.');
      return;
    }
    onChange(chosenUrl);
    setStatusMsg({ type: 'ok', text: `Linked image from UA Box: ${entry.name}` });
    setPickerOpen(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files as ArrayLike<File>);
    const file = files.find(f => f.type.startsWith('image/'));
    if (file) processFile(file);
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData
      ? Array.from(e.clipboardData.items as ArrayLike<DataTransferItem>)
      : [];
    const imgItem = items.find(it => it.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      const blob = imgItem.getAsFile();
      if (blob) {
        const ext = blob.type.split('/')[1] || 'png';
        const file = new File([blob], `pasted_${Date.now()}.${ext}`, { type: blob.type });
        processFile(file);
      }
    }
  };

  const handlePasteButton = async () => {
    setStatusMsg(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setStatusMsg({
          type: 'info',
          text: 'Click this box and press Ctrl+V (or Cmd+V on Mac) to paste a copied image.',
        });
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split('/')[1] || 'png';
          const file = new File([blob], `clipboard_${Date.now()}.${ext}`, { type: imgType });
          await processFile(file);
          return;
        }
      }
      setStatusMsg({
        type: 'info',
        text: 'No image found in clipboard. Copy an image or screenshot first, or press Ctrl+V inside this box.',
      });
    } catch {
      setStatusMsg({
        type: 'info',
        text: 'Click inside this box and press Ctrl+V (Windows) / Cmd+V (Mac) to paste your copied photo.',
      });
    }
  };

  const hasValue = Boolean(value && value.trim());
  const resolvedPreview = hasValue ? resolveAssetUrl(value) : '';

  return (
    <div
      tabIndex={0}
      onPaste={handlePasteEvent}
      onDragOver={e => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border p-3 space-y-2.5 focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/40 transition-colors ${
        dragging ? 'bg-red-50/50 border-[#9E1B32]' : 'bg-slate-50 border-gray-200'
      }`}
    >
      {entityContext && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-gray-200/80 text-[10px]">
          <span className="inline-flex items-center gap-1.5 font-mono text-slate-600 truncate">
            {uploadAsPrivate ? (
              <Lock className="w-3 h-3 text-amber-700 shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-emerald-700 shrink-0" />
            )}
            <span className="font-bold text-slate-700">Box Target:</span>
            <span className="truncate">{targetBoxPathPreview}</span>
          </span>
          <div className="inline-flex items-center rounded-md border border-gray-300 bg-white overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setUploadAsPrivate(false)}
              className={`px-2 py-0.5 font-bold inline-flex items-center gap-1 cursor-pointer ${
                !uploadAsPrivate ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe className="w-2.5 h-2.5" /> Public
            </button>
            <button
              type="button"
              onClick={() => setUploadAsPrivate(true)}
              className={`px-2 py-0.5 font-bold inline-flex items-center gap-1 cursor-pointer ${
                uploadAsPrivate ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Lock className="w-2.5 h-2.5" /> Private
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[#9E1B32]" />
          <span>{label}</span>
        </label>
        {hasValue && (
          <button
            type="button"
            onClick={() => {
              const prevVal = value;
              onChange('');
              if (isDeletableBoxFileUrl(prevVal)) {
                deleteBoxFileFromUrl(prevVal).then(ok => {
                  setStatusMsg(
                    ok
                      ? { type: 'info', text: 'Photo removed from website & moved to Box Trash.' }
                      : null
                  );
                });
              } else {
                setStatusMsg(null);
              }
            }}
            className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> {isDeletableBoxFileUrl(value) ? 'Remove & Delete from Box' : 'Clear Photo'}
          </button>
        )}
      </div>

      {hasValue && resolvedPreview && (
        <div className="bg-white border border-gray-200 rounded-lg p-2 flex items-center gap-3">
          <img
            src={resolvedPreview}
            alt="Selected preview"
            referrerPolicy="no-referrer"
            className={
              previewShape === 'circle'
                ? 'w-16 h-16 rounded-full object-cover border border-gray-200 shrink-0'
                : 'w-28 h-20 rounded object-contain bg-slate-50 border border-gray-100 shrink-0'
            }
          />
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-bold text-slate-800">Image Ready</p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {value.startsWith('data:') ? 'Local / Clipboard Image' : value}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>{busy ? 'Uploading...' : 'Upload from Computer'}</span>
          <input type="file" accept="image/*" onChange={handleFileInput} disabled={busy} className="hidden" />
        </label>

        {entityContext && (
          <button
            type="button"
            onClick={() => {
              const next = !pickerOpen;
              setPickerOpen(next);
              if (next) {
                setFolderHistory([]);
                loadEntityBoxImages();
              }
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              pickerOpen
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Pick from Box Folder</span>
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={handlePasteButton}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-gray-300 text-slate-700 text-xs font-bold cursor-pointer"
          title="Paste copied image or screenshot (or press Ctrl+V)"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-[#9E1B32]" />
          <span>Paste Clipboard Image</span>
        </button>

        <span className="text-[10px] text-slate-500 font-medium">
          or drag &amp; drop / press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[9px]">Ctrl+V</kbd>
        </span>
      </div>

      {pickerOpen && entityContext && (
        <div className="bg-white border border-blue-200 rounded-lg p-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
            <span className="font-mono text-[11px] text-slate-600 truncate">📁 {pickerPath || targetBoxPathPreview}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {folderHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextHist = folderHistory.slice(0, -1);
                    setFolderHistory(nextHist);
                    const prev = nextHist[nextHist.length - 1];
                    loadEntityBoxImages(prev ? { folderId: prev.folderId, folderPath: prev.path } : undefined);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const cur = folderHistory[folderHistory.length - 1];
                  loadEntityBoxImages(cur ? { folderId: cur.folderId, folderPath: cur.path } : undefined);
                }}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${pickerLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              {sanitizeExternalUrl(entityContext.boxFolderUrl || pickerShareUrl) && (
                <a
                  href={sanitizeExternalUrl(entityContext.boxFolderUrl || pickerShareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Open Box
                </a>
              )}
            </div>
          </div>

          {pickerLoading ? (
            <div className="py-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Loading folder...
            </div>
          ) : pickerError ? (
            <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded">{pickerError}</p>
          ) : pickerEntries.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic text-center py-2">
              Folder is empty. Drop large photos into this Box folder and click Refresh.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded">
              {pickerEntries.map(entry =>
                entry.type === 'folder' ? (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() =>
                      loadEntityBoxImages({
                        folderId: entry.id,
                        folderPath: `${pickerPath}/${entry.name}`,
                        pushHistory: true,
                      })
                    }
                    className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-blue-50/50 text-left cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 truncate inline-flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {entry.name}
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold">Open &rarr;</span>
                  </button>
                ) : (
                  <div key={entry.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate">{entry.name}</p>
                      <p className="text-[10px] text-slate-400">{formatBoxFileSize(entry.size)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={linkingId === entry.id}
                      onClick={() => handleAttachBoxImage(entry)}
                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Link2 className="w-3 h-3" /> Use Photo
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      <input
        type="text"
        value={value.startsWith('data:') ? '' : value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#9E1B32]"
      />

      {statusMsg && (
        <p
          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded border ${
            statusMsg.type === 'err'
              ? 'bg-red-50 border-red-200 text-red-700'
              : statusMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {statusMsg.text}
        </p>
      )}

      {isBoxSharePageNotDirectFile(value) && (
        <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 leading-snug">
          Note: Box <code>/s/...</code> links are webpages, not raw image URLs. For URLs, use Box <strong>Direct Link</strong> (<code>.../shared/static/...</code>) or just upload/paste the image directly above!
        </p>
      )}
    </div>
  );
};
