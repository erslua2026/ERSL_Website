import {
  Person,
  Project,
  ProjectCollaborator,
  ProjectContentBlock,
  ProjectCustomSubTab,
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
    label: 'ERSL Members & Admins Only',
    shortLabel: 'Members',
    description: 'Restricted to approved ERSL lab members and administrators.',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    value: 'admin',
    label: 'Lab Admins Only',
    shortLabel: 'Admin Only',
    description: 'Visible strictly to ERSL lab administrators.',
    pillClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
];

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
    kind: 'custom',
    defaultLabel: 'Custom Section',
    defaultVisibility: 'public',
    description: 'Flexible sub-page with any combination of text, links, datasets, or files.',
  },
];

/**
 * Normalizes legacy ProjectSubPageData (fixed 4 sub-tabs) into the flexible
 * customSubTabs representation without dropping any existing summary,
 * objectives, resources, events, datasets, or field photos.
 */
export function buildNormalizedSubTabs(
  project: Project,
  subPage: ProjectSubPageData
): ProjectCustomSubTab[] {
  if (Array.isArray(subPage.customSubTabs) && subPage.customSubTabs.length > 0) {
    return subPage.customSubTabs.map(tab => ({
      ...tab,
      visibility: tab.visibility || subPage.tabVisibility?.[tab.id] || 'public',
      blocks: Array.isArray(tab.blocks) ? tab.blocks : [],
    }));
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

  return [
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
  ];
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

