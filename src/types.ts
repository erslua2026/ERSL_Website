export type Role = 'Admin' | 'Researcher' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  avatarUrl?: string;
}

export interface ResearchTheme {
  id: string;
  title: string;
  description: string;
  overviewBody?: string;
  selectedPublicationIds?: string[];
  keywords: string[];
  image: string; // fallback to URL, Box direct link, or local filename
}

export type SubTabVisibility = 'public' | 'collaborators' | 'members' | 'admin';
export type ProjectSubTabKey = 'overview' | 'resources' | 'events' | 'datasets';

export type ProjectContentBlockType =
  | 'paragraph'
  | 'objectives'
  | 'link'
  | 'dataset'
  | 'software'
  | 'meeting-note'
  | 'event'
  | 'box-folder'
  | 'image';

export interface ProjectReferenceLink {
  id: string;
  label: string;
  url: string;
  kind?: 'paper' | 'dataset' | 'code' | 'demo' | 'box' | 'other';
}

export interface ProjectContentBlock {
  id: string;
  type: ProjectContentBlockType;
  title: string;
  body?: string;
  url?: string;
  boxUrl?: string;
  category?: string;
  date?: string;
  location?: string;
  availability?: string;
  attendees?: string;
  language?: string;
  version?: string;
  caption?: string;
  highlight?: boolean;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  startTime?: string;
  endTime?: string;
  answer?: string;
  resolved?: boolean;
  status?: string;
  sectionLevel?: 'section' | 'subsection';
  contextNote?: string;
  imageUrl?: string;
  figureSize?: 'full' | 'compact';
  references?: ProjectReferenceLink[];
}

export type ProjectCustomSubTabKind =
  | 'overview'
  | 'information'
  | 'showcase'
  | 'resources'
  | 'events'
  | 'datasets'
  | 'software'
  | 'meeting-notes'
  | 'plan'
  | 'progress'
  | 'schedules'
  | 'questions'
  | 'todo'
  | 'reservoir-tracker'
  | 'workplan-tracker'
  | 'custom';

export interface ProjectShowcaseMetric {
  id: string;
  value: string;
  label: string;
}

export interface ProjectShowcaseTab {
  id: string;
  label: string;
  articleTitle?: string;
  summary?: string;
  metrics?: ProjectShowcaseMetric[];
  heroImageUrl?: string;
  heroCaption?: string;
  attributionNote?: string;
  citationText?: string;
  blocks: ProjectContentBlock[];
}

export type ProjectTrackerStageStatus = string;

export interface ProjectTrackerStageColumn {
  id: string;
  label: string;
}

export interface ProjectTrackerStatusOption {
  id: string;
  label: string;
  color: 'slate' | 'blue' | 'amber' | 'purple' | 'emerald' | 'rose';
}

export interface ProjectTrackerCustomField {
  id: string;
  label: string;
  placeholder?: string;
}

export interface ProjectTrackerConfig {
  trackerTitle?: string;
  itemNoun?: string;
  trackMode?: 'counts' | 'checklist';
  unitLabel?: string;
  showSummaryBar?: boolean;
  stages: ProjectTrackerStageColumn[];
  statuses: ProjectTrackerStatusOption[];
  memberFields: ProjectTrackerCustomField[];
}

export interface ProjectTrackerAllocation {
  id: string;
  memberName: string;
  memberEmail?: string;
  taskTitle?: string;
  targetCount: number;
  finishedCount: number;
  deliverDate?: string;
  collectDate?: string;
  checkDate?: string;
  backupDate?: string;
  status: ProjectTrackerStageStatus;
  notes?: string;
  customFields?: Record<string, string>;
}

export interface ProjectTrackerRound {
  id: string;
  label: string;
  scope?: string;
  dueDate?: string;
  deliverCompleted?: boolean;
  collectCompleted?: boolean;
  checkCompleted?: boolean;
  backupCompleted?: boolean;
  stageChecks?: Record<string, boolean>;
  notes?: string;
  allocations: ProjectTrackerAllocation[];
}

export interface ProjectCustomSubTab {
  id: string;
  label: string;
  kind?: ProjectCustomSubTabKind;
  visibility: SubTabVisibility;
  description?: string;
  blocks: ProjectContentBlock[];
  showcaseTabs?: ProjectShowcaseTab[];
  workplanRounds?: ProjectTrackerRound[];
  workplanConfig?: ProjectTrackerConfig;
}

export interface ProjectInvestigator {
  id: string;
  name: string;
  role: string;
  affiliation?: string;
}

export interface ProjectCollaborator {
  id: string;
  personId?: string;
  name: string;
  department?: string;
  affiliation?: string;
  role?: string;
  email?: string;
  url?: string;
}

export interface ProjectResourceItem {
  id: string;
  title: string;
  description: string;
  url?: string;
  boxUrl?: string;
  category?: string;
  date?: string;
  location?: string;
  availability?: string;
}

export interface ProjectSubPageData {
  summary: string;
  objectives: string[];
  piInfo?: string;
  investigators?: ProjectInvestigator[];
  timeline?: string;
  bannerImage?: string;
  boxFolderUrl?: string;
  headerBgColor?: string;
  tabVisibility: Record<string, SubTabVisibility>;
  resources: ProjectResourceItem[];
  events: ProjectResourceItem[];
  datasets: ProjectResourceItem[];
  fieldPhotos?: { id: string; url: string; caption?: string }[];
  customSubTabs?: ProjectCustomSubTab[];
  collaborators?: ProjectCollaborator[];
  collaboratorAccessCode?: string;
}

