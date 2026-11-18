import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  Plus,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { Instrument, InstrumentResourceItem, InstrumentStatus, User } from '../types';
import { getInstrumentStatusMeta, INSTRUMENT_STATUS_OPTIONS } from '../lib/instrumentUtils';
import { isResolvableResourceUrl, isSafeDataDocumentUrl, openOrDownloadResource, resolveAssetUrl, sanitizeExternalUrl } from '../lib/boxUtils';
import { ImageUploadField } from './ImageUploadField';
import { BoxUploadButton } from './BoxUploadButton';

interface InstrumentSubPageProps {
  instrument: Instrument;
  currentUser: User | null;
  canEdit: boolean;
  primaryColor?: string;
  resolveInstrumentImage: (imagePath: string) => string;
  onBack: () => void;
  onUpdateInstrument: (updated: Instrument) => void;
  onLoginClick: () => void;
}

type InstrumentSubTab = 'overview' | 'resources';

const RESOURCE_CATEGORIES: InstrumentResourceItem['category'][] = [
  'Manual',
  'Tutorial',
  'SOP',
  'Software',
  'Dataset',
  'Other',
];

function getNormalizedResources(inst: Instrument): InstrumentResourceItem[] {
  const existing = Array.isArray(inst.resources) ? inst.resources : [];
  if (existing.length > 0) return existing;
  if (inst.manualLink && inst.manualLink.trim()) {
    return [
      {
        id: `legacy-manual-${inst.id}`,
        title: `${inst.name} — Operating Manual`,
        url: inst.manualLink.trim(),
        category: 'Manual',
        visibility: 'public',
        description: 'Manufacturer operating guide and technical reference document.',
      },
    ];
  }
  return [];
}

