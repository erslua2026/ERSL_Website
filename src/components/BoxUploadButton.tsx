import React, { useState } from 'react';
import { ClipboardPaste, FileCheck2, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { BoxFileDestination, BoxImageCategory, uploadDocumentWithBoxFallback } from '../lib/boxSync';
import { getUploadedFileLabel } from '../lib/boxUtils';

interface BoxUploadButtonProps {
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>;
  label?: string;
  accept?: string;
  currentValue?: string;
  onClear?: () => void;
  onUploaded: (url: string, fileName: string) => void;
}

export const BoxUploadButton: React.FC<BoxUploadButtonProps> = ({
  destination,
  label = 'Upload Local File / Document',
  accept = '*/*',
  currentValue,
  onClear,
  onUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'info' | 'err'; text: string } | null>(null);

  const processFile = async (file: File) => {
    setUploading(true);
    setStatusMsg(null);
    try {
      const res = await uploadDocumentWithBoxFallback(file, destination);
      onUploaded(res.url, res.fileName);
      setStatusMsg({
        type: 'ok',
        text: res.uploadedToBox
          ? `Uploaded to UA Box: ${file.name}`
          : `Attached locally & ready to save: ${file.name}`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'err',
        text: err?.message || 'File upload failed. Try a file under 3.5MB or paste an external/Box link.',
      });
    } finally {
      setUploading(false);
    }
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
          disabled={uploading}
          onClick={handlePasteButton}
          className="inline-flex items-center gap-1.5 rounded-md bg-white hover:bg-slate-100 border border-gray-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
          title="Paste copied screenshot or image from clipboard (Ctrl+V)"
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-[#9E1B32]" />
          <span>Paste Clipboard Image</span>
        </button>

        <span className="text-[10px] text-slate-500 font-medium">
          or drag &amp; drop / press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-[9px]">Ctrl+V</kbd>
        </span>
      </div>

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
