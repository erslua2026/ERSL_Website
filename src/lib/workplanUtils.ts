import { initialPeople } from '../data/initialData';
import type { Person, ProjectContentBlock, ProjectSubPageData, User } from '../types';
import { getCloudData, setCloudData } from './cloudStore';
import { Profile, supabase } from './supabase';

export type WorkplanStatus = 'not_started' | 'in_progress' | 'completed' | 'discuss_with_liu';

export interface WorkplanTask {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: WorkplanStatus;
}

export interface WorkplanComment {
  id: string;
  task_id: string;
  author_id?: string;
  author_name: string;
  body: string;
  created_at: string;
}

export const WORKPLAN_STATUS_META: Record<
  WorkplanStatus,
  { label: string; shortLabel: string; cls: string; dot: string }
> = {
  not_started: {
    label: 'Not yet started',
    shortLabel: 'Not started',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'In process',
    shortLabel: 'In process',
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    shortLabel: 'Done',
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  discuss_with_liu: {
    label: 'Need to discuss with Dr. Liu',
    shortLabel: 'Discuss w/ Liu',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
};

export const WORKPLAN_UPDATED_EVENT = 'ersl-workplan-updated';
export const STUDENT_WORKSPACES_UPDATED_EVENT = 'ersl-student-workspaces-updated';

const KNOWN_OWNER_ALIASES: Record<string, string> = {
  'user-liu': 'person-liu',
  'user-mandal': 'person-mandal',
  'user-naveen': 'person-purushothaman',
};

let lastWorkplanMutationAt = 0;

export function markWorkplanLocalWrite() {
  lastWorkplanMutationAt = Date.now();
  try {
    localStorage.setItem('ersl_workplan_dirty_at', String(lastWorkplanMutationAt));
  } catch {}
}

export function isWorkplanLocallyDirty(windowMs = 6000): boolean {
  if (Date.now() - lastWorkplanMutationAt < windowMs) return true;
  try {
    const raw = Number(localStorage.getItem('ersl_workplan_dirty_at') || '0');
    return Number.isFinite(raw) && Date.now() - raw < windowMs;
  } catch {
    return false;
  }
}

export function daysUntilDue(d: string | null | undefined): number | null {
  if (!d) return null;
  const parsed = new Date(`${d}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

export function normalizeWorkplanEmail(email?: string): string {
  return (email || '').trim().toLowerCase();
}

function normalizePersonName(name?: string): string {
  return (name || '')
    .replace(/\b(dr|prof|professor|mr|ms|mrs)\.?\s+/gi, '')
    .trim()
    .toLowerCase();
}

export function buildWorkplanPersonLookup(peopleList: Person[] = initialPeople) {
  const emailToPersonId = new Map<string, string>();
  const idToEmail = new Map<string, string>();
  const idToName = new Map<string, string>();

  [...initialPeople, ...peopleList].forEach(p => {
    const email = normalizeWorkplanEmail(
      p.email || (p.id === 'person-purushothaman' ? 'npurushothaman@ua.edu' : '')
    );
    if (email) {
      emailToPersonId.set(email, p.id);
      idToEmail.set(p.id, email);
    }
    if (p.name) {
      idToName.set(p.id, normalizePersonName(p.name));
    }
  });

  try {
    const rawProfiles = localStorage.getItem('ersl_workplan_profiles');
    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      if (Array.isArray(parsed)) {
        parsed.forEach((prof: { id?: string; email?: string; name?: string }) => {
          const email = normalizeWorkplanEmail(prof?.email);
          if (prof?.id && email) {
            idToEmail.set(prof.id, email);
            if (!emailToPersonId.has(email)) {
              emailToPersonId.set(email, prof.id);
            }
          }
          if (prof?.id && prof?.name && !idToName.has(prof.id)) {
            idToName.set(prof.id, normalizePersonName(prof.name));
          }
        });
      }
    }
  } catch {}

  return { emailToPersonId, idToEmail, idToName };
}

export function matchesPersonWorkplanOwner(
  ownerId: string | undefined,
  person: Person,
  peopleList: Person[] = initialPeople
): boolean {
  if (!ownerId || !person) return false;
  if (ownerId === person.id) return true;
  if (KNOWN_OWNER_ALIASES[ownerId] === person.id) return true;
  if (KNOWN_OWNER_ALIASES[person.id] === ownerId) return true;

  const { emailToPersonId, idToEmail, idToName } = buildWorkplanPersonLookup(peopleList);
  const personEmail = normalizeWorkplanEmail(
    person.email || (person.id === 'person-purushothaman' ? 'npurushothaman@ua.edu' : '')
  );
  const ownerEmail = idToEmail.get(ownerId);

  if (personEmail && ownerEmail && personEmail === ownerEmail) return true;
  if (personEmail && emailToPersonId.get(personEmail) === ownerId) return true;

  const personName = normalizePersonName(person.name);
  const ownerName = idToName.get(ownerId);
  if (personName && ownerName && personName === ownerName) return true;
  return false;
}

export function readLocalWorkplanTasks(): WorkplanTask[] {
  try {
    const raw = localStorage.getItem('ersl_tasks');
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readLocalStudentWorkspaces(): Record<string, ProjectSubPageData> {
  try {
    const raw = localStorage.getItem('ersl_subpage_students');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function todoBlockToWorkplanTask(personId: string, blk: ProjectContentBlock): WorkplanTask {
  const st: WorkplanStatus =
    blk.completed
      ? 'completed'
      : blk.status === 'in_progress' ||
          blk.status === 'discuss_with_liu' ||
          blk.status === 'not_started' ||
          blk.status === 'completed'
        ? blk.status
        : 'not_started';
  return {
    id: blk.id,
    owner_id: personId,
    title: blk.title,
    description: blk.body || '',
    due_date: blk.date || null,
    status: st,
  };
}

/**
 * Merges any student `Weekly To-Do List` blocks from `ersl_subpage_students`
 * that do not yet exist in `tasks`, so Work Plan Manager & To-Do list never diverge.
 */
export function mergeStudentTodosIntoTasks(
  tasks: WorkplanTask[],
  workspaces?: Record<string, ProjectSubPageData>
): { tasks: WorkplanTask[]; addedAny: boolean } {
  const map = workspaces || readLocalStudentWorkspaces();
  const byId = new Map<string, WorkplanTask>();
  tasks.forEach(t => {
    if (t && t.id) byId.set(t.id, t);
  });

  let addedAny = false;
  Object.entries(map).forEach(([personId, sub]) => {
    const todoTab = sub?.customSubTabs?.find(t => t.kind === 'todo' || t.id === 'todo');
    if (!todoTab || !Array.isArray(todoTab.blocks)) return;
    todoTab.blocks.forEach(blk => {
      if (!blk || !blk.id || !blk.title) return;
      if (!byId.has(blk.id)) {
        byId.set(blk.id, todoBlockToWorkplanTask(personId, blk));
        addedAny = true;
      }
    });
  });

  return {
    tasks: Array.from(byId.values()),
    addedAny,
  };
}

/**
 * Mirrors a Work Plan task status/edit/delete back into any matching `todo` tab block
 * stored inside `ersl_subpage_students` (local + cloud + live React event).
 */
export function mirrorTaskToStudentWorkspaces(
  mode: 'update' | 'delete',
  taskId: string,
  patch?: Partial<WorkplanTask>
): void {
  const workspaces = readLocalStudentWorkspaces();
  let changed = false;

  const nextWorkspaces: Record<string, ProjectSubPageData> = { ...workspaces };
  Object.entries(workspaces).forEach(([personId, sub]) => {
    if (!sub || !Array.isArray(sub.customSubTabs)) return;
    let personChanged = false;
    const nextTabs = sub.customSubTabs.map(tab => {
      if (tab.kind !== 'todo' && tab.id !== 'todo') return tab;
      if (!Array.isArray(tab.blocks)) return tab;
      const hasMatch = tab.blocks.some(b => b.id === taskId);
      if (!hasMatch) return tab;

      personChanged = true;
      const nextBlocks =
        mode === 'delete'
          ? tab.blocks.filter(b => b.id !== taskId)
          : tab.blocks.map(b => {
              if (b.id !== taskId) return b;
              const nextStatus = patch?.status ?? (b.completed ? 'completed' : 'not_started');
              return {
                ...b,
                title: patch?.title !== undefined ? patch.title : b.title,
                body: patch?.description !== undefined ? patch.description || undefined : b.body,
                date: patch?.due_date !== undefined ? patch.due_date || undefined : b.date,
                status: nextStatus,
                completed: nextStatus === 'completed',
              };
            });
      return { ...tab, blocks: nextBlocks };
    });

    if (personChanged) {
      changed = true;
      nextWorkspaces[personId] = { ...sub, customSubTabs: nextTabs };
    }
  });

  if (!changed) return;

  try {
    localStorage.setItem('ersl_subpage_students', JSON.stringify(nextWorkspaces));
  } catch {}
  setCloudData('ersl_subpage_students', nextWorkspaces).catch(() => {});
  window.dispatchEvent(
    new CustomEvent(STUDENT_WORKSPACES_UPDATED_EVENT, { detail: nextWorkspaces })
  );
}

export function mergeWorkplanCommentMaps(
  cloudMap?: Record<string, WorkplanComment[]> | null,
  localMap?: Record<string, WorkplanComment[]> | null
): Record<string, WorkplanComment[]> {
  const out: Record<string, WorkplanComment[]> = {};
  const allKeys = new Set([
    ...Object.keys(cloudMap && typeof cloudMap === 'object' ? cloudMap : {}),
    ...Object.keys(localMap && typeof localMap === 'object' ? localMap : {}),
  ]);
  allKeys.forEach(tid => {
    const a = Array.isArray(cloudMap?.[tid]) ? cloudMap![tid] : [];
    const b = Array.isArray(localMap?.[tid]) ? localMap![tid] : [];
    const byId = new Map<string, WorkplanComment>();
    [...a, ...b].forEach(c => {
      if (c && c.id) byId.set(c.id, c);
    });
    out[tid] = Array.from(byId.values()).sort(
      (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
    );
  });
  return out;
}

export async function refreshWorkplanProfilesCache(): Promise<Profile[]> {
  if (!supabase) return [];
  try {
    const res = await supabase.from('profiles').select('id,name,email,role').in('role', ['admin', 'member']);
    if (res.data && res.data.length > 0) {
      try {
        localStorage.setItem('ersl_workplan_profiles', JSON.stringify(res.data));
      } catch {}
      return res.data as Profile[];
    }
  } catch {}
  return [];
}

export async function fetchWorkplanMatrixSnapshot(): Promise<{
  tasks: WorkplanTask[];
  comments: Record<string, WorkplanComment[]>;
}> {
  const localTasks = readLocalWorkplanTasks();
  const dirty = isWorkplanLocallyDirty();

  // Warm Supabase profile alias cache so UUID owners map reliably to People profiles
  refreshWorkplanProfilesCache().catch(() => {});

  try {
    const { data: cloudMatrix } = await getCloudData<{
      tasks?: WorkplanTask[];
      comments?: Record<string, WorkplanComment[]>;
    }>('ersl_workplan_matrix');

    const baseTasks = dirty
      ? localTasks
      : Array.isArray(cloudMatrix?.tasks)
        ? cloudMatrix.tasks
        : localTasks;

    const { tasks: withStudentTodos } = mergeStudentTodosIntoTasks(baseTasks);
    const cloudComments =
      cloudMatrix?.comments && typeof cloudMatrix.comments === 'object' ? cloudMatrix.comments : {};

    try {
      localStorage.setItem('ersl_tasks', JSON.stringify(withStudentTodos));
    } catch {}

    return { tasks: withStudentTodos, comments: cloudComments };
  } catch {
    const { tasks: withStudentTodos } = mergeStudentTodosIntoTasks(localTasks);
    return { tasks: withStudentTodos, comments: {} };
  }
}

export async function saveWorkplanTaskAction(params: {
  action: 'add' | 'update' | 'delete' | 'add-comment' | 'upsert';
  task?: WorkplanTask;
  taskId?: string;
  patch?: Partial<WorkplanTask>;
  comment?: WorkplanComment;
  currentTasks: WorkplanTask[];
  currentComments: Record<string, WorkplanComment[]>;
  updatedBy?: User | null;
}): Promise<{ tasks: WorkplanTask[]; comments: Record<string, WorkplanComment[]> }> {
  const { action, task, taskId, patch, comment, currentTasks, currentComments, updatedBy } = params;

  markWorkplanLocalWrite();

  let optimisticTasks = currentTasks;
  let optimisticComments = currentComments;

  if (action === 'add' && task) {
    optimisticTasks = currentTasks.some(t => t.id === task.id)
      ? currentTasks.map(t => (t.id === task.id ? task : t))
      : [task, ...currentTasks];
  } else if (action === 'upsert' && task) {
    optimisticTasks = currentTasks.some(t => t.id === task.id)
      ? currentTasks.map(t => (t.id === task.id ? task : t))
      : [task, ...currentTasks];
  } else if (action === 'update' && taskId && patch) {
    optimisticTasks = currentTasks.map(t => (t.id === taskId ? { ...t, ...patch } : t));
  } else if (action === 'delete' && taskId) {
    optimisticTasks = currentTasks.filter(t => t.id !== taskId);
  } else if (action === 'add-comment' && taskId && comment) {
    const existing = currentComments[taskId] || [];
    optimisticComments = { ...currentComments, [taskId]: [...existing, comment] };
    try {
      localStorage.setItem(`ersl_comments_${taskId}`, JSON.stringify(optimisticComments[taskId]));
    } catch {}
  }

  try {
    localStorage.setItem('ersl_tasks', JSON.stringify(optimisticTasks));
  } catch {}

  if (action === 'update' && taskId && patch) {
    mirrorTaskToStudentWorkspaces('update', taskId, patch);
  } else if (action === 'delete' && taskId) {
    mirrorTaskToStudentWorkspaces('delete', taskId);
  }

  // Notify mounted sibling/summary views immediately before awaiting network
  window.dispatchEvent(new CustomEvent(WORKPLAN_UPDATED_EVENT));

  try {
    const { data: latestCloud } = await getCloudData<{
      tasks?: WorkplanTask[];
      comments?: Record<string, WorkplanComment[]>;
    }>('ersl_workplan_matrix');
    const baseTasks = Array.isArray(latestCloud?.tasks) ? latestCloud.tasks : optimisticTasks;

    let mergedTasks = baseTasks;
    if ((action === 'add' || action === 'upsert') && task) {
      mergedTasks = baseTasks.some(t => t.id === task.id)
        ? baseTasks.map(t => (t.id === task.id ? task : t))
        : [task, ...baseTasks];
    } else if (action === 'update' && taskId && patch) {
      mergedTasks = baseTasks.some(t => t.id === taskId)
        ? baseTasks.map(t => (t.id === taskId ? { ...t, ...patch } : t))
        : optimisticTasks;
    } else if (action === 'delete' && taskId) {
      mergedTasks = baseTasks.filter(t => t.id !== taskId);
    }

    const mergedComments = mergeWorkplanCommentMaps(latestCloud?.comments, optimisticComments);
    const saved = await setCloudData(
      'ersl_workplan_matrix',
      { tasks: mergedTasks, comments: mergedComments },
      { updatedBy: updatedBy?.name || updatedBy?.email || 'Lab Member' }
    );

    if (saved) {
      try {
        localStorage.setItem('ersl_tasks', JSON.stringify(mergedTasks));
      } catch {}
      window.dispatchEvent(new CustomEvent(WORKPLAN_UPDATED_EVENT));
      return { tasks: mergedTasks, comments: mergedComments };
    }
    return { tasks: optimisticTasks, comments: optimisticComments };
  } catch {
    setCloudData(
      'ersl_workplan_matrix',
      { tasks: optimisticTasks, comments: optimisticComments },
      { updatedBy: updatedBy?.name || updatedBy?.email || 'Lab Member' }
    ).catch(() => {});
    return { tasks: optimisticTasks, comments: optimisticComments };
  }
}

export async function syncStudentTodoBlocksToWorkplan(
  personId: string,
  blocks: ProjectContentBlock[],
  updatedBy?: User | null
): Promise<WorkplanTask[]> {
  if (!personId || !Array.isArray(blocks) || blocks.length === 0) return [];
  const snap = await fetchWorkplanMatrixSnapshot();
  const knownIds = new Set(snap.tasks.map(t => t.id));
  const missing = blocks.filter(b => b && b.id && b.title && !knownIds.has(b.id));
  if (missing.length === 0) return snap.tasks;

  let nextTasks = [...snap.tasks];
  for (const blk of missing) {
    nextTasks = [todoBlockToWorkplanTask(personId, blk), ...nextTasks];
  }
  markWorkplanLocalWrite();
  try {
    localStorage.setItem('ersl_tasks', JSON.stringify(nextTasks));
  } catch {}
  await setCloudData(
    'ersl_workplan_matrix',
    { tasks: nextTasks, comments: snap.comments },
    { updatedBy: updatedBy?.name || updatedBy?.email || 'Lab Member' }
  ).catch(() => {});
  window.dispatchEvent(new CustomEvent(WORKPLAN_UPDATED_EVENT));
  return nextTasks;
}

export function subscribeWorkplanRealtime(onSync: () => void): () => void {
  const onEvent = () => onSync();
  window.addEventListener(WORKPLAN_UPDATED_EVENT, onEvent);

  if (!supabase) {
    return () => {
      window.removeEventListener(WORKPLAN_UPDATED_EVENT, onEvent);
    };
  }

  const channel = supabase
    .channel(`ersl_workplan_shared_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservoir_matrix', filter: 'id=eq.ersl_workplan_matrix' },
      () => onSync()
    )
    .subscribe();

  return () => {
    window.removeEventListener(WORKPLAN_UPDATED_EVENT, onEvent);
    supabase?.removeChannel(channel);
  };
}
