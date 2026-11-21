import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ClipboardPaste,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  Globe,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  BoxEntityCategory,
  BoxFileDestination,
  BoxFolderEntry,
  BoxImageCategory,
  buildEntityBoxFolderName,
  ENTITY_CATEGORY_ROOTS,
  formatBoxFileSize,
  getBoxFileShareLinks,
  getExpectedBoxFolderPath,
  listBoxFolderContents,
  uploadDocumentWithBoxFallback,
} from '../lib/boxSync';
import { getUploadedFileLabel, sanitizeExternalUrl } from '../lib/boxUtils';

export interface BoxUploadEntityContext {
  category: BoxEntityCategory;
  itemId?: string;
  itemName?: string;
  isPrivate?: boolean;
  boxFolderUrl?: string;
}

interface BoxUploadButtonProps {
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>;
  label?: string;
  accept?: string;
  currentValue?: string;
  entityContext?: BoxUploadEntityContext;
  onClear?: () => void;
  onUploaded: (url: string, fileName: string) => void;
}

function inferCategoryFromDestination(
  dest: string,
  ctx?: BoxUploadEntityContext
): BoxEntityCategory | undefined {
  if (ctx?.category) return ctx.category;
  if (dest.startsWith('people/') || dest.startsWith('students/') || dest === 'people') return 'people';
  if (dest.startsWith('projects/') || dest === 'projects') return 'projects';
  if (dest.startsWith('instruments/') || dest === 'instruments') return 'instruments';
  if (dest.startsWith('datasets/') || dest === 'datasets') return 'datasets';
  if (dest.startsWith('software/') || dest === 'software') return 'software';
  return undefined;
}

