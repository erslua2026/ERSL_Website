import React, { useState, useEffect } from 'react';
import {
  Plus, Edit, Edit2, Trash2, Calendar, FileText, Search, Download, ExternalLink,
  Mail, Users, Award, ShieldAlert, GraduationCap, Check, HelpCircle,
  FolderGit2, Lock, Eye, AlertCircle, FileCode, CheckCircle2, ChevronRight, Sliders, Play, Info,
  RefreshCw, X, Copy
} from 'lucide-react';

import { UAHeader } from './components/UAHeader';
import { UASSO } from './components/UASSO';
import { BoxExplorer } from './components/BoxExplorer';
import { AdminDashboard } from './components/AdminDashboard';
import { EditModal } from './components/EditModal';
import { SubPageHeader } from './components/SubPageHeader';

import {
  initialThemes, initialProjects, initialPublications, initialSoftware,
  initialDataLayers, initialInstruments, initialPeople, initialBoxFiles, initialAuditLogs
} from './data/initialData';

import {
  User, Role, ResearchTheme, Project, Publication, Software,
  DataLayer, Instrument, Person, BoxFile, AuditLog,
  SiteConfig, CustomPageData, BulletinItem, TabConfig, PageHeaderConfig
} from './types';
import { newsItems, NewsItem } from './data/news';
import { defaultSiteConfig, defaultCustomPages } from './data/defaultSiteConfig';
import { NewsModal } from './components/NewsModal';
import { BulletinModal } from './components/BulletinModal';
import { ProjectSubPage } from './components/ProjectSubPage';
import { ThemeSubPage } from './components/ThemeSubPage';
import { InstrumentSubPage } from './components/InstrumentSubPage';
import { CustomPageView } from './components/CustomPageView';
import { SiteCustomizerModal } from './components/SiteCustomizerModal';
import { resolveAssetUrl } from './lib/boxUtils';
import { LoginModal } from './components/LoginModal';
import { UpdatePasswordModal } from './components/UpdatePasswordModal';
import { Workplan } from './components/Workplan';
import { ReservoirProject } from './components/ReservoirProject';
import { BoxFolders } from './components/BoxFolders';
import { MemberManager } from './components/MemberManager';
import { ProfessionalDevelopment } from './components/ProfessionalDevelopment';
import { supabase, fetchProfile, profileToUser } from './lib/supabase';
import { getCloudData, setCloudData, getLastCloudError } from './lib/cloudStore';
import { getLastBoxStatus } from './lib/boxSync';
import { ImageUploadField } from './components/ImageUploadField';
import { buildSiteSearchItems, SiteSearchItem } from './lib/siteSearch';
import { applyAutoGraduation } from './lib/peopleUtils';

// Helper to resolve image paths (local folder under public/images/{category} vs base64/URL assets)
const resolveImagePath = (
  imagePath: string | undefined,
  category: 'home' | 'research' | 'instruments' | 'people'
): string => {
  if (!imagePath) return '';
  const trimmed = imagePath.trim();
  if (!trimmed) return '';
  // Absolute /images/... or relative images/... paths must be re-based so they work under a sub-path (GitHub Pages /ERSL/)
  const base = import.meta.env.BASE_URL;
  if (trimmed.startsWith('/images/')) {
    return `${base}${trimmed.slice(1)}`;
  }
  if (trimmed.startsWith('images/')) {
    return `${base}${trimmed}`;
  }
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  // Otherwise, map to the designated local public images folder
  return `${base}images/${category}/${trimmed}`;
};

const isMockPublication = (p: Publication): boolean =>
  !p || p.id === 'pub-0';

const reconstructAbstract = (invertedIndex?: Record<string, number[]> | null): string => {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const wordsByPos: { [pos: number]: string } = {};
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        wordsByPos[pos] = word;
      }
    }
  }
  const sorted = Object.keys(wordsByPos)
    .map(Number)
    .sort((a, b) => a - b);
  const text = sorted.map(pos => wordsByPos[pos]).join(' ');
  return text.length > 550 ? text.slice(0, 550) + '...' : text;
};