export const InstrumentSubPage: React.FC<InstrumentSubPageProps> = ({
  instrument,
  currentUser,
  canEdit,
  primaryColor = '#9E1B32',
  resolveInstrumentImage,
  onBack,
  onUpdateInstrument,
  onLoginClick,
}) => {
  const [activeTab, setActiveTab] = useState<InstrumentSubTab>('overview');
  const [imgFailed, setImgFailed] = useState(false);

  // Edit overview modal state
  const [editingOverview, setEditingOverview] = useState(false);
  const [draftName, setDraftName] = useState(instrument.name);
  const [draftCategory, setDraftCategory] = useState(instrument.category);
  const [draftStatus, setDraftStatus] = useState<InstrumentStatus>(instrument.status || 'field-ready');
  const [draftStatusNote, setDraftStatusNote] = useState(instrument.statusNote || '');
  const [draftSummary, setDraftSummary] = useState(instrument.description);
  const [draftDetailed, setDraftDetailed] = useState(
    instrument.detailedDescription || instrument.description
  );
  const [draftImage, setDraftImage] = useState(instrument.image);

  // Add / Edit resource item modal state
  const [resourceModal, setResourceModal] = useState<{
    open: boolean;
    existing: InstrumentResourceItem | null;
  }>({ open: false, existing: null });
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resCategory, setResCategory] = useState<InstrumentResourceItem['category']>('Manual');
  const [resVisibility, setResVisibility] = useState<'public' | 'members'>('public');
  const [resDesc, setResDesc] = useState('');

  const resources = getNormalizedResources(instrument);
  const publicCount = resources.filter(r => r.visibility === 'public').length;
  const privateCount = resources.filter(r => r.visibility === 'members').length;

  const descriptionParagraphs = (instrument.detailedDescription || instrument.description || '')
    .split(/\n{2,}|\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const openEditOverview = () => {
    setDraftName(instrument.name);
    setDraftCategory(instrument.category);
    setDraftStatus(instrument.status || 'field-ready');
    setDraftStatusNote(instrument.statusNote || '');
    setDraftSummary(instrument.description);
    setDraftDetailed(instrument.detailedDescription || instrument.description);
    setDraftImage(instrument.image);
    setEditingOverview(true);
  };

  const handleSaveOverview = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateInstrument({
      ...instrument,
      name: draftName.trim() || instrument.name,
      category: draftCategory.trim() || instrument.category,
      status: draftStatus,
      statusNote: draftStatus === 'field-ready' ? undefined : (draftStatusNote.trim() || undefined),
      description: draftSummary.trim() || instrument.description,
      detailedDescription: draftDetailed.trim() || draftSummary.trim(),
      image: draftImage.trim(),
    });
    setImgFailed(false);
    setEditingOverview(false);
  };

  const openResourceModal = (existing: InstrumentResourceItem | null) => {
    if (existing) {
      setResTitle(existing.title);
      setResUrl(existing.url);
      setResCategory(existing.category);
      setResVisibility(existing.visibility);
      setResDesc(existing.description || '');
    } else {
      setResTitle('');
      setResUrl('');
      setResCategory('Manual');
      setResVisibility('public');
      setResDesc('');
    }
    setResourceModal({ open: true, existing });
  };

  const persistResources = (nextResources: InstrumentResourceItem[]) => {
    const firstPublicManual = nextResources.find(
      r => r.visibility === 'public' && (r.category === 'Manual' || r.category === 'SOP')
    );
    onUpdateInstrument({
      ...instrument,
      resources: nextResources,
      manualLink: firstPublicManual ? firstPublicManual.url : instrument.manualLink,
    });
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) {
      alert('Please upload a file, paste a clipboard image, or enter a resource URL.');
      return;
    }
    if (!isResolvableResourceUrl(resUrl)) {
      alert('Please provide a valid http(s) URL or upload a valid document/image file.');
      return;
    }
    const newItem: InstrumentResourceItem = {
      id: resourceModal.existing?.id || `inst-res-${Date.now()}`,
      title: resTitle.trim(),
      url: resUrl.trim(),
      category: resCategory,
      visibility: resVisibility,
      description: resDesc.trim() || undefined,
    };
    const nextList = resourceModal.existing
      ? resources.map(r => (r.id === newItem.id ? newItem : r))
      : [...resources, newItem];
    persistResources(nextList);
    setResourceModal({ open: false, existing: null });
  };

  const handleDeleteResource = (item: InstrumentResourceItem) => {
    if (!confirm(`Remove "${item.title}" from this instrument's resources?`)) return;
    persistResources(resources.filter(r => r.id !== item.id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* Top Crimson Instrument Header */}
      <div className="rounded-2xl border border-gray-200 shadow-xs overflow-hidden bg-white">
        <div className="p-5 md:p-7 space-y-4 text-white" style={{ backgroundColor: primaryColor }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-white/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Instruments</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-white/25 bg-white/15 text-white uppercase tracking-wider">
                {instrument.category}
              </span>
              {(() => {
                const statusMeta = getInstrumentStatusMeta(instrument.status);
                return (
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 ${statusMeta.headerBadgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                    <span>{statusMeta.bannerLabel}</span>
                  </span>
                );
              })()}
              {canEdit && (
                <button
                  type="button"
                  onClick={openEditOverview}
                  className="text-xs font-bold bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  style={{ color: primaryColor }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Description &amp; Specs</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-100 block mb-1">
              ERSL Field Instrumentation &amp; Facility
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{instrument.name}</h2>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div className="px-5 md:px-6 py-3 bg-slate-50/70 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-white border-transparent shadow-xs'
                  : 'text-slate-700 border-gray-200 bg-white hover:bg-slate-100'
              }`}
              style={activeTab === 'overview' ? { backgroundColor: primaryColor } : undefined}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Overview &amp; Specifications</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('resources')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'resources'
                  ? 'text-white border-transparent shadow-xs'
                  : 'text-slate-700 border-gray-200 bg-white hover:bg-slate-100'
              }`}
              style={activeTab === 'resources' ? { backgroundColor: primaryColor } : undefined}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Manuals, Tutorials &amp; Materials ({resources.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Globe className="w-3 h-3" /> {publicCount} Public
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Lock className="w-3 h-3" /> {privateCount} Private
            </span>
          </div>
        </div>
      </div>

      {/* Status Notice Banner when under repair / calibration / out of service */}
      {instrument.status && instrument.status !== 'field-ready' && (() => {
        const statusMeta = getInstrumentStatusMeta(instrument.status);
        return (
          <div className={`rounded-xl border px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2 ${statusMeta.alertBoxClass}`}>
            <div className="flex items-center gap-2 font-bold">
              <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
              <span>Status: {statusMeta.label}</span>
              {instrument.statusNote && <span className="font-medium">— {instrument.statusNote}</span>}
            </div>
            {canEdit && (
              <button type="button" onClick={openEditOverview} className="underline font-extrabold cursor-pointer">
                Update Status
              </button>
            )}
          </div>
        );
      })()}

      {/* TAB 1: OVERVIEW & DETAILED DESCRIPTION */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-7 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-xl border border-gray-200 bg-slate-50 p-4 flex items-center justify-center min-h-[260px]">
              {instrument.image && (instrument.image.startsWith('http') || instrument.image.startsWith('data:') || instrument.image.includes('.')) ? (
                <img
                  src={
                    imgFailed
                      ? 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=800&q=80'
                      : resolveAssetUrl(resolveInstrumentImage(instrument.image))
                  }
                  onError={() => setImgFailed(true)}
                  alt={instrument.name}
                  className="max-w-full max-h-72 w-auto h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center space-y-2 py-8">
                  <span className="text-4xl block">🛰️</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{instrument.category}</span>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                <h3 className="text-base font-extrabold uppercase tracking-wider" style={{ color: primaryColor }}>
                  Instrument Overview &amp; Capabilities
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={openEditOverview}
                    className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> Edit Description
                  </button>
                )}
              </div>

              <div className="space-y-3 text-sm text-slate-700 leading-relaxed text-justify">
                {descriptionParagraphs.map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Looking for operating guides, SOPs, or training videos?
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('resources')}
                  className="text-xs font-extrabold px-3.5 py-2 rounded-lg text-white cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Open Manuals &amp; Tutorials ({resources.length}) &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PUBLIC & PRIVATE MANUALS, TUTORIALS & MATERIALS */}
      {activeTab === 'resources' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Manuals, Tutorials &amp; Useful Materials ({resources.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 text-justify">
                Public guides are available to all visitors; internal training tutorials, calibration SOPs, and private lab files are visible only after signing in via the ERSL Member Portal.
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => openResourceModal(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-2 rounded-lg cursor-pointer shadow-xs hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Manual / Tutorial</span>
              </button>
            )}
          </div>

          {resources.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-gray-200 space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600">No manuals or tutorials added yet.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openResourceModal(null)}
                  className="text-xs font-bold px-3.5 py-2 rounded-lg text-white cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Add First Material Link
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources.map(item => {
                const isPrivate = item.visibility === 'members';
                const canAccessUrl = !isPrivate || Boolean(currentUser);
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                      isPrivate ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50/60 border-gray-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white border border-gray-200 text-slate-700">
                            {item.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              isPrivate
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                            <span>{isPrivate ? 'Private · Members Only' : 'Public'}</span>
                          </span>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openResourceModal(item)}
                              className="p-1 bg-white hover:bg-blue-50 text-blue-600 rounded border border-gray-200 cursor-pointer"
                              title="Edit Resource"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteResource(item)}
                              className="p-1 bg-white hover:bg-red-50 text-red-600 rounded border border-gray-200 cursor-pointer"
                              title="Delete Resource"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs text-slate-600 leading-relaxed text-justify">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-gray-200/70">
                      {canAccessUrl ? (
                        isSafeDataDocumentUrl(item.url) ? (
                          <button
                            type="button"
                            onClick={() => openOrDownloadResource(item.url, item.title)}
                            className="inline-flex items-center gap-1.5 text-xs font-extrabold hover:underline cursor-pointer"
                            style={{ color: primaryColor }}
                          >
                            <span>Open / Download {item.category}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        ) : sanitizeExternalUrl(item.url) ? (
                          <a
                            href={sanitizeExternalUrl(item.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-extrabold hover:underline"
                            style={{ color: primaryColor }}
                          >
                            <span>Open {item.category}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Invalid resource URL</span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={onLoginClick}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Member Login Required to Access Link</span>
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

      {/* MODAL 1: EDIT INSTRUMENT OVERVIEW */}
      {editingOverview && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 text-white flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
              <h3 className="text-sm font-black uppercase tracking-wider">Edit Instrument Description &amp; Details</h3>
              <button type="button" onClick={() => setEditingOverview(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveOverview} className="p-5 space-y-4 overflow-y-auto text-xs text-left">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Instrument Name</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={draftCategory}
                    onChange={e => setDraftCategory(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Operational Status</label>
                  <select
                    value={draftStatus}
                    onChange={e => setDraftStatus(e.target.value as InstrumentStatus)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#9E1B32]"
                  >
                    {INSTRUMENT_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {draftStatus !== 'field-ready' && (
                <div>
                  <label className="font-bold text-amber-800 block mb-1">Repair / Status Note (Optional)</label>
                  <input
                    type="text"
                    value={draftStatusNote}
                    onChange={e => setDraftStatusNote(e.target.value)}
                    placeholder="e.g., Sensor battery/gimbal under repair until Dec 2026"
                    className="w-full p-2.5 border border-amber-200 bg-amber-50/40 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
              )}

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
                  Detailed Instrument Description &amp; Technical Specifications (Justified on sub-page)
                </label>
                <textarea
                  rows={6}
                  value={draftDetailed}
                  onChange={e => setDraftDetailed(e.target.value)}
                  placeholder="Enter full specifications, sensor capabilities, deployment protocols, and accuracy notes..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <ImageUploadField
                label="Instrument Photo"
                category="Instruments"
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
                  Save Instrument Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT PUBLIC OR PRIVATE MANUAL / TUTORIAL */}
      {resourceModal.open && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
            <div className="px-5 py-4 text-white flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
              <h3 className="text-sm font-black uppercase tracking-wider">
                {resourceModal.existing ? 'Edit Material Link' : 'Add Manual, Tutorial or Material'}
              </h3>
              <button
                type="button"
                onClick={() => setResourceModal({ open: false, existing: null })}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveResource} className="p-5 space-y-3.5 text-xs text-left">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Title</label>
                <input
                  type="text"
                  value={resTitle}
                  onChange={e => setResTitle(e.target.value)}
                  required
                  placeholder="e.g., Manufacturer Operating Manual (PDF) or Calibration Video"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Material Type</label>
                  <select
                    value={resCategory}
                    onChange={e => setResCategory(e.target.value as InstrumentResourceItem['category'])}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#9E1B32]"
                  >
                    {RESOURCE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Access Visibility</label>
                  <select
                    value={resVisibility}
                    onChange={e => setResVisibility(e.target.value as 'public' | 'members')}
                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#9E1B32]"
                  >
                    <option value="public">Public (Visible to Anyone)</option>
                    <option value="members">Private (ERSL Members Only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Document / Tutorial File or URL *</label>
                <input
                  type="text"
                  value={resUrl.startsWith('data:') ? '' : resUrl}
                  onChange={e => setResUrl(e.target.value)}
                  placeholder="https://... or upload PDF / guide / photo below"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
                <BoxUploadButton
                  destination="general"
                  currentValue={resUrl}
                  onClear={() => setResUrl('')}
                  onUploaded={(url) => setResUrl(url)}
                  label="Upload Manual / PDF / Photo"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Notes / Usage Description (Optional)</label>
                <textarea
                  rows={2}
                  value={resDesc}
                  onChange={e => setResDesc(e.target.value)}
                  placeholder="Brief description of what this manual or tutorial covers..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setResourceModal({ open: false, existing: null })}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-white font-bold cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
