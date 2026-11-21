import {
  BoxFile,
  BulletinItem,
  CustomPageData,
  DataLayer,
  Instrument,
  Person,
  Project,
  ProjectSubPageData,
  Publication,
  ResearchTheme,
  SiteConfig,
  Software,
  TeachingMaterial,
  User,
} from '../types';
import { NewsItem } from '../data/news';
import {
  buildNormalizedStudentSubTabs,
  buildNormalizedSubTabs,
  DEFAULT_PROJECT_SUBPAGE,
  resolveProjectViewerAccess,
} from './projectSubPageUtils';

export interface SiteSearchItem {
  id: string;
  title: string;
  subtitle: string;
  searchText: string;
  tab: string;
  tabLabel: string;
  themeId?: string;
  instrumentId?: string;
  projectId?: string;
  projectSubTabId?: string;
  studentId?: string;
  studentSubTabId?: string;
  peopleGroup?: 'member' | 'collaborator' | 'former';
}

interface BuildSearchParams {
  siteConfig: SiteConfig;
  currentUser: User | null;
  editMode: boolean;
  themes: ResearchTheme[];
  projects: Project[];
  publications: Publication[];
  people: Person[];
  instruments: Instrument[];
  softwareList: Software[];
  dataLayers: DataLayer[];
  news: NewsItem[];
  teachingList: TeachingMaterial[];
  bulletins: BulletinItem[];
  boxFiles: BoxFile[];
  customPages: Record<string, CustomPageData>;
  studentWorkspaces?: Record<string, ProjectSubPageData>;
}