const getCleanInitials = (name?: string): string => {
  if (!name) return 'UA';
  const parts = name.split(' ').filter(p => {
    const lower = p.toLowerCase().replace(/\./g, '');
    return !['dr', 'prof', 'professor', 'phd', 'candidate', 'postdoc', 'researcher'].includes(lower);
  });
  if (parts.length === 0) return 'UA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function App() {
  // Global States (with LocalStorage persistence for testing)
  // Real login: the user comes from the Supabase session (see effect below), never from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [peopleSubTab, setPeopleSubTab] = useState<'member' | 'collaborator' | 'former'>('member');
  const [personGroupOverride, setPersonGroupOverride] = useState<'member' | 'collaborator' | 'former' | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('ersl_tab');
    return saved || 'home';
  });

  const [showSSOPopup, setShowSSOPopup] = useState(false);
  const [showUpdatePasswordModal, setShowUpdatePasswordModal] = useState(() => {
    return window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token');
  });
  const [editMode, setEditMode] = useState(false);
  const isAdmin = currentUser?.role === 'Admin';

  const CORE_THEME_IDS = new Set(initialThemes.map(t => t.id));
  const isLegacyRemovedTheme = (t: ResearchTheme): boolean => {
    if (CORE_THEME_IDS.has(t.id)) return false;
    if (t.id.startsWith('theme-')) return true;
    const title = (t.title || '').toLowerCase();
    return (
      title.includes('lake morphology') ||
      title.includes('ai for river and lake') ||
      title.includes('ai & cloud geo-sensing') ||
      title.includes('lake & reservoir hydrology') ||
      title.includes('coastal & estuarine optics') ||
      title.includes('uav & bathymetric surveying')
    );
  };
  const normalizeThemes = (raw?: ResearchTheme[] | null): ResearchTheme[] => {
    if (!Array.isArray(raw) || raw.length === 0) return initialThemes;
    const cleanedRaw = raw.filter(t => t && !isLegacyRemovedTheme(t));
    const byId = new Map(cleanedRaw.map(t => [t.id, t]));
    const mergedCore = initialThemes.map(def => {
      const existing = byId.get(def.id) || cleanedRaw.find(t => (t.title || '').toLowerCase() === def.title.toLowerCase());
      const OLD_THEME_PLACEHOLDERS = new Set([
        'images/research/water-quality.jpg',
        'water-quality.jpg',
        'https://alabama.box.com/s/d9w2jled1dcqoz4cisvf8oq1g3d50pli',
        'https://alabama.box.com/shared/static/c6x0ay8ejcvmsnp07qmx2svq08fp0vj1.png',
        'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=800&q=80',
        'ai-aquatic-sensing.jpg',
        'river-morphology.png',
        'lake-morphology.jpg',
      ]);
      const isOldPlaceholder = OLD_THEME_PLACEHOLDERS.has((existing?.image || '').trim());
      return existing
        ? {
          ...def,
          image: (!existing.image || isOldPlaceholder) ? def.image : existing.image,
          description: existing.description || def.description,
        }
        : def;
    });
    const customExtras = cleanedRaw.filter(
      t =>
        !CORE_THEME_IDS.has(t.id) &&
        !initialThemes.some(d => d.title.toLowerCase() === (t.title || '').toLowerCase())
    );
    return [...mergedCore, ...customExtras];
  };

  const LEGACY_THEME_ID_REMAP: Record<string, string> = {
    'lake-morphology': 'water-quantity',
    'lake-morphology-analysis': 'water-quantity',
    'theme-lake-morphology': 'water-quantity',
    'ai-river-lake': 'geoai',
    'ai-for-river-and-lake-systems': 'geoai',
    'theme-ai-river-lake': 'geoai',
    'ai-sensing': 'geoai',
    'lake-hydrology': 'water-quantity',
    'coastal-optics': 'water-quality',
    'uav-bathymetry': 'river-morphology',
  };

  const normalizeProjects = (raw?: Project[] | null): Project[] => {
    if (!Array.isArray(raw) || raw.length === 0) return initialProjects;
    const initById = new Map(initialProjects.map(p => [p.id, p]));
    return raw.map(p => {
      const def = initById.get(p.id);
      const remappedThemeIds = Array.isArray(p.themeIds)
        ? Array.from(
          new Set(
            p.themeIds
              .map(tid => LEGACY_THEME_ID_REMAP[tid] || tid)
              .filter(tid => CORE_THEME_IDS.has(tid) || !tid.startsWith('theme-'))
          )
        )
        : [];
      return {
        ...p,
        themeIds: remappedThemeIds.length > 0 ? remappedThemeIds : (def?.themeIds || []),
        subPage: p.subPage || def?.subPage,
      };
    });
  };

  // Database lists with bulletproof fallback error handling
  const [themes, setThemes] = useState<ResearchTheme[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_themes');
      return saved ? normalizeThemes(JSON.parse(saved)) : initialThemes;
    } catch {
      return initialThemes;
    }
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_projects');
      return saved ? normalizeProjects(JSON.parse(saved)) : initialProjects;
    } catch {
      return initialProjects;
    }
  });

  const [publications, setPublications] = useState<Publication[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_publications');
      if (saved) {
        const savedList: Publication[] = JSON.parse(saved);
        if (Array.isArray(savedList) && savedList.length > 0) {
          const clean = savedList.filter(p => !isMockPublication(p));
          if (clean.length > 0) return clean;
        }
      }
    } catch { }
    return initialPublications;
  });

  // Automatically persist any publications update to local storage
  useEffect(() => {
    localStorage.setItem('ersl_publications', JSON.stringify(publications));
  }, [publications]);

  const [softwareList, setSoftwareList] = useState<Software[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_software');
      return saved ? JSON.parse(saved) : initialSoftware;
    } catch {
      return initialSoftware;
    }
  });

  const [dataLayers, setDataLayers] = useState<DataLayer[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_datalayers');
      return saved ? JSON.parse(saved) : initialDataLayers;
    } catch {
      return initialDataLayers;
    }
  });

  const [instruments, setInstruments] = useState<Instrument[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_instruments');
      return saved ? JSON.parse(saved) : initialInstruments;
    } catch {
      return initialInstruments;
    }
  });

  const [people, setPeople] = useState<Person[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_people');
      if (!saved) return applyAutoGraduation(initialPeople).updatedList;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return applyAutoGraduation(initialPeople).updatedList;
      const validSaved = parsed.filter(p => p && p.id && p.name);
      if (validSaved.length === 0) return applyAutoGraduation(initialPeople).updatedList;
      const known = new Set(validSaved.map(p => p.id));
      return applyAutoGraduation([...validSaved, ...initialPeople.filter(p => !known.has(p.id))]).updatedList;
    } catch {
      return applyAutoGraduation(initialPeople).updatedList;
    }
  });

  const [boxFiles, setBoxFiles] = useState<BoxFile[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_boxfiles');
      return saved ? JSON.parse(saved) : initialBoxFiles;
    } catch {
      return initialBoxFiles;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('ersl_auditlogs');
      return saved ? JSON.parse(saved) : initialAuditLogs;
    } catch {
      return initialAuditLogs;
    }
  });

  const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(null);
  const [selectedProjectSubTabId, setSelectedProjectSubTabId] = useState<string | undefined>(undefined);
  const [selectedThemeDetails, setSelectedThemeDetails] = useState<ResearchTheme | null>(null);
  const [selectedInstrumentDetails, setSelectedInstrumentDetails] = useState<Instrument | null>(null);
  const [activeThemeFilter, setActiveThemeFilter] = useState<string>('all');
  const [copiedProjectUrlId, setCopiedProjectUrlId] = useState<string | null>(null);
  const [standaloneProjectId, setStandaloneProjectId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('project');
    } catch {
      return null;
    }
  });
  const [standaloneSubTabId] = useState<string | undefined>(() => {
    try {
      return new URLSearchParams(window.location.search).get('subtab') || undefined;
    } catch {
      return undefined;
    }
  });

  const openProjectInNewTab = (projectId: string, subTabId?: string) => {
    const params = new URLSearchParams();
    params.set('project', projectId);
    if (subTabId) params.set('subtab', subTabId);
    const targetUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const exitStandaloneProject = () => {
    setStandaloneProjectId(null);
    setSelectedProjectDetails(null);
    setSelectedProjectSubTabId(undefined);
    setActiveTab('projects');
    try {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, '', cleanUrl);
    } catch { }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const normalizeSiteConfig = (raw?: Partial<SiteConfig> | null): SiteConfig => {
    if (!raw || !Array.isArray(raw.tabs)) return defaultSiteConfig;
    const version = raw.configVersion || 1;
    const needsV2Upgrade = version < 2;
    const needsV3Upgrade = version < 3;
    const needsV4Upgrade = version < 4;
    const needsV5Upgrade = version < 5;
    const needsV6Upgrade = version < 6;
    const isOldDefaultMission =
      !raw.homeMission?.description ||
      raw.homeMission.description.startsWith('Our research balances extensive field-level tracking');
    const existingIds = new Set(raw.tabs.map(t => t.id));
    const missingDefaults = defaultSiteConfig.tabs.filter(t => !existingIds.has(t.id));

    let combinedTabs = [...raw.tabs]
      .filter(tab => tab.id !== 'field')
      .map(tab => {
        let updated = tab;
        if (needsV2Upgrade && updated.id === 'research' && updated.label === 'Research Areas') {
          updated = { ...updated, label: 'Research Themes' };
        }
        if (needsV6Upgrade && updated.id === 'reservoir') {
          updated = { ...updated, label: 'Project Management', icon: '📊' };
        }
        return updated;
      });

    // Ensure 'projects' tab is placed cleanly right after 'research' when missing
    missingDefaults.forEach(defTab => {
      if (defTab.id === 'projects') {
        const resIdx = combinedTabs.findIndex(t => t.id === 'research');
        if (resIdx >= 0) {
          combinedTabs = [
            ...combinedTabs.slice(0, resIdx + 1),
            defTab,
            ...combinedTabs.slice(resIdx + 1),
          ];
          return;
        }
      }
      combinedTabs.push(defTab);
    });

    return {
      ...defaultSiteConfig,
      ...raw,
      configVersion: 6,
      themeStyle: raw.themeStyle || 'macos-glass',
      showSubheadings: needsV3Upgrade ? true : (raw.showSubheadings ?? true),
      swapHomeColors: needsV3Upgrade ? false : (raw.swapHomeColors ?? false),
      memberLayoutMode:
        raw.memberLayoutMode ||
        (raw.layoutMode && raw.layoutMode !== 'horizontal-top' ? raw.layoutMode : 'vertical-left'),
      subheadingColor: raw.subheadingColor || '#9E1B32',
      tabs: combinedTabs,
      homeSlides: needsV4Upgrade
        ? defaultSiteConfig.homeSlides
        : (Array.isArray(raw.homeSlides) && raw.homeSlides.length > 0 ? raw.homeSlides : defaultSiteConfig.homeSlides),
      homeMission:
        (needsV5Upgrade && isOldDefaultMission) || !raw.homeMission
          ? defaultSiteConfig.homeMission
          : raw.homeMission,
    };
  };

  // Dynamic Site CMS Configuration & Custom Tabs/Sub-pages (Cloud synced)
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    try {
      const saved = localStorage.getItem('ersl_site_config');
      if (saved) return normalizeSiteConfig(JSON.parse(saved) as SiteConfig);
    } catch { }
    return defaultSiteConfig;
  });

  const [customPages, setCustomPages] = useState<Record<string, CustomPageData>>(() => {
    try {
      const saved = localStorage.getItem('ersl_custom_pages');
      if (saved) return JSON.parse(saved);
    } catch { }
    return defaultCustomPages;
  });

  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [bulletinModalOpen, setBulletinModalOpen] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<BulletinItem | null>(null);

  // News & Lab Updates State (Publications, Achievements, Blogs, Field Surveys)
  const [news, setNews] = useState<NewsItem[]>(() => {
    const saved = localStorage.getItem('ersl_news');
    if (!saved) return newsItems;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : newsItems;
    } catch {
      return newsItems;
    }
  });
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [editingNewsItem, setEditingNewsItem] = useState<NewsItem | null>(null);
  const [newsCategoryFilter, setNewsCategoryFilter] = useState<string>('all');
  const [editingHomeSection, setEditingHomeSection] = useState<'mission' | 'news-header' | 'footer' | null>(null);
  const [homeEditDraft, setHomeEditDraft] = useState<SiteConfig | null>(null);
  const [cloudStatus, setCloudStatus] = useState<{ type: 'saved' | 'error' | 'syncing'; text: string } | null>(null);

  const openHomeSectionEditor = (sec: 'mission' | 'news-header' | 'footer') => {
    setHomeEditDraft(JSON.parse(JSON.stringify(siteConfig)));
    setEditingHomeSection(sec);
  };

  const saveHomeSectionEditor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!homeEditDraft) return;
    await handleSaveSiteConfig(homeEditDraft);
    setEditingHomeSection(null);
    setHomeEditDraft(null);
  };

  const SECTION_STORAGE_KEYS: Record<string, { cloudKey: string; localKey: string }> = {
    publications: { cloudKey: 'ersl_sec_publications', localKey: 'ersl_publications' },
    software: { cloudKey: 'ersl_sec_software', localKey: 'ersl_software' },
    dataLayers: { cloudKey: 'ersl_sec_datalayers', localKey: 'ersl_datalayers' },
    instruments: { cloudKey: 'ersl_sec_instruments', localKey: 'ersl_instruments' },
    people: { cloudKey: 'ersl_sec_people', localKey: 'ersl_people' },
    themes: { cloudKey: 'ersl_sec_themes', localKey: 'ersl_themes' },
    projects: { cloudKey: 'ersl_sec_projects', localKey: 'ersl_projects' },
    news: { cloudKey: 'ersl_sec_news', localKey: 'ersl_news' },
    teaching: { cloudKey: 'ersl_sec_teaching', localKey: 'ersl_teaching' },
    bulletins: { cloudKey: 'ersl_sec_bulletins', localKey: 'ersl_bulletins' },
    bulletinFolders: { cloudKey: 'ersl_sec_bulletin_folders', localKey: 'ersl_bulletin_folders' },
  };

  const notifyCloudResult = (ok: boolean, label = 'Changes') => {
    if (ok) {
      const boxStatus = getLastBoxStatus();
      const boxSuffix = boxStatus.state === 'synced' ? ' + UA Box' : '';
      setCloudStatus({ type: 'saved', text: `${label} saved to ERSL Cloud${boxSuffix}` });
      setTimeout(() => setCloudStatus(prev => (prev?.type === 'saved' ? null : prev)), 3200);
    } else {
      const reason = getLastCloudError();
      setCloudStatus({
        type: 'error',
        text: `${label} saved locally only — cloud sync failed${reason ? ` (${reason})` : '. Check Supabase table/RLS.'}`,
      });
    }
  };

  // Per-section Cloud Synchronizer: 1 single row write for ONLY the edited section (low egress, no cross-admin overwrite)
  const syncSiteContentToCloud = async (overrides?: {
    publications?: Publication[];
    software?: Software[];
    dataLayers?: DataLayer[];
    instruments?: Instrument[];
    people?: Person[];
    themes?: ResearchTheme[];
    projects?: Project[];
    news?: NewsItem[];
    teaching?: any[];
    bulletins?: BulletinItem[];
    bulletinFolders?: string[];
  }) => {
    if (!overrides || Object.keys(overrides).length === 0) return;
    const updatedBy = currentUser?.name || currentUser?.email || 'Admin';
    setCloudStatus({ type: 'syncing', text: 'Saving to ERSL Cloud...' });

    const sectionPromises = (Object.entries(overrides) as [string, any][])
      .filter(([, val]) => val !== undefined)
      .map(([field, val]) => {
        const cfg = SECTION_STORAGE_KEYS[field];
        if (!cfg) return Promise.resolve(true);
        try { localStorage.setItem(cfg.localKey, JSON.stringify(val)); } catch { }
        return setCloudData(cfg.cloudKey, val, { updatedBy });
      });

    const results = await Promise.all(sectionPromises);
    notifyCloudResult(results.every(Boolean), 'Update');
  };

  // Hydrate all sections in ONE batched Supabase query (no persistent Realtime WebSocket cost)
  const hydrateFromCloud = async (showToast = false) => {
    if (!supabase) return;
    if (showToast) setCloudStatus({ type: 'syncing', text: 'Refreshing from ERSL Cloud...' });

    const keys = [
      'ersl_site_content',
      'ersl_sec_publications',
      'ersl_sec_software',
      'ersl_sec_datalayers',
      'ersl_sec_instruments',
      'ersl_sec_people',
      'ersl_sec_themes',
      'ersl_sec_projects',
      'ersl_sec_news',
      'ersl_sec_teaching',
      'ersl_sec_bulletins',
      'ersl_sec_bulletin_folders',
      'ersl_site_config',
      'ersl_custom_pages',
    ];

    const byKey: Record<string, any> = {};
    try {
      const { data, error } = await supabase
        .from('reservoir_matrix')
        .select('id, rounds')
        .in('id', keys);
      if (error) {
        if (showToast) {
          setCloudStatus({ type: 'error', text: `Cloud refresh failed (${error.message})` });
        }
        return;
      }
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          byKey[row.id] = row.rounds;
        });
      }
    } catch (err: any) {
      if (showToast) {
        setCloudStatus({ type: 'error', text: `Cloud refresh failed (${err?.message || 'network error'})` });
      }
      return;
    }

    const legacy = (byKey['ersl_site_content'] as Record<string, any>) || {};
    const pick = <T,>(secKey: string, legacyKey: string, allowEmpty = false): T | null => {
      const sec = byKey[secKey];
      if (Array.isArray(sec) && (allowEmpty || sec.length > 0)) return sec as T;
      const leg = legacy[legacyKey];
      if (Array.isArray(leg) && leg.length > 0) return leg as T;
      return null;
    };

    const pubs = pick<Publication[]>('ersl_sec_publications', 'publications');
    if (pubs) {
      setPublications(pubs);
      try { localStorage.setItem('ersl_publications', JSON.stringify(pubs)); } catch { }
    }
    const soft = pick<Software[]>('ersl_sec_software', 'software');
    if (soft) {
      setSoftwareList(soft);
      try { localStorage.setItem('ersl_software', JSON.stringify(soft)); } catch { }
    }
    const dl = pick<DataLayer[]>('ersl_sec_datalayers', 'dataLayers');
    if (dl) {
      setDataLayers(dl);
      try { localStorage.setItem('ersl_datalayers', JSON.stringify(dl)); } catch { }
    }
    const inst = pick<Instrument[]>('ersl_sec_instruments', 'instruments');
    if (inst) {
      setInstruments(inst);
      try { localStorage.setItem('ersl_instruments', JSON.stringify(inst)); } catch { }
    }
    const ppl = pick<Person[]>('ersl_sec_people', 'people');
    if (ppl) {
      const { updatedList, graduatedNames } = applyAutoGraduation(ppl);
      setPeople(updatedList);
      try { localStorage.setItem('ersl_people', JSON.stringify(updatedList)); } catch { }
      if (graduatedNames.length > 0 && currentUser && currentUser.role !== 'Viewer') {
        syncSiteContentToCloud({ people: updatedList });
        appendAuditLog('AUTO_GRADUATE_TEAM_MEMBER', `Auto-moved to Former Members: ${graduatedNames.join(', ')}`);
      }
    }
    const thm = pick<ResearchTheme[]>('ersl_sec_themes', 'themes');
    if (thm) {
      const normalizedThm = normalizeThemes(thm);
      setThemes(normalizedThm);
      try { localStorage.setItem('ersl_themes', JSON.stringify(normalizedThm)); } catch { }
      if (currentUser && currentUser.role !== 'Viewer' && JSON.stringify(normalizedThm) !== JSON.stringify(thm)) {
        syncSiteContentToCloud({ themes: normalizedThm });
      }
    }
    const prj = pick<Project[]>('ersl_sec_projects', 'projects');
    if (prj) {
      const normalizedPrj = normalizeProjects(prj);
      setProjects(normalizedPrj);
      try { localStorage.setItem('ersl_projects', JSON.stringify(normalizedPrj)); } catch { }
    }
    const nws = pick<NewsItem[]>('ersl_sec_news', 'news', true);
    if (nws) {
      setNews(nws);
      try { localStorage.setItem('ersl_news', JSON.stringify(nws)); } catch { }
    } else if (byKey['ersl_sec_news'] === undefined && currentUser && currentUser.role !== 'Viewer') {
      // Rescue local News edits trapped by the earlier empty-array sync bug as soon as an editor/admin opens the site
      try {
        const localNewsRaw = localStorage.getItem('ersl_news');
        if (localNewsRaw) {
          const parsedLocal = JSON.parse(localNewsRaw);
          if (Array.isArray(parsedLocal) && parsedLocal.length > 0 && JSON.stringify(parsedLocal) !== JSON.stringify(newsItems)) {
            syncSiteContentToCloud({ news: parsedLocal });
          }
        }
      } catch { }
    }
    const tch = pick<any[]>('ersl_sec_teaching', 'teaching');
    if (tch) {
      setTeachingList(tch);
      try { localStorage.setItem('ersl_teaching', JSON.stringify(tch)); } catch { }
    }
    const bul = pick<BulletinItem[]>('ersl_sec_bulletins', 'bulletins', true);
    if (bul) {
      setBulletins(bul);
      try { localStorage.setItem('ersl_bulletins', JSON.stringify(bul)); } catch { }
    } else if (byKey['ersl_sec_bulletins'] === undefined && currentUser && currentUser.role !== 'Viewer') {
      try {
        const localBullRaw = localStorage.getItem('ersl_bulletins');
        if (localBullRaw) {
          const parsedBull = JSON.parse(localBullRaw);
          if (Array.isArray(parsedBull) && parsedBull.length > 0) {
            syncSiteContentToCloud({ bulletins: parsedBull });
          }
        }
      } catch { }
    }
    const fld = pick<string[]>('ersl_sec_bulletin_folders', 'bulletinFolders');
    if (fld) {
      setBulletinFolders(fld);
      try { localStorage.setItem('ersl_bulletin_folders', JSON.stringify(fld)); } catch { }
    }

    const siteCfg = byKey['ersl_site_config'] as SiteConfig | undefined;
    if (siteCfg && Array.isArray(siteCfg.tabs)) {
      const merged = normalizeSiteConfig(siteCfg);
      setSiteConfig(merged);
      try { localStorage.setItem('ersl_site_config', JSON.stringify(merged)); } catch { }
    }

    const customPagesCloud = byKey['ersl_custom_pages'] as Record<string, CustomPageData> | undefined;
    if (customPagesCloud && typeof customPagesCloud === 'object') {
      setCustomPages(customPagesCloud);
      try { localStorage.setItem('ersl_custom_pages', JSON.stringify(customPagesCloud)); } catch { }
    }

    if (showToast) {
      setCloudStatus({ type: 'saved', text: 'Refreshed latest data from ERSL Cloud' });
      setTimeout(() => setCloudStatus(prev => (prev?.type === 'saved' ? null : prev)), 2500);
    }
  };

  useEffect(() => {
    hydrateFromCloud();
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'Viewer') {
      hydrateFromCloud(false);
    }
  }, [currentUser?.id]);

  const handleSaveSiteConfig = async (next: SiteConfig) => {
    setSiteConfig(next);
    try { localStorage.setItem('ersl_site_config', JSON.stringify(next)); } catch { }
    const ok = await setCloudData('ersl_site_config', next, { updatedBy: currentUser?.name || 'Admin' });
    notifyCloudResult(ok, 'Site design');
    appendAuditLog('UPDATE_SITE_CONFIG', `Layout: ${next.layoutMode}, Primary: ${next.primaryColor}`);
  };

  const handleSavePageHeader = (tabId: string, nextHeader: PageHeaderConfig) => {
    const nextConfig: SiteConfig = {
      ...siteConfig,
      pageHeaders: {
        ...(siteConfig.pageHeaders || {}),
        [tabId]: nextHeader,
      },
    };
    handleSaveSiteConfig(nextConfig);
  };

  const getSubHeaderPassProps = (tabId: string) => ({
    headerOverride: siteConfig.pageHeaders?.[tabId],
    accentColor,
    showSubheadings: siteConfig.showSubheadings,
    canEditHeader: isAdmin && editMode,
    onSaveHeader: handleSavePageHeader,
  });

  const handleCreateCustomPage = async (tab: TabConfig, page: CustomPageData) => {
    const nextConfig: SiteConfig = { ...siteConfig, tabs: [...siteConfig.tabs, tab] };
    const nextPages = { ...customPages, [tab.id]: page };
    setSiteConfig(nextConfig);
    setCustomPages(nextPages);
    try {
      localStorage.setItem('ersl_site_config', JSON.stringify(nextConfig));
      localStorage.setItem('ersl_custom_pages', JSON.stringify(nextPages));
    } catch { }
    const [ok1, ok2] = await Promise.all([
      setCloudData('ersl_site_config', nextConfig, { updatedBy: currentUser?.name || 'Admin' }),
      setCloudData('ersl_custom_pages', nextPages, { updatedBy: currentUser?.name || 'Admin' }),
    ]);
    notifyCloudResult(ok1 && ok2, `Custom tab "${tab.label}"`);
    appendAuditLog('CREATE_CUSTOM_TAB', `Created tab "${tab.label}"`);
    setActiveTab(tab.id);
  };

  const handleDeleteCustomTab = async (tabId: string) => {
    const nextConfig: SiteConfig = {
      ...siteConfig,
      tabs: siteConfig.tabs.filter(t => t.id !== tabId),
    };
    const nextPages = { ...customPages };
    delete nextPages[tabId];
    setSiteConfig(nextConfig);
    setCustomPages(nextPages);
    try {
      localStorage.setItem('ersl_site_config', JSON.stringify(nextConfig));
      localStorage.setItem('ersl_custom_pages', JSON.stringify(nextPages));
    } catch { }
    const [ok1, ok2] = await Promise.all([
      setCloudData('ersl_site_config', nextConfig, { updatedBy: currentUser?.name || 'Admin' }),
      setCloudData('ersl_custom_pages', nextPages, { updatedBy: currentUser?.name || 'Admin' }),
    ]);
    notifyCloudResult(ok1 && ok2, 'Tab deletion');
    if (activeTab === tabId) setActiveTab('home');
  };

  const handleUpdateCustomPage = async (updated: CustomPageData) => {
    const nextPages = { ...customPages, [updated.tabId]: updated };
    setCustomPages(nextPages);
    try { localStorage.setItem('ersl_custom_pages', JSON.stringify(nextPages)); } catch { }
    const ok = await setCloudData('ersl_custom_pages', nextPages, { updatedBy: currentUser?.name || 'Admin' });
    notifyCloudResult(ok, 'Page update');
  };

  const handleUpdateProject = (updatedProject: Project) => {
    const nextProjects = projects.map(p => (p.id === updatedProject.id ? updatedProject : p));
    setProjects(nextProjects);
    setSelectedProjectDetails(updatedProject);
    try { localStorage.setItem('ersl_projects', JSON.stringify(nextProjects)); } catch { }
    syncSiteContentToCloud({ projects: nextProjects });
    appendAuditLog('UPDATE_PROJECT_SUBPAGE', updatedProject.title);
  };

  const handleUpdateTheme = (updatedTheme: ResearchTheme) => {
    const nextThemes = themes.map(t => (t.id === updatedTheme.id ? updatedTheme : t));
    setThemes(nextThemes);
    setSelectedThemeDetails(updatedTheme);
    setFailedImages(prev => {
      const next = { ...prev };
      delete next[`theme-${updatedTheme.id}`];
      delete next[`hero-theme-${updatedTheme.id}`];
      return next;
    });
    try { localStorage.setItem('ersl_themes', JSON.stringify(nextThemes)); } catch { }
    syncSiteContentToCloud({ themes: nextThemes });
    appendAuditLog('UPDATE_RESEARCH_THEME', updatedTheme.title);
  };

  const handleUpdateInstrument = (updatedInst: Instrument) => {
    const nextInstruments = instruments.map(i => (i.id === updatedInst.id ? updatedInst : i));
    setInstruments(nextInstruments);
    setSelectedInstrumentDetails(updatedInst);
    try { localStorage.setItem('ersl_instruments', JSON.stringify(nextInstruments)); } catch { }
    syncSiteContentToCloud({ instruments: nextInstruments });
    appendAuditLog('UPDATE_INSTRUMENT', updatedInst.name);
  };

  const handleSaveBulletin = (saved: BulletinItem) => {
    const exists = bulletins.some(b => b.id === saved.id);
    const next = exists
      ? bulletins.map(b => (b.id === saved.id ? saved : b))
      : [saved, ...bulletins];
    setBulletins(next);
    try { localStorage.setItem('ersl_bulletins', JSON.stringify(next)); } catch { }
    syncSiteContentToCloud({ bulletins: next });
    appendAuditLog(exists ? 'UPDATE_BULLETIN' : 'PUBLISH_BULLETIN', saved.title);
    setBulletinModalOpen(false);
    setEditingBulletin(null);
  };

  useEffect(() => {
    localStorage.setItem('ersl_news', JSON.stringify(news));
  }, [news]);

  const handleSaveNewsItem = (savedItem: NewsItem) => {
    const idx = news.findIndex(n => n.id === savedItem.id);
    const updated: NewsItem[] = idx >= 0
      ? news.map((n, i) => (i === idx ? savedItem : n))
      : [savedItem, ...news];
    setNews(updated);
    try { localStorage.setItem('ersl_news', JSON.stringify(updated)); } catch { }
    syncSiteContentToCloud({ news: updated });
    setNewsModalOpen(false);
    setEditingNewsItem(null);
    appendAuditLog('UPDATE_NEWS', `Saved news update: "${savedItem.title}"`);
  };

  const handleDeleteNewsItem = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete news announcement "${title}"?`)) return;
    const updated = news.filter(n => n.id !== id);
    setNews(updated);
    try { localStorage.setItem('ersl_news', JSON.stringify(updated)); } catch { }
    syncSiteContentToCloud({ news: updated });
    appendAuditLog('DELETE_NEWS', `Deleted news announcement: "${title}"`);
  };
  const [bulletinFolders, setBulletinFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem('ersl_bulletin_folders');
    return saved ? JSON.parse(saved) : ['General'];
  });
  const [activeBulletinFolder, setActiveBulletinFolder] = useState<string>('All');
  useEffect(() => {
    localStorage.setItem('ersl_bulletin_folders', JSON.stringify(bulletinFolders));
  }, [bulletinFolders]);

  // Lab Bulletins & Announcements State (Point 5)
  const [bulletins, setBulletins] = useState<any[]>(() => {
    const saved = localStorage.getItem('ersl_bulletins');
    const defaultBulletins = [
      {
        id: 'b-1',
        title: 'NASA SWOT Satellite Pass Calibration Campaign',
        sender: 'Dr. Hongxing Liu',
        date: '2026-07-10 09:30',
        content: 'Team, we need to coordinate in-situ ADCP river surveys matching the upcoming NASA SWOT (Surface Water and Ocean Topography) wide-swath satellite passes over the Black Warrior basin on July 14th and 18th. Ensure all drone batteries are fully charged and the Sentera 6X Pro is calibrated. Postdocs and PhDs please check your assignments in the shared Box field survey folder.',
        priority: 'high'
      },
      {
        id: 'b-2',
        title: 'CIROH NOAA Annual Progress Reports Due',
        sender: 'Dr. Hongxing Liu',
        date: '2026-07-05 14:15',
        content: 'Reminder to all researchers: please upload your recent manuscripts, geospatial model weights, and draft reports to our NOAA CIROH shared directory by Friday. We must aggregate these inputs for the annual board review meeting. Reach out to Dr. Dan Tian if you need assistance with the RS-FloodXDepth validation charts.',
        priority: 'normal'
      }
    ];
    return saved ? JSON.parse(saved) : defaultBulletins;
  });

  // State for user management (inside Admin Panel)
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const defaultUsers: User[] = [
      { id: 'user-liu', name: 'Dr. Hongxing Liu', email: 'hongxing.liu@ua.edu', role: 'Admin', department: 'Geography' },
      { id: 'user-mandal', name: 'Dr. Tapas Mandal', email: 'tmandal@ua.edu', role: 'Researcher', department: 'Geography' },
      { id: 'user-naveen', name: 'Naveen Purushothaman', email: 'npurushothaman@ua.edu', role: 'Researcher', department: 'Geography' }
    ];
    const saved = localStorage.getItem('ersl_all_users');
    return saved ? JSON.parse(saved) : defaultUsers;
  });

  // Admissions Contact Forms Inbox (Simulated CRM)
  const [inboxEntries, setInboxEntries] = useState<any[]>(() => {
    const saved = localStorage.getItem('ersl_inbox');
    return saved ? JSON.parse(saved) : [];
  });

  // Teaching Materials state (Point 5)
  const [teachingList, setTeachingList] = useState<any[]>(() => {
    const defaultTeaching = [
      {
        id: 'teach-1',
        title: 'Course Syllabus: GY 404/504 - Advanced GIS & Remote Sensing',
        course: 'GY 404/504',
        description: 'Semester plan, grading schemas, satellite pass calendars, and field drone certification standards.',
        link: 'https://ua.box.com/s/gy404-syllabus-2026',
        updatedAt: '2026-06-15'
      },
      {
        id: 'teach-2',
        title: 'Laboratory Manual 3: SAR reach-scale surface water extraction on GEE',
        course: 'GY 404/504 Lab 3',
        description: 'Comprehensive walk-through to process Sentinel-1 polarization ratios and map surface inundation depths.',
        link: 'https://ua.box.com/s/gee-sar-manual',
        updatedAt: '2026-07-02'
      },
      {
        id: 'teach-3',
        title: 'Field Guide: ADCP River Gauging & Hydrodynamic Bathymetry Calibration',
        course: 'GY 504 Graduate Seminar',
        description: 'Operating manual for SonTek M9 RiverSurveyor profiling, transducer depth settings, and flow rate corrections.',
        link: 'https://ua.box.com/s/adcp-field-procedures',
        updatedAt: '2026-07-10'
      }
    ];
    const saved = localStorage.getItem('ersl_teaching');
    return saved ? JSON.parse(saved) : defaultTeaching;
  });

  // Helper to resolve clean initials ignoring Dr. prefix (Point 6)
  const getCleanInitials = (name: string): string => {
    const parts = name.split(' ').filter(p => {
      const lower = p.toLowerCase().replace(/\./g, '');
      return !['dr', 'prof', 'professor', 'phd', 'candidate', 'postdoc', 'researcher'].includes(lower);
    });
    if (parts.length === 0) return 'UA';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Editor Modal Control state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'publication' | 'data-layer' | 'research-theme' | 'project' | 'instrument' | 'person' | 'software' | 'teaching'>('publication');
  const [editingItem, setEditingItem] = useState<any>(null);

  // Rolling Research-Themes Hero state (syncs directly with Research Themes & their Box/local images)
  const [currentThemeSlide, setCurrentThemeSlide] = useState(0);

  // Forms Search and filters
  const [pubSearch, setPubSearch] = useState('');
  const [pubSort, setPubSort] = useState<'newest' | 'oldest'>('newest');
  const [pubFilter, setPubFilter] = useState<string>('All');

  // Interactive Google Scholar Sync states
  const [isSyncingScholar, setIsSyncingScholar] = useState(false);
  const [syncScholarLogs, setSyncScholarLogs] = useState<string[]>([]);

  const [dataSearch, setDataSearch] = useState('');
  const [simulatedBand, setSimulatedBand] = useState<string>('green');

  // Track failed images to handle fallback elegantly
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Custom states for Water Remote Sensing Dashboard
  const [selectedStation, setSelectedStation] = useState<string>('northport');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanTimestamp, setScanTimestamp] = useState<string>('2026-07-11 09:00 UTC');

  // Admissions Form States
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentDegree, setStudentDegree] = useState('PhD');
  const [studentStatement, setStudentStatement] = useState('');
  const [studentInterests, setStudentInterests] = useState<string[]>([]);
  const [showContactSuccess, setShowContactSuccess] = useState(false);

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem('ersl_themes', JSON.stringify(themes));
  }, [themes]);

  useEffect(() => {
    localStorage.setItem('ersl_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('ersl_publications', JSON.stringify(publications));
  }, [publications]);

  useEffect(() => {
    localStorage.setItem('ersl_software', JSON.stringify(softwareList));
  }, [softwareList]);

  useEffect(() => {
    localStorage.setItem('ersl_datalayers', JSON.stringify(dataLayers));
  }, [dataLayers]);

  useEffect(() => {
    localStorage.setItem('ersl_instruments', JSON.stringify(instruments));
  }, [instruments]);

  useEffect(() => {
    localStorage.setItem('ersl_people', JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    localStorage.setItem('ersl_boxfiles', JSON.stringify(boxFiles));
  }, [boxFiles]);

  useEffect(() => {
    localStorage.setItem('ersl_auditlogs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('ersl_bulletins', JSON.stringify(bulletins));
  }, [bulletins]);

  useEffect(() => {
    localStorage.setItem('ersl_all_users', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem('ersl_inbox', JSON.stringify(inboxEntries));
  }, [inboxEntries]);

  useEffect(() => {
    localStorage.setItem('ersl_teaching', JSON.stringify(teachingList));
  }, [teachingList]);

  useEffect(() => {
    if (!currentUser) {
      localStorage.removeItem('ersl_user'); // clear any old fake-SSO session
      setEditMode(false);
    } else if (currentUser.role === 'Admin') {
      setEditMode(true);
    }
  }, [currentUser]);

  // Supabase session -> currentUser (only approved members/admins are treated as logged in)
  useEffect(() => {
    if (!supabase) return;
    const apply = async (userId?: string) => {
      if (!userId) { setCurrentUser(null); return; }
      const profile = await fetchProfile(userId);
      if (profile && profile.role !== 'pending') setCurrentUser(profileToUser(profile));
      else setCurrentUser(null);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowUpdatePasswordModal(true);
      }
      apply(session?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('ersl_tab', activeTab);
  }, [activeTab]);

  // Smooth scroll-reveal transition as sections & cards enter the viewport
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main > div > section, main > div > div, main .grid > *, footer'
      )
    ).filter(el => !el.classList.contains('ersl-in-view'));

    if (candidates.length === 0) return;

    // Stagger siblings inside grids slightly for a smooth cascading rise
    candidates.forEach((el, idx) => {
      el.classList.add('ersl-scroll-item');
      const isGridChild = el.parentElement?.classList.contains('grid');
      if (isGridChild) {
        const siblingIndex = Array.from(el.parentElement!.children).indexOf(el);
        el.style.setProperty('--ersl-delay', `${Math.min(siblingIndex, 5) * 60}ms`);
      } else {
        el.style.setProperty('--ersl-delay', `${Math.min(idx, 2) * 40}ms`);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('ersl-in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px -24px 0px' }
    );

    const raf = requestAnimationFrame(() => {
      candidates.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.96) {
          el.classList.add('ersl-in-view');
        } else {
          observer.observe(el);
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [
    activeTab,
    selectedProjectDetails?.id,
    activeThemeFilter,
    peopleSubTab,
    newsCategoryFilter,
    news.length,
    themes.length,
    projects.length,
    publications.length,
    instruments.length,
    people.length,
    softwareList.length,
    dataLayers.length,
  ]);

  // Auto-roll top hero banner across the 5 Research Themes
  useEffect(() => {
    if (themes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentThemeSlide(prev => (prev + 1) % themes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [themes.length]);

  // Helper: Log administrative/edit actions to audit trail
  const appendAuditLog = (action: string, target: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'Anonymous',
      action,
      target
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Login handler from SSO Popup
  const handleSSOSuccess = (user: User) => {
    setCurrentUser(user);
    setShowSSOPopup(false);
    // Add to allUsers if new
    setAllUsers(prev => {
      if (prev.some(u => u.email === user.email)) return prev;
      return [...prev, user];
    });
    // Check role, keep edit mode disabled by default on login for security
    if (user.role !== 'Viewer') {
      setEditMode(false);
    }
    // Append audit log
    const newLog: AuditLog = {
      id: `log-sso-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      userId: user.id,
      userName: user.name,
      action: 'SSO_LOGIN',
      target: `Logged into ERSL Workspace with Role: ${user.role}`
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const PUBLIC_BUILTIN_TABS = new Set([
    'home',
    'people',
    'research',
    'projects',
    'publications',
    'instruments',
    'software',
    'data',
  ]);

  const isTabPublic = (tabId: string) => {
    const custom = customPages[tabId];
    const meta = siteConfig.tabs.find(t => t.id === tabId);
    if (custom) return meta ? meta.visibility === 'public' : true;
    if (!PUBLIC_BUILTIN_TABS.has(tabId)) return false;
    return meta ? meta.visibility === 'public' : true;
  };

  const handleLogout = () => {
    if (currentUser) {
      appendAuditLog('SSO_LOGOUT', 'Logged out of ERSL portal session');
    }
    supabase?.auth.signOut();
    setCurrentUser(null);
    setEditMode(false);
    setActiveTab(prev => (isTabPublic(prev) ? prev : 'home'));
  };

  // Role modification inside Admin Panel (syncs with Active Directory)
  const handleUserRoleChange = (userId: string, newRole: Role) => {
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

    // If we changed current user role, sync current state
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, role: newRole } : null);
      if (newRole === 'Viewer') {
        setEditMode(false);
      }
    }

    const modifiedUser = allUsers.find(u => u.id === userId);
    appendAuditLog('ADMIN_USER_ROLE_CHANGE', `Changed ${modifiedUser?.name || 'User'}'s permission level to ${newRole}`);
  };

  const handleAdminAddUser = (newUser: Omit<User, 'id'>) => {
    const id = `user-${Date.now()}`;
    const userWithId = { ...newUser, id };
    setAllUsers(prev => [...prev, userWithId]);
    appendAuditLog('ADMIN_ADD_AUTHORIZED_USER', `Authorized ${newUser.name} (${newUser.email}) with role ${newUser.role}`);
  };

  const handleAdminDeleteUser = (userId: string) => {
    const userToDelete = allUsers.find(u => u.id === userId);
    if (!userToDelete) return;
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    appendAuditLog('ADMIN_REVOKE_USER_ACCESS', `Revoked access authorization for ${userToDelete.name} (${userToDelete.email})`);
  };

  // Unified Save handler for EditModal
  const handleModalSave = (savedItem: any) => {
    const isEdit = !!editingItem;

    if (modalType === 'publication') {
      const updated = isEdit ? publications.map(p => p.id === savedItem.id ? savedItem : p) : [savedItem, ...publications];
      setPublications(updated);
      try { localStorage.setItem('ersl_publications', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ publications: updated });
      appendAuditLog(isEdit ? 'UPDATE_PUBLICATION' : 'ADD_PUBLICATION', savedItem.title);
    } else if (modalType === 'data-layer') {
      const updated = isEdit ? dataLayers.map(d => d.id === savedItem.id ? savedItem : d) : [savedItem, ...dataLayers];
      setDataLayers(updated);
      try { localStorage.setItem('ersl_datalayers', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ dataLayers: updated });
      appendAuditLog(isEdit ? 'UPDATE_DATALAYER' : 'ADD_DATALAYER', savedItem.name);
    } else if (modalType === 'research-theme') {
      const updated = isEdit ? themes.map(t => t.id === savedItem.id ? savedItem : t) : [...themes, savedItem];
      setThemes(updated);
      setFailedImages(prev => {
        const next = { ...prev };
        delete next[`theme-${savedItem.id}`];
        delete next[`hero-theme-${savedItem.id}`];
        return next;
      });
      try { localStorage.setItem('ersl_themes', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ themes: updated });
      appendAuditLog(isEdit ? 'UPDATE_RESEARCH_THEME' : 'ADD_RESEARCH_THEME', savedItem.title);
    } else if (modalType === 'instrument') {
      const updated = isEdit ? instruments.map(i => i.id === savedItem.id ? savedItem : i) : [...instruments, savedItem];
      setInstruments(updated);
      try { localStorage.setItem('ersl_instruments', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ instruments: updated });
      appendAuditLog(isEdit ? 'UPDATE_INSTRUMENT' : 'ADD_INSTRUMENT', savedItem.name);
    } else if (modalType === 'person') {
      const updated = isEdit ? people.map(p => p.id === savedItem.id ? savedItem : p) : [...people, savedItem];
      setPeople(updated);
      try { localStorage.setItem('ersl_people', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ people: updated });
      appendAuditLog(isEdit ? 'UPDATE_PEOPLE_ROSTER' : 'ADD_PEOPLE_ROSTER', savedItem.name);
    } else if (modalType === 'software') {
      const updated = isEdit ? softwareList.map(s => s.id === savedItem.id ? savedItem : s) : [savedItem, ...softwareList];
      setSoftwareList(updated);
      try { localStorage.setItem('ersl_software', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ software: updated });
      appendAuditLog(isEdit ? 'UPDATE_SOFTWARE' : 'ADD_SOFTWARE', savedItem.title);
    } else if (modalType === 'teaching') {
      const updated = isEdit ? teachingList.map(t => t.id === savedItem.id ? savedItem : t) : [savedItem, ...teachingList];
      setTeachingList(updated);
      try { localStorage.setItem('ersl_teaching', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ teaching: updated });
      appendAuditLog(isEdit ? 'UPDATE_TEACHING_MATERIAL' : 'ADD_TEACHING_MATERIAL', savedItem.title);
    } else if (modalType === 'project') {
      const normalizedProject: Project = {
        ...savedItem,
        agency: savedItem.agency || savedItem.sponsor || 'ERSL Grant',
        sponsor: savedItem.sponsor || savedItem.agency || 'ERSL Grant',
        details: savedItem.details || savedItem.summary || '',
        summary: savedItem.summary || savedItem.details || '',
        themeIds: Array.isArray(savedItem.themeIds) ? savedItem.themeIds : [],
        subPage: savedItem.subPage || {
          tabVisibility: { overview: 'public', resources: 'public', events: 'public', datasets: 'members' },
          objectives: [],
          resources: [],
          events: [],
          datasets: [],
        },
      };
      const updated = isEdit ? projects.map(p => p.id === normalizedProject.id ? normalizedProject : p) : [normalizedProject, ...projects];
      setProjects(updated);
      try { localStorage.setItem('ersl_projects', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ projects: updated });
      appendAuditLog(isEdit ? 'UPDATE_PROJECT' : 'ADD_PROJECT', normalizedProject.title);
    }

    setModalOpen(false);
    setEditingItem(null);
    setPersonGroupOverride(undefined);
  };

  // Unified Delete handlers
  const handleDeleteItem = (id: string, itemType: string, displayName: string) => {
    if (!confirm(`Are you sure you want to delete "${displayName}" from our records? This action will generate a safety log.`)) {
      return;
    }

    if (itemType === 'publication') {
      const updated = publications.filter(p => p.id !== id);
      setPublications(updated);
      try { localStorage.setItem('ersl_publications', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ publications: updated });
      appendAuditLog('DELETE_PUBLICATION', displayName);
    } else if (itemType === 'data-layer') {
      const updated = dataLayers.filter(d => d.id !== id);
      setDataLayers(updated);
      try { localStorage.setItem('ersl_datalayers', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ dataLayers: updated });
      appendAuditLog('DELETE_DATALAYER', displayName);
    } else if (itemType === 'research-theme') {
      const updated = themes.filter(t => t.id !== id);
      setThemes(updated);
      try { localStorage.setItem('ersl_themes', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ themes: updated });
      appendAuditLog('DELETE_RESEARCH_THEME', displayName);
    } else if (itemType === 'instrument') {
      const updated = instruments.filter(i => i.id !== id);
      setInstruments(updated);
      try { localStorage.setItem('ersl_instruments', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ instruments: updated });
      appendAuditLog('DELETE_INSTRUMENT', displayName);
    } else if (itemType === 'person') {
      const updated = people.filter(p => p.id !== id);
      setPeople(updated);
      try { localStorage.setItem('ersl_people', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ people: updated });
      appendAuditLog('DELETE_PEOPLE_ROSTER', displayName);
    } else if (itemType === 'software') {
      const updated = softwareList.filter(s => s.id !== id);
      setSoftwareList(updated);
      try { localStorage.setItem('ersl_software', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ software: updated });
      appendAuditLog('DELETE_SOFTWARE', displayName);
    } else if (itemType === 'teaching') {
      const updated = teachingList.filter(t => t.id !== id);
      setTeachingList(updated);
      try { localStorage.setItem('ersl_teaching', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ teaching: updated });
      appendAuditLog('DELETE_TEACHING_MATERIAL', displayName);
    } else if (itemType === 'project') {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      try { localStorage.setItem('ersl_projects', JSON.stringify(updated)); } catch { }
      syncSiteContentToCloud({ projects: updated });
      if (selectedProjectDetails?.id === id) setSelectedProjectDetails(null);
      appendAuditLog('DELETE_PROJECT', displayName);
    }
  };

  // Box file operations
  const handleBoxAddFile = (newFile: BoxFile) => {
    setBoxFiles(prev => [newFile, ...prev]);
    appendAuditLog(newFile.type === 'folder' ? 'CREATE_BOX_FOLDER' : 'UPLOAD_BOX_FILE', `${newFile.name} added to workspace`);
  };

  const handleBoxDeleteFile = (fileId: string) => {
    const targetFile = boxFiles.find(f => f.id === fileId);
    setBoxFiles(prev => prev.filter(f => f.id !== fileId));
    appendAuditLog('DELETE_BOX_ITEM', `${targetFile?.name || 'File'} removed from Box workspace`);
  };

  // Admissions Application form handler
  const handleAdmissionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentEmail) return;

    const newApplication = {
      id: `app-${Date.now()}`,
      name: studentName,
      email: studentEmail,
      degree: studentDegree,
      interests: studentInterests,
      statement: studentStatement,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    setInboxEntries(prev => [newApplication, ...prev]);
    setShowContactSuccess(true);

    // Clear forms
    setStudentName('');
    setStudentEmail('');
    setStudentStatement('');
    setStudentInterests([]);

    appendAuditLog('PUBLIC_STUDENT_APPLICATION', `${studentName} submitted prospective student profile (${studentDegree})`);
  };

  const toggleInterest = (interest: string) => {
    setStudentInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleScholarSync = async () => {
    if (isSyncingScholar) return;
    setIsSyncingScholar(true);
    setSyncScholarLogs(['🔍 Connecting to live academic metadata feed for Dr. Hongxing Liu (Scholar ID: GN_fGecAAAAJ)...']);

    try {
      // 1. Live query to OpenAlex open research registry across Dr. Liu publications
      setSyncScholarLogs(prev => [...prev, '🌐 Querying live peer-reviewed works (Univ of Alabama, Cincinnati, Texas A&M, USGS)...']);
      const openAlexUrl = `https://api.openalex.org/works?filter=author.id:A5101778436&sort=publication_year:desc&per_page=100`;

      let liveWorks: Publication[] = [];
      try {
        const liveRes = await fetch(openAlexUrl);
        if (liveRes.ok) {
          const json = await liveRes.json();
          if (Array.isArray(json.results) && json.results.length > 0) {
            // Intelligent filter: Dr. Hongxing Liu in Geography, Remote Sensing, Hydrology, Water Quality
            const relevantResults = json.results.filter((w: any) => {
              const title = (w.title || w.display_name || '').toLowerCase();
              const concepts = (w.concepts || []).map((c: any) => (c.display_name || '').toLowerCase());
              const affiliations = (w.authorships || [])
                .flatMap((a: any) => (a.institutions || []).map((i: any) => (i.display_name || '').toLowerCase()))
                .concat((w.authorships || []).flatMap((a: any) => (a.raw_affiliation_strings || []).map((s: string) => s.toLowerCase())));

              // Exclude medical, surgical, cancer, or non-geospatial arsenic chemistry
              const isMed = title.includes('craniopharyngioma') || title.includes('carcinoma') || title.includes('oncology') ||
                title.includes('neurosurgery') || title.includes('leukemia') || title.includes('arsenic removal') ||
                title.includes('sorbent design') || title.includes('patient') || title.includes('clinical');
              if (isMed) return false;

              // Affirmative matches: UA, Cincinnati, Texas A&M, Ohio State, USGS, CIROH, Remote Sensing, Water, Geography
              const hasAffiliation = affiliations.some(aff =>
                aff.includes('alabama') || aff.includes('cincinnati') || aff.includes('texas a&m') ||
                aff.includes('ohio state') || aff.includes('geography') || aff.includes('remote sensing') ||
                aff.includes('usgs') || aff.includes('ciroh')
              );

              const hasKeywords = concepts.some(c =>
                c.includes('remote sensing') || c.includes('geography') || c.includes('hydrology') ||
                c.includes('gis') || c.includes('water') || c.includes('sediment') || c.includes('satellite') ||
                c.includes('earth observation') || c.includes('radar') || c.includes('spatial') || c.includes('photogrammetry')
              );

              const hasTitleTerms = title.includes('water') || title.includes('lake') || title.includes('river') ||
                title.includes('flood') || title.includes('satellite') || title.includes('remote sensing') ||
                title.includes('sar') || title.includes('lidar') || title.includes('snow') ||
                title.includes('ice') || title.includes('forest') || title.includes('dem') ||
                title.includes('geographic') || title.includes('spatial') || title.includes('swot') ||
                title.includes('sediment') || title.includes('algal') || title.includes('turbidity');

              return hasAffiliation || hasKeywords || hasTitleTerms;
            });

            liveWorks = relevantResults.map((w: any, idx: number) => {
              const authors = (w.authorships || [])
                .map((a: any) => a.author?.display_name)
                .filter(Boolean)
                .slice(0, 5)
                .join(', ') || 'H. Liu et al.';
              const venue = w.primary_location?.source?.display_name || w.primary_location?.raw_source_name || 'Academic Journal';
              const year = w.publication_year || 2024;
              const isConf = w.type === 'proceedings-article' || w.type === 'conference-paper';
              const link = w.doi || w.primary_location?.landing_page_url || `https://scholar.google.com/citations?user=GN_fGecAAAAJ`;
              const rawAbstract = reconstructAbstract(w.abstract_inverted_index);
              const abstract = rawAbstract || 'Peer-reviewed research publication in satellite remote sensing, inland water quality, hydrology, and geospatial environmental modeling by Dr. Hongxing Liu and collaborators.';
              return {
                id: `pub-scholar-${w.id ? w.id.replace('https://openalex.org/', '') : idx}`,
                title: w.title || w.display_name || 'Environmental Remote Sensing Research',
                authors,
                venue: w.biblio?.volume ? `${venue} ${w.biblio.volume}` : venue,
                year,
                type: isConf ? 'Conference' : 'Peer-Reviewed Article',
                link,
                abstract,
                keywords: (w.concepts || []).slice(0, 4).map((c: any) => c.display_name).filter(Boolean)
              };
            });
          }
        }
      } catch (err) {
        console.warn('Live API request notice:', err);
      }

      const cleanLiveWorks = liveWorks.filter(p => !isMockPublication(p));
      if (cleanLiveWorks.length > 0) {
        setPublications(cleanLiveWorks);
        try { localStorage.setItem('ersl_publications', JSON.stringify(cleanLiveWorks)); } catch { }
        syncSiteContentToCloud({ publications: cleanLiveWorks });
        setSyncScholarLogs(prev => [
          ...prev,
          `📥 Retrieved ${cleanLiveWorks.length} verified peer-reviewed articles & conference papers from Dr. Hongxing Liu's active research index!`,
          `✅ ERSL Lab publication catalog successfully synchronized and saved to ERSL Cloud!`
        ]);
      } else {
        setSyncScholarLogs(prev => [
          ...prev,
          `ℹ️ No new papers automatically imported. You can add any publication manually by pasting its DOI or Google Scholar link using the "+ Add" button above!`
        ]);
      }
    } catch {
      setSyncScholarLogs(prev => [...prev, '❌ Unable to complete publications synchronization. Please use "+ Add" to add papers by DOI or link.']);
    } finally {
      setIsSyncingScholar(false);
      appendAuditLog('SCHOLAR_PROFILE_SYNC', 'Synchronized Dr. Hongxing Liu publications from academic index');
    }
  };

  // Filter and sort publication logic
  const filteredPublications = publications
    .filter(pub => {
      const matchesSearch = pub.title.toLowerCase().includes(pubSearch.toLowerCase()) ||
        pub.authors.toLowerCase().includes(pubSearch.toLowerCase()) ||
        pub.venue.toLowerCase().includes(pubSearch.toLowerCase());
      const matchesFilter = pubFilter === 'All' || pub.type === pubFilter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      return pubSort === 'newest' ? b.year - a.year : a.year - b.year;
    });

  const accentColor = siteConfig.primaryColor || '#9E1B32';
  const heroThemes = themes.length > 0 ? themes : initialThemes;
  const activeHeroTheme = heroThemes[currentThemeSlide % heroThemes.length] || heroThemes[0];
  const activeHeroImg = resolveAssetUrl(resolveImagePath(activeHeroTheme?.image, 'research'));
  const subheadingAccent = siteConfig.subheadingColor || '#9E1B32';
  const isGlassTheme = siteConfig.themeStyle !== 'classic';
  const effectiveLayoutMode = !currentUser
    ? 'horizontal-top'
    : (siteConfig.memberLayoutMode || (siteConfig.layoutMode === 'horizontal-top' ? 'vertical-left' : siteConfig.layoutMode));

  const siteSearchItems = buildSiteSearchItems({
    siteConfig,
    currentUser,
    editMode,
    themes,
    projects,
    publications,
    people,
    instruments,
    softwareList,
    dataLayers,
    news,
    teachingList,
    bulletins,
    boxFiles,
    customPages,
  });

  const handleNavigateSearch = (item: SiteSearchItem) => {
    setActiveTab(item.tab);
    if (item.peopleGroup) {
      setPeopleSubTab(item.peopleGroup);
    }
    if (item.themeId) {
      const thm = themes.find(t => t.id === item.themeId) || null;
      setSelectedThemeDetails(thm);
    } else {
      setSelectedThemeDetails(null);
    }
    if (item.instrumentId) {
      const inst = instruments.find(i => i.id === item.instrumentId) || null;
      setSelectedInstrumentDetails(inst);
    } else {
      setSelectedInstrumentDetails(null);
    }
    if (item.projectId) {
      const proj = projects.find(p => p.id === item.projectId) || null;
      setSelectedProjectDetails(proj);
      setSelectedProjectSubTabId(item.projectSubTabId);
    } else {
      setSelectedProjectDetails(null);
      setSelectedProjectSubTabId(undefined);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const headerSiteConfig: SiteConfig = {
    ...siteConfig,
    layoutMode: effectiveLayoutMode,
    tabs: !currentUser
      ? siteConfig.tabs.filter(t => t.visibility === 'public' && t.id !== 'home')
      : siteConfig.tabs,
  };

  return (
    <div
      data-theme={isGlassTheme ? 'macos-glass' : 'classic'}
      className="min-h-screen flex flex-col text-slate-800 font-sans selection:bg-red-200 selection:text-red-900 overflow-x-hidden"
      style={isGlassTheme ? undefined : { backgroundColor: siteConfig.pageBgColor || '#f8fafc' }}
    >

      {/* Top Banner indicating Admin / Editor rights */}
      {currentUser && currentUser.role !== 'Viewer' && (
        <div className="bg-[#1e293b] text-white px-3 sm:px-4 py-1.5 text-xs flex flex-wrap justify-between items-center gap-2 z-40 border-b border-slate-700 select-none">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping shrink-0"></span>
            <span className="font-bold uppercase tracking-wider text-[11px] truncate">
              {currentUser.role === 'Admin' ? '🛠️ UA Admin Mode' : '✍️ ERSL Researcher Mode'}
            </span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-slate-300 font-medium hidden sm:inline truncate">{currentUser.name} ({currentUser.email})</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setEditMode(prev => !prev)}
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider cursor-pointer transition-colors ${editMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              title="Toggle editing buttons across the site"
            >
              {editMode ? '✍️ Edit Mode: ON' : '🔒 Edit Mode: OFF'}
            </button>
            <button
              type="button"
              onClick={() => hydrateFromCloud(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
              title="Pull latest updates saved by Dr. Liu and other admins"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync Cloud</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Sliders className="w-3 h-3" />
                <span>Site Designer</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('admin')}
              style={{ backgroundColor: accentColor }}
              className="text-white text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
            >
              Control Panel
            </button>
          </div>
        </div>
      )}

      {/* Visible Cloud Sync Toast (confirms saves & surfaces errors instead of failing silently) */}
      {cloudStatus && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border ${cloudStatus.type === 'error'
            ? 'bg-red-900 text-white border-red-500'
            : cloudStatus.type === 'syncing'
              ? 'bg-slate-900 text-white border-slate-700'
              : 'bg-emerald-900 text-white border-emerald-500'
            }`}
        >
          <span>{cloudStatus.text}</span>
          {cloudStatus.type === 'error' && (
            <button type="button" onClick={() => setCloudStatus(null)} className="ml-2 underline cursor-pointer">
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Standalone Shareable Project Portal (?project=<id>) OR Main Website Shell */}
      {standaloneProjectId ? (() => {
        const standaloneProj = projects.find(p => p.id === standaloneProjectId) || null;
        return (
          <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6">
            {standaloneProj ? (
              <ProjectSubPage
                project={standaloneProj}
                themes={themes}
                people={people}
                currentUser={currentUser}
                canEdit={Boolean(editMode)}
                editMode={Boolean(editMode)}
                isStandalone
                siteConfig={siteConfig}
                primaryColor={accentColor}
                initialSubTabId={standaloneSubTabId}
                onBack={exitStandaloneProject}
                onUpdateProject={handleUpdateProject}
                onLoginClick={() => setShowSSOPopup(true)}
                onToggleEditMode={() => setEditMode(prev => !prev)}
                onLogout={handleLogout}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-10 text-center max-w-lg mx-auto space-y-4">
                <FolderGit2 className="w-10 h-10 mx-auto text-slate-400" />
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Project Portal Not Found</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    No active research project matched ID &ldquo;{standaloneProjectId}&rdquo;.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exitStandaloneProject}
                  className="text-white text-xs font-bold px-5 py-2.5 rounded-lg cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  &larr; Return to ERSL Lab Website
                </button>
              </div>
            )}
          </div>
        );
      })() : (
      /* Configurable Navigation + Content Shell (Horizontal Top for Public, Vertical Left/Right for Members) */
      <div
        className={`flex-1 flex min-w-0 ${effectiveLayoutMode === 'vertical-left'
          ? 'flex-col lg:flex-row'
          : effectiveLayoutMode === 'vertical-right'
            ? 'flex-col lg:flex-row-reverse'
            : 'flex-col'
          }`}
      >
        <UAHeader
          currentUser={currentUser}
          siteConfig={headerSiteConfig}
          onLoginClick={() => setShowSSOPopup(true)}
          onLogout={handleLogout}
          currentTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedProjectDetails(null);
            setSelectedProjectSubTabId(undefined);
            setSelectedThemeDetails(null);
            setSelectedInstrumentDetails(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onAdminClick={() => setActiveTab('admin')}
          onOpenCustomizer={isAdmin ? () => setCustomizerOpen(true) : undefined}
          searchableItems={siteSearchItems}
          onNavigateSearch={handleNavigateSearch}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Main Body view route controller (aligned cleanly to max-w-7xl guide) */}
          <main className={`flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 ${siteConfig.compactMode ? 'pt-2 pb-4' : 'pt-2.5 pb-6'}`}>

            {!currentUser && !isTabPublic(activeTab) ? (
              <div className="bg-white p-10 md:p-12 rounded-2xl border border-gray-200 text-center max-w-lg mx-auto shadow-sm space-y-4 my-8">
                <Lock className="w-12 h-12 mx-auto" style={{ color: accentColor }} />
                <div>
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-50 border border-red-100"
                    style={{ color: subheadingAccent }}
                  >
                    Restricted ERSL Portal
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 mt-3">Members-Only Workspace</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Public access includes ERSL Home, People, Research Themes, Research Projects, Publications, Instruments, Software, and Datasets. Sign in via myBama / ERSL Portal to access internal lab workspaces.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSSOPopup(true)}
                    style={{ backgroundColor: accentColor }}
                    className="hover:opacity-90 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm cursor-pointer"
                  >
                    Authenticate via myBama SSO
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className="text-xs font-bold py-2.5 px-4 rounded-xl border border-gray-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            ) : (
              <>

                {/* VIEW 1: HOME PAGE (1. Aims & Mission -> 2. News -> 3. Rolling Research Themes) */}
                {activeTab === 'home' && (
                  <div className={`${siteConfig.compactMode ? 'space-y-4' : 'space-y-5'} animate-in fade-in duration-300`}>

                    {/* UA SDML-Style 2-Column Editorial Aims & Mission (Full-Height Logo Left + Content Right) */}
                    <section className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-gray-100 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-left relative">
                      {isAdmin && editMode && editingHomeSection !== 'mission' && (
                        <div className="lg:col-span-12 flex justify-end lg:mb-0 -mb-2">
                          <button
                            type="button"
                            onClick={() => openHomeSectionEditor('mission')}
                            className="sm:absolute sm:top-3 sm:right-3 z-10 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit Aims & Mission</span>
                          </button>
                        </div>
                      )}

                      <div className="lg:col-span-4 flex items-center justify-center lg:justify-start">
                        <img
                          src={(editingHomeSection === 'mission' ? homeEditDraft?.logoUrl : siteConfig.logoUrl) || 'https://alabama.box.com/shared/static/bl5k9qrcbymh4xgvlt03u8fdw81j8vlq.jpg'}
                          alt="Environmental Remote Sensing Laboratory Logo"
                          referrerPolicy="no-referrer"
                          className="w-44 sm:w-64 lg:w-full max-h-72 h-auto object-contain rounded-xl"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (!img.dataset.fallbackUsed) {
                              img.dataset.fallbackUsed = '1';
                              img.src = `${import.meta.env.BASE_URL}images/logo/logo.jpg`;
                            }
                          }}
                        />
                      </div>

                      <div className="lg:col-span-8 space-y-2.5 min-w-0 sm:pr-28">
                        {editingHomeSection === 'mission' && homeEditDraft ? (
                          <form onSubmit={saveHomeSectionEditor} className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: subheadingAccent }}>
                                Edit Aims & Mission + Logo
                              </span>
                              <button type="button" onClick={() => setEditingHomeSection(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                                Cancel
                              </button>
                            </div>
                            <div className="space-y-2.5 text-xs">
                              <div>
                                <label className="block font-bold text-slate-700 mb-1">Section Badge</label>
                                <input
                                  value={homeEditDraft.homeMission.badge}
                                  onChange={e => setHomeEditDraft({ ...homeEditDraft, homeMission: { ...homeEditDraft.homeMission, badge: e.target.value } })}
                                  className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                                />
                              </div>
                              <ImageUploadField
                                value={homeEditDraft.logoUrl || ''}
                                onChange={nextLogo => setHomeEditDraft(prev => (prev ? { ...prev, logoUrl: nextLogo } : prev))}
                                category="Logos"
                                previewShape="circle"
                                label="Lab Logo (Upload from Computer, Paste Clipboard, or URL)"
                              />
                            </div>
                            <div className="text-xs">
                              <label className="block font-bold text-slate-700 mb-1">Heading</label>
                              <input
                                value={homeEditDraft.homeMission.heading}
                                onChange={e => setHomeEditDraft({ ...homeEditDraft, homeMission: { ...homeEditDraft.homeMission, heading: e.target.value } })}
                                className="w-full p-2 border border-gray-300 rounded-lg bg-white font-bold"
                              />
                            </div>
                            <div className="text-xs">
                              <label className="block font-bold text-slate-700 mb-1">Mission Description</label>
                              <textarea
                                rows={4}
                                value={homeEditDraft.homeMission.description}
                                onChange={e => setHomeEditDraft({ ...homeEditDraft, homeMission: { ...homeEditDraft.homeMission, description: e.target.value } })}
                                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingHomeSection(null)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-slate-700 cursor-pointer">
                                Cancel
                              </button>
                              <button type="submit" style={{ backgroundColor: accentColor }} className="px-4 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer shadow-xs">
                                Save & Sync to Cloud
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <span
                              className="inline-block uppercase tracking-widest font-extrabold text-xs"
                              style={{ color: subheadingAccent }}
                            >
                              {siteConfig.homeMission.badge}
                            </span>
                            <h2
                              className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight"
                              style={{ color: subheadingAccent }}
                            >
                              {siteConfig.homeMission.heading}
                            </h2>
                            <p className="text-gray-600 text-sm leading-relaxed text-justify">
                              {siteConfig.homeMission.description}
                            </p>
                            <div className="pt-1 flex flex-wrap gap-2.5 text-xs font-bold text-gray-700">
                              <button onClick={() => setActiveTab('people')} className="px-4 py-2 rounded-lg border border-gray-200 hover:border-[#9E1B32] hover:text-[#9E1B32] transition-all bg-slate-50 hover:bg-white cursor-pointer">
                                👥 Meet the Team
                              </button>
                              <button onClick={() => setActiveTab('publications')} className="px-4 py-2 rounded-lg border border-gray-200 hover:border-[#9E1B32] hover:text-[#9E1B32] transition-all bg-slate-50 hover:bg-white cursor-pointer">
                                📄 Academic Publications
                              </button>
                              <button onClick={() => setActiveTab('research')} className="px-4 py-2 rounded-lg border border-gray-200 hover:border-[#9E1B32] hover:text-[#9E1B32] transition-all bg-slate-50 hover:bg-white cursor-pointer">
                                🔬 Research Themes
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </section>

                    {/* Public News & Lab Highlights (with Photos & Space-Optimized Subheading) */}
                    <section id="home-news" className="bg-white p-4 md:p-5 rounded-2xl shadow-xs border border-gray-100 text-left space-y-3">
                      {editingHomeSection === 'news-header' && homeEditDraft ? (
                        <form onSubmit={saveHomeSectionEditor} className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">News Eyebrow Label</label>
                              <input
                                value={homeEditDraft.newsEyebrow || ''}
                                onChange={e => setHomeEditDraft({ ...homeEditDraft, newsEyebrow: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">News Section Heading</label>
                              <input
                                value={homeEditDraft.newsHeading || ''}
                                onChange={e => setHomeEditDraft({ ...homeEditDraft, newsHeading: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg bg-white font-bold"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingHomeSection(null)} className="px-3 py-1 rounded-lg border border-gray-300 font-bold text-slate-700 cursor-pointer">
                              Cancel
                            </button>
                            <button type="submit" style={{ backgroundColor: accentColor }} className="px-3.5 py-1 rounded-lg text-white font-bold cursor-pointer">
                              Save Heading
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2.5 border-b border-gray-100">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span
                                className="text-[11px] font-extrabold uppercase tracking-widest"
                                style={{ color: subheadingAccent }}
                              >
                                {siteConfig.newsEyebrow || '📢 Latest News & Updates'}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                Public
                              </span>
                            </div>
                            <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                              {siteConfig.newsHeading || 'Publications, Field Surveys & Lab Stories'}
                            </h2>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {isAdmin && editMode && (
                              <button
                                type="button"
                                onClick={() => openHomeSectionEditor('news-header')}
                                className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1 shadow-xs transition-all cursor-pointer shrink-0"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit Heading</span>
                              </button>
                            )}
                            {(currentUser || isAdmin || editMode) && (
                              <button
                                onClick={() => {
                                  setEditingNewsItem(null);
                                  setNewsModalOpen(true);
                                }}
                                style={{ backgroundColor: accentColor }}
                                className="hover:opacity-90 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Post News / Photo</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Category Filter Tabs */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {[
                          { id: 'all', label: 'All Updates', icon: '🌐' },
                          { id: 'publication', label: 'Publications', icon: '🎓' },
                          { id: 'achievement', label: 'Achievements', icon: '🏆' },
                          { id: 'field', label: 'Field Surveys', icon: '🚁' },
                          { id: 'blog', label: 'Blogs & Notes', icon: '✍️' },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setNewsCategoryFilter(tab.id)}
                            style={newsCategoryFilter === tab.id ? { backgroundColor: accentColor } : undefined}
                            className={`px-3 py-1 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center space-x-1 ${newsCategoryFilter === tab.id
                              ? 'text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                          >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* News Grid with Photo Support */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {news
                          .filter(n => newsCategoryFilter === 'all' || (n.category || 'general') === newsCategoryFilter)
                          .map((n) => {
                            const cat = n.category || 'general';
                            const badgeStyles: Record<string, { label: string; icon: string; cls: string }> = {
                              publication: { label: 'Publication', icon: '🎓', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                              achievement: { label: 'Achievement', icon: '🏆', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                              field: { label: 'Field Campaign', icon: '🚁', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
                              blog: { label: 'Lab Blog', icon: '✍️', cls: 'bg-purple-50 text-purple-800 border-purple-200' },
                              general: { label: 'Announcement', icon: '📢', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
                            };
                            const badge = badgeStyles[cat] || badgeStyles.general;
                            const resolvedPhoto = resolveAssetUrl(n.image);

                            return (
                              <article key={n.id} className="border border-gray-100 rounded-xl overflow-hidden bg-slate-50/70 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between text-left group relative">
                                <div>
                                  {resolvedPhoto && !failedImages[`news-${n.id}`] && (
                                    <div className="h-36 bg-slate-200 overflow-hidden relative">
                                      <img
                                        src={resolvedPhoto}
                                        alt={n.imageCaption || n.title}
                                        onError={() => setFailedImages(prev => ({ ...prev, [`news-${n.id}`]: true }))}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        referrerPolicy="no-referrer"
                                      />
                                      {n.imageCaption && (
                                        <span className="absolute bottom-1.5 right-2 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-xs">
                                          {n.imageCaption}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="p-4 pb-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.cls}`}>
                                        <span>{badge.icon}</span>
                                        <span>{badge.label}</span>
                                      </span>
                                      <time className="text-[10px] font-bold text-gray-400">
                                        {new Date(n.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </time>
                                    </div>

                                    <h3 className="font-extrabold text-slate-800 text-sm leading-snug group-hover:text-[#9E1B32] transition-colors">
                                      {n.title}
                                    </h3>
                                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed whitespace-pre-line line-clamp-4 text-justify">
                                      {n.summary}
                                    </p>
                                  </div>
                                </div>

                                <div className="mx-4 mb-3 mt-1 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                                  {n.link ? (
                                    n.link.startsWith('#') ? (
                                      <button
                                        onClick={() => setActiveTab(n.link!.replace('#', ''))}
                                        style={{ color: subheadingAccent }}
                                        className="text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
                                      >
                                        <span>Explore tab →</span>
                                      </button>
                                    ) : (
                                      <a
                                        href={n.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: subheadingAccent }}
                                        className="text-xs font-bold hover:underline flex items-center gap-1"
                                      >
                                        <span>Read more →</span>
                                      </a>
                                    )
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic">Lab update</span>
                                  )}

                                  {(currentUser || isAdmin || editMode) && (
                                    <div className="flex items-center space-x-1">
                                      <button
                                        onClick={() => {
                                          setEditingNewsItem(n);
                                          setNewsModalOpen(true);
                                        }}
                                        className="p-1 text-slate-500 hover:text-[#9E1B32] hover:bg-red-50 rounded cursor-pointer transition-colors"
                                        title="Edit this announcement"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteNewsItem(n.id, n.title)}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                                        title="Delete announcement"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                      </div>
                    </section>

                    {/* 3. Rolling Research Themes Showcase (Uncropped image on top, text bar cleanly below) */}
                    {activeHeroTheme && (
                      <section className="select-none">
                        <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-xs">
                          {/* Full Uncropped Image Container (fits 3:1 collages & standard photos without cutting top/bottom) */}
                          <div className="w-full aspect-[3/1] min-h-[200px] max-h-[460px] bg-white flex items-center justify-center overflow-hidden">
                            {activeHeroImg && !failedImages[`hero-theme-${activeHeroTheme.id}`] ? (
                              <img
                                key={activeHeroTheme.id}
                                src={activeHeroImg}
                                alt={activeHeroTheme.title}
                                onError={() => setFailedImages(prev => ({ ...prev, [`hero-theme-${activeHeroTheme.id}`]: true }))}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain transition-all duration-700"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white"
                                style={{
                                  background: `radial-gradient(circle at 20% 25%, ${accentColor}cc 0%, #1e293b 60%, #0f172a 100%)`,
                                }}
                              >
                                <span className="text-[11px] font-extrabold uppercase tracking-widest text-white/80 mb-1">
                                  ERSL Research Theme
                                </span>
                                <span className="text-xl md:text-3xl font-black tracking-tight">
                                  {activeHeroTheme.title}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Dedicated Text & Navigation Bar Below Image (Zero Intersection) */}
                          <div className="px-5 py-3.5 md:px-6 md:py-4 border-t border-slate-200/80 bg-white/95 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-left">
                            <div className="space-y-1 max-w-3xl">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <h2
                                  className="text-xl md:text-2xl font-black tracking-tight leading-snug"
                                  style={{ color: subheadingAccent }}
                                >
                                  {activeHeroTheme.title}
                                </h2>
                                {isAdmin && editMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalType('research-theme');
                                      setEditingItem(activeHeroTheme);
                                      setModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit Theme & Photo</span>
                                  </button>
                                )}
                              </div>
                              {siteConfig.showSubheadings && (
                                <p className="text-xs md:text-sm text-slate-600 font-medium leading-relaxed text-justify">
                                  {activeHeroTheme.description}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedThemeDetails(activeHeroTheme);
                                    setSelectedProjectDetails(null);
                                    setActiveTab('research');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  style={{ backgroundColor: accentColor }}
                                  className="hover:opacity-90 text-white font-extrabold text-[11px] tracking-widest uppercase py-2.5 px-4 rounded-lg shadow-xs transition-all cursor-pointer"
                                >
                                  Explore Theme
                                </button>
                                <button
                                  onClick={() => setActiveTab('publications')}
                                  className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-[#9E1B32] hover:text-[#9E1B32] font-extrabold text-[11px] tracking-widest uppercase py-2.5 px-4 rounded-lg shadow-xs transition-all cursor-pointer"
                                >
                                  Publications
                                </button>
                              </div>

                              {/* Rolling 5-Theme Controls */}
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  aria-label="Previous Research Theme"
                                  onClick={() => setCurrentThemeSlide(prev => (prev - 1 + heroThemes.length) % heroThemes.length)}
                                  className="p-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#9E1B32] hover:text-[#9E1B32] transition-colors cursor-pointer"
                                >
                                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                                </button>
                                {heroThemes.map((t, i) => {
                                  const active = currentThemeSlide % heroThemes.length === i;
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      title={t.title}
                                      onClick={() => setCurrentThemeSlide(i)}
                                      style={active ? { backgroundColor: accentColor } : undefined}
                                      className={`h-2 rounded-full transition-all cursor-pointer ${active ? 'w-6' : 'w-2 bg-slate-300 hover:bg-slate-500'
                                        }`}
                                    />
                                  );
                                })}
                                <button
                                  type="button"
                                  aria-label="Next Research Theme"
                                  onClick={() => setCurrentThemeSlide(prev => (prev + 1) % heroThemes.length)}
                                  className="p-1 rounded-full border border-slate-200 text-slate-600 hover:border-[#9E1B32] hover:text-[#9E1B32] transition-colors cursor-pointer"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                  </div>
                )}

                {/* VIEW 2A: RESEARCH THEMES (clicking a card opens its dedicated ThemeSubPage) */}
                {activeTab === 'research' && (() => {
                  const activeThemeObj = selectedThemeDetails
                    ? (themes.find(t => t.id === selectedThemeDetails.id) || selectedThemeDetails)
                    : null;

                  if (activeThemeObj) {
                    return (
                      <ThemeSubPage
                        theme={activeThemeObj}
                        projects={projects}
                        publications={publications}
                        canEdit={Boolean(editMode)}
                        canShareLink={Boolean(currentUser)}
                        primaryColor={accentColor}
                        resolveThemeImage={(img) => resolveImagePath(img, 'research')}
                        onBack={() => setSelectedThemeDetails(null)}
                        onUpdateTheme={handleUpdateTheme}
                        onOpenProjectNewTab={(projId) => openProjectInNewTab(projId)}
                        onOpenAllProjects={() => {
                          setSelectedThemeDetails(null);
                          setActiveThemeFilter(activeThemeObj.id);
                          setActiveTab('projects');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    );
                  }

                  return (
                    <div className="space-y-8 animate-in fade-in duration-300">
                      <SubPageHeader
                        tabId="research"
                        defaults={{
                          badge: 'CORE RESEARCH THEMES',
                          title: 'Hydrology, GeoAI & Environmental Remote Sensing Themes',
                          subtitle: 'Click any research theme below to explore its scientific overview, linked projects, and curated publications.',
                        }}
                        override={siteConfig.pageHeaders?.research}
                        accentColor={accentColor}
                        showSubtitle={siteConfig.showSubheadings}
                        canEdit={isAdmin && editMode}
                        onSave={handleSavePageHeader}
                        actions={
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveThemeFilter('all');
                                setActiveTab('projects');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="bg-white/15 hover:bg-white/25 text-white border border-white/25 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1.5 cursor-pointer"
                            >
                              <FolderGit2 className="w-3.5 h-3.5" />
                              <span>Research Projects ({projects.length})</span>
                            </button>
                            {editMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalType('research-theme');
                                  setEditingItem(null);
                                  setModalOpen(true);
                                }}
                                style={{ color: accentColor }}
                                className="bg-white hover:bg-red-50 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Theme</span>
                              </button>
                            )}
                          </div>
                        }
                      />

                      {/* 5 General Research Themes Grid */}
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-extrabold uppercase tracking-widest" style={{ color: subheadingAccent }}>
                            Core Research Categories ({themes.length})
                          </h3>
                          <span className="text-[11px] text-gray-500">Click any category card to open its Overview, Projects &amp; Selected Publications</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {themes.map((theme) => {
                            const linkedProjectsCount = projects.filter(p => Array.isArray(p.themeIds) && p.themeIds.includes(theme.id)).length;
                            const hasPinned = Array.isArray(theme.selectedPublicationIds) && theme.selectedPublicationIds.length > 0;
                            const linkedPubsCount = hasPinned
                              ? theme.selectedPublicationIds!.length
                              : publications.filter(pub =>
                                  theme.keywords.some(kw =>
                                    pub.title.toLowerCase().includes(kw.toLowerCase()) ||
                                    pub.abstract?.toLowerCase().includes(kw.toLowerCase()) ||
                                    (pub.keywords && pub.keywords.some((pk: string) => pk.toLowerCase() === kw.toLowerCase()))
                                  )
                                ).length;

                            return (
                              <div
                                key={theme.id}
                                onClick={() => {
                                  setSelectedThemeDetails(theme);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden flex flex-col justify-between group hover:shadow-md hover:border-[#9E1B32]/50 transition-all relative cursor-pointer"
                              >
                                {editMode && (
                                  <div
                                    className="absolute top-2.5 right-2.5 flex space-x-1.5 z-10"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModalType('research-theme');
                                        setEditingItem(theme);
                                        setModalOpen(true);
                                      }}
                                      className="p-1 bg-white hover:bg-blue-50 text-blue-600 rounded border border-gray-200 shadow-xs cursor-pointer"
                                      title="Edit Theme"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(theme.id, 'research-theme', theme.title)}
                                      className="p-1 bg-white hover:bg-red-50 text-red-500 rounded border border-gray-200 shadow-xs cursor-pointer"
                                      title="Delete Theme"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}

                                <div>
                                  <div className="h-44 relative overflow-hidden bg-slate-800">
                                    {theme.image ? (
                                      <img
                                        src={
                                          failedImages[`theme-${theme.id}`]
                                            ? 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'
                                            : resolveAssetUrl(resolveImagePath(theme.image, 'research'))
                                        }
                                        onError={() => setFailedImages(prev => ({ ...prev, [`theme-${theme.id}`]: true }))}
                                        alt={theme.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center p-4 bg-slate-900">
                                        <span className="text-white font-extrabold text-xs uppercase tracking-wider">{theme.title}</span>
                                      </div>
                                    )}
                                    <span className="absolute bottom-2 left-2 bg-slate-950/75 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                                      {linkedProjectsCount} Project{linkedProjectsCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  <div className="p-4 text-left">
                                    <h4 className="font-extrabold text-sm tracking-tight group-hover:underline" style={{ color: subheadingAccent }}>
                                      {theme.title}
                                    </h4>
                                    <p className="text-gray-600 text-xs leading-relaxed mt-1.5 line-clamp-3 text-justify">{theme.description}</p>
                                  </div>
                                </div>

                                <div className="px-4 pb-4 pt-2 border-t border-gray-100 text-left space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    {theme.keywords.slice(0, 4).map(kw => (
                                      <span key={kw} className="bg-slate-100 text-slate-700 font-semibold text-[9px] px-2 py-0.5 rounded uppercase border border-slate-200">
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between gap-2 pt-1">
                                    <span className="text-[10px] font-bold text-gray-500">
                                      📖 {linkedPubsCount} publication{linkedPubsCount !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[11px] font-extrabold flex items-center gap-0.5" style={{ color: subheadingAccent }}>
                                      <span>Open Theme Page</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* VIEW 2B: RESEARCH PROJECTS (Separate top-level tab; each project opens as standalone portal in a new tab) */}
                {activeTab === 'projects' && (() => {
                  const activeProj = selectedProjectDetails
                    ? (projects.find(p => p.id === selectedProjectDetails.id) || selectedProjectDetails)
                    : null;

                  if (activeProj) {
                    return (
                      <ProjectSubPage
                        project={activeProj}
                        themes={themes}
                        people={people}
                        currentUser={currentUser}
                        canEdit={Boolean(editMode)}
                        editMode={Boolean(editMode)}
                        siteConfig={siteConfig}
                        primaryColor={accentColor}
                        initialSubTabId={selectedProjectSubTabId}
                        onBack={() => {
                          setSelectedProjectDetails(null);
                          setSelectedProjectSubTabId(undefined);
                        }}
                        onUpdateProject={handleUpdateProject}
                        onLoginClick={() => setShowSSOPopup(true)}
                        onToggleEditMode={() => setEditMode(prev => !prev)}
                        onLogout={handleLogout}
                      />
                    );
                  }

                  const visibleProjects = activeThemeFilter === 'all'
                    ? projects
                    : projects.filter(p => Array.isArray(p.themeIds) && p.themeIds.includes(activeThemeFilter));

                  return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <SubPageHeader
                        tabId="projects"
                        defaults={{
                          badge: 'FUNDED RESEARCH PORTFOLIO',
                          title: 'Research Projects & Sponsor Portals',
                          subtitle: 'Click any project card below to open its standalone, shareable project webpage in a new browser tab.',
                        }}
                        override={siteConfig.pageHeaders?.projects}
                        accentColor={accentColor}
                        showSubtitle={siteConfig.showSubheadings}
                        canEdit={isAdmin && editMode}
                        onSave={handleSavePageHeader}
                        actions={
                          editMode ? (
                            <button
                              type="button"
                              onClick={() => {
                                setModalType('project');
                                setEditingItem(null);
                                setModalOpen(true);
                              }}
                              style={{ color: accentColor }}
                              className="bg-white hover:bg-red-50 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Research Project</span>
                            </button>
                          ) : undefined
                        }
                      />

                      {/* Theme Filter Bar + Connected Research Projects Section */}
                      <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: subheadingAccent }}>
                              Active &amp; Completed Projects ({visibleProjects.length})
                            </span>
                            <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                              Sponsored Research Portals — Open in New Tab or Share Link
                            </h3>
                          </div>

                          {editMode && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalType('project');
                                setEditingItem(null);
                                setModalOpen(true);
                              }}
                              style={{ backgroundColor: accentColor }}
                              className="hover:opacity-90 text-white text-xs font-bold py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Research Project</span>
                            </button>
                          )}
                        </div>

                        {/* Filter pills */}
                        <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
                          <button
                            type="button"
                            onClick={() => setActiveThemeFilter('all')}
                            style={activeThemeFilter === 'all' ? { backgroundColor: accentColor } : undefined}
                            className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${activeThemeFilter === 'all'
                              ? 'text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                          >
                            All Themes ({projects.length})
                          </button>
                          {themes.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setActiveThemeFilter(t.id)}
                              style={activeThemeFilter === t.id ? { backgroundColor: accentColor } : undefined}
                              className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${activeThemeFilter === t.id
                                ? 'text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                              {t.title} ({projects.filter(p => Array.isArray(p.themeIds) && p.themeIds.includes(t.id)).length})
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                          {visibleProjects.map((proj) => {
                            const projThemes = themes.filter(t => Array.isArray(proj.themeIds) && proj.themeIds.includes(t.id));
                            return (
                              <div
                                key={proj.id}
                                onClick={() => openProjectInNewTab(proj.id)}
                                style={{ borderLeftColor: accentColor }}
                                className="bg-slate-50/70 hover:bg-white p-5 rounded-xl border border-gray-200 border-l-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group relative"
                              >
                                {editMode && (
                                  <div
                                    className="flex items-center gap-1.5 mb-2 justify-end"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModalType('project');
                                        setEditingItem(proj);
                                        setModalOpen(true);
                                      }}
                                      className="p-1 bg-white hover:bg-blue-50 text-blue-600 rounded border border-gray-200 cursor-pointer"
                                      title="Edit Project Metadata"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(proj.id, 'project', proj.title)}
                                      className="p-1 bg-white hover:bg-red-50 text-red-500 rounded border border-gray-200 cursor-pointer"
                                      title="Delete Project"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}

                                <div>
                                  <div className="flex justify-between items-center gap-2">
                                    <span
                                      className="text-[11px] font-bold px-2 py-0.5 rounded border"
                                      style={{ color: subheadingAccent, backgroundColor: `${subheadingAccent}10`, borderColor: `${subheadingAccent}30` }}
                                    >
                                      {proj.sponsor || proj.agency || 'ERSL Grant'}
                                    </span>
                                    <span className="text-[11px] font-bold flex items-center space-x-1" style={{ color: subheadingAccent }}>
                                      <span>Open in New Tab</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </span>
                                  </div>

                                  <h4 className="font-extrabold text-slate-900 text-sm mt-2.5 group-hover:text-[#9E1B32] transition-colors">
                                    {proj.title}
                                  </h4>
                                  <p className="text-gray-600 text-xs mt-1.5 leading-relaxed line-clamp-3 text-justify">
                                    {proj.summary || proj.details}
                                  </p>

                                  {/* Connected Theme Badges */}
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {projThemes.length > 0 ? projThemes.map(pt => (
                                      <span key={pt.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-700 border border-gray-200">
                                        🏷️ {pt.title}
                                      </span>
                                    )) : (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                        ⚠️ Assign Research Theme
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div
                                  className="border-t border-gray-200 pt-2.5 mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500 font-bold"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {currentUser ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const shareUrl = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(proj.id)}`;
                                        navigator.clipboard?.writeText(shareUrl);
                                        setCopiedProjectUrlId(proj.id);
                                        setTimeout(() => setCopiedProjectUrlId(null), 2000);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-gray-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                    >
                                      {copiedProjectUrlId === proj.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          <span className="text-emerald-700">Sponsor Link Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Copy Sponsor Link</span>
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">Open standalone project page &rarr;</span>
                                  )}

                                  <span className="uppercase tracking-wider font-extrabold" style={{ color: subheadingAccent }}>
                                    {proj.status || 'Active'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* VIEW 3: PUBLICATIONS PORTAL */}
                {activeTab === 'publications' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="publications"
                      defaults={{
                        badge: 'ACADEMIC OUTPUTS',
                        title: 'Peer-Reviewed Publications',
                        subtitle:
                          'Journal articles, international congress presentations, and technical hydrographic reports compiled by the ERSL facility.',
                      }}
                      override={siteConfig.pageHeaders?.publications}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                    />

                    {/* Filter and Search controls */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-5 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search articles by title, author, or venue..."
                          value={pubSearch}
                          onChange={(e) => setPubSearch(e.target.value)}
                          className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 rounded border border-gray-200 focus:outline-none focus:border-[#9E1B32]"
                        />
                      </div>

                      <div className="md:col-span-3 flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-400 shrink-0 uppercase tracking-wider">Type:</span>
                        <select
                          value={pubFilter}
                          onChange={(e) => setPubFilter(e.target.value)}
                          className="w-full text-xs p-2 bg-slate-50 border border-gray-200 rounded focus:outline-none focus:border-[#9E1B32] font-semibold text-gray-700"
                        >
                          <option value="All">All Publications</option>
                          <option value="Peer-Reviewed Article">Peer-Reviewed Articles</option>
                          <option value="Conference">Conference Proceedings</option>
                          <option value="Other">Other Reports</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-400 shrink-0 uppercase tracking-wider">Sort:</span>
                        <select
                          value={pubSort}
                          onChange={(e) => setPubSort(e.target.value as 'newest' | 'oldest')}
                          className="w-full text-xs p-2 bg-slate-50 border border-gray-200 rounded focus:outline-none focus:border-[#9E1B32] font-semibold text-gray-700"
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2">
                        {(currentUser || isAdmin || editMode) ? (
                          <>
                            <button
                              onClick={() => {
                                setModalType('publication');
                                setEditingItem(null);
                                setModalOpen(true);
                              }}
                              className="bg-[#9E1B32] hover:bg-red-800 text-white font-bold text-xs py-2 px-3 rounded flex items-center justify-center space-x-1 shadow-sm cursor-pointer shrink-0"
                              title="Add publication"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>

                            {publications.length > 0 && (
                              <button
                                onClick={() => {
                                  if (confirm("Are you sure you want to clear all publications? The catalog will be completely emptied. You can add papers manually by DOI or sync from Google Scholar.")) {
                                    setPublications([]);
                                    localStorage.setItem('ersl_publications', JSON.stringify([]));
                                    appendAuditLog('CLEAR_PUBLICATIONS', 'Cleared all publications from website catalog');
                                  }
                                }}
                                className="bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 text-xs font-bold py-2 px-2.5 rounded flex items-center justify-center space-x-1 cursor-pointer shrink-0"
                                title="Clear all publication records"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear All</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider text-center md:text-right">
                            📖 {filteredPublications.length} Records
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dynamic publications render */}
                    <div className="space-y-4">
                      {filteredPublications.length === 0 ? (
                        <div className="bg-white p-12 rounded-xl border border-gray-100 text-center text-gray-500 shadow-sm space-y-3">
                          <FileText className="w-12 h-12 mx-auto text-gray-300" />
                          <div>
                            <h4 className="text-sm font-bold text-gray-700">No publication records currently displayed.</h4>
                            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                              {currentUser
                                ? 'Click "+ Add" above to add research publications.'
                                : 'Publications will be displayed here once cataloged by the laboratory.'}
                            </p>
                          </div>
                          {(currentUser || isAdmin || editMode) && (
                            <button
                              onClick={() => {
                                setModalType('publication');
                                setEditingItem(null);
                                setModalOpen(true);
                              }}
                              className="bg-[#9E1B32] hover:bg-red-800 text-white font-bold text-xs py-2 px-4 rounded-lg inline-flex items-center space-x-1.5 shadow-sm cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Publication</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100 text-left">
                          {filteredPublications.map((pub) => (
                            <div key={pub.id} className="p-5 flex items-start space-x-4 hover:bg-slate-50/30 transition-colors group relative">

                              {/* Badge indicator */}
                              <span className="bg-red-50 text-[#9E1B32] font-extrabold text-[10px] px-2.5 py-1 rounded border border-red-100 h-6 shrink-0 shadow-xs">
                                {pub.year}
                              </span>

                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-extrabold text-[#9E1B32] uppercase tracking-wider text-[9px]">
                                  {pub.type}
                                </p>
                                <h4 className="text-sm font-bold text-slate-800 leading-snug mt-1 max-w-4xl">
                                  {pub.title}
                                </h4>
                                <p className="text-xs text-slate-500 font-semibold mt-1.5">
                                  <strong>{pub.authors}</strong> | <span className="italic">{pub.venue}</span>
                                </p>

                                {pub.link && (
                                  <a
                                    href={pub.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-800 mt-2 hover:underline"
                                  >
                                    <span>DOI Access URL</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>

                              {/* Interactive elements on individual record */}
                              {(currentUser || isAdmin || editMode) && (
                                <div className="flex space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setModalType('publication');
                                      setEditingItem(pub);
                                      setModalOpen(true);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition-colors"
                                    title="Edit Publication"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(pub.id, 'publication', pub.title)}
                                    className="p-1 text-red-500 hover:bg-red-50 border border-gray-200 rounded cursor-pointer transition-colors"
                                    title="Delete Publication"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                            </div>
                          ))}
                        </div>
                      )}
                    </div>



                  </div>
                )}

                {/* VIEW: PROFESSIONAL DEVELOPMENT (RESTRICTED FOR MEMBERS ONLY) */}
                {activeTab === 'professional' && (
                  currentUser ? (
                    <ProfessionalDevelopment currentUser={currentUser} {...getSubHeaderPassProps('professional')} />
                  ) : (
                    <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center max-w-lg mx-auto shadow-sm space-y-5 animate-in fade-in duration-300">
                      <div className="w-16 h-16 rounded-full bg-red-50 text-[#9E1B32] flex items-center justify-center mx-auto border border-red-100">
                        <Lock className="w-8 h-8" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9E1B32] bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                          CONFIDENTIAL MEMBER RESOURCE
                        </span>
                        <h3 className="text-lg font-extrabold text-slate-800 mt-2">Professional Development Vault Is Restricted</h3>
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                          Proprietary journal manuscript frameworks, peer-reviewer rebuttal toolkits, NASA/NSF grant templates, and lab writing materials are reserved exclusively for authorized University of Alabama ERSL researchers.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowSSOPopup(true)}
                        className="bg-[#9E1B32] hover:bg-red-800 text-white text-xs font-bold py-2.5 px-6 rounded-lg transition-all shadow-md shadow-red-950/20 cursor-pointer inline-flex items-center space-x-2"
                      >
                        <span>Authenticate via myBama SSO or Member Login</span>
                      </button>
                    </div>
                  )
                )}

                {/* VIEW 4: SOFTWARE & MODELS */}
                {activeTab === 'software' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="software"
                      defaults={{
                        badge: 'OPEN CODE & TOOLKITS',
                        title: 'Software & Computational Models',
                        subtitle:
                          'Open-source geospatial toolkits, river boundary segmentation architectures, and change-point detectors compiled in Python and R.',
                      }}
                      override={siteConfig.pageHeaders?.software}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                      actions={
                        editMode ? (
                          <button
                            type="button"
                            onClick={() => {
                              setModalType('software');
                              setEditingItem(null);
                              setModalOpen(true);
                            }}
                            style={{ color: accentColor }}
                            className="bg-white hover:bg-red-50 font-bold text-xs py-2 px-3.5 rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Software</span>
                          </button>
                        ) : undefined
                      }
                    />

                    {/* Card grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                      {softwareList.map((soft) => (
                        <div key={soft.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative group">
                          <div>
                            <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${soft.language === 'Python'
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-purple-50 text-purple-600 border-purple-100'
                                }`}>
                                {soft.language}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400 font-mono text-[10px]">Open Source</span>
                                {editMode && (
                                  <div className="flex space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModalType('software');
                                        setEditingItem(soft);
                                        setModalOpen(true);
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer"
                                      title="Edit Software"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(soft.id, 'software', soft.title)}
                                      className="p-1 text-red-500 hover:bg-red-50 border border-gray-200 rounded cursor-pointer"
                                      title="Delete Software"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <h4 className="text-sm font-extrabold text-slate-900 mt-3">{soft.title}</h4>
                            <p className="text-gray-600 text-xs mt-2 leading-relaxed text-justify">{soft.description}</p>
                          </div>

                          <div className="border-t border-gray-100 pt-3 mt-4 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-400">LICENSE: MIT OPEN SOURCE</span>
                            {soft.link && (
                              <a
                                href={soft.link}
                                target="_blank"
                                rel="noreferrer"
                                style={{ backgroundColor: '#0f172a' }}
                                className="hover:opacity-90 text-white text-[11px] font-bold py-1.5 px-3.5 rounded-lg flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                              >
                                <span>Open Repository / Box</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VIEW 5: DATASETS & DATA LAYERS */}
                {activeTab === 'data' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="data"
                      defaults={{
                        badge: 'DATASETS & UA BOX REPOSITORIES',
                        title: 'Datasets & Environmental Data Layers',
                        subtitle:
                          'Access points for open-source global satellite archives and UA Box field-surveyed geomorphic datasets.',
                      }}
                      override={siteConfig.pageHeaders?.data}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                    />

                    {/* Filter and Add */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filter data layers..."
                          value={dataSearch}
                          onChange={(e) => setDataSearch(e.target.value)}
                          className="w-full text-xs pl-9 pr-3 py-2 bg-white rounded border border-gray-200 focus:outline-none focus:border-[#9E1B32] shadow-xs"
                        />
                      </div>

                      {editMode && (
                        <button
                          onClick={() => {
                            setModalType('data-layer');
                            setEditingItem(null);
                            setModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3.5 rounded flex items-center space-x-1 shadow-sm hover:cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Data Layer</span>
                        </button>
                      )}
                    </div>

                    {/* Lists */}
                    <div className="space-y-4 text-left">
                      {dataLayers
                        .filter(data => data.name.toLowerCase().includes(dataSearch.toLowerCase()) || data.description.toLowerCase().includes(dataSearch.toLowerCase()))
                        .map((data) => (
                          <div
                            key={data.id}
                            className="bg-white p-5 rounded-xl border border-gray-100 border-l-4 border-l-[#9E1B32] shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative group"
                          >

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2.5">
                                <h4 className="text-sm font-extrabold text-slate-800">{data.name}</h4>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${data.availability === 'Public'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : data.availability === 'Request'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                  }`}>
                                  {data.availability}
                                </span>
                              </div>
                              <p className="text-gray-500 text-xs mt-2 leading-relaxed max-w-4xl text-justify">{data.description}</p>
                            </div>

                            {/* Actions and access buttons */}
                            <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                              {data.link && (
                                <a
                                  href={data.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="bg-[#9E1B32] hover:bg-red-800 text-white text-[10px] font-bold py-1.5 px-4 rounded shadow-sm flex items-center space-x-1.5 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Fetch Dataset</span>
                                </a>
                              )}

                              {editMode && (
                                <div className="flex space-x-1 opacity-85 group-hover:opacity-100 transition-opacity pl-2 border-l border-gray-100">
                                  <button
                                    onClick={() => {
                                      setModalType('data-layer');
                                      setEditingItem(data);
                                      setModalOpen(true);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition-colors"
                                    title="Edit Dataset"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(data.id, 'data-layer', data.name)}
                                    className="p-1 text-red-500 hover:bg-red-50 border border-gray-200 rounded cursor-pointer transition-colors"
                                    title="Delete Dataset"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                          </div>
                        ))}
                    </div>

                  </div>
                )}

                {/* VIEW 6: INSTRUMENTS & FACILITIES */}
                {activeTab === 'instruments' && (() => {
                  const activeInstObj = selectedInstrumentDetails
                    ? (instruments.find(i => i.id === selectedInstrumentDetails.id) || selectedInstrumentDetails)
                    : null;

                  if (activeInstObj) {
                    return (
                      <InstrumentSubPage
                        instrument={activeInstObj}
                        currentUser={currentUser}
                        canEdit={Boolean(editMode)}
                        primaryColor={accentColor}
                        resolveInstrumentImage={(img) => resolveImagePath(img, 'instruments')}
                        onBack={() => setSelectedInstrumentDetails(null)}
                        onUpdateInstrument={handleUpdateInstrument}
                        onLoginClick={() => setShowSSOPopup(true)}
                      />
                    );
                  }

                  return (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="instruments"
                      defaults={{
                        badge: 'PHYSICAL ASSETS & SENSORS',
                        title: 'Research Instruments & Field Facilities',
                        subtitle:
                          'Aerial mapping, geodetic positioning, and underwater acoustic stream gauging systems stationed at the ERSL facility.',
                      }}
                      override={siteConfig.pageHeaders?.instruments}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                    />

                    {/* Grid */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest">Active Equipment Registry</h3>
                        {editMode && (
                          <button
                            onClick={() => {
                              setModalType('instrument');
                              setEditingItem(null);
                              setModalOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3.5 rounded flex items-center space-x-1 shadow-sm hover:cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Instrument</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                        {instruments.map((inst) => (
                          <div
                            key={inst.id}
                            onClick={() => {
                              setSelectedInstrumentDetails(inst);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col justify-between group hover:shadow-md hover:border-[#9E1B32]/40 transition-all relative min-h-[400px] h-full cursor-pointer"
                          >

                            {editMode && (
                              <div className="absolute top-2.5 right-2.5 flex space-x-1.5 z-10" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    setModalType('instrument');
                                    setEditingItem(inst);
                                    setModalOpen(true);
                                  }}
                                  className="p-1 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-800 rounded border border-gray-200 shadow-sm cursor-pointer"
                                  title="Edit Equipment"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(inst.id, 'instrument', inst.name)}
                                  className="p-1 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 rounded border border-gray-200 shadow-sm cursor-pointer"
                                  title="Delete Equipment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            <div>
                              {/* Photo display: scales any aspect ratio proportionally to fit cleanly inside the box without cropping */}
                              {inst.image && (inst.image.startsWith('http') || inst.image.startsWith('data:') || inst.image.includes('.')) ? (
                                <div className="h-48 w-full bg-slate-50/80 border-b border-gray-100 flex items-center justify-center p-3 overflow-hidden relative select-none">
                                  <img
                                    src={
                                      failedImages[`inst-${inst.id}`]
                                        ? 'https://images.unsplash.com/photo-1508962914676-134849a727f0?auto=format&fit=crop&w=400&q=80'
                                        : resolveAssetUrl(resolveImagePath(inst.image, 'instruments'))
                                    }
                                    onError={() => {
                                      setFailedImages(prev => ({ ...prev, [`inst-${inst.id}`]: true }));
                                    }}
                                    alt={inst.name}
                                    className="max-w-full max-h-full w-auto h-auto object-contain group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="absolute bottom-2 left-2 text-[9px] font-bold text-slate-600 tracking-wider uppercase border border-slate-200 bg-white/95 px-2 py-0.5 rounded shadow-xs z-10">
                                    {inst.category}
                                  </span>
                                </div>
                              ) : (
                                <div className="bg-gradient-to-br from-red-50 to-slate-100 h-48 flex flex-col items-center justify-center p-6 border-b border-gray-50 relative select-none text-center">
                                  <span className="text-[#9E1B32] text-3xl mb-1 shrink-0">🛰️</span>
                                  <span className="text-[10px] font-bold text-slate-400 tracking-wider mt-1 uppercase border border-slate-200 bg-white/80 px-2 py-0.5 rounded shadow-xs">
                                    {inst.category}
                                  </span>
                                </div>
                              )}

                              <div className="p-5 overflow-hidden">
                                <h4 className="font-extrabold text-[#9E1B32] text-sm tracking-tight leading-snug line-clamp-1 group-hover:underline">{inst.name}</h4>
                                <p className="text-gray-500 text-[11px] leading-relaxed mt-2 line-clamp-4 text-justify">{inst.description}</p>

                                {/* Quick Operating Manual Download Link */}
                                {inst.manualLink && (
                                  <div className="mt-3.5 pt-3 border-t border-dashed border-gray-100" onClick={e => e.stopPropagation()}>
                                    <a
                                      href={inst.manualLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#9E1B32] hover:text-red-800 font-extrabold text-[10px] uppercase flex items-center space-x-1 tracking-wider"
                                    >
                                      <span>📖</span>
                                      <span>Download Operating Manual (PDF)</span>
                                      <span>&rarr;</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="p-5 pt-0 border-t border-gray-50 mt-4 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                              <span className="text-green-600 flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block mr-1"></span>
                                <span>Field Ready</span>
                              </span>
                              <span className="text-[#9E1B32] flex items-center gap-0.5 font-extrabold">
                                <span>Specs &amp; Manuals</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>

                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                  );
                })()}

                {/* VIEW 7: PEOPLE / LAB ROSTER */}
                {activeTab === 'people' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="people"
                      defaults={{
                        badge: 'RESEARCH DIRECTORY',
                        title: 'Our Researchers',
                        subtitle:
                          'Dedicated professors, postdoctoral fellows, and graduate research students driving hydrographic innovations inside the ERSL.',
                      }}
                      override={siteConfig.pageHeaders?.people}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                    />

                    {/* List */}
                    <div className="space-y-6">
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <h3 className="text-sm font-extrabold uppercase tracking-widest" style={{ color: subheadingAccent }}>
                          {peopleSubTab === 'former' ? 'Former Members' : peopleSubTab === 'collaborator' ? 'Research Collaborators' : 'Active Team Roster'}
                        </h3>
                        {editMode && (
                          <div className="flex flex-wrap items-center gap-2">
                            {peopleSubTab === 'former' && people.some(p => (p.group || 'member') === 'member') && (
                              <select
                                value=""
                                onChange={e => {
                                  const selected = people.find(p => p.id === e.target.value);
                                  if (!selected) return;
                                  setModalType('person');
                                  setEditingItem(selected);
                                  setPersonGroupOverride('former');
                                  setModalOpen(true);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 border border-gray-300 text-slate-800 font-bold text-xs py-1.5 px-3 rounded cursor-pointer"
                                title="Convert an active team member into Former Members"
                              >
                                <option value="">+ Move Team Member to Former...</option>
                                {people
                                  .filter(p => (p.group || 'member') === 'member')
                                  .map(tm => (
                                    <option key={tm.id} value={tm.id}>
                                      {tm.name} ({tm.role})
                                    </option>
                                  ))}
                              </select>
                            )}
                            <button
                              onClick={() => {
                                setModalType('person');
                                setEditingItem(null);
                                setPersonGroupOverride(undefined);
                                setModalOpen(true);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3.5 rounded flex items-center space-x-1 shadow-sm hover:cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                {peopleSubTab === 'former' ? 'Add Former Member' : peopleSubTab === 'collaborator' ? 'Add Collaborator' : 'Add Member Profile'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 border-b border-gray-200">
                        {([
                          ['member', 'Team'],
                          ['collaborator', 'Collaborators'],
                          ['former', 'Former Members'],
                        ] as const).map(([k, label]) => (
                          <button
                            key={k}
                            onClick={() => setPeopleSubTab(k)}
                            className={`px-5 py-2.5 text-sm font-bold -mb-px border-b-2 transition-colors cursor-pointer ${peopleSubTab === k ? 'border-[#9E1B32] text-[#9E1B32]' : 'border-transparent text-gray-500 hover:text-gray-800'
                              }`}
                          >
                            {label} ({people.filter(p => (p.group || 'member') === k).length})
                          </button>
                        ))}
                      </div>

                      <div className="space-y-10">
                        {([
                          { key: 'member', title: 'Team' },
                          { key: 'collaborator', title: 'Collaborators' },
                          { key: 'former', title: 'Former Members' },
                        ] as const).filter(g => g.key === peopleSubTab).map(({ key, title }) => {
                          const group = people.filter(p => (p.group || 'member') === key);
                          if (group.length === 0) return (
                            <div key={key} className="bg-white p-10 rounded-xl border border-dashed border-gray-300 text-center text-sm text-gray-500">
                              No {title.toLowerCase()} listed yet.{editMode ? ' Click Add above or convert a current Team member.' : ''}
                            </div>
                          );

                          // Dedicated 4-column Alumni / Former Members editorial directory layout
                          if (key === 'former') {
                            return (
                              <div key={key} className="space-y-5">
                                <h3 className="text-lg font-extrabold text-slate-800 border-b-2 border-[#9E1B32] inline-block pb-1">
                                  Former Members
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
                                  {group.map(person => {
                                    const stints =
                                      Array.isArray(person.formerStints) && person.formerStints.length > 0
                                        ? person.formerStints
                                        : [
                                          {
                                            role: person.role,
                                            years: person.formerYears || '',
                                            topic: person.formerTopic || person.researchFocus || '',
                                          },
                                        ].filter(s => s.role || s.years || s.topic);

                                    return (
                                      <div
                                        key={person.id}
                                        className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between gap-3 relative"
                                      >
                                        {editMode && (
                                          <div className="flex items-center justify-end gap-1 pb-1 border-b border-gray-100">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setModalType('person');
                                                setEditingItem(person);
                                                setPersonGroupOverride('member');
                                                setModalOpen(true);
                                              }}
                                              className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                                              title="Move back to active Team"
                                            >
                                              Move to Team
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setModalType('person');
                                                setEditingItem(person);
                                                setPersonGroupOverride(undefined);
                                                setModalOpen(true);
                                              }}
                                              className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                              title="Edit Former Member"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteItem(person.id, 'person', person.name)}
                                              className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                              title="Delete Former Member"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )}

                                        <div className="space-y-2.5">
                                          <h4 className="text-lg font-extrabold text-slate-900 leading-snug">
                                            {person.name}
                                          </h4>

                                          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                                            {stints.map((st, sIdx) => (
                                              <p key={sIdx}>
                                                <span className="font-bold text-slate-800">{st.role}</span>
                                                {st.years ? `, ${st.years}` : ''}
                                                {st.topic ? `, ${st.topic}` : ''}
                                              </p>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-gray-100">
                                          {person.currentAffiliation && (
                                            <p className="text-[11px] font-semibold text-slate-700 leading-snug">
                                              <span className="text-[10px] uppercase tracking-wider font-extrabold block text-[#9E1B32]">
                                                Current Affiliation
                                              </span>
                                              {person.currentAffiliation}
                                            </p>
                                          )}

                                          {(person.email || person.scholar || person.linkedin) && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                              {person.email && (
                                                <a
                                                  href={`mailto:${person.email}`}
                                                  className="p-1.5 rounded bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-[#9E1B32] border border-gray-200"
                                                  title="Email"
                                                >
                                                  <Mail className="w-3 h-3" />
                                                </a>
                                              )}
                                              {person.scholar && (
                                                <a
                                                  href={person.scholar}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 text-[9px] font-bold text-slate-600 hover:text-blue-600 border border-gray-200"
                                                >
                                                  SCHOLAR
                                                </a>
                                              )}
                                              {person.linkedin && (
                                                <a
                                                  href={person.linkedin}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 text-[9px] font-bold text-slate-600 hover:text-blue-700 border border-gray-200"
                                                >
                                                  LINKEDIN
                                                </a>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={key} className="space-y-4">
                              <h3 className="text-lg font-extrabold text-slate-800 border-b-2 border-[#9E1B32] inline-block pb-1">{title}</h3>
                              <div className="grid grid-cols-1 gap-8 text-left">
                                {group.map((person) => (
                                  <div key={person.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row overflow-hidden group hover:shadow-md transition-shadow relative h-[480px] md:h-[280px]">

                                    {/* Admin actions */}
                                    {editMode && (
                                      <div className="absolute top-4 right-4 flex space-x-1.5 z-10">
                                        {key === 'member' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setModalType('person');
                                              setEditingItem(person);
                                              setPersonGroupOverride('former');
                                              setModalOpen(true);
                                            }}
                                            className="px-2 py-1 bg-white hover:bg-amber-50 text-amber-800 rounded border border-amber-200 shadow-sm cursor-pointer transition-colors text-[10px] font-bold"
                                            title="Graduate / Move to Former Members"
                                          >
                                            Move to Former
                                          </button>
                                        )}
                                        <button
                                          onClick={() => {
                                            setModalType('person');
                                            setEditingItem(person);
                                            setPersonGroupOverride(undefined);
                                            setModalOpen(true);
                                          }}
                                          className="p-1 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-800 rounded border border-gray-200 shadow-sm cursor-pointer transition-colors"
                                          title="Edit Profile"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteItem(person.id, 'person', person.name)}
                                          className="p-1 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 rounded border border-gray-200 shadow-sm cursor-pointer transition-colors"
                                          title="Delete Profile"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}

                                    {/* Left: Image Column (fixed width/height on both mobile and desktop to ensure no squishing/warping) */}
                                    <div className="w-full md:w-[220px] lg:w-[240px] bg-slate-50 relative shrink-0 h-[200px] md:h-full">
                                      {person.image && !failedImages[`person-${person.id}`] ? (
                                        <img
                                          src={resolveImagePath(person.image, 'people')}
                                          onError={() => {
                                            setFailedImages(prev => ({ ...prev, [`person-${person.id}`]: true }));
                                          }}
                                          alt={person.name}
                                          className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] object-cover object-top rounded-xl shadow-xs select-none animate-in fade-in duration-300"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="absolute inset-3 bg-red-50 flex flex-col items-center justify-center rounded-xl font-bold text-[#9E1B32] select-none animate-in zoom-in-75">
                                          <span className="text-4xl">{getCleanInitials(person.name)}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Right: Info Column with fixed/responsive height to align with outer boundaries */}
                                    <div className="flex-1 p-5 md:p-6 flex flex-col justify-between overflow-hidden h-[280px] md:h-full">
                                      <div>
                                        <div className="border-b border-gray-100 pb-2 mb-3 flex flex-wrap items-start justify-between gap-2">
                                          <div>
                                            <h4 className="text-lg md:text-xl font-extrabold text-[#9E1B32] tracking-tight">{person.name}</h4>
                                            <h6 className="text-xs font-semibold text-gray-500 mt-0.5 capitalize tracking-wide">{person.role}</h6>
                                          </div>
                                          {editMode && key === 'member' && person.expectedGraduationDate && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                              Auto-graduates: {person.expectedGraduationDate}
                                            </span>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <p className="text-xs md:text-sm text-gray-800 leading-relaxed line-clamp-2">
                                            <strong className="text-gray-900 font-extrabold">Research Focus:</strong>{' '}
                                            <span className="font-semibold text-gray-600">{person.researchFocus}</span>
                                          </p>
                                          <p className="text-xs md:text-sm text-gray-600 leading-relaxed font-normal text-justify line-clamp-4 md:line-clamp-3 lg:line-clamp-4" id={`bio-${person.id}`}>
                                            {person.bio}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Social networks & links */}
                                      <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between items-center text-xs shrink-0">
                                        <div className="flex items-center space-x-2.5">
                                          {person.email && (
                                            <a
                                              href={`mailto:${person.email}`}
                                              className="bg-slate-50 hover:bg-red-50 hover:text-[#9E1B32] border border-gray-200 text-gray-600 py-1.5 px-3 rounded-lg shadow-xs transition-colors flex items-center justify-center"
                                              title="Email Contact"
                                            >
                                              <Mail className="w-4 h-4 mr-1.5" />
                                              <span className="font-semibold text-xs pr-1">Email</span>
                                            </a>
                                          )}
                                          {person.scholar && (
                                            <a
                                              href={person.scholar}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 text-gray-600 py-1.5 px-3 rounded-lg shadow-xs transition-colors flex items-center justify-center"
                                              title="Google Scholar Profile"
                                            >
                                              <span className="font-bold text-[10px] px-1">SCHOLAR</span>
                                            </a>
                                          )}
                                          {person.linkedin && (
                                            <a
                                              href={person.linkedin}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 text-gray-600 py-1.5 px-3 rounded-lg shadow-xs transition-colors flex items-center justify-center"
                                              title="LinkedIn Profile"
                                            >
                                              <span className="font-bold text-[10px] px-1">LINKEDIN</span>
                                            </a>
                                          )}
                                        </div>

                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">UA GEOGRAPHY</span>
                                      </div>
                                    </div>

                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

                {/* VIEW: TEACHING MATERIALS (Point 5) */}
                {activeTab === 'teaching' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="teaching"
                      defaults={{
                        badge: 'LAB MEMBER PORTAL',
                        title: 'Teaching & Lab Training Materials',
                        subtitle:
                          'Course syllabi, processing checklists, hardware tutorials, and sensor calibration guides.',
                      }}
                      override={siteConfig.pageHeaders?.teaching}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                    />

                    {/* Filter and Add */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                      <div>
                        <h3 className="text-sm font-extrabold uppercase tracking-widest text-left" style={{ color: subheadingAccent }}>Internal Education Archive</h3>
                      </div>

                      {editMode && (
                        <button
                          onClick={() => {
                            setModalType('teaching');
                            setEditingItem(null);
                            setModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3.5 rounded flex items-center space-x-1 shadow-sm hover:cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Upload Teaching Material</span>
                        </button>
                      )}
                    </div>

                    {/* Teaching materials list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                      {teachingList.map((material) => (
                        <div key={material.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative group">

                          {editMode && (
                            <div className="absolute top-4 right-4 flex space-x-1.5 opacity-85 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setModalType('teaching');
                                  setEditingItem(material);
                                  setModalOpen(true);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 border border-gray-200 rounded cursor-pointer transition-colors"
                                title="Edit Course Material"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(material.id, 'teaching', material.title)}
                                className="p-1 text-red-500 hover:bg-red-50 border border-gray-200 rounded cursor-pointer transition-colors"
                                title="Delete Course Material"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="bg-red-50 text-[#9E1B32] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-red-100">
                                {material.course || 'GY General'}
                              </span>
                              <span className="text-gray-400 font-mono text-[9px]">Last revised: {material.updatedAt}</span>
                            </div>

                            <h4 className="text-sm font-extrabold text-slate-800 mt-3">{material.title}</h4>
                            <p className="text-gray-500 text-xs mt-2.5 leading-relaxed text-justify">{material.description}</p>
                          </div>

                          <div className="border-t border-gray-50 pt-4 mt-6 flex justify-between items-center">
                            <span className="text-[9px] font-bold text-[#9E1B32] uppercase tracking-wider">🔒 RESTRICTED INTERNAL</span>
                            {material.link && (
                              <a
                                href={material.link}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-slate-900 hover:bg-[#9E1B32] text-white text-[10px] font-bold py-1.5 px-3.5 rounded flex items-center space-x-1 shadow-sm transition-all cursor-pointer"
                              >
                                <span>Access Material (Box)</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VIEW 7B: LAB BULLETINS & ANNOUNCEMENTS (Pop-Up Editor, Full-Width News Feed) */}
                {activeTab === 'bulletins' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="bulletins"
                      defaults={{
                        badge: 'LAB COMMUNICATIONS & NEWS FEED',
                        title: 'Lab Bulletins & Announcements',
                        subtitle:
                          'Coordinated notices, remote sensing directives, and field survey updates for ERSL members.',
                      }}
                      override={siteConfig.pageHeaders?.bulletins}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                      actions={
                        (editMode || isAdmin || currentUser?.email === 'hongxing.liu@ua.edu') ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBulletin(null);
                              setBulletinModalOpen(true);
                            }}
                            style={{ color: accentColor }}
                            className="bg-white hover:bg-red-50 text-xs font-extrabold py-2 px-4 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Post Bulletin / News</span>
                          </button>
                        ) : undefined
                      }
                    />

                    {/* Full-Width Bulletin & News Feed */}
                    <div className="space-y-4 text-left">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                          <span>📬</span>
                          <span>
                            Active Notice Board ({bulletins.filter(b => activeBulletinFolder === 'All' || (b.folder || 'General') === activeBulletinFolder).length})
                          </span>
                        </h3>

                        {/* Research idea folders */}
                        <div className="flex flex-wrap items-center gap-2">
                          {['All', ...bulletinFolders].map(f => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setActiveBulletinFolder(f)}
                              style={activeBulletinFolder === f ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${activeBulletinFolder === f
                                ? 'text-white'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-[#9E1B32] hover:text-[#9E1B32]'
                                }`}
                            >
                              📁 {f}
                            </button>
                          ))}
                          {(editMode || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => {
                                const name = prompt('New bulletin folder name:')?.trim();
                                if (name && !bulletinFolders.includes(name)) {
                                  const nextFolders = [...bulletinFolders, name];
                                  setBulletinFolders(nextFolders);
                                  setActiveBulletinFolder(name);
                                  syncSiteContentToCloud({ bulletinFolders: nextFolders });
                                }
                              }}
                              className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              + New Folder
                            </button>
                          )}
                        </div>
                      </div>

                      {bulletins.length === 0 ? (
                        <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400 max-w-md mx-auto shadow-xs">
                          <p className="text-2xl">📭</p>
                          <p className="text-xs font-bold text-gray-700 mt-2">No active bulletins</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">Use &ldquo;Post Bulletin / News&rdquo; to publish a new notice.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {bulletins
                            .filter(b => activeBulletinFolder === 'All' || (b.folder || 'General') === activeBulletinFolder)
                            .map((b) => {
                              const imgUrl = resolveAssetUrl(b.image);
                              return (
                                <div
                                  key={b.id}
                                  style={{ borderLeftColor: b.priority === 'high' ? '#dc2626' : accentColor }}
                                  className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 shadow-xs transition-all relative group flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {b.priority === 'high' ? (
                                          <span className="bg-red-100 text-red-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-red-200 flex items-center space-x-1">
                                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                                            <span>Urgent Directive</span>
                                          </span>
                                        ) : (
                                          <span className="bg-slate-100 text-slate-600 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-slate-200">
                                            Lab Notice
                                          </span>
                                        )}
                                        <span className="text-[10px] text-gray-400 font-medium">{b.date}</span>
                                        <span
                                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-100"
                                          style={{ color: subheadingAccent }}
                                        >
                                          📁 {b.folder || 'General'}
                                        </span>
                                      </div>

                                      {(editMode || isAdmin || currentUser?.email === 'hongxing.liu@ua.edu') && (
                                        <div className="flex items-center space-x-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingBulletin(b);
                                              setBulletinModalOpen(true);
                                            }}
                                            className="text-blue-600 hover:bg-blue-50 p-1 rounded border border-gray-200 cursor-pointer"
                                            title="Edit Bulletin"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (confirm(`Delete the bulletin "${b.title}"?`)) {
                                                const next = bulletins.filter(x => x.id !== b.id);
                                                setBulletins(next);
                                                syncSiteContentToCloud({ bulletins: next });
                                                appendAuditLog('DELETE_BULLETIN', `Deleted lab bulletin: "${b.title}"`);
                                              }
                                            }}
                                            className="text-red-500 hover:bg-red-50 p-1 rounded border border-gray-200 cursor-pointer"
                                            title="Delete Notice"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    <h4 className="font-extrabold text-slate-900 text-sm mt-2.5">{b.title}</h4>
                                    {imgUrl && (
                                      <div className="mt-2.5 rounded-lg overflow-hidden border border-gray-100 max-h-44 bg-slate-100">
                                        <img src={imgUrl} alt={b.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                    )}
                                    <p className="text-gray-600 text-xs mt-2 leading-relaxed whitespace-pre-wrap text-justify">{b.content}</p>
                                  </div>

                                  <div className="border-t border-gray-100 pt-2.5 mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400 font-bold">
                                    <span>POSTED BY: {b.sender}</span>
                                    {b.link ? (
                                      <a
                                        href={b.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: subheadingAccent }}
                                        className="hover:underline inline-flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Open Attachment / Box</span>
                                      </a>
                                    ) : (
                                      <span className="font-mono text-gray-300">ID: {b.id.toUpperCase()}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* VIEW 8: OPPORTUNITIES & GRADUATE INTAKE */}
                {activeTab === 'opportunities' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <SubPageHeader
                      tabId="opportunities"
                      defaults={{
                        badge: 'JOIN ERSL',
                        title: 'Prospective Graduate Students',
                        subtitle:
                          "We are actively seeking motivated Master's and Ph.D. researchers in geomorphology, remote sensing, and GeoAI.",
                      }}
                      override={siteConfig.pageHeaders?.opportunities}
                      accentColor={accentColor}
                      showSubtitle={siteConfig.showSubheadings}
                      canEdit={isAdmin && editMode}
                      onSave={handleSavePageHeader}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                      {/* Left Panel: Requirements details */}
                      <div className="lg:col-span-5 text-left space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                          <h3 className="font-extrabold text-slate-800 text-sm flex items-center space-x-1.5">
                            <GraduationCap className="w-5 h-5 text-[#9E1B32]" />
                            <span>Candidate Core Capabilities</span>
                          </h3>
                          <p className="text-gray-500 text-xs leading-relaxed">
                            Successful candidates are fully funded (GRA fellowships supported by NOAA CIROH) and typically exhibit skills in:
                          </p>

                          <ul className="space-y-2 text-xs text-gray-700 font-semibold">
                            <li className="flex items-center space-x-2 bg-slate-50 p-2 rounded">
                              <span className="text-green-600 font-bold shrink-0">✔️</span>
                              <span>Geospatial programming (Python, R, GEE)</span>
                            </li>
                            <li className="flex items-center space-x-2 bg-slate-50 p-2 rounded">
                              <span className="text-green-600 font-bold shrink-0">✔️</span>
                              <span>Fluvial geomorphology & hydrology principles</span>
                            </li>
                            <li className="flex items-center space-x-2 bg-slate-50 p-2 rounded">
                              <span className="text-green-600 font-bold shrink-0">✔️</span>
                              <span>UAV piloting or field ADCP surveying interest</span>
                            </li>
                            <li className="flex items-center space-x-2 bg-slate-50 p-2 rounded">
                              <span className="text-green-600 font-bold shrink-0">✔️</span>
                              <span>Synthetic Aperture Radar (SAR) processing</span>
                            </li>
                          </ul>
                        </div>

                        {/* Summer school panel */}
                        <div className="bg-slate-950 p-6 rounded-xl text-white shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-red-800/10 rounded-full translate-x-8 -translate-y-8"></div>
                          <span className="bg-[#9E1B32] text-xs font-bold px-2 py-0.5 rounded">Summer School</span>
                          <h4 className="font-bold text-sm mt-3">FLOW Academy 2026</h4>
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            Every summer, ERSL organizes interactive field camps for university graduates to learn hydrodynamic gauging and aerial photogrammetry on Black Warrior River.
                          </p>
                        </div>
                      </div>

                      {/* Right Panel: Admissions contact form */}
                      <div className="lg:col-span-7">
                        <div className="bg-white p-6 md:p-8 rounded-xl border border-gray-100 shadow-sm text-left">
                          <h3 className="text-base font-extrabold text-slate-800 mb-2">Graduate Intake Application Intake Form</h3>
                          <p className="text-xs text-gray-400 mb-6">Apply to join our research campaigns. Submitted profiles sync to our team dashboard.</p>

                          {showContactSuccess ? (
                            <div className="border border-green-100 bg-green-50/50 rounded-xl p-6 text-center space-y-4 animate-in zoom-in-95">
                              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold shadow-sm">
                                🎉
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-gray-800">Application Submitted!</h4>
                                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                                  Thank you for your interest in ERSL. Your profile has been compiled and securely logged into the university CRM student database. The Lab Director will review your credentials shortly.
                                </p>
                              </div>
                              <button
                                onClick={() => setShowContactSuccess(false)}
                                className="bg-[#222222] hover:bg-[#9E1B32] text-white font-bold text-xs py-1.5 px-4 rounded transition-colors cursor-pointer"
                              >
                                Submit another profile
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={handleAdmissionsSubmit} className="space-y-4 text-xs text-gray-700">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="font-bold text-gray-700">Full Name</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., Jane Doe"
                                    value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 rounded border border-gray-300 focus:outline-none focus:border-[#9E1B32]"
                                    required
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="font-bold text-gray-700">Email Address</label>
                                  <input
                                    type="email"
                                    placeholder="e.g., jdoe@crimson.ua.edu"
                                    value={studentEmail}
                                    onChange={(e) => setStudentEmail(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 rounded border border-gray-300 focus:outline-none focus:border-[#9E1B32]"
                                    required
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="font-bold text-gray-700">Degree Objective</label>
                                  <select
                                    value={studentDegree}
                                    onChange={(e) => setStudentDegree(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded focus:outline-none focus:border-[#9E1B32] font-semibold text-gray-700"
                                  >
                                    <option value="MS">Master of Science (MS) in Geography</option>
                                    <option value="PhD">Doctor of Philosophy (PhD) in Geography</option>
                                    <option value="PostDoc">Postdoctoral Fellow</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="font-bold text-gray-700">Attach Curriculum Vitae (Simulated)</label>
                                  <div className="border border-dashed border-gray-300 rounded p-2 text-center bg-slate-50 font-bold text-[10px] text-gray-400">
                                    📎 Drag & Drop CV PDF
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 block">Select Primary Research Interests</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    'Python / Geospatial Coding',
                                    'UAV Aerial Mapping & LiDAR',
                                    'Fluvial Geomorphology & ADCP',
                                    'Sentinel-1/2 SAR Remote Sensing'
                                  ].map(interest => (
                                    <label key={interest} className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-gray-200 cursor-pointer hover:bg-slate-100/50 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={studentInterests.includes(interest)}
                                        onChange={() => toggleInterest(interest)}
                                        className="rounded text-[#9E1B32] focus:ring-[#9E1B32] border-gray-300"
                                      />
                                      <span className="font-medium text-gray-600">{interest}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-gray-700">Statement of Purpose / Research Intent</label>
                                <textarea
                                  placeholder="Briefly state your academic research goals and why you want to work with ERSL..."
                                  value={studentStatement}
                                  onChange={(e) => setStudentStatement(e.target.value)}
                                  rows={4}
                                  className="w-full p-2.5 bg-slate-50 rounded border border-gray-300 focus:outline-none focus:border-[#9E1B32]"
                                  required
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-[#9E1B32] hover:bg-red-800 text-white font-bold py-2.5 rounded transition-all shadow-md shadow-red-100 cursor-pointer flex items-center justify-center space-x-2"
                              >
                                <FileText className="w-4 h-4" />
                                <span>Submit Application to ERSL Portal</span>
                              </button>
                            </form>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* VIEW 9: BOX FOLDERS (public folders for everyone, private ones for approved members) */}
                {activeTab === 'box' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {currentUser ? (
                      <BoxFolders currentUser={currentUser} {...getSubHeaderPassProps('box')} />
                    ) : (
                      <div className="bg-white p-12 rounded-xl border border-gray-100 text-center text-gray-400 max-w-lg mx-auto shadow-sm space-y-4">
                        <Lock className="w-12 h-12 mx-auto text-[#9E1B32]" />
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">🔐 Box Cloud Space Requires Authentication</h3>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Collaborative folders containing proprietary drone imagery, hydrologic discharge models, and active draft manuscripts are reserved for certified University of Alabama lab members.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowSSOPopup(true)}
                          className="bg-[#9E1B32] hover:bg-red-800 text-white text-xs font-bold py-2 px-6 rounded transition-all shadow-md cursor-pointer"
                        >
                          Authenticate via myBama SSO
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW: WORK PLAN (private) */}
                {activeTab === 'workplan' && (
                  <div>
                    {currentUser ? (
                      <Workplan currentUser={currentUser} {...getSubHeaderPassProps('workplan')} />
                    ) : (
                      <div className="bg-white p-12 rounded-xl border border-gray-100 text-center max-w-lg mx-auto shadow-sm space-y-4">
                        <Lock className="w-12 h-12 mx-auto text-[#9E1B32]" />
                        <p className="text-sm font-bold text-gray-800">Members only</p>
                        <button onClick={() => setShowSSOPopup(true)} className="bg-[#9E1B32] hover:bg-red-800 text-white text-xs font-bold py-2 px-6 rounded cursor-pointer">Log in</button>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW: PROJECT MANAGEMENT (HOUSES RESERVOIR DELINEATION MATRIX) */}
                {activeTab === 'reservoir' && (
                  <div>
                    {currentUser ? (
                      <ReservoirProject
                        currentUser={currentUser}
                        projects={projects}
                        onOpenProjectNewTab={(projId) => openProjectInNewTab(projId)}
                        {...getSubHeaderPassProps('reservoir')}
                      />
                    ) : (
                      <div className="bg-white p-12 rounded-xl border border-gray-100 text-center max-w-lg mx-auto shadow-sm space-y-4">
                        <Lock className="w-12 h-12 mx-auto text-[#9E1B32]" />
                        <p className="text-sm font-bold text-gray-800">Members only</p>
                        <p className="text-xs text-gray-500">The Project Management workspace and National Reservoir Delineation Matrix are restricted to authorized ERSL lab researchers.</p>
                        <button onClick={() => setShowSSOPopup(true)} className="bg-[#9E1B32] hover:bg-red-800 text-white text-xs font-bold py-2 px-6 rounded cursor-pointer">Log in</button>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 10: ADMIN PANEL / SETTINGS */}
                {activeTab === 'admin' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {currentUser && currentUser.role === 'Admin' && <MemberManager />}
                    {currentUser && currentUser.role === 'Admin' ? (
                      <AdminDashboard
                        currentUser={currentUser}
                        users={allUsers}
                        onRoleChange={handleUserRoleChange}
                        onAddUser={handleAdminAddUser}
                        onDeleteUser={handleAdminDeleteUser}
                        auditLogs={auditLogs}
                        onOpenCustomizer={() => setCustomizerOpen(true)}
                        onClearLogs={() => {
                          setAuditLogs([]);
                          appendAuditLog('CLEAR_AUDIT_LOGS', 'Wiped operational terminal log history');
                        }}
                      />
                    ) : (
                      <div className="bg-white p-12 rounded-xl border border-gray-100 text-center text-gray-400 max-w-lg mx-auto shadow-sm space-y-4">
                        <ShieldAlert className="w-12 h-12 mx-auto text-red-600" />
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">🚫 Administrative Access Blocked</h3>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            You must be logged in as an **Admin** via the University SSO provider to configure LDAP directories, toggle security roles, or view operational audit trails.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setCurrentUser(null);
                            setShowSSOPopup(true);
                          }}
                          className="bg-[#9E1B32] hover:bg-red-800 text-white text-xs font-bold py-2 px-6 rounded transition-all shadow-md cursor-pointer"
                        >
                          Re-Authenticate as Admin
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CUSTOM ADMIN-CREATED TABS & SUB-WEBPAGES */}
                {customPages[activeTab] && (() => {
                  const tabMeta = siteConfig.tabs.find(t => t.id === activeTab);
                  if (tabMeta?.visibility === 'members' && !currentUser) {
                    return (
                      <div className="bg-white p-12 rounded-xl border border-gray-200 text-center max-w-lg mx-auto shadow-xs space-y-4">
                        <Lock className="w-12 h-12 mx-auto" style={{ color: accentColor }} />
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">Members Only Section</h3>
                          <p className="text-xs text-gray-500 mt-1">Sign in as an approved ERSL member to view this custom workspace.</p>
                        </div>
                        <button
                          onClick={() => setShowSSOPopup(true)}
                          style={{ backgroundColor: accentColor }}
                          className="text-white text-xs font-bold py-2 px-6 rounded cursor-pointer"
                        >
                          Log in via myBama / ERSL Portal
                        </button>
                      </div>
                    );
                  }
                  return (
                    <CustomPageView
                      page={customPages[activeTab]}
                      currentUser={currentUser}
                      canEdit={Boolean(editMode || isAdmin)}
                      primaryColor={accentColor}
                      onUpdatePage={handleUpdateCustomPage}
                      onLoginClick={() => setShowSSOPopup(true)}
                    />
                  );
                })()}
              </>
            )}

          </main>

          {/* Footer */}
          <footer className="bg-[#111111] text-[#d1d5db] py-8 px-4 md:px-8 border-t border-[#262626] select-none text-left">
            {isAdmin && editMode && editingHomeSection === 'footer' && homeEditDraft ? (
              <form onSubmit={saveHomeSectionEditor} className="max-w-7xl mx-auto bg-neutral-900 border border-neutral-700 rounded-xl p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase tracking-wider text-white">Edit Footer & Header Lab Info</span>
                  <button type="button" onClick={() => setEditingHomeSection(null)} className="text-gray-400 hover:text-white cursor-pointer font-bold">
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Header Lab Full Name</label>
                    <input
                      value={homeEditDraft.labFullName}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, labFullName: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Header Department Subtitle</label>
                    <input
                      value={homeEditDraft.departmentName || ''}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, departmentName: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Footer Location</label>
                    <input
                      value={homeEditDraft.footerLocation || ''}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, footerLocation: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Footer Title</label>
                    <input
                      value={homeEditDraft.footerTitle || ''}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, footerTitle: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white mb-2"
                    />
                    <label className="block font-bold text-gray-300 mb-1">Footer Summary</label>
                    <textarea
                      rows={2}
                      value={homeEditDraft.footerDescription || ''}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, footerDescription: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-300 mb-1">Right Column Title</label>
                    <input
                      value={homeEditDraft.footerStorageTitle || ''}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, footerStorageTitle: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white mb-2"
                    />
                    <label className="block font-bold text-gray-300 mb-1">Right Column Text</label>
                    <textarea
                      rows={2}
                      value={homeEditDraft.footerStorageText || ''}
                      onChange={e => setHomeEditDraft({ ...homeEditDraft, footerStorageText: e.target.value })}
                      className="w-full p-2 rounded bg-neutral-800 border border-neutral-600 text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingHomeSection(null)} className="px-3.5 py-1.5 rounded bg-neutral-800 text-gray-300 hover:bg-neutral-700 font-bold cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" style={{ backgroundColor: accentColor }} className="px-4 py-1.5 rounded text-white font-bold cursor-pointer">
                    Save & Sync Footer
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                  {isAdmin && editMode && (
                    <button
                      type="button"
                      onClick={() => openHomeSectionEditor('footer')}
                      className="md:absolute md:top-0 md:right-0 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-neutral-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer w-fit"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Header & Footer</span>
                    </button>
                  )}
                  <div>
                    <h5 className="text-white font-extrabold text-sm mb-2">
                      {siteConfig.footerTitle || 'Environmental Remote Sensing Laboratory (ERSL)'}
                    </h5>
                    <p className="text-xs text-gray-400 leading-relaxed max-w-xs">
                      {siteConfig.footerDescription || 'Calibrating continental-scale hydrological models using high-resolution drone mapping, machine learning, and satellite observations.'}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-white font-extrabold text-sm mb-2">Academic Affiliations</h5>
                    <ul className="text-xs space-y-1.5 text-gray-400">
                      <li><a href="https://barefield.ua.edu/" target="_blank" rel="noreferrer" className="hover:text-white hover:underline transition-all">College of Arts & Sciences</a></li>
                      <li><a href="https://geography.ua.edu/" target="_blank" rel="noreferrer" className="hover:text-white hover:underline transition-all">Department of Geography</a></li>
                      <li><a href="https://www.ua.edu/" target="_blank" rel="noreferrer" className="hover:text-white hover:underline transition-all">The University of Alabama</a></li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-white font-extrabold text-sm mb-2">
                      {siteConfig.footerStorageTitle || 'Administrative & Box Storage'}
                    </h5>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {siteConfig.footerStorageText || 'Assets & datasets link directly via UA Box; tabs and sub-pages synchronize via ERSL Cloud.'}
                    </p>
                    {!currentUser && (
                      <button
                        onClick={() => setShowSSOPopup(true)}
                        className="mt-2.5 inline-flex items-center space-x-1 bg-red-800/50 hover:bg-[#9E1B32] text-red-200 border border-red-700 hover:text-white text-[10px] font-bold py-1.5 px-3 rounded transition-colors cursor-pointer"
                      >
                        <span>Authorized Portal Log In</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-w-7xl mx-auto mt-6 pt-5 border-t border-[#262626] flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest gap-2">
                  <span>&copy; {new Date().getFullYear()} Environmental Remote Sensing Laboratory. All Rights Reserved.</span>
                  <span>{siteConfig.footerLocation || 'Tuscaloosa, AL 35487'}</span>
                </div>
              </>
            )}
          </footer>
        </div>
      </div>
      )}

      {/* SSO Login modal popup */}
      {showSSOPopup && (
        <LoginModal onClose={() => setShowSSOPopup(false)} />
      )}

      {/* Editor Modal */}
      {modalOpen && (
        <EditModal
          type={modalType}
          item={editingItem}
          themes={themes}
          defaultPersonGroup={peopleSubTab}
          initialPersonGroupOverride={personGroupOverride}
          onSave={handleModalSave}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
            setPersonGroupOverride(undefined);
          }}
        />
      )}

      {/* News & Announcements Modal */}
      {newsModalOpen && (
        <NewsModal
          item={editingNewsItem}
          onSave={handleSaveNewsItem}
          onClose={() => {
            setNewsModalOpen(false);
            setEditingNewsItem(null);
          }}
        />
      )}

      {/* Lab Bulletin Pop-Up Modal */}
      {bulletinModalOpen && (
        <BulletinModal
          item={editingBulletin}
          folders={bulletinFolders}
          defaultFolder={activeBulletinFolder}
          senderName={currentUser?.name || 'Dr. Hongxing Liu'}
          onSave={handleSaveBulletin}
          onClose={() => {
            setBulletinModalOpen(false);
            setEditingBulletin(null);
          }}
        />
      )}

      {/* Full Website CMS / Layout / Color / Tab Customizer */}
      {customizerOpen && (
        <SiteCustomizerModal
          config={siteConfig}
          customPages={customPages}
          onSaveConfig={handleSaveSiteConfig}
          onCreateCustomPage={handleCreateCustomPage}
          onDeleteCustomTab={handleDeleteCustomTab}
          onClose={() => setCustomizerOpen(false)}
        />
      )}

      {showUpdatePasswordModal && (
        <UpdatePasswordModal onClose={() => setShowUpdatePasswordModal(false)} />
      )}

    </div>
  );
}