export const BoxUploadButton: React.FC<BoxUploadButtonProps> = ({
  destination,
  label = 'Upload Local File / Document',
  accept = '*/*',
  currentValue,
  entityContext,
  onClear,
  onUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'info' | 'err'; text: string } | null>(null);

  // Box -> Web Browser State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerCategory, setPickerCategory] = useState<BoxEntityCategory>(
    inferCategoryFromDestination(destination, entityContext) || 'projects'
  );
  const [pickerPath, setPickerPath] = useState('');
  const [pickerShareUrl, setPickerShareUrl] = useState(entityContext?.boxFolderUrl || '');
  const [pickerEntries, setPickerEntries] = useState<BoxFolderEntry[]>([]);
  const [folderHistory, setFolderHistory] = useState<Array<{ folderId: string; path: string }>>([]);
  const [linkingFileId, setLinkingFileId] = useState<string | null>(null);

  const defaultPrivacy = Boolean(
    entityContext?.isPrivate ??
      (destination === 'workplan' ||
        destination === 'bulletins' ||
        destination === 'teaching' ||
        destination.startsWith('people/') ||
        destination.startsWith('students/') ||
        destination.startsWith('projects/'))
  );
  const [uploadAsPrivate, setUploadAsPrivate] = useState<boolean>(defaultPrivacy);

  useEffect(() => {
    setUploadAsPrivate(defaultPrivacy);
  }, [defaultPrivacy]);

  const effectiveUploadDestination = (
    entityContext?.category && (entityContext.itemName || entityContext.itemId)
      ? `${entityContext.category}/${buildEntityBoxFolderName(entityContext.itemName, entityContext.itemId || 'Item')}`
      : destination
  ) as Exclude<BoxFileDestination, `images/${BoxImageCategory}`>;

  const inferredCat = inferCategoryFromDestination(effectiveUploadDestination, entityContext);
  const targetBoxPathPreview = inferredCat
    ? getExpectedBoxFolderPath(
        inferredCat,
        entityContext?.itemName || inferredCat,
        entityContext?.itemId || 'Item',
        uploadAsPrivate
      )
    : `06_Website_Data_Sync/${destination}`;

  const processFile = async (file: File) => {
    setUploading(true);
    setStatusMsg(null);
    try {
      const res = await uploadDocumentWithBoxFallback(file, effectiveUploadDestination, {
        isPrivate: uploadAsPrivate,
      });
      onUploaded(res.url, res.fileName);
      setStatusMsg({
        type: 'ok',
        text: res.uploadedToBox
          ? `Uploaded to UA Box (${uploadAsPrivate ? 'Private' : 'Public'} · ${targetBoxPathPreview}): ${file.name}`
          : `Attached locally & ready to save (${uploadAsPrivate ? 'Private' : 'Public'}): ${file.name}`,
      });
      if (pickerOpen) {
        loadBoxFolder({
          category: pickerCategory,
          isPrivate: uploadAsPrivate,
          folderName: entityContext?.itemName
            ? buildEntityBoxFolderName(entityContext.itemName, entityContext.itemId || 'Item')
            : undefined,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'err',
        text:
          err?.message ||
          'File exceeds 3.5MB browser fallback. Drop it into your Box folder and click "Browse Box Folder" to link it here.',
      });
    } finally {
      setUploading(false);
    }
  };

  const loadBoxFolder = async (opts: {
    folderId?: string;
    category?: BoxEntityCategory;
    folderName?: string;
    folderPath?: string;
    isPrivate?: boolean;
    pushHistory?: boolean;
  }) => {
    setPickerLoading(true);
    setPickerError('');
    const res = await listBoxFolderContents({
      folderId: opts.folderId,
      category: opts.category,
      folderName: opts.folderName,
      folderPath: opts.folderPath,
      isPrivate: opts.isPrivate ?? uploadAsPrivate,
    });
    setPickerLoading(false);

    if (!res.ok) {
      setPickerError(res.error || 'Could not browse Box folder.');
      setPickerEntries([]);
      return;
    }

    if (opts.pushHistory && res.folderId) {
      setFolderHistory(prev => [...prev, { folderId: res.folderId!, path: res.folderPath || 'Box' }]);
    }
    setPickerPath(res.folderPath || ENTITY_CATEGORY_ROOTS[opts.category || pickerCategory]);
    if (res.shareUrl) setPickerShareUrl(res.shareUrl);
    setPickerEntries(res.entries || []);
  };

  const handleOpenPicker = () => {
    const nextOpen = !pickerOpen;
    setPickerOpen(nextOpen);
    if (nextOpen) {
      const initialCat = inferCategoryFromDestination(destination, entityContext) || 'projects';
      setPickerCategory(initialCat);
      setFolderHistory([]);
      const subName =
        entityContext?.category === initialCat && (entityContext.itemName || entityContext.itemId)
          ? buildEntityBoxFolderName(entityContext.itemName, entityContext.itemId || 'Item')
          : undefined;
      loadBoxFolder({ category: initialCat, folderName: subName });
    }
  };

  const handleAttachBoxFile = async (entry: BoxFolderEntry) => {
    setLinkingFileId(entry.id);
    const linkRes = await getBoxFileShareLinks(entry.id, uploadAsPrivate);
    setLinkingFileId(null);
    const chosenUrl =
      linkRes.shareUrl || linkRes.directUrl || entry.shareUrl || entry.directUrl || '';
    if (!linkRes.ok || !chosenUrl) {
      setPickerError(linkRes.error || 'Unable to create shared link for this Box file.');
      return;
    }
    onUploaded(chosenUrl, entry.name);
    setStatusMsg({
      type: 'ok',
      text: `Linked from UA Box: ${entry.name} (${formatBoxFileSize(entry.size)})`,
    });
    setPickerOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData
      ? Array.from(e.clipboardData.items as ArrayLike<DataTransferItem>)
      : [];
    const fileItem = items.find(it => it.kind === 'file');
    if (fileItem) {
      const blob = fileItem.getAsFile();
      if (blob) {
        e.preventDefault();
        const ext = blob.type.split('/')[1] || 'png';
        const fileName = blob.name && blob.name !== 'image.png' ? blob.name : `pasted_${Date.now()}.${ext}`;
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
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
          text: 'Click inside this upload box and press Ctrl+V (Cmd+V on Mac) to paste a copied image.',
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
        text: 'No image found in clipboard. Copy a screenshot/photo first, or press Ctrl+V here.',
      });
    } catch {
      setStatusMsg({
        type: 'info',
        text: 'Click this box and press Ctrl+V (Cmd+V on Mac) to paste your copied screenshot or file.',
      });
    }
  };

  const isLocalDataAttached = Boolean(currentValue && currentValue.startsWith('data:'));
  const directFolderHref = sanitizeExternalUrl(entityContext?.boxFolderUrl || pickerShareUrl);

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
      className={`mt-1.5 rounded-lg border p-2.5 space-y-2 focus:outline-none focus:ring-2 focus:ring-[#9E1B32]/30 transition-colors ${
        dragging ? 'bg-red-50/50 border-[#9E1B32]' : 'bg-slate-50 border-slate-200'
      }`}
    >
      {/* Explicit Box Privacy & Folder Target Strip */}
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
            title="Save to 01_Public folder with open shared link"
          >
            <Globe className="w-2.5 h-2.5" /> Public
          </button>
          <button
            type="button"
            onClick={() => setUploadAsPrivate(true)}
            className={`px-2 py-0.5 font-bold inline-flex items-center gap-1 cursor-pointer ${
              uploadAsPrivate ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Save to 02_Private_Members folder with restricted access"
          >
            <Lock className="w-2.5 h-2.5" /> Private
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer transition-colors">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
          <span>{uploading ? 'Processing...' : label}</span>
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            disabled={uploading}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={handleOpenPicker}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
            pickerOpen
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
          }`}
          title="Browse files already stored in UA Box (>3MB supported) and attach them to the website"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Browse Box Folder (Box &rarr; Web)</span>
        </button>

        {directFolderHref && (
          <a
            href={directFolderHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-white hover:bg-slate-100 border border-gray-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700"
            title="Open this item's dedicated Box folder to drop >3MB files"
          >
            <ExternalLink className="w-3 h-3 text-blue-600" />
            <span>Open Box Folder</span>
          </a>
        )}

        <button
          type="button"
          disabled={uploading}
          onClick={handlePasteButton}
          className="inline-flex items-center gap-1.5 rounded-md bg-white hover:bg-slate-100 border border-gray-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
          title="Paste copied screenshot or image from clipboard (Ctrl+V)"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-[#9E1B32]" />
          <span>Paste Image</span>
        </button>
      </div>

      {pickerOpen && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['people', 'projects', 'instruments', 'datasets', 'software'] as BoxEntityCategory[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setPickerCategory(cat);
                    setFolderHistory([]);
                    loadBoxFolder({ category: cat });
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                    pickerCategory === cat
                      ? 'bg-[#9E1B32] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {ENTITY_CATEGORY_ROOTS[cat]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {folderHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextHist = folderHistory.slice(0, -1);
                    setFolderHistory(nextHist);
                    const prev = nextHist[nextHist.length - 1];
                    if (prev) {
                      loadBoxFolder({ folderId: prev.folderId, folderPath: prev.path });
                    } else {
                      loadBoxFolder({ category: pickerCategory });
                    }
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  loadBoxFolder({
                    folderId: folderHistory[folderHistory.length - 1]?.folderId,
                    category: pickerCategory,
                  })
                }
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                title="Refresh Box folder contents"
              >
                <RefreshCw className={`w-3 h-3 ${pickerLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="font-mono truncate">📁 {pickerPath || ENTITY_CATEGORY_ROOTS[pickerCategory]}</span>
            {sanitizeExternalUrl(pickerShareUrl) && (
              <a
                href={sanitizeExternalUrl(pickerShareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3" /> Open in Box
              </a>
            )}
          </div>

          {pickerLoading ? (
            <div className="py-4 text-center text-slate-500 flex items-center justify-center gap-2 text-[11px]">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Reading Box folder contents...</span>
            </div>
          ) : pickerError ? (
            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
              <p className="font-bold">Box API Folder Listing Notice</p>
              <p>{pickerError}</p>
              <p className="text-[10px] text-amber-800">
                Tip: If Box App credentials are still pending, open your UA Box folder in another tab, copy the file’s Box Shared Link, and paste it into the link field above.
              </p>
            </div>
          ) : pickerEntries.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-3 text-center">
              This Box folder is empty. Upload a file into Box and click Refresh to attach it here.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-md">
              {pickerEntries.map(entry =>
                entry.type === 'folder' ? (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() =>
                      loadBoxFolder({
                        folderId: entry.id,
                        folderPath: `${pickerPath}/${entry.name}`,
                        pushHistory: true,
                      })
                    }
                    className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-blue-50/60 text-left cursor-pointer"
                  >
                    <span className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{entry.name}</span>
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold shrink-0">Open &rarr;</span>
                  </button>
                ) : (
                  <div
                    key={entry.id}
                    className="px-2.5 py-2 flex items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{entry.name}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 pl-5">
                        {formatBoxFileSize(entry.size)}
                        {entry.modifiedAt ? ` · ${entry.modifiedAt.slice(0, 10)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={linkingFileId === entry.id}
                      onClick={() => handleAttachBoxFile(entry)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {linkingFileId === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Link2 className="w-3 h-3" />
                      )}
                      <span>Attach</span>
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {isLocalDataAttached && (
        <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 text-[11px] font-bold text-emerald-800">
          <span className="inline-flex items-center gap-1.5 truncate">
            <FileCheck2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>{getUploadedFileLabel(currentValue)} ready</span>
          </span>
          {onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setStatusMsg(null);
              }}
              className="text-red-600 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {statusMsg && (
        <p
          className={`text-[10px] font-semibold ${
            statusMsg.type === 'err'
              ? 'text-red-700'
              : statusMsg.type === 'ok'
                ? 'text-emerald-700'
                : 'text-blue-700'
          }`}
        >
          {statusMsg.text}
        </p>
      )}
    </div>
  );
};
