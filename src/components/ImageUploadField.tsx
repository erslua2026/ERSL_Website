import React, { useState } from 'react';
import { ClipboardPaste, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { BoxImageCategory, uploadImageWithBoxFallback } from '../lib/boxSync';
import { isBoxSharePageNotDirectFile, resolveAssetUrl } from '../lib/boxUtils';

interface ImageUploadFieldProps {
  value: string;
  onChange: (nextUrl: string) => void;
  category: BoxImageCategory;
  label?: string;
  previewShape?: 'rect' | 'circle';
  placeholder?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  value,
  onChange,
  category,
  label = 'Photo (Upload Local File, Paste from Clipboard, or Paste URL)',
  previewShape = 'rect',
  placeholder = 'Optional: https://alabama.box.com/shared/static/... or image URL',
}) => {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'info' | 'err'; text: string } | null>(null);

  const processFile = async (file: File) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await uploadImageWithBoxFallback(file, category);
      onChange(res.url);
      setStatusMsg({
        type: 'ok',
        text: res.uploadedToBox
          ? 'Uploaded to UA Box & ready to save.'
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[#9E1B32]" />
          <span>{label}</span>
        </label>
        {hasValue && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setStatusMsg(null);
            }}
            className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> Clear Photo
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
