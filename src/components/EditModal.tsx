import React, { useState, useEffect } from 'react';
import { X, Save, Edit, Plus, Sparkles, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { Publication, DataLayer, ResearchTheme, Instrument, Person, FormerStint, ProjectInvestigator } from '../types';
import { getLocalTodayYmd, graduatePersonToFormer, inferAlumniRoleFromRoleText } from '../lib/peopleUtils';
import { formatInvestigatorsSummary, parseLegacyInvestigators } from '../lib/projectSubPageUtils';
import { INSTRUMENT_STATUS_OPTIONS } from '../lib/instrumentUtils';
import { DuplicateMatchResult, decodeHtmlEntities, extractNormalizedDoi, findDuplicatePublication } from '../lib/publicationUtils';
import { resolveReferenceUrl } from '../lib/boxUtils';
import { BoxUploadButton } from './BoxUploadButton';
import { ImageUploadField } from './ImageUploadField';

export type DuplicateResolutionAction = 'update' | 'replace' | 'remove-existing';

interface EditModalProps {
  type: 'publication' | 'data-layer' | 'research-theme' | 'project' | 'instrument' | 'person' | 'software' | 'teaching';
  item: any; // null if adding new
  themes?: ResearchTheme[];
  existingPublications?: Publication[];
  defaultPersonGroup?: 'member' | 'collaborator' | 'former';
  initialPersonGroupOverride?: 'member' | 'collaborator' | 'former';
  onSave: (savedItem: any) => void;
  onResolvePublicationDuplicate?: (
    action: DuplicateResolutionAction,
    duplicateId: string,
    newItem: Publication
  ) => void;
  onClose: () => void;
}

export const EditModal: React.FC<EditModalProps> = ({
  type,
  item,
  themes = [],
  existingPublications = [],
  defaultPersonGroup = 'member',
  initialPersonGroupOverride,
  onSave,
  onResolvePublicationDuplicate,
  onClose,
}) => {
  const [formData, setFormData] = useState<any>({});
  const [doiQuery, setDoiQuery] = useState('');
  const [isFetchingDoi, setIsFetchingDoi] = useState(false);
  const [doiFetchMsg, setDoiFetchMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicateMatchResult | null>(null);

  const extractDoi = (input: string): string | null => {
    const match = input.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
    return match ? match[0] : null;
  };

  const handleAutoFetchDoi = async () => {
    if (!doiQuery.trim()) return;
    setIsFetchingDoi(true);
    setDoiFetchMsg({ type: 'info', text: '🔍 Querying global CrossRef and OpenAlex academic registries...' });

    const cleanDoi = extractDoi(doiQuery);

    try {
      if (cleanDoi) {
        // Query CrossRef
        const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
        if (res.ok) {
          const json = await res.json();
          const itemData = json.message;
          if (itemData) {
            const authorsList = (itemData.author || [])
              .map((a: any) => `${a.family || ''}${a.given ? ', ' + a.given : ''}`)
              .filter(Boolean)
              .join('; ') || 'Liu, H. et al.';
            const venue = itemData['container-title']?.[0] || itemData.publisher || 'Journal';
            const year = itemData.published?.['date-parts']?.[0]?.[0] || itemData['published-print']?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
            const title = (itemData.title?.[0] || '').replace(/<[^>]*>/g, '');
            const link = itemData.URL || `https://doi.org/${cleanDoi}`;
            const isConf = itemData.type === 'proceedings-article';

            setFormData((prev: any) => ({
              ...prev,
              title: decodeHtmlEntities(title) || prev.title,
              authors: decodeHtmlEntities(authorsList) || prev.authors,
              venue: decodeHtmlEntities(venue) || prev.venue,
              year: Number(year) || prev.year,
              doi: cleanDoi.toLowerCase(),
              link: link || prev.link,
              type: isConf ? 'Conference' : 'Peer-Reviewed Article',
              abstract: itemData.abstract ? decodeHtmlEntities(itemData.abstract.replace(/<[^>]*>/g, '')) : prev.abstract
            }));
            setDoiFetchMsg({ type: 'success', text: `✅ Successfully fetched "${title.slice(0, 45)}..." from CrossRef!` });
            setIsFetchingDoi(false);
            return;
          }
        }
      }

      // Fallback 1: Query OpenAlex by search query or URL
      const cleanSearch = doiQuery
        .replace(/https?:\/\/scholar\.google\.com\/[^\s]*/gi, '')
        .replace(/[+]/g, ' ')
        .trim() || doiQuery;

      const openAlexUrl = cleanDoi
        ? `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`
        : `https://api.openalex.org/works?search=${encodeURIComponent(cleanSearch)}&per_page=1`;

      try {
        const oaRes = await fetch(openAlexUrl);
        if (oaRes.ok) {
          const oaJson = await oaRes.json();
          const w = cleanDoi ? oaJson : oaJson.results?.[0];
          if (w && (w.title || w.display_name)) {
            const authors = (w.authorships || [])
              .map((a: any) => a.author?.display_name)
              .filter(Boolean)
              .slice(0, 6)
              .join(', ') || 'Liu, H. et al.';
            const venue = w.primary_location?.source?.display_name || 'Academic Journal';
            const year = w.publication_year || new Date().getFullYear();
            const title = w.title || w.display_name || '';
            const link = w.doi || w.primary_location?.landing_page_url || (cleanDoi ? `https://doi.org/${cleanDoi}` : '');
            const isConf = w.type === 'proceedings-article' || w.type === 'conference-paper';

            setFormData((prev: any) => ({
              ...prev,
              title: decodeHtmlEntities(title) || prev.title,
              authors: decodeHtmlEntities(authors) || prev.authors,
              venue: decodeHtmlEntities(venue) || prev.venue,
              year: Number(year) || prev.year,
              doi: extractNormalizedDoi(w.doi || cleanDoi || link) || prev.doi,
              link: link || prev.link,
              type: isConf ? 'Conference' : 'Peer-Reviewed Article',
            }));
            setDoiFetchMsg({ type: 'success', text: `✅ Successfully fetched "${title.slice(0, 45)}..." from OpenAlex!` });
            setIsFetchingDoi(false);
            return;
          }
        }
      } catch { }

      // Fallback 2: Query CrossRef bibliographic search
      try {
        const crSearchRes = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(cleanSearch)}&rows=1`);
        if (crSearchRes.ok) {
          const crJson = await crSearchRes.json();
          const itemData = crJson.message?.items?.[0];
          if (itemData && itemData.title?.[0]) {
            const authorsList = (itemData.author || [])
              .map((a: any) => `${a.family || ''}${a.given ? ', ' + a.given : ''}`)
              .filter(Boolean)
              .join('; ') || 'Liu, H. et al.';
            const venue = itemData['container-title']?.[0] || itemData.publisher || 'Journal';
            const year = itemData.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
            const title = (itemData.title[0] || '').replace(/<[^>]*>/g, '');
            const link = itemData.URL || (itemData.DOI ? `https://doi.org/${itemData.DOI}` : '');
            const isConf = itemData.type === 'proceedings-article';

            setFormData((prev: any) => ({
              ...prev,
              title: decodeHtmlEntities(title) || prev.title,
              authors: decodeHtmlEntities(authorsList) || prev.authors,
              venue: decodeHtmlEntities(venue) || prev.venue,
              year: Number(year) || prev.year,
              doi: extractNormalizedDoi(itemData.DOI || link) || prev.doi,
              link: link || prev.link,
              type: isConf ? 'Conference' : 'Peer-Reviewed Article',
              abstract: itemData.abstract ? decodeHtmlEntities(itemData.abstract.replace(/<[^>]*>/g, '')) : prev.abstract
            }));
            setDoiFetchMsg({ type: 'success', text: `✅ Successfully fetched "${title.slice(0, 45)}..." from CrossRef registry!` });
            setIsFetchingDoi(false);
            return;
          }
        }
      } catch { }

      setDoiFetchMsg({ type: 'error', text: '⚠️ Could not automatically resolve publication metadata. You can enter the title, authors, and venue manually below.' });
    } catch (err: any) {
      setDoiFetchMsg({ type: 'error', text: `⚠️ Fetch notice: ${err.message || 'Network notice'}. You can still fill in the details manually below.` });
    } finally {
      setIsFetchingDoi(false);
    }
  };

  useEffect(() => {
    if (item) {
      if (type === 'person') {
        const nextGroup = initialPersonGroupOverride || item.group || 'member';
        const todayYmd = getLocalTodayYmd();
        const existingStints: FormerStint[] =
          Array.isArray(item.formerStints) && item.formerStints.length > 0
            ? item.formerStints
            : nextGroup === 'former'
              ? [{ role: item.role || 'MS', years: item.formerYears || '', topic: item.formerTopic || item.researchFocus || '' }]
              : [];
        setFormData({
          ...item,
          group: nextGroup,
          // If converting back from Former -> Team, clear a past graduation date so auto-graduation won't immediately re-trigger
          expectedGraduationDate:
            nextGroup === 'member' && item.expectedGraduationDate && item.expectedGraduationDate <= todayYmd
              ? ''
              : item.expectedGraduationDate,
          formerStints: existingStints,
        });
      } else if (type === 'project') {
        const existingInvs: ProjectInvestigator[] =
          Array.isArray(item.subPage?.investigators) && item.subPage.investigators.length > 0
            ? item.subPage.investigators
            : parseLegacyInvestigators(item.subPage?.piInfo, item.details);
        setFormData({
          ...item,
          sponsor: item.sponsor || item.agency || '',
          period: item.period || item.subPage?.timeline || '',
          summary: item.summary || item.subPage?.summary || '',
          investigators:
            existingInvs.length > 0
              ? existingInvs
              : [{ id: `inv-${Date.now()}`, name: '', role: 'PI', affiliation: 'The University of Alabama' }],
        });
      } else {
        setFormData({ ...item });
      }
    } else {
      // Default blank values for adding new items
      if (type === 'publication') {
        setFormData({
          title: '',
          authors: '',
          venue: '',
          year: new Date().getFullYear(),
          type: 'Peer-Reviewed Article',
          link: ''
        });
      } else if (type === 'data-layer') {
        setFormData({
          name: '',
          description: '',
          availability: 'Public',
          link: ''
        });
      } else if (type === 'research-theme') {
        setFormData({
          title: '',
          description: '',
          keywords: '',
          image: ''
        });
      } else if (type === 'instrument') {
        setFormData({
          name: '',
          description: '',
          category: 'Field Sensors',
          status: 'field-ready',
          statusNote: '',
          image: 'gps'
        });
      } else if (type === 'person') {
        setFormData({
          name: '',
          role: '',
          department: '',
          institution: '',
          researchFocus: '',
          bio: '',
          email: '',
          scholar: '',
          linkedin: '',
          image: '',
          group: defaultPersonGroup,
          currentAffiliation: '',
          formerStints:
            defaultPersonGroup === 'former'
              ? [{ role: 'MS', years: String(new Date().getFullYear()), topic: '' }]
              : [],
        });
      } else if (type === 'software') {
        setFormData({
          title: '',
          description: '',
          language: 'Python',
          visibility: 'public',
          link: ''
        });
      } else if (type === 'teaching') {
        setFormData({
          title: '',
          course: '',
          description: '',
          link: '',
          updatedAt: new Date().toISOString().slice(0, 10)
        });
      } else if (type === 'project') {
        setFormData({
          title: '',
          sponsor: '',
          status: 'Active',
          period: '',
          summary: '',
          image: '',
          themeIds: themes.length > 0 ? [themes[0].id] : [],
          investigators: [
            { id: `inv-${Date.now()}`, name: '', role: 'PI', affiliation: 'The University of Alabama' },
          ],
          subPage: {
            tabVisibility: { overview: 'public', resources: 'public', events: 'public', datasets: 'members' },
            objectives: [],
            resources: [],
            events: [],
            datasets: []
          }
        });
      }
    }
  }, [item, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const livePublicationDuplicate =
    type === 'publication'
      ? findDuplicatePublication(formData, existingPublications, item?.id)
      : null;

  const buildCandidatePublication = (): Publication => {
    const cleanDoi =
      extractNormalizedDoi(formData.doi) ||
      extractNormalizedDoi(formData.link) ||
      extractNormalizedDoi(formData.title) ||
      undefined;
    const rawLink = typeof formData.link === 'string' ? formData.link.trim() : '';
    const resolvedExternal = rawLink && !rawLink.startsWith('data:') ? resolveReferenceUrl(rawLink) : rawLink;
    const finalLink = resolvedExternal || (cleanDoi ? `https://doi.org/${cleanDoi}` : '') || rawLink || undefined;
    return {
      ...formData,
      id: formData.id || `publication-${Date.now()}`,
      title: decodeHtmlEntities(formData.title || '').trim(),
      authors: decodeHtmlEntities(formData.authors || '').trim(),
      venue: decodeHtmlEntities(formData.venue || '').trim(),
      doi: cleanDoi,
      link: finalLink,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'publication') {
      const candidatePub = buildCandidatePublication();
      const dup = findDuplicatePublication(candidatePub, existingPublications, item?.id);
      if (dup) {
        setDuplicatePrompt(dup);
        return;
      }
      onSave(candidatePub);
      return;
    }

    // For research theme, convert keywords string to array
    if (type === 'research-theme' && typeof formData.keywords === 'string') {
      formData.keywords = formData.keywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k !== '');
    }

    if (type === 'project') {
      const selectedThemes: string[] = Array.isArray(formData.themeIds) ? formData.themeIds : [];
      if (themes.length > 0 && selectedThemes.length === 0) {
        alert('Please connect this project to at least one Research Theme.');
        return;
      }
      const cleanInvestigators: ProjectInvestigator[] = (
        Array.isArray(formData.investigators) ? formData.investigators : []
      )
        .map((inv: ProjectInvestigator) => ({
          ...inv,
          name: (inv.name || '').trim(),
          role: (inv.role || 'PI').trim(),
          affiliation: inv.affiliation?.trim() || undefined,
        }))
        .filter((inv: ProjectInvestigator) => inv.name);
      const piSummary = formatInvestigatorsSummary(cleanInvestigators);
      const cleanSponsor = (formData.sponsor || formData.agency || 'ERSL Grant').trim();
      const cleanPeriod = (formData.period || '').trim();
      const cleanSummary = (formData.summary || '').trim();
      const existingSub = formData.subPage || {
        tabVisibility: { overview: 'public', resources: 'public', events: 'public', datasets: 'members' },
        objectives: [],
        resources: [],
        events: [],
        datasets: [],
      };
      onSave({
        ...formData,
        id: formData.id || `${type}-${Date.now()}`,
        agency: cleanSponsor,
        sponsor: cleanSponsor,
        period: cleanPeriod || existingSub.timeline || undefined,
        summary: cleanSummary || existingSub.summary || '',
        details: piSummary || (formData.details || '').trim() || cleanSummary || '',
        subPage: {
          ...existingSub,
          summary: cleanSummary || existingSub.summary || '',
          piInfo: piSummary || existingSub.piInfo || formData.details || '',
          investigators: cleanInvestigators,
          timeline: cleanPeriod || existingSub.timeline || 'Active Research Grant',
        },
      });
      return;
    }

    if (type === 'person' && formData.group === 'former') {
      const cleanStints: FormerStint[] = (Array.isArray(formData.formerStints) ? formData.formerStints : [])
        .map((s: FormerStint) => ({
          role: (s.role || '').trim(),
          years: (s.years || '').trim(),
          topic: (s.topic || '').trim() || undefined,
        }))
        .filter((s: FormerStint) => s.role || s.years || s.topic);

      const primary = cleanStints[0];
      const nextPerson: Person = {
        ...formData,
        id: formData.id || `${type}-${Date.now()}`,
        group: 'former',
        formerStints: cleanStints,
        role: primary?.role || formData.role || 'Former Member',
        formerYears: primary?.years || formData.formerYears || undefined,
        formerTopic: primary?.topic || formData.formerTopic || undefined,
        currentAffiliation: (formData.currentAffiliation || '').trim() || undefined,
        researchFocus:
          cleanStints
            .map(s => s.topic)
            .filter(Boolean)
            .join('; ') ||
          formData.researchFocus ||
          '',
        bio: formData.bio || '',
      };
      onSave(nextPerson);
      return;
    }

    if (type === 'person' && formData.group !== 'former') {
      const candidate: Person = {
        ...formData,
        id: formData.id || `${type}-${Date.now()}`,
        group: formData.group || 'member',
        expectedGraduationDate: (formData.expectedGraduationDate || '').trim() || undefined,
        graduationDegree: (formData.graduationDegree || '').trim() || undefined,
        thesisTopic: (formData.thesisTopic || '').trim() || undefined,
        currentAffiliation: (formData.currentAffiliation || '').trim() || undefined,
      };
      const todayYmd = getLocalTodayYmd();
      if (
        candidate.group === 'member' &&
        candidate.expectedGraduationDate &&
        todayYmd >= candidate.expectedGraduationDate
      ) {
        onSave(graduatePersonToFormer(candidate, candidate.expectedGraduationDate));
        return;
      }
      onSave(candidate);
      return;
    }

    onSave({
      ...formData,
      id: formData.id || `${type}-${Date.now()}`
    });
  };

  const getTitle = () => {
    const isEdit = !!item;
    const action = isEdit ? 'Edit' : 'Add New';
    switch (type) {
      case 'publication': return `${action} Publication`;
      case 'data-layer': return `${action} Data Layer`;
      case 'research-theme': return `${action} Research Theme`;
      case 'project': return `${action} Research Project`;
      case 'instrument': return `${action} Research Instrument`;
      case 'person': return `${action} Team Member Profile`;
      case 'software': return `${action} Software Tool / Model`;
      case 'teaching': return `${action} Teaching Material`;
      default: return 'Edit Item';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">

        {/* Modal Header */}
        <div className="bg-[#9E1B32] text-white p-4 flex justify-between items-center">
          <h3 className="text-sm font-bold flex items-center space-x-1.5">
            <Edit className="w-4 h-4" />
            <span>{getTitle()}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto bg-slate-50 text-xs">

          {/* Publication Form Fields */}
          {type === 'publication' && (
            <>
              {/* ⚡ Auto-Fill from DOI or Google Scholar Link Banner */}
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-extrabold text-[#9E1B32]">
                  <Sparkles className="w-4 h-4 text-[#9E1B32] shrink-0" />
                  <span>Auto-Fill from DOI or Google Scholar Link</span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Paste a paper <strong>DOI</strong> (e.g. <code className="bg-white px-1 py-0.5 rounded border border-red-200 text-[#9E1B32]">10.1109/TGRS.2021.3079949</code> or <code className="bg-white px-1 py-0.5 rounded border border-red-200 text-[#9E1B32]">https://doi.org/...</code>) or Google Scholar article URL to auto-fill metadata instantly.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={doiQuery}
                    onChange={e => setDoiQuery(e.target.value)}
                    placeholder="Paste DOI or Google Scholar URL here..."
                    className="flex-1 p-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoFetchDoi}
                    disabled={!doiQuery.trim() || isFetchingDoi}
                    className="bg-[#9E1B32] hover:bg-red-800 disabled:opacity-50 text-white font-bold px-3 py-2 rounded text-xs cursor-pointer flex items-center space-x-1 shrink-0 shadow-2xs"
                  >
                    <span>{isFetchingDoi ? 'Fetching...' : '⚡ Auto-Fill'}</span>
                  </button>
                </div>
                {doiFetchMsg && (
                  <p className={`text-[11px] font-semibold ${doiFetchMsg.type === 'success' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded' :
                    doiFetchMsg.type === 'error' ? 'text-red-700 bg-red-100/60 border border-red-200 p-2 rounded' :
                      'text-blue-700 bg-blue-50 border border-blue-200 p-2 rounded'
                    }`}>
                    {doiFetchMsg.text}
                  </p>
                )}
              </div>

              {type === 'publication' && livePublicationDuplicate && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-950 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-xs">
                        Duplicate Publication Detected (Matches existing {livePublicationDuplicate.reason})
                      </p>
                      <p className="text-[11px] text-amber-900 mt-0.5 line-clamp-2">
                        <strong>[{livePublicationDuplicate.existing.year}]</strong> {livePublicationDuplicate.existing.title}
                      </p>
                      <p className="text-[10px] text-amber-800 mt-0.5">
                        Click Save below or choose how to resolve (Update existing or Remove duplicate).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDuplicatePrompt(livePublicationDuplicate)}
                      className="text-[11px] font-extrabold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg shrink-0 cursor-pointer"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Publication Title</label>
                <textarea
                  name="title"
                  value={formData.title || ''}
                  onChange={handleChange}
                  rows={2}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Authors (Comma separated)</label>
                <input
                  type="text"
                  name="authors"
                  placeholder="e.g., Liu, H., Purushothaman, N."
                  value={formData.authors || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Year</label>
                  <input
                    type="number"
                    name="year"
                    value={formData.year || new Date().getFullYear()}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Category Type</label>
                  <select
                    name="type"
                    value={formData.type || 'Peer-Reviewed Article'}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  >
                    <option value="Peer-Reviewed Article">Peer-Reviewed Article</option>
                    <option value="Conference">Conference Proceeding / Presentation</option>
                    <option value="Other">Other Publication / Report</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Journal Venue / Volume Details</label>
                <input
                  type="text"
                  name="venue"
                  placeholder="e.g., Remote Sensing of Environment, 250, 112000"
                  value={formData.venue || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">DOI (Optional, auto-linked to doi.org)</label>
                <input
                  type="text"
                  name="doi"
                  placeholder="e.g., 10.1109/TGRS.2021.3079949"
                  value={formData.doi || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">DOI / External URL or Upload Local PDF / File (Optional)</label>
                <input
                  type="text"
                  name="link"
                  placeholder="https://doi.org/... or upload a PDF/file below"
                  value={typeof formData.link === 'string' && formData.link.startsWith('data:') ? '' : (formData.link || '')}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
                <BoxUploadButton
                  destination="publications"
                  label="Upload Paper PDF / Document / Image"
                  accept=".pdf,.doc,.docx,.txt,.zip,image/*"
                  currentValue={formData.link}
                  onClear={() => setFormData((prev: any) => ({ ...prev, link: '' }))}
                  onUploaded={(url) => setFormData((prev: any) => ({ ...prev, link: url }))}
                />
              </div>
            </>
          )}

          {/* Data Layer Form Fields */}
          {type === 'data-layer' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Dataset Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g., Mobile River UAV Maps"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Description</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Availability Rights</label>
                <select
                  name="availability"
                  value={formData.availability || 'Public'}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                >
                  <option value="Public">Public (Anyone can access)</option>
                  <option value="Request">Request (Requires contact approval)</option>
                  <option value="Internal">Internal (Lab-members only)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Access Link or Upload Dataset / File (Optional)</label>
                <input
                  type="text"
                  name="link"
                  placeholder="https://... or upload a CSV / GeoJSON / ZIP / PDF below"
                  value={typeof formData.link === 'string' && formData.link.startsWith('data:') ? '' : (formData.link || '')}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
                <BoxUploadButton
                  destination="datasets"
                  entityContext={{
                    category: 'datasets',
                    itemId: formData.id,
                    itemName: formData.name,
                    isPrivate: formData.availability !== 'Public',
                    boxFolderUrl: formData.boxFolderUrl,
                  }}
                  label="Upload Local Dataset / File"
                  currentValue={formData.link}
                  onClear={() => setFormData((prev: any) => ({ ...prev, link: '' }))}
                  onUploaded={(url) => setFormData((prev: any) => ({ ...prev, link: url }))}
                />
              </div>
            </>
          )}

          {/* Research Theme Form Fields */}
          {type === 'research-theme' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Theme Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Card Description (Short Preview)</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Detailed Theme Overview (For Theme Sub-Page, Optional)</label>
                <textarea
                  name="overviewBody"
                  value={formData.overviewBody || ''}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Extended scientific narrative shown inside the Theme Overview sub-page..."
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Keywords (Comma separated list)</label>
                <input
                  type="text"
                  name="keywords"
                  placeholder="e.g., Remote Sensing, Hydrology, Deep Learning"
                  value={
                    Array.isArray(formData.keywords)
                      ? formData.keywords.join(', ')
                      : formData.keywords || ''
                  }
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <ImageUploadField
                value={formData.image || ''}
                onChange={nextImg => setFormData((prev: any) => ({ ...prev, image: nextImg }))}
                category="Research"
                label="Research Theme Banner Photo"
              />
            </>
          )}

          {/* Instrument Form Fields */}
          {type === 'instrument' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Equipment Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Instrument Category</label>
                  <input
                    type="text"
                    name="category"
                    placeholder="e.g., Hydrologic Field Sensors"
                    value={formData.category || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Operational Status</label>
                  <select
                    name="status"
                    value={formData.status || 'field-ready'}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  >
                    {INSTRUMENT_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(formData.status && formData.status !== 'field-ready') && (
                <div className="space-y-1">
                  <label className="block font-bold text-amber-800">Repair / Status Note (Optional)</label>
                  <input
                    type="text"
                    name="statusNote"
                    placeholder="e.g., Gimbal sent to manufacturer for service / ETA Dec 2026"
                    value={formData.statusNote || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-amber-50/50 border border-amber-200 rounded focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Card Summary &amp; Specifications</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Detailed Description (For Instrument Sub-Page, Optional)</label>
                <textarea
                  name="detailedDescription"
                  value={formData.detailedDescription || ''}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Full technical capabilities, SOP background, and deployment notes shown on the Instrument sub-page..."
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Operating Manual / SOP File or Link (Optional)</label>
                <input
                  type="text"
                  name="manualLink"
                  placeholder="https://... or upload PDF/manual/photo below"
                  value={typeof formData.manualLink === 'string' && formData.manualLink.startsWith('data:') ? '' : (formData.manualLink || '')}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
                <BoxUploadButton
                  destination="instruments"
                  entityContext={{
                    category: 'instruments',
                    itemId: formData.id,
                    itemName: formData.name,
                    isPrivate: false,
                    boxFolderUrl: formData.boxFolderUrl,
                  }}
                  label="Upload Operating Manual (PDF / Doc / Photo)"
                  accept=".pdf,.doc,.docx,.txt,.zip,image/*"
                  currentValue={formData.manualLink}
                  onClear={() => setFormData((prev: any) => ({ ...prev, manualLink: '' }))}
                  onUploaded={(url) => setFormData((prev: any) => ({ ...prev, manualLink: url }))}
                />
              </div>

              <ImageUploadField
                value={formData.image || ''}
                onChange={nextImg => setFormData((prev: any) => ({ ...prev, image: nextImg }))}
                category="Instruments"
                entityContext={{
                  category: 'instruments',
                  itemId: formData.id,
                  itemName: formData.name,
                  isPrivate: false,
                  boxFolderUrl: formData.boxFolderUrl,
                }}
                label="Equipment Display Image"
              />
            </>
          )}

          {/* Team Member / Person / Former Member Form Fields */}
          {type === 'person' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Listed Under</label>
                  <select
                    name="group"
                    value={formData.group || 'member'}
                    onChange={e => {
                      const nextGroup = e.target.value;
                      setFormData((prev: any) => {
                        const needsStint =
                          nextGroup === 'former' &&
                          (!Array.isArray(prev.formerStints) || prev.formerStints.length === 0);
                        return {
                          ...prev,
                          group: nextGroup,
                          formerStints: needsStint
                            ? [
                              {
                                role: prev.role || 'MS',
                                years: prev.formerYears || '',
                                topic: prev.formerTopic || prev.researchFocus || '',
                              },
                            ]
                            : prev.formerStints,
                        };
                      });
                    }}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  >
                    <option value="member">Team (Lab Member)</option>
                    <option value="collaborator">Collaborator</option>
                    <option value="former">Former Member / Alumni</option>
                  </select>
                </div>
              </div>

              {formData.group === 'former' ? (
                <>
                  <div className="space-y-2.5 bg-slate-50 border border-gray-200 rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-extrabold text-slate-800 text-xs">
                        Role(s), Years &amp; Topic Worked at ERSL
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev: any) => ({
                            ...prev,
                            formerStints: [
                              ...(Array.isArray(prev.formerStints) ? prev.formerStints : []),
                              { role: 'MS', years: '', topic: '' },
                            ],
                          }))
                        }
                        className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Role / Degree
                      </button>
                    </div>

                    <datalist id="ersl-former-role-suggestions">
                      <option value="MS" />
                      <option value="Ph.D." />
                      <option value="Research Scientist" />
                      <option value="Postdoctoral Researcher" />
                      <option value="Research Assistant" />
                      <option value="Visiting Scholar" />
                      <option value="Undergraduate Researcher" />
                    </datalist>

                    {(Array.isArray(formData.formerStints) && formData.formerStints.length > 0
                      ? formData.formerStints
                      : [{ role: 'MS', years: '', topic: '' }]
                    ).map((stint: FormerStint, idx: number) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            ERSL Entry #{idx + 1}
                          </span>
                          {(formData.formerStints?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev: any) => ({
                                  ...prev,
                                  formerStints: prev.formerStints.filter((_: any, i: number) => i !== idx),
                                }))
                              }
                              className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">
                              Role / Degree at ERSL *
                            </label>
                            <input
                              type="text"
                              list="ersl-former-role-suggestions"
                              placeholder="e.g., MS, Ph.D., Research Scientist"
                              value={stint.role || ''}
                              required
                              onChange={e => {
                                const val = e.target.value;
                                setFormData((prev: any) => {
                                  const next = [...(prev.formerStints || [])];
                                  next[idx] = { ...next[idx], role: val };
                                  return { ...prev, formerStints: next };
                                });
                              }}
                              className="w-full p-2 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">
                              Years / Completion Year *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., 2025 or 2025-2026"
                              value={stint.years || ''}
                              required
                              onChange={e => {
                                const val = e.target.value;
                                setFormData((prev: any) => {
                                  const next = [...(prev.formerStints || [])];
                                  next[idx] = { ...next[idx], years: val };
                                  return { ...prev, formerStints: next };
                                });
                              }}
                              className="w-full p-2 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Research Topic / Thesis Title (Optional)
                          </label>
                          <textarea
                            rows={2}
                            placeholder="e.g., Enhancement of Low-Fidelity Flood Inundation Mapping Through Surrogate Modeling"
                            value={stint.topic || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => {
                                const next = [...(prev.formerStints || [])];
                                next[idx] = { ...next[idx], topic: val };
                                return { ...prev, formerStints: next };
                              });
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">Current Affiliation / Position (Optional)</label>
                    <input
                      type="text"
                      name="currentAffiliation"
                      placeholder="e.g., Research Physical Scientist at NOAA OWP / Assistant Professor at ..."
                      value={formData.currentAffiliation || ''}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">
                      {formData.group === 'collaborator' ? 'Role / Academic Title *' : 'Academic Role *'}
                    </label>
                    <input
                      type="text"
                      name="role"
                      placeholder={formData.group === 'collaborator' ? 'e.g., Co-PI · Professor / Research Hydrologist' : 'e.g., Assistant Professor / PhD Candidate'}
                      value={formData.role || ''}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">
                        Department {formData.group === 'collaborator' ? '*' : '(Optional)'}
                      </label>
                      <input
                        type="text"
                        name="department"
                        placeholder={formData.group === 'collaborator' ? 'e.g., Dept. of Civil & Environmental Engineering' : 'e.g., Dept. of Geography & the Environment'}
                        value={formData.department || ''}
                        onChange={handleChange}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                        required={formData.group === 'collaborator'}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-gray-700">
                        Institute / University / Agency {formData.group === 'collaborator' ? '*' : '(Optional)'}
                      </label>
                      <input
                        type="text"
                        name="institution"
                        placeholder={formData.group === 'collaborator' ? 'e.g., NOAA OWP / USGS / Auburn University' : 'e.g., The University of Alabama'}
                        value={formData.institution || ''}
                        onChange={handleChange}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                        required={formData.group === 'collaborator'}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">
                      Research Focus Areas {formData.group === 'collaborator' ? '(Optional)' : '*'}
                    </label>
                    <input
                      type="text"
                      name="researchFocus"
                      placeholder="e.g., UAV mapping, satellite SAR hydrology"
                      value={formData.researchFocus || ''}
                      onChange={handleChange}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                      required={formData.group !== 'collaborator'}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-gray-700">
                      {formData.group === 'collaborator' ? 'Biography / Collaboration Scope (Optional)' : 'Biography / Research Background *'}
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio || ''}
                      onChange={handleChange}
                      rows={4}
                      placeholder={formData.group === 'collaborator' ? 'Joint grant research focus, field expertise, or lab partnership summary...' : ''}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                      required={formData.group !== 'collaborator'}
                    />
                  </div>

                  {(formData.group || 'member') === 'member' && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 block">
                          Auto-Move to Former Members Upon Graduation (Optional)
                        </span>
                        <span className="text-[11px] text-slate-600 leading-snug block mt-0.5">
                          Set a graduation/completion date below and this member will automatically move to <strong>Former Members</strong> on that date with their degree, research topic, and current affiliation.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Graduation / Transition Date
                          </label>
                          <input
                            type="date"
                            name="expectedGraduationDate"
                            value={formData.expectedGraduationDate || ''}
                            onChange={handleChange}
                            className="w-full p-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-1">
                            Degree / Role to Record
                          </label>
                          <input
                            type="text"
                            name="graduationDegree"
                            list="ersl-former-role-suggestions"
                            placeholder={inferAlumniRoleFromRoleText(formData.role) || 'e.g., MS, Ph.D., Research Scientist'}
                            value={formData.graduationDegree || ''}
                            onChange={handleChange}
                            className="w-full p-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Thesis / Research Topic on Graduation (defaults to Research Focus if blank)
                        </label>
                        <input
                          type="text"
                          name="thesisTopic"
                          placeholder="e.g., Satellite and Deep Learning Estimation of River Suspended Sediment"
                          value={formData.thesisTopic || ''}
                          onChange={handleChange}
                          className="w-full p-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Next / Current Affiliation (Optional)
                        </label>
                        <input
                          type="text"
                          name="currentAffiliation"
                          placeholder="e.g., Postdoctoral Fellow at ... / NOAA OWP"
                          value={formData.currentAffiliation || ''}
                          onChange={handleChange}
                          className="w-full p-2 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:border-[#9E1B32]"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Email Address (Optional)</label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g., student@ua.edu"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Google Scholar Profile Link</label>
                  <input
                    type="url"
                    name="scholar"
                    value={formData.scholar || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">LinkedIn Profile Link</label>
                  <input
                    type="url"
                    name="linkedin"
                    value={formData.linkedin || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
              </div>

              <ImageUploadField
                value={formData.image || ''}
                onChange={nextImg => setFormData((prev: any) => ({ ...prev, image: nextImg }))}
                category="People"
                entityContext={{
                  category: 'people',
                  itemId: formData.id,
                  itemName: formData.name,
                  isPrivate: false,
                  boxFolderUrl: formData.subPage?.boxFolderUrl,
                }}
                previewShape="circle"
                label="Profile Portrait Photo (Optional for Alumni/Collaborators)"
              />
            </>
          )}

          {/* Software Form Fields */}
          {type === 'software' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Software / Model Name</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g., reach-scale-river-depth-extractor"
                  value={formData.title || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Primary Programming Language</label>
                  <select
                    name="language"
                    value={formData.language || 'Python'}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  >
                    <option value="Python">Python</option>
                    <option value="R">R Language</option>
                    <option value="JavaScript">JavaScript (GEE)</option>
                    <option value="Other">Other Language</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Visibility Access</label>
                  <select
                    name="visibility"
                    value={formData.visibility || 'public'}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  >
                    <option value="public">Public (Visible to everyone)</option>
                    <option value="members">Members Only (Signed-in lab members)</option>
                    <option value="admin">Admin Only (Lab administrators)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Description & Release Features</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={4}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">GitHub Repository, Link, or Local Package / Guide Upload</label>
                <input
                  type="text"
                  name="link"
                  placeholder="https://github.com/... or upload script/ZIP/PDF below"
                  value={typeof formData.link === 'string' && formData.link.startsWith('data:') ? '' : (formData.link || '')}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
                <BoxUploadButton
                  destination="software"
                  entityContext={{
                    category: 'software',
                    itemId: formData.id,
                    itemName: formData.title,
                    isPrivate: Boolean(formData.visibility && formData.visibility !== 'public'),
                    boxFolderUrl: formData.boxFolderUrl,
                  }}
                  label="Upload Code / ZIP / Guide File"
                  currentValue={formData.link}
                  onClear={() => setFormData((prev: any) => ({ ...prev, link: '' }))}
                  onUploaded={(url) => setFormData((prev: any) => ({ ...prev, link: url }))}
                />
              </div>
            </>
          )}

          {/* Teaching Material Form Fields */}
          {type === 'teaching' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Resource / Handout Name</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g., Lab Guide 4: UAV Multispectral Calibration"
                  value={formData.title || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Course Affiliation / Subject</label>
                <input
                  type="text"
                  name="course"
                  placeholder="e.g., GY 404/504: Advanced Remote Sensing"
                  value={formData.course || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Syllabus Details & Practical Guidance</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={4}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Course File Upload or Link (PDF / Slides / Box)</label>
                <input
                  type="text"
                  name="link"
                  placeholder="https://... or upload syllabus/slides/PDF below"
                  value={typeof formData.link === 'string' && formData.link.startsWith('data:') ? '' : (formData.link || '')}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                />
                <BoxUploadButton
                  destination="teaching"
                  label="Upload Syllabus / Slides / Manual"
                  currentValue={formData.link}
                  onClear={() => setFormData((prev: any) => ({ ...prev, link: '' }))}
                  onUploaded={(url) => setFormData((prev: any) => ({ ...prev, link: url }))}
                />
              </div>
            </>
          )}

          {/* Research Project Form Fields */}
          {type === 'project' && (
            <>
              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Project Title *</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g., GeoAI High-Resolution Flood Inundation Mapping"
                  value={formData.title || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Sponsor / Agency *</label>
                  <input
                    type="text"
                    name="sponsor"
                    placeholder="NOAA / NASA / NSF"
                    value={formData.sponsor || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Status</label>
                  <select
                    name="status"
                    value={formData.status || 'Active'}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  >
                    <option value="Active">Active</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Pending">Pending / Upcoming</option>
                    <option value="Finished">Finished</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-gray-700">Period</label>
                  <input
                    type="text"
                    name="period"
                    placeholder="2024 - 2027"
                    value={formData.period || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  />
                </div>
              </div>

              {themes.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block font-bold text-gray-700">
                    Connected Research Themes * <span className="text-[10px] font-normal text-gray-500">(select at least one)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-2.5 rounded-lg border border-gray-200">
                    {themes.map(t => {
                      const currentIds: string[] = Array.isArray(formData.themeIds) ? formData.themeIds : [];
                      const checked = currentIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2 text-[11px] font-semibold p-1.5 rounded border cursor-pointer transition-colors ${checked ? 'bg-red-50 border-[#9E1B32] text-[#9E1B32]' : 'bg-white border-gray-200 text-gray-700'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? currentIds.filter(id => id !== t.id)
                                : [...currentIds, t.id];
                              setFormData((prev: any) => ({ ...prev, themeIds: next }));
                            }}
                          />
                          <span className="truncate">{t.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-extrabold text-slate-800 text-xs">
                    Principal Investigators (PI &amp; Co-PIs)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev: any) => ({
                        ...prev,
                        investigators: [
                          ...(Array.isArray(prev.investigators) ? prev.investigators : []),
                          { id: `inv-${Date.now()}`, name: '', role: 'Co-PI', affiliation: '' },
                        ],
                      }))
                    }
                    className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Investigator
                  </button>
                </div>
                <div className="space-y-2">
                  {(Array.isArray(formData.investigators) ? formData.investigators : []).map((inv: ProjectInvestigator, idx: number) => (
                    <div key={inv.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-white p-2 rounded-lg border border-gray-200">
                      <select
                        value={inv.role}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData((prev: any) => ({
                            ...prev,
                            investigators: prev.investigators.map((x: ProjectInvestigator, i: number) => (i === idx ? { ...x, role: val } : x)),
                          }));
                        }}
                        className="sm:col-span-3 p-1.5 border border-gray-300 rounded text-xs font-bold bg-slate-50"
                      >
                        <option value="PI">PI</option>
                        <option value="Co-PI">Co-PI</option>
                        <option value="Co-Investigator">Co-Investigator</option>
                        <option value="Lead Researcher">Lead Researcher</option>
                        <option value="Senior Personnel">Senior Personnel</option>
                        <option value="Collaborator">Collaborator</option>
                      </select>
                      <input
                        value={inv.name}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData((prev: any) => ({
                            ...prev,
                            investigators: prev.investigators.map((x: ProjectInvestigator, i: number) => (i === idx ? { ...x, name: val } : x)),
                          }));
                        }}
                        placeholder="Full Name (e.g., Dr. Hongxing Liu)"
                        className="sm:col-span-4 p-1.5 border border-gray-300 rounded text-xs"
                      />
                      <input
                        value={inv.affiliation || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData((prev: any) => ({
                            ...prev,
                            investigators: prev.investigators.map((x: ProjectInvestigator, i: number) => (i === idx ? { ...x, affiliation: val } : x)),
                          }));
                        }}
                        placeholder="Institution (Optional)"
                        className="sm:col-span-4 p-1.5 border border-gray-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        disabled={(formData.investigators?.length || 0) <= 1}
                        onClick={() =>
                          setFormData((prev: any) => ({
                            ...prev,
                            investigators: prev.investigators.filter((_: any, i: number) => i !== idx),
                          }))
                        }
                        className="sm:col-span-1 p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-30 cursor-pointer flex justify-center text-xs font-bold"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-gray-700">Project Summary *</label>
                <textarea
                  name="summary"
                  rows={3}
                  value={formData.summary || ''}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <ImageUploadField
                  value={formData.image || ''}
                  onChange={nextImg => setFormData((prev: any) => ({ ...prev, image: nextImg }))}
                  category="Projects"
                  entityContext={{
                    category: 'projects',
                    itemId: formData.id,
                    itemName: formData.title,
                    isPrivate: false,
                    boxFolderUrl: formData.subPage?.boxFolderUrl,
                  }}
                  label="Project Banner Photo (Optional — Upload, Paste Clipboard, or URL)"
                />
                <p className="text-[10px] text-gray-500">
                  Tip: Open any project card after saving to customize its sub-pages, text paragraphs, collaborators, datasets, software, and meeting notes.
                </p>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold transition-all hover:cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#9E1B32] hover:bg-red-800 text-white rounded font-bold shadow-md transition-all hover:cursor-pointer flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>

      </div>

      {/* Duplicate Publication Pop-up Dialog */}
      {duplicatePrompt && type === 'publication' && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[80] animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full overflow-hidden text-left animate-in zoom-in-95 duration-150">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-extrabold text-sm">Duplicate Publication Found</h4>
              </div>
              <button
                type="button"
                onClick={() => setDuplicatePrompt(null)}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                This publication matches an existing record by{' '}
                <strong className="text-amber-800">{duplicatePrompt.reason}</strong>. Would you like to update the existing record or remove the duplicate?
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Existing Record ({duplicatePrompt.existing.year})
                </span>
                <p className="font-extrabold text-slate-900 leading-snug">
                  {duplicatePrompt.existing.title}
                </p>
                <p className="text-[11px] text-slate-600">
                  {duplicatePrompt.existing.authors} · <span className="italic">{duplicatePrompt.existing.venue}</span>
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const candidate = buildCandidatePublication();
                    if (onResolvePublicationDuplicate) {
                      onResolvePublicationDuplicate('update', duplicatePrompt.existing.id, candidate);
                    } else {
                      onSave({ ...candidate, id: duplicatePrompt.existing.id });
                    }
                    setDuplicatePrompt(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#9E1B32] hover:bg-red-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Update Existing Record with These Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const candidate = buildCandidatePublication();
                    if (onResolvePublicationDuplicate) {
                      onResolvePublicationDuplicate('remove-existing', duplicatePrompt.existing.id, candidate);
                    }
                    setDuplicatePrompt(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Existing Duplicate Record</span>
                </button>

                {!item && (
                  <button
                    type="button"
                    onClick={() => {
                      const candidate = buildCandidatePublication();
                      if (onResolvePublicationDuplicate) {
                        onResolvePublicationDuplicate('replace', duplicatePrompt.existing.id, candidate);
                      } else {
                        onSave(candidate);
                      }
                      setDuplicatePrompt(null);
                    }}
                    className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Replace Duplicate with This New Entry</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSave(buildCandidatePublication());
                      setDuplicatePrompt(null);
                    }}
                    className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Keep Both Anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicatePrompt(null)}
                    className="py-2 px-3 rounded-lg border border-gray-300 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer"
                  >
                    Back to Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
