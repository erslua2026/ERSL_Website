import React, { useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { BoxFileDestination, BoxImageCategory, uploadDocumentToBox } from '../lib/boxSync';

interface BoxUploadButtonProps {
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>;
  label?: string;
  accept?: string;
  onUploaded: (url: string, fileName: string) => void;
}

export const BoxUploadButton: React.FC<BoxUploadButtonProps> = ({
  destination,
  label = 'Upload File to Box',
  accept = '*/*',
  onUploaded,
}) => {
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setStatusMsg(null);
    try {
      const res = await uploadDocumentToBox(file, destination);
      onUploaded(res.url, res.fileName);
      setStatusMsg(`Uploaded to UA Box: ${file.name}`);
    } catch (err: any) {
      setStatusMsg(err?.message || 'Upload pending UA OIT Box approval — paste a Box link for now.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <label className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-300 bg-slate-900 hover:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer transition-colors">
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
        <span>{uploading ? 'Uploading to UA Box...' : label}</span>
        <input
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {statusMsg && (
        <p className={`text-[10px] font-semibold ${statusMsg.startsWith('Uploaded') ? 'text-emerald-700' : 'text-amber-700'}`}>
          {statusMsg}
        </p>
      )}
    </div>
  );
};