export interface Project {
  id: string;
  title: string;
  agency: string;
  sponsor?: string;
  status?: string;
  period?: string;
  details: string;
  summary?: string;
  image?: string;
  link?: string;
  themeIds: string[]; // Must connect to at least one ResearchTheme
  subPage?: ProjectSubPageData;
}

export interface Publication {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  type: 'Peer-Reviewed Article' | 'Conference' | 'Other';
  doi?: string;
  link?: string;
  scholarUrl?: string;
  citations?: number;
  abstract?: string;
  keywords?: string[];
}

export type BoxEntityCategory = 'people' | 'projects' | 'instruments' | 'datasets' | 'software';

export interface Software {
  id: string;
  title: string;
  description: string;
  link?: string;
  language: 'Python' | 'R' | 'JavaScript' | 'Other';
  version?: string;
  boxUrl?: string;
  boxFolderUrl?: string;
  visibility?: 'public' | 'members' | 'admin';
}

export interface DataLayer {
  id: string;
  name: string;
  description: string;
  availability: string;
  link?: string;
  boxUrl?: string;
  boxFolderUrl?: string;
  source?: string;
}

export interface InstrumentResourceItem {
  id: string;
  title: string;
  url: string;
  category: 'Manual' | 'Tutorial' | 'SOP' | 'Software' | 'Dataset' | 'Other';
  visibility: 'public' | 'members' | 'admin';
  description?: string;
}

export type InstrumentStatus = 'field-ready' | 'under-repair' | 'calibration' | 'offline';

export interface Instrument {
  id: string;
  name: string;
  description: string;
  detailedDescription?: string;
  category: string;
  image: string;
  manualLink?: string;
  boxFolderUrl?: string;
  status?: InstrumentStatus;
  statusNote?: string;
  resources?: InstrumentResourceItem[];
}

export interface FormerStint {
  role: string;
  years: string;
  topic?: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  department?: string;
  institution?: string;
  researchFocus: string;
  bio: string;
  email: string;
  scholar?: string;
  linkedin?: string;
  image: string;
  group?: 'member' | 'collaborator' | 'former'; // defaults to 'member'
  expectedGraduationDate?: string; // YYYY-MM-DD; auto-moves member -> former once reached
  graduationDegree?: string; // e.g., Ph.D., MS, Research Scientist
  thesisTopic?: string; // topic/thesis to record when graduated
  formerYears?: string;
  formerTopic?: string;
  currentAffiliation?: string;
  formerStints?: FormerStint[];
  subPage?: ProjectSubPageData;
}

export interface BoxFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: string;
  updatedAt: string;
  updatedBy: string;
  parentId: string | null;
  downloadUrl?: string;
  tags?: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
}

export interface TeachingMaterial {
  id: string;
  title: string;
  course: string;
  description: string;
  link?: string;
  updatedAt: string;
}

export interface BulletinItem {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'high';
  folder?: string;
  sender: string;
  date: string;
  image?: string;
  link?: string;
}

export type LayoutMode = 'vertical-left' | 'vertical-right' | 'horizontal-top' | 'horizontal-compact';
export type TabPosition = 'start' | 'center' | 'end';
export type TabVisibility = 'public' | 'members' | 'admin' | 'hidden';

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  visibility: TabVisibility;
  isCustom?: boolean;
}

export interface CustomBlock {
  id: string;
  type: 'text' | 'link' | 'box-folder' | 'image' | 'dataset';
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface CustomSubTab {
  id: string;
  label: string;
  visibility: SubTabVisibility;
  blocks: CustomBlock[];
}

export interface CustomPageData {
  tabId: string;
  title: string;
  subtitle?: string;
  boxFolderUrl?: string;
  subTabLayout?: 'horizontal' | 'vertical';
  subTabs: CustomSubTab[];
}

export interface HomeSlideConfig {
  id: string;
  file?: string;
  image: string;
  title: string;
  desc: string;
}

export interface HomeMissionConfig {
  badge: string;
  heading: string;
  description: string;
  logoUrl?: string;
  cardTitle: string;
  cardDesc: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
}

export interface PageHeaderConfig {
  badge: string;
  title: string;
  subtitle: string;
  bgColor?: string;
  gradientEnd?: string;
}

export interface SiteConfig {
  labShortName: string;
  labFullName: string;
  labTagline: string;
  departmentName?: string;
  logoUrl?: string;
  newsEyebrow?: string;
  newsHeading?: string;
  footerTitle?: string;
  footerDescription?: string;
  footerStorageTitle?: string;
  footerStorageText?: string;
  footerLocation?: string;
  primaryColor: string;
  subheadingColor: string;
  headerBgColor: string;
  headerTextColor: string;
  pageBgColor: string;
  layoutMode: LayoutMode;
  tabPosition: TabPosition;
  compactMode: boolean;
  showSubheadings: boolean;
  swapHomeColors: boolean;
  themeStyle?: 'macos-glass' | 'classic';
  memberLayoutMode?: LayoutMode;
  configVersion?: number;
  tabs: TabConfig[];
  homeSlides: HomeSlideConfig[];
  homeMission: HomeMissionConfig;
  pageHeaders?: Record<string, PageHeaderConfig>;
}
