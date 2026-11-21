import {
  Person,
  Project,
  ProjectCollaborator,
  ProjectContentBlock,
  ProjectCustomSubTab,
  ProjectInvestigator,
  ProjectShowcaseTab,
  ProjectSubPageData,
  SubTabVisibility,
  User,
} from '../types';

export const DEFAULT_PROJECT_SUBPAGE: ProjectSubPageData = {
  summary: '',
  objectives: [],
  piInfo: '',
  timeline: 'Active Research Grant',
  tabVisibility: { overview: 'public', resources: 'public', events: 'public', datasets: 'members' },
  resources: [],
  events: [],
  datasets: [],
};

export interface VisibilityMeta {
  value: SubTabVisibility;
  label: string;
  shortLabel: string;
  description: string;
  pillClass: string;
}

export const VISIBILITY_OPTIONS: VisibilityMeta[] = [
  {
    value: 'public',
    label: 'Public (Anyone)',
    shortLabel: 'Public',
    description: 'Visible to everyone visiting the website.',
    pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'collaborators',
    label: 'Project Collaborators + Lab',
    shortLabel: 'Collaborators',
    description: 'Visible to linked project collaborators, ERSL members, and lab admins.',
    pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'members',
    label: 'Members Only (ERSL Lab)',
    shortLabel: 'Members',
    description: 'Restricted to approved ERSL lab members and administrators.',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    value: 'admin',
    label: 'Private (Lab Admins Only)',
    shortLabel: 'Private',
    description: 'Visible strictly to Dr. Liu / ERSL lab administrators.',
    pillClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
];

export function getStudentBoxSlug(name?: string): string {
  const cleaned = (name || 'Student')
    .replace(/\b(dr|prof|professor)\.?\s+/gi, '')
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'Student';
}

export const STUDENT_SUBTAB_PRESETS: Array<{
  kind: NonNullable<ProjectCustomSubTab['kind']>;
  defaultLabel: string;
  defaultVisibility: SubTabVisibility;
  description: string;
}> = [
  {
    kind: 'plan',
    defaultLabel: 'Plan',
    defaultVisibility: 'members',
    description: 'Research plan, dissertation/thesis goals, and academic roadmap.',
  },
  {
    kind: 'progress',
    defaultLabel: 'Progress',
    defaultVisibility: 'members',
    description: 'Ongoing research progress, preliminary figures, and milestones.',
  },
  {
    kind: 'schedules',
    defaultLabel: 'Schedules',
    defaultVisibility: 'members',
    description: 'Course schedule, field campaigns, and lab meeting availability.',
  },
  {
    kind: 'questions',
    defaultLabel: 'Summary of Questions',
    defaultVisibility: 'members',
    description: 'Open technical questions and discussion items for Dr. Liu.',
  },
  {
    kind: 'todo',
    defaultLabel: 'Weekly To-Do List',
    defaultVisibility: 'members',
    description: 'Weekly tasks, action items, and short-term deliverables.',
  },
  {
    kind: 'resources',
    defaultLabel: 'Materials & References',
    defaultVisibility: 'public',
    description: 'Reference papers, useful web links, datasets, scripts, and uploaded files.',
  },
  {
    kind: 'meeting-notes',
    defaultLabel: 'Meeting Notes',
    defaultVisibility: 'members',
    description: '1-on-1 advisement meeting notes and feedback logs.',
  },
  {
    kind: 'custom',
    defaultLabel: 'Custom Section',
    defaultVisibility: 'members',
    description: 'Custom student workspace section for materials, links, or notes.',
  },
];

export function buildNormalizedStudentSubTabs(
  person: Person,
  subPage?: ProjectSubPageData | null
): ProjectCustomSubTab[] {
  if (Array.isArray(subPage?.customSubTabs) && subPage.customSubTabs.length > 0) {
    return subPage.customSubTabs.map(tab => ({
      ...tab,
      visibility: tab.visibility || 'members',
      blocks: Array.isArray(tab.blocks) ? tab.blocks : [],
    }));
  }

  return [
    {
      id: 'plan',
      label: 'Plan',
      kind: 'plan',
      visibility: 'public',
      description: 'Research plan, academic objectives, and focus areas.',
      blocks: [
        {
          id: `blk-student-plan-${person.id}`,
          type: 'paragraph',
          title: 'Research Focus & Overview',
          body: [person.researchFocus ? `Focus: ${person.researchFocus}` : '', person.bio || '']
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    },
    {
      id: 'progress',
      label: 'Progress',
      kind: 'progress',
      visibility: 'members',
      description: 'Preliminary results, figures, and milestone progress.',
      blocks: [],
    },
    {
      id: 'schedules',
      label: 'Schedules',
      kind: 'schedules',
      visibility: 'members',
      description: 'Weekly availability, courses, and upcoming conference/field dates.',
      blocks: [],
    },
    {
      id: 'questions',
      label: 'Summary of Questions',
      kind: 'questions',
      visibility: 'members',
      description: 'Key questions to review during advisement meetings.',
      blocks: [],
    },
    {
      id: 'todo',
      label: 'Weekly To-Do List',
      kind: 'todo',
      visibility: 'members',
      description: 'Current weekly action items and checklist.',
      blocks: [],
    },
    {
      id: 'resources',
      label: 'Materials & References',
      kind: 'resources',
      visibility: 'public',
      description: 'Reference papers, datasets, useful web links, and Box materials.',
      blocks: [],
    },
  ];
}

export function getVisibilityMeta(vis?: SubTabVisibility): VisibilityMeta {
  return VISIBILITY_OPTIONS.find(v => v.value === vis) || VISIBILITY_OPTIONS[0];
}

export const SUBTAB_PRESETS: Array<{
  kind: NonNullable<ProjectCustomSubTab['kind']>;
  defaultLabel: string;
  defaultVisibility: SubTabVisibility;
  description: string;
}> = [
  {
    kind: 'showcase',
    defaultLabel: 'Showcase',
    defaultVisibility: 'public',
    description: 'Dedicated results showcase with customizable sub-tabs for individual models, validation plots, demos, and findings.',
  },
  {
    kind: 'information',
    defaultLabel: 'Project Information',
    defaultVisibility: 'public',
    description: 'Background text paragraphs, methodology, SOPs, and project documentation.',
  },
  {
    kind: 'datasets',
    defaultLabel: 'Datasets',
    defaultVisibility: 'members',
    description: 'Project datasets, remote sensing products, and UA Box data folders.',
  },
  {
    kind: 'software',
    defaultLabel: 'Software & Code',
    defaultVisibility: 'public',
    description: 'GitHub repositories, scripts, deep learning models, and tools.',
  },
  {
    kind: 'meeting-notes',
    defaultLabel: 'Meeting Notes',
    defaultVisibility: 'collaborators',
    description: 'Project team & collaborator sync notes, decisions, and action items.',
  },
  {
    kind: 'resources',
    defaultLabel: 'Useful Resources',
    defaultVisibility: 'public',
    description: 'Reference papers, agency portals, Box folders, and guides.',
  },
  {
    kind: 'events',
    defaultLabel: 'Events & Campaigns',
    defaultVisibility: 'public',
    description: 'Field campaigns, workshops, conferences, and milestones.',
  },
  {
    kind: 'workplan-tracker',
    defaultLabel: 'Project Management (Custom)',
    defaultVisibility: 'members',
    description: 'Admin-customizable project management tracker with custom workflow stages, member columns, and statuses.',
  },
  {
    kind: 'reservoir-tracker',
    defaultLabel: 'Reservoir Protocol Matrix',
    defaultVisibility: 'members',
    description: 'National Reservoir Delineation Protocol Matrix, team sprint allocations, and QA verification.',
  },
  {
    kind: 'custom',
    defaultLabel: 'Custom Section',
    defaultVisibility: 'public',
    description: 'Flexible sub-page with any combination of text, links, datasets, or files.',
  },
];

const RESERVOIR_MANAGED_PROJECT_IDS = new Set(['proj-8', 'proj-9']);
const RESERVOIR_MANAGED_TITLE_PATTERNS = [
  'near-real-time monitoring of key reservoir variables by integrating wide-swath swot altimetry and deep learning techniques',
  'develop a generic georeferenced reservoir representation for large-scale hydrologic models',
];

export function isReservoirManagedProject(project?: Project | null): boolean {
  if (!project) return false;
  if (RESERVOIR_MANAGED_PROJECT_IDS.has(project.id)) return true;
  const cleanTitle = (project.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return RESERVOIR_MANAGED_TITLE_PATTERNS.includes(cleanTitle);
}

export function isFinishedProject(project?: { status?: string } | null): boolean {
  const s = (project?.status || '').trim().toLowerCase();
  return s === 'completed' || s === 'finished' || s === 'archived';
}

export function parseLegacyInvestigators(piInfo?: string, details?: string): ProjectInvestigator[] {
  const raw = (piInfo || details || '').trim();
  if (!raw) return [];

  const result: ProjectInvestigator[] = [];
  // Split patterns like "PI: Dr. Hongxing Liu | Co-PIs: Dr. Sagy Cohen, Dr. Yuehan Lu"
  const segments = raw.split(/[|;]/).map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const match = seg.match(/^(co-?pis?|pis?|principal investigator|lead|collaborators?)\s*:\s*(.+)$/i);
    if (match) {
      const prefix = match[1].toLowerCase();
      const role = prefix.startsWith('co') ? 'Co-PI' : prefix.startsWith('pi') || prefix.startsWith('principal') ? 'PI' : 'Investigator';
      const names = match[2].split(',').map(n => n.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);
      names.forEach((name, idx) => {
        result.push({ id: `inv-${Date.now()}-${result.length}-${idx}`, name, role });
      });
    } else {
      result.push({ id: `inv-${Date.now()}-${result.length}`, name: seg, role: 'PI' });
    }
  }
  return result;
}

export function formatInvestigatorsSummary(list: ProjectInvestigator[]): string {
  const clean = list.filter(i => i.name.trim());
  if (clean.length === 0) return '';
  return clean
    .map(i => `${i.role ? `${i.role}: ` : ''}${i.name.trim()}${i.affiliation?.trim() ? ` (${i.affiliation.trim()})` : ''}`)
    .join(' · ');
}

export function isShowcaseSubTab(tab?: ProjectCustomSubTab | null): boolean {
  if (!tab) return false;
  if (tab.kind === 'showcase') return true;
  const idLower = (tab.id || '').trim().toLowerCase();
  const labelLower = (tab.label || '').trim().toLowerCase();
  return idLower === 'showcase' || labelLower === 'showcase';
}

export function getNormalizedShowcaseTabs(tab: ProjectCustomSubTab): ProjectShowcaseTab[] {
  if (Array.isArray(tab.showcaseTabs) && tab.showcaseTabs.length > 0) {
    return tab.showcaseTabs.map((st, idx) => ({
      ...st,
      id: st.id || `res-tab-${idx + 1}`,
      label: st.label || `Model / Result ${idx + 1}`,
      summary: st.summary || '',
      blocks: Array.isArray(st.blocks) ? st.blocks : [],
    }));
  }
  const existingBlocks = Array.isArray(tab.blocks) ? tab.blocks : [];
  const firstHeading = existingBlocks.find(b => b.type === 'paragraph' && b.title?.trim())?.title?.trim();
  const autoLabel = firstHeading
    ? (firstHeading.length > 36 ? `${firstHeading.slice(0, 34).trim()}…` : firstHeading)
    : 'Model & Key Results';
  return [
    {
      id: 'res-primary',
      label: autoLabel,
      summary: '',
      blocks: existingBlocks,
    },
  ];
}

/**
 * Normalizes legacy ProjectSubPageData (fixed 4 sub-tabs) into the flexible
 * customSubTabs representation without dropping any existing summary,
 * objectives, resources, events, datasets, or field photos.
 */
export function buildNormalizedSubTabs(
  project: Project,
  subPage: ProjectSubPageData
): ProjectCustomSubTab[] {
  const ensureBuiltInTabs = (tabs: ProjectCustomSubTab[]): ProjectCustomSubTab[] => {
    let next = tabs.map(t =>
      isShowcaseSubTab(t)
        ? { ...t, kind: 'showcase' as const }
        : t
    );

    // Ensure every Research Project has a public Showcase tab with nested Model/Result tabs
    if (!next.some(t => isShowcaseSubTab(t))) {
      const showcaseTab: ProjectCustomSubTab = {
        id: 'showcase',
        label: 'Showcase',
        kind: 'showcase',
        visibility: 'public',
        description:
          'Highlighted models, validation figures, scientific findings, and result tabs for this project.',
        blocks: [],
        showcaseTabs: [
          {
            id: 'res-primary',
            label: 'Model 1 · Key Results',
            summary: '',
            blocks: [],
          },
        ],
      };
      const pmIdx = next.findIndex(
        t => t.kind === 'workplan-tracker' || t.kind === 'reservoir-tracker' || t.id === 'project-management'
      );
      if (pmIdx >= 0) {
        next = [...next.slice(0, pmIdx), showcaseTab, ...next.slice(pmIdx)];
      } else {
        next = [...next, showcaseTab];
      }
    }

    if (isReservoirManagedProject(project)) {
      if (next.some(t => t.kind === 'reservoir-tracker' || t.id === 'project-management')) {
        return next;
      }
      return [
        ...next,
        {
          id: 'project-management',
          label: 'Project Management',
          kind: 'reservoir-tracker',
          visibility: 'members',
          description:
            'National Reservoir Delineation Protocol Matrix, sprint allocations, collection tracking, and QA verification.',
          blocks: [],
        },
      ];
    }

    if (next.some(t => t.kind === 'workplan-tracker' || t.id === 'project-management')) {
      return next;
    }

    return [
      ...next,
      {
        id: 'project-management',
        label: 'Project Management',
        kind: 'workplan-tracker',
        visibility: 'members',
        description:
          'Customizable Admin-only project management tracker: configure custom stages, columns, member responsibilities, and status options for this project.',
        blocks: [],
      },
    ];
  };

  if (Array.isArray(subPage.customSubTabs) && subPage.customSubTabs.length > 0) {
    return ensureBuiltInTabs(
      subPage.customSubTabs.map(tab => ({
        ...tab,
        visibility: tab.visibility || subPage.tabVisibility?.[tab.id] || 'public',
        blocks: Array.isArray(tab.blocks) ? tab.blocks : [],
      }))
    );
  }

  const vis = subPage.tabVisibility || {};
  const overviewBlocks: ProjectContentBlock[] = [];

  const summaryText = (subPage.summary || project.summary || project.details || '').trim();
  if (summaryText) {
    overviewBlocks.push({
      id: `blk-summary-${project.id}`,
      type: 'paragraph',
      title: 'About This Project',
      body: summaryText,
    });
  }

  if (Array.isArray(subPage.objectives) && subPage.objectives.length > 0) {
    overviewBlocks.push({
      id: `blk-obj-${project.id}`,
      type: 'objectives',
      title: 'Core Objectives & Deliverables',
      body: subPage.objectives.join('\n'),
    });
  }

  if (Array.isArray(subPage.fieldPhotos) && subPage.fieldPhotos.length > 0) {
    subPage.fieldPhotos.forEach((pf, idx) => {
      overviewBlocks.push({
        id: pf.id || `blk-photo-${project.id}-${idx}`,
        type: 'image',
        title: pf.caption || 'Field & Survey Photo',
        url: pf.url,
        caption: pf.caption,
      });
    });
  }

  const resourceBlocks: ProjectContentBlock[] = (subPage.resources || []).map(r => ({
    id: r.id,
    type: r.boxUrl && !r.url ? 'box-folder' : 'link',
    title: r.title,
    body: r.description,
    url: r.url,
    boxUrl: r.boxUrl,
    category: r.category || 'Resource',
  }));

  const eventBlocks: ProjectContentBlock[] = (subPage.events || []).map(ev => ({
    id: ev.id,
    type: 'event',
    title: ev.title,
    body: ev.description,
    date: ev.date,
    location: ev.location,
    url: ev.url,
    boxUrl: ev.boxUrl,
  }));

  const datasetBlocks: ProjectContentBlock[] = (subPage.datasets || []).map(ds => ({
    id: ds.id,
    type: 'dataset',
    title: ds.title,
    body: ds.description,
    url: ds.url,
    boxUrl: ds.boxUrl,
    availability: ds.availability || 'Public',
  }));

  return ensureBuiltInTabs([
    {
      id: 'overview',
      label: 'Overview',
      kind: 'overview',
      visibility: vis.overview || 'public',
      blocks: overviewBlocks,
    },
    {
      id: 'resources',
      label: 'Useful Resources',
      kind: 'resources',
      visibility: vis.resources || 'public',
      blocks: resourceBlocks,
    },
    {
      id: 'events',
      label: 'Events',
      kind: 'events',
      visibility: vis.events || 'public',
      blocks: eventBlocks,
    },
    {
      id: 'datasets',
      label: 'Datasets',
      kind: 'datasets',
      visibility: vis.datasets || 'members',
      blocks: datasetBlocks,
    },
  ]);
}

export type PreviewRole = 'actual' | 'public' | 'collaborator' | 'member' | 'admin';

export function resolveProjectViewerAccess(params: {
  currentUser: User | null;
  people?: Person[];
  collaborators: ProjectCollaborator[];
  passkeyUnlocked: boolean;
  previewRole?: PreviewRole;
}): {
  isAdmin: boolean;
  isLabMember: boolean;
  isLinkedCollaborator: boolean;
  canViewVisibility: (vis: SubTabVisibility) => boolean;
} {
  const { currentUser, people = [], collaborators, passkeyUnlocked, previewRole = 'actual' } = params;

  if (previewRole && previewRole !== 'actual') {
    const isAdmin = previewRole === 'admin';
    const isLabMember = previewRole === 'member' || isAdmin;
    const isLinkedCollaborator = previewRole === 'collaborator' || isLabMember;
    return {
      isAdmin,
      isLabMember,
      isLinkedCollaborator,
      canViewVisibility: (vis: SubTabVisibility) => {
        if (vis === 'public') return true;
        if (vis === 'collaborators') return isAdmin || isLabMember || isLinkedCollaborator;
        if (vis === 'members') return isAdmin || isLabMember;
        if (vis === 'admin') return isAdmin;
        return true;
      },
    };
  }

  const isAdmin = currentUser?.role === 'Admin';
  const email = (currentUser?.email || '').trim().toLowerCase();

  // Distinguish external collaborator-only accounts listed in People Directory (group === 'collaborator')
  // from ERSL internal lab members.
  const isCollaboratorOnlyInDirectory = Boolean(
    email &&
      !isAdmin &&
      (currentUser?.role === 'Viewer' ||
        (people.some(p => p.email?.trim().toLowerCase() === email && p.group === 'collaborator') &&
          !people.some(p => p.email?.trim().toLowerCase() === email && p.group !== 'collaborator')))
  );

  const isLabMember = Boolean(currentUser && !isCollaboratorOnlyInDirectory && (isAdmin || currentUser.role === 'Researcher'));
  const isEmailLinkedCollaborator = Boolean(
    email && collaborators.some(c => c.email?.trim().toLowerCase() === email)
  );
  const isLinkedCollaborator = Boolean(passkeyUnlocked || isEmailLinkedCollaborator);

  return {
    isAdmin,
    isLabMember,
    isLinkedCollaborator,
    canViewVisibility: (vis: SubTabVisibility) => {
      if (vis === 'public') return true;
      if (vis === 'collaborators') return isAdmin || isLabMember || isLinkedCollaborator;
      if (vis === 'members') return isAdmin || isLabMember;
      if (vis === 'admin') return isAdmin;
      return true;
    },
  };
}