export function buildSiteSearchItems({
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
  studentWorkspaces = {},
}: BuildSearchParams): SiteSearchItem[] {
  const isLoggedIn = Boolean(currentUser);
  const isAdmin = currentUser?.role === 'Admin';
  const canSeePrivate = isLoggedIn || editMode;

  const visibleTabs = siteConfig.tabs.filter(t => {
    if (t.visibility === 'hidden' && !editMode) return false;
    if (t.visibility === 'members' && !canSeePrivate) return false;
    if (t.visibility === 'admin' && !isAdmin) return false;
    return true;
  });
  const visibleTabIds = new Set(visibleTabs.map(t => t.id));

  const items: SiteSearchItem[] = [];

  // 1. Navigation Tabs & Page Headers (all pages in current scope)
  visibleTabs.forEach(tab => {
    const hdr = siteConfig.pageHeaders?.[tab.id];
    items.push({
      id: `srch-tab-${tab.id}`,
      title: hdr?.title || tab.label,
      subtitle: hdr?.subtitle || `Go to ${tab.label} page`,
      searchText: [tab.label, tab.id, hdr?.badge, hdr?.title, hdr?.subtitle].filter(Boolean).join(' '),
      tab: tab.id,
      tabLabel: tab.label,
    });
  });

  // Quick member/admin destinations when logged in or in edit mode
  if (canSeePrivate && (currentUser?.role === 'Admin' || editMode)) {
    items.push({
      id: 'srch-tab-admin',
      title: 'Admin Dashboard & Control Panel',
      subtitle: 'Member approvals, site customizer, cloud sync & audit logs',
      searchText: 'admin dashboard control panel members approval customizer audit logs settings',
      tab: 'admin',
      tabLabel: 'Admin',
    });
  }

  // 2. Home Aims & Mission
  if (siteConfig.homeMission) {
    items.push({
      id: 'srch-home-mission',
      title: siteConfig.homeMission.heading || siteConfig.labFullName,
      subtitle: siteConfig.homeMission.badge || 'Aims & Mission',
      searchText: [
        siteConfig.labFullName,
        siteConfig.labShortName,
        siteConfig.labTagline,
        siteConfig.homeMission.badge,
        siteConfig.homeMission.heading,
        siteConfig.homeMission.description,
        siteConfig.footerDescription,
      ]
        .filter(Boolean)
        .join(' '),
      tab: 'home',
      tabLabel: 'Home',
    });
  }

  // 3. News & Lab Updates
  news.forEach(n => {
    items.push({
      id: `srch-news-${n.id}`,
      title: n.title,
      subtitle: `News (${n.date})${n.category ? ` · ${n.category}` : ''}`,
      searchText: [n.title, n.summary, n.category, n.date, n.imageCaption].filter(Boolean).join(' '),
      tab: 'home',
      tabLabel: 'News',
    });
  });

  // 4. Research Themes
  if (visibleTabIds.has('research') || canSeePrivate) {
    themes.forEach(t => {
      items.push({
        id: `srch-theme-${t.id}`,
        title: t.title,
        subtitle: `Research Theme · ${t.keywords.slice(0, 3).join(', ')}`,
        searchText: [t.title, t.description, t.overviewBody, ...(t.keywords || [])].filter(Boolean).join(' '),
        tab: 'research',
        tabLabel: 'Research Themes',
        themeId: t.id,
      });
    });
  }

  // 5. Projects + Accessible Project Sub-Pages & Rich Blocks
  if (visibleTabIds.has('projects') || visibleTabIds.has('research') || canSeePrivate) {
    projects.forEach(p => {
      const subPage = {
        ...DEFAULT_PROJECT_SUBPAGE,
        ...(p.subPage || {}),
        tabVisibility: {
          ...DEFAULT_PROJECT_SUBPAGE.tabVisibility,
          ...(p.subPage?.tabVisibility || {}),
        },
        collaborators: p.subPage?.collaborators || [],
      };
      const collaborators = subPage.collaborators || [];
      const collabNames = collaborators.map(c => `${c.name} ${c.affiliation || ''} ${c.role || ''}`).join(' ');

      items.push({
        id: `srch-proj-${p.id}`,
        title: p.title,
        subtitle: `Project · ${p.agency}${p.period ? ` · ${p.period}` : ''}${p.details ? ` · ${p.details}` : ''}`,
        searchText: [p.id, p.title, p.agency, p.sponsor, p.period, p.status, p.details, p.summary, subPage.summary, subPage.piInfo, subPage.timeline, subPage.boxFolderUrl, collabNames]
          .filter(Boolean)
          .join(' '),
        tab: 'projects',
        tabLabel: 'Research Projects',
        projectId: p.id,
      });

      const access = resolveProjectViewerAccess({
        currentUser,
        people,
        collaborators,
        passkeyUnlocked: false,
        previewRole: editMode && currentUser?.role === 'Admin' ? 'admin' : 'actual',
      });

      const customSubTabs = buildNormalizedSubTabs(p, subPage);
      customSubTabs.forEach(subTab => {
        if (!editMode && !access.canViewVisibility(subTab.visibility)) return;

        // Index the sub-page itself
        const blockTexts = subTab.blocks
          .map(b =>
            [b.title, b.body, b.category, b.availability, b.language, b.location, b.attendees, b.caption, b.date]
              .filter(Boolean)
              .join(' ')
          )
          .join(' ');

        items.push({
          id: `srch-proj-sub-${p.id}-${subTab.id}`,
          title: `${p.title} — ${subTab.label}`,
          subtitle: `Project Sub-Page (${subTab.visibility}) · ${p.agency}`,
          searchText: [p.title, subTab.label, subTab.description, blockTexts].filter(Boolean).join(' '),
          tab: 'projects',
          tabLabel: `Project · ${subTab.label}`,
          projectId: p.id,
          projectSubTabId: subTab.id,
        });

        // Also index individual blocks (paragraphs, datasets, software, meeting notes, events, links)
        subTab.blocks.forEach(blk => {
          items.push({
            id: `srch-proj-blk-${p.id}-${subTab.id}-${blk.id}`,
            title: blk.title,
            subtitle: `${p.title} › ${subTab.label}`,
            searchText: [
              blk.title,
              blk.body,
              blk.category,
              blk.availability,
              blk.language,
              blk.location,
              blk.attendees,
              blk.caption,
              blk.date,
              p.title,
            ]
              .filter(Boolean)
              .join(' '),
            tab: 'projects',
            tabLabel: `Project · ${subTab.label}`,
            projectId: p.id,
            projectSubTabId: subTab.id,
          });
        });
      });
    });
  }

  // 6. Publications
  if (visibleTabIds.has('publications') || canSeePrivate) {
    publications.forEach(pub => {
      items.push({
        id: `srch-pub-${pub.id}`,
        title: pub.title,
        subtitle: `${pub.authors} (${pub.year}) · ${pub.venue}`,
        searchText: [pub.title, pub.authors, pub.venue, String(pub.year), pub.type, pub.doi, pub.link, pub.abstract, ...(pub.keywords || [])]
          .filter(Boolean)
          .join(' '),
        tab: 'publications',
        tabLabel: 'Publications',
      });
    });
  }

  // 7. People, Collaborators & Former Members
  if (visibleTabIds.has('people') || canSeePrivate) {
    people.forEach(per => {
      const grp = per.group === 'collaborator' ? 'collaborator' : per.group === 'former' ? 'former' : 'member';
      const stintText = (per.formerStints || [])
        .map(s => `${s.role} ${s.years} ${s.topic || ''}`)
        .join(' ');
      const subSummary =
        grp === 'former'
          ? [
              per.formerStints?.[0]
                ? `${per.formerStints[0].role}${per.formerStints[0].years ? ` (${per.formerStints[0].years})` : ''}`
                : per.role,
              per.currentAffiliation ? `Now: ${per.currentAffiliation}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : `${per.role}${per.researchFocus ? ` · ${per.researchFocus}` : ''}`;

      items.push({
        id: `srch-person-${per.id}`,
        title: per.name,
        subtitle: subSummary,
        searchText: [
          per.name,
          per.role,
          per.researchFocus,
          per.bio,
          per.formerYears,
          per.formerTopic,
          per.currentAffiliation,
          stintText,
          grp === 'former' ? 'former member alumni' : grp,
        ]
          .filter(Boolean)
          .join(' '),
        tab: 'people',
        tabLabel: grp === 'collaborator' ? 'Collaborators' : grp === 'former' ? 'Former Members' : 'People',
        peopleGroup: grp,
        studentId: grp === 'member' ? per.id : undefined,
      });

      // Index Student / Team Member Sub-Pages & Materials
      if (grp === 'member') {
        const stuWorkspace = studentWorkspaces[per.id] || per.subPage || DEFAULT_PROJECT_SUBPAGE;
        const stuAccess = resolveProjectViewerAccess({
          currentUser,
          people,
          collaborators: [],
          passkeyUnlocked: false,
          previewRole: editMode && isAdmin ? 'admin' : 'actual',
        });
        const stuTabs = buildNormalizedStudentSubTabs(per, stuWorkspace);
        stuTabs.forEach(sTab => {
          if (!editMode && !stuAccess.canViewVisibility(sTab.visibility)) return;
          const blkText = sTab.blocks
            .map(b => [b.title, b.body, b.category, b.url, b.date].filter(Boolean).join(' '))
            .join(' ');
          items.push({
            id: `srch-stu-sub-${per.id}-${sTab.id}`,
            title: `${per.name} — ${sTab.label}`,
            subtitle: `Student Section (${sTab.visibility})`,
            searchText: [per.name, sTab.label, sTab.description, blkText].filter(Boolean).join(' '),
            tab: 'people',
            tabLabel: `Student · ${sTab.label}`,
            peopleGroup: 'member',
            studentId: per.id,
            studentSubTabId: sTab.id,
          });
          sTab.blocks.forEach(blk => {
            items.push({
              id: `srch-stu-blk-${per.id}-${sTab.id}-${blk.id}`,
              title: blk.title,
              subtitle: `${per.name} › ${sTab.label}`,
              searchText: [blk.title, blk.body, blk.category, blk.url, blk.date, per.name].filter(Boolean).join(' '),
              tab: 'people',
              tabLabel: `Student · ${sTab.label}`,
              peopleGroup: 'member',
              studentId: per.id,
              studentSubTabId: sTab.id,
            });
          });
        });
      }
    });
  }

  // 8. Instruments
  if (visibleTabIds.has('instruments') || canSeePrivate) {
    instruments.forEach(inst => {
      const resText = (inst.resources || [])
        .filter(r => r.visibility === 'public' || canSeePrivate)
        .map(r => `${r.title} ${r.category} ${r.description || ''}`)
        .join(' ');
      items.push({
        id: `srch-inst-${inst.id}`,
        title: inst.name,
        subtitle: `Instrument · ${inst.category}`,
        searchText: [inst.name, inst.category, inst.description, inst.detailedDescription, resText]
          .filter(Boolean)
          .join(' '),
        tab: 'instruments',
        tabLabel: 'Instruments',
        instrumentId: inst.id,
      });
    });
  }

  // 9. Software
  if (visibleTabIds.has('software') || canSeePrivate) {
    softwareList.forEach(soft => {
      const vis = soft.visibility || 'public';
      if (vis === 'admin' && !isAdmin && !editMode) return;
      if (vis === 'members' && !canSeePrivate) return;
      items.push({
        id: `srch-soft-${soft.id}`,
        title: soft.title,
        subtitle: `Software (${soft.language}${soft.version ? ` v${soft.version}` : ''})`,
        searchText: [soft.title, soft.language, soft.version, soft.description].filter(Boolean).join(' '),
        tab: 'software',
        tabLabel: 'Software',
      });
    });
  }

  // 10. Data Layers
  if (visibleTabIds.has('data') || canSeePrivate) {
    dataLayers.forEach(dl => {
      items.push({
        id: `srch-data-${dl.id}`,
        title: dl.name,
        subtitle: `Dataset · ${dl.availability}${dl.source ? ` · ${dl.source}` : ''}`,
        searchText: [dl.name, dl.availability, dl.source, dl.description].filter(Boolean).join(' '),
        tab: 'data',
        tabLabel: 'Data',
      });
    });
  }

  // 11. Teaching Materials
  if (visibleTabIds.has('teaching') || canSeePrivate) {
    teachingList.forEach(tc => {
      items.push({
        id: `srch-teach-${tc.id}`,
        title: tc.title,
        subtitle: `Course: ${tc.course}`,
        searchText: [tc.title, tc.course, tc.description].filter(Boolean).join(' '),
        tab: 'teaching',
        tabLabel: 'Teaching',
      });
    });
  }

  // 12. Custom Pages & Sub-Tabs
  Object.values(customPages).forEach(page => {
    if (!visibleTabIds.has(page.tabId) && !canSeePrivate) return;
    items.push({
      id: `srch-cpage-${page.tabId}`,
      title: page.title,
      subtitle: page.subtitle || 'Custom Page',
      searchText: [page.title, page.subtitle].filter(Boolean).join(' '),
      tab: page.tabId,
      tabLabel: page.title,
    });

    (page.subTabs || []).forEach(sub => {
      if (sub.visibility === 'admin' && !isAdmin && !editMode) return;
      if (sub.visibility !== 'public' && !canSeePrivate) return;
      (sub.blocks || []).forEach(blk => {
        items.push({
          id: `srch-cblk-${page.tabId}-${sub.id}-${blk.id}`,
          title: blk.title,
          subtitle: `${page.title} › ${sub.label}`,
          searchText: [blk.title, blk.body, blk.tag, blk.url, sub.label, page.title].filter(Boolean).join(' '),
          tab: page.tabId,
          tabLabel: page.title,
        });
      });
    });
  });

  // 13. Member & Admin Private Pages (Bulletins, Box Storage)
  if (canSeePrivate) {
    bulletins.forEach(b => {
      items.push({
        id: `srch-bul-${b.id}`,
        title: b.title,
        subtitle: `Bulletin (${b.date}) · ${b.sender}${b.folder ? ` · ${b.folder}` : ''}`,
        searchText: [b.title, b.content, b.sender, b.folder, b.date].filter(Boolean).join(' '),
        tab: 'bulletins',
        tabLabel: 'Bulletins',
      });
    });

    boxFiles.forEach(f => {
      items.push({
        id: `srch-box-${f.id}`,
        title: f.name,
        subtitle: `Box ${f.type === 'folder' ? 'Folder' : 'File'} · Updated by ${f.updatedBy}`,
        searchText: [f.name, f.updatedBy, ...(f.tags || [])].filter(Boolean).join(' '),
        tab: 'box',
        tabLabel: 'Box Storage',
      });
    });
  }

  return items;
}

/**
 * Matches multi-word queries across title, subtitle, and full searchText,
 * ranking title hits first.
 */
export function filterSiteSearchItems(items: SiteSearchItem[], query: string, limit = 10): SiteSearchItem[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const titleMatches: SiteSearchItem[] = [];
  const bodyMatches: SiteSearchItem[] = [];

  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    const haystack = `${titleLower} ${item.subtitle.toLowerCase()} ${item.searchText.toLowerCase()}`;
    const allMatch = tokens.every(tok => haystack.includes(tok));
    if (!allMatch) continue;

    if (tokens.every(tok => titleLower.includes(tok))) {
      titleMatches.push(item);
    } else {
      bodyMatches.push(item);
    }
  }

  return [...titleMatches, ...bodyMatches].slice(0, limit);
}

