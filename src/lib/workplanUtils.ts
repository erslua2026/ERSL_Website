import { initialPeople } from '../data/initialData';
import type { Person, User } from '../types';
import { getCloudData, setCloudData } from './cloudStore';
import { supabase } from './supabase';

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

const KNOWN_OWNER_ALIASES: Record<string, string> = {
  'user-liu': 'person-liu',
  'user-mandal': 'person-mandal',
  'user-naveen': 'person-purushothaman',
};

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

export function buildWorkplanPersonLookup(peopleList: Person[] = initialPeople) {
  const emailToPersonId = new Map<string, string>();
  const idToEmail = new Map<string, string>();

  [...initialPeople, ...peopleList].forEach(p => {
    const email = normalizeWorkplanEmail(
      p.email || (p.id === 'person-purushothaman' ? 'npurushothaman@ua.edu' : '')
    );
    if (email) {
      emailToPersonId.set(email, p.id);
      idToEmail.set(p.id, email);
    }
  });

  try {
    const rawProfiles = localStorage.getItem('ersl_workplan_profiles');
    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      if (Array.isArray(parsed)) {
        parsed.forEach((prof: { id?: string; email?: string }) => {
          const email = normalizeWorkplanEmail(prof?.email);
          if (prof?.id && email) {
            idToEmail.set(prof.id, email);
            if (!emailToPersonId.has(email)) {
              emailToPersonId.set(email, prof.id);
            }
          }
        });
      }
    }
  } catch {}

  return { emailToPersonId, idToEmail };
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

  const { emailToPersonId, idToEmail } = buildWorkplanPersonLookup(peopleList);
  const personEmail = normalizeWorkplanEmail(
    person.email || (person.id === 'person-purushothaman' ? 'npurushothaman@ua.edu' : '')
  );
  const ownerEmail = idToEmail.get(ownerId);

  if (personEmail && ownerEmail && personEmail === ownerEmail) return true;
  if (personEmail && emailToPersonId.get(personEmail) === ownerId) return true;
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

export async function fetchWorkplanMatrixSnapshot(): Promise<{
  tasks: WorkplanTask[];
  comments: Record<string, WorkplanComment[]>;
}> {
  const localTasks = readLocalWorkplanTasks();
  try {
    const { data: cloudMatrix } = await getCloudData<{
      tasks?: WorkplanTask[];
      comments?: Record<string, WorkplanComment[]>;
    }>('ersl_workplan_matrix');

    const cloudTasks = Array.isArray(cloudMatrix?.tasks) ? cloudMatrix.tasks : localTasks;
    const cloudComments =
      cloudMatrix?.comments && typeof cloudMatrix.comments === 'object' ? cloudMatrix.comments : {};

    if (Array.isArray(cloudMatrix?.tasks)) {
      try {
        localStorage.setItem('ersl_tasks', JSON.stringify(cloudTasks));
      } catch {}
    }

    return { tasks: cloudTasks, comments: cloudComments };
  } catch {
    return { tasks: localTasks, comments: {} };
  }
}

export async function saveWorkplanTaskAction(params: {
  action: 'add' | 'update' | 'delete' | 'add-comment';
  task?: WorkplanTask;
  taskId?: string;
  patch?: Partial<WorkplanTask>;
  comment?: WorkplanComment;
  currentTasks: WorkplanTask[];
  currentComments: Record<string, WorkplanComment[]>;
  updatedBy?: User | null;
}): Promise<{ tasks: WorkplanTask[]; comments: Record<string, WorkplanComment[]> }> {
  const { action, task, taskId, patch, comment, currentTasks, currentComments, updatedBy } = params;

  let optimisticTasks = currentTasks;
  let optimisticComments = currentComments;

  if (action === 'add' && task) {
    optimisticTasks = [task, ...currentTasks];
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

  try {
    const { data: latestCloud } = await getCloudData<{
      tasks?: WorkplanTask[];
      comments?: Record<string, WorkplanComment[]>;
    }>('ersl_workplan_matrix');
    const baseTasks = Array.isArray(latestCloud?.tasks) ? latestCloud.tasks : optimisticTasks;

    let mergedTasks = baseTasks;
    if (action === 'add' && task) {
      mergedTasks = baseTasks.some(t => t.id === task.id) ? baseTasks : [task, ...baseTasks];
    } else if (action === 'update' && taskId && patch) {
      mergedTasks = baseTasks.some(t => t.id === taskId)
        ? baseTasks.map(t => (t.id === taskId ? { ...t, ...patch } : t))
        : optimisticTasks;
    } else if (action === 'delete' && taskId) {
      mergedTasks = baseTasks.filter(t => t.id !== taskId);
    }

    const mergedComments = mergeWorkplanCommentMaps(latestCloud?.comments, optimisticComments);
    await setCloudData(
      'ersl_workplan_matrix',
      { tasks: mergedTasks, comments: mergedComments },
      { updatedBy: updatedBy?.name || updatedBy?.email || 'Lab Member' }
    );

    try {
      localStorage.setItem('ersl_tasks', JSON.stringify(mergedTasks));
    } catch {}
    window.dispatchEvent(new CustomEvent(WORKPLAN_UPDATED_EVENT));
    return { tasks: mergedTasks, comments: mergedComments };
  } catch {
    setCloudData(
      'ersl_workplan_matrix',
      { tasks: optimisticTasks, comments: optimisticComments },
      { updatedBy: updatedBy?.name || updatedBy?.email || 'Lab Member' }
    ).catch(() => {});
    window.dispatchEvent(new CustomEvent(WORKPLAN_UPDATED_EVENT));
    return { tasks: optimisticTasks, comments: optimisticComments };
  }
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
