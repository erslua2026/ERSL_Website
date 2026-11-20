import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Edit2,
  ExternalLink,
  HelpCircle,
  List,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import type { Person, ProjectContentBlock, User } from '../types';
import { isSafeDataDocumentUrl, openOrDownloadResource, resolveReferenceUrl, sanitizeExternalUrl } from '../lib/boxUtils';
import {
  daysUntilDue,
  fetchWorkplanMatrixSnapshot,
  matchesPersonWorkplanOwner,
  saveWorkplanTaskAction,
  subscribeWorkplanRealtime,
  syncStudentTodoBlocksToWorkplan,
  WORKPLAN_STATUS_META,
  WorkplanComment,
  WorkplanStatus,
  WorkplanTask,
} from '../lib/workplanUtils';
import { LinkedReferenceText } from './LinkedReferenceText';

interface StudentTodoViewProps {
  blocks: ProjectContentBlock[];
  person?: Person;
  people?: Person[];
  currentUser?: User | null;
  canEdit: boolean;
  primaryColor: string;
  onQuickAddTodo: (task: { title: string; date?: string; priority: 'low' | 'medium' | 'high'; category?: string }) => void;
  onToggleTodo: (block: ProjectContentBlock) => void;
  onEditBlock: (block: ProjectContentBlock) => void;
  onDeleteBlock: (blockId: string) => void;
  onClearCompleted: () => void;
}

export const StudentTodoView: React.FC<StudentTodoViewProps> = ({
  blocks,
  person,
  people = [],
  currentUser,
  canEdit,
  primaryColor,
  onQuickAddTodo,
  onToggleTodo,
  onEditBlock,
  onDeleteBlock,
  onClearCompleted,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [filter, setFilter] = useState<'all' | WorkplanStatus>('all');
  const [allTasks, setAllTasks] = useState<WorkplanTask[]>([]);
  const [comments, setComments] = useState<Record<string, WorkplanComment[]>>({});
  const [openChatTaskId, setOpenChatTaskId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  const syncWorkplan = useCallback(async () => {
    const snap = await fetchWorkplanMatrixSnapshot();
    setAllTasks(snap.tasks);
    setComments(snap.comments);
  }, []);

  useEffect(() => {
    syncWorkplan();
    return subscribeWorkplanRealtime(syncWorkplan);
  }, [syncWorkplan]);

  useEffect(() => {
    if (!person?.id || blocks.length === 0) return;
    syncStudentTodoBlocksToWorkplan(person.id, blocks, currentUser)
      .then(updated => {
        if (updated && updated.length > 0) setAllTasks(updated);
      })
      .catch(() => {});
  }, [person?.id, blocks]);

  const myWorkplanTasks = useMemo(() => {
    if (!person) return [];
    return allTasks.filter(t => matchesPersonWorkplanOwner(t.owner_id, person, people));
  }, [allTasks, person, people]);

  const syncedTaskIds = useMemo(() => new Set(allTasks.map(t => t.id)), [allTasks]);
  const unsyncedBlocks = useMemo(
    () => blocks.filter(b => !syncedTaskIds.has(b.id)),
    [blocks, syncedTaskIds]
  );

  const statusCounts = useMemo(() => {
    const allItems = [
      ...myWorkplanTasks.map(t => ({
        status: t.status,
        overdue: Boolean(
          t.status !== 'completed' && daysUntilDue(t.due_date) !== null && (daysUntilDue(t.due_date) as number) < 0
        ),
      })),
      ...unsyncedBlocks.map(b => {
        const st: WorkplanStatus =
          (b.status as WorkplanStatus) || (b.completed ? 'completed' : 'not_started');
        return {
          status: st,
          overdue: Boolean(
            st !== 'completed' && daysUntilDue(b.date) !== null && (daysUntilDue(b.date) as number) < 0
          ),
        };
      }),
    ];
    const total = allItems.length;
    const completed = allItems.filter(i => i.status === 'completed').length;
    const inProgress = allItems.filter(i => i.status === 'in_progress').length;
    const discuss = allItems.filter(i => i.status === 'discuss_with_liu').length;
    const notStarted = allItems.filter(i => i.status === 'not_started').length;
    const overdue = allItems.filter(i => i.overdue).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, discuss, notStarted, overdue, pct };
  }, [myWorkplanTasks, unsyncedBlocks]);

  const filteredTasks = useMemo(() => {
    const base =
      filter === 'all' ? myWorkplanTasks : myWorkplanTasks.filter(t => t.status === filter);
    return [...base].sort(
      (a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')
    );
  }, [myWorkplanTasks, filter]);

  const filteredLocalBlocks = useMemo(() => {
    const base = unsyncedBlocks.filter(b => {
      const st: WorkplanStatus =
        (b.status as WorkplanStatus) || (b.completed ? 'completed' : 'not_started');
      if (filter === 'all') return true;
      return st === filter;
    });
    return [...base].sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)));
  }, [unsyncedBlocks, filter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (person) {
      const newTask: WorkplanTask = {
        id: `task-${Date.now()}`,
        owner_id: person.id,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
        status: 'not_started',
      };
      const res = await saveWorkplanTaskAction({
        action: 'add',
        task: newTask,
        currentTasks: allTasks,
        currentComments: comments,
        updatedBy: currentUser,
      });
      setAllTasks(res.tasks);
      setComments(res.comments);
    } else {
      onQuickAddTodo({
        title: title.trim(),
        date: dueDate || undefined,
        priority,
        category: 'Weekly To-Do',
      });
    }
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
  };

  const handleUpdateWorkplanStatus = async (task: WorkplanTask, status: WorkplanStatus) => {
    const res = await saveWorkplanTaskAction({
      action: 'update',
      taskId: task.id,
      patch: { status },
      currentTasks: allTasks,
      currentComments: comments,
      updatedBy: currentUser,
    });
    setAllTasks(res.tasks);
    setComments(res.comments);
  };

  const handleDeleteWorkplanTask = async (task: WorkplanTask) => {
    if (!confirm(`Delete work plan task "${task.title}"?`)) return;
    const res = await saveWorkplanTaskAction({
      action: 'delete',
      taskId: task.id,
      currentTasks: allTasks,
      currentComments: comments,
      updatedBy: currentUser,
    });
    setAllTasks(res.tasks);
    setComments(res.comments);
  };

  const handleSendWorkplanComment = async (taskId: string) => {
    if (!commentDraft.trim()) return;
    const newComment: WorkplanComment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      task_id: taskId,
      author_id: currentUser?.id,
      author_name: currentUser?.name || currentUser?.email || person?.name || 'Lab Member',
      body: commentDraft.trim(),
      created_at: new Date().toISOString(),
    };
    const res = await saveWorkplanTaskAction({
      action: 'add-comment',
      taskId,
      comment: newComment,
      currentTasks: allTasks,
      currentComments: comments,
      updatedBy: currentUser,
    });
    setAllTasks(res.tasks);
    setComments(res.comments);
    setCommentDraft('');
  };

  return (
    <div className="space-y-2.5">
      {/* Compact Work-Plan Summary Strip */}
      <div className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-extrabold text-slate-800 mr-1">
            {statusCounts.completed}/{statusCounts.total} Done ({statusCounts.pct}%)
          </span>
          <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden mr-1.5">
            <div className="h-full transition-all" style={{ width: `${statusCounts.pct}%`, backgroundColor: '#16a34a' }} />
          </div>
          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
            Active: {statusCounts.inProgress}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
            Discuss w/ Liu: {statusCounts.discuss}
          </span>
          {statusCounts.overdue > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> {statusCounts.overdue} Overdue
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['all', `All (${statusCounts.total})`],
              ['in_progress', 'In Process'],
              ['discuss_with_liu', 'Discuss'],
              ['not_started', 'Not Started'],
              ['completed', 'Done'],
            ] as const
          ).map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors ${
                filter === key
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-slate-600 hover:bg-slate-100'
              }`}
              style={filter === key ? { backgroundColor: primaryColor } : undefined}
            >
              {lbl}
            </button>
          ))}
          {canEdit && blocks.some(b => b.completed) && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="ml-1 text-[10px] font-bold text-slate-500 hover:text-red-600 underline cursor-pointer"
            >
              Clear Done Notes
            </button>
          )}
        </div>
      </div>

      {/* Ultra-Compact Work-Plan-Connected Task Composer */}
      {canEdit && (
        <form onSubmit={handleAdd} className="bg-slate-50 border border-gray-200 rounded-xl p-2 flex flex-wrap items-center gap-1.5 text-xs">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add work plan task / weekly to-do..."
            className="flex-1 min-w-[190px] px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
          />
          {person && (
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Deliverables / note (optional)"
              className="w-44 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
            />
          )}
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            title="Target due date (optional)"
            className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-slate-700"
          />
          {!person && (
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-slate-700"
            >
              <option value="medium">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          )}
          <button
            type="submit"
            disabled={!title.trim()}
            className="px-3 py-1.5 rounded-lg text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>
      )}

      {/* Compact Work-Plan-Style Task Table / Rows */}
      {filteredTasks.length === 0 && filteredLocalBlocks.length === 0 ? (
        <div className="p-5 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
          {statusCounts.total === 0
            ? 'No work plan tasks or to-do items yet. Add one above to sync directly with the Lab Work Plan Summary.'
            : 'No tasks match the selected status filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {filteredTasks.map(task => {
            const st = WORKPLAN_STATUS_META[task.status || 'not_started'];
            const dLeft = daysUntilDue(task.due_date);
            const isOverdue = task.status !== 'completed' && dLeft !== null && dLeft < 0;
            const taskComments = comments[task.id] || [];
            const isDone = task.status === 'completed';

            return (
              <div key={task.id} className={`px-3 py-2 transition-colors ${isOverdue ? 'bg-red-50/25' : isDone ? 'bg-slate-50/60' : 'hover:bg-slate-50/50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        handleUpdateWorkplanStatus(task, isDone ? 'in_progress' : 'completed')
                      }
                      className={`mt-0.5 shrink-0 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      title={isDone ? 'Reopen task' : 'Mark completed'}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 hover:text-[#9E1B32]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                        <span className={`text-xs font-extrabold leading-snug ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </span>
                        {task.due_date && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border inline-flex items-center gap-1 ${
                              isOverdue
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-50 text-slate-600 border-gray-200'
                            }`}
                          >
                            <CalendarIcon className="w-2.5 h-2.5" />
                            {task.due_date}
                            {isOverdue ? ` · Overdue ${Math.abs(dLeft!)}d` : ''}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          <LinkedReferenceText text={task.description} />
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      disabled={!canEdit}
                      value={task.status}
                      onChange={e =>
                        handleUpdateWorkplanStatus(task, e.target.value as WorkplanStatus)
                      }
                      className={`text-[11px] font-bold px-2 py-1 rounded-md border ${st.cls} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      {(Object.keys(WORKPLAN_STATUS_META) as WorkplanStatus[]).map(k => (
                        <option key={k} value={k}>
                          {WORKPLAN_STATUS_META[k].label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setOpenChatTaskId(openChatTaskId === task.id ? null : task.id)}
                      className="px-2 py-1 rounded-md border border-gray-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      title="Notes & comments"
                    >
                      <MessageSquare className="w-3 h-3 text-[#9E1B32]" />
                      {taskComments.length > 0 && <span>{taskComments.length}</span>}
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkplanTask(task)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        title="Delete work plan task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {openChatTaskId === task.id && (
                  <div className="mt-2 ml-6 p-2 bg-slate-50 border border-gray-200 rounded-lg space-y-1.5 text-[11px]">
                    {taskComments.length === 0 ? (
                      <p className="text-slate-400 italic">No discussion notes yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {taskComments.map(c => (
                          <div key={c.id} className="bg-white border border-gray-100 rounded px-2 py-1">
                            <span className="font-bold text-slate-800">{c.author_name}: </span>
                            <span className="text-slate-700">{c.body}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={commentDraft}
                          onChange={e => setCommentDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendWorkplanComment(task.id);
                            }
                          }}
                          placeholder="Add progress note or reply..."
                          className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendWorkplanComment(task.id)}
                          className="px-2.5 py-1 rounded text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <Send className="w-3 h-3" /> Send
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredLocalBlocks.map(item => {
            const todayYmd = new Date().toISOString().slice(0, 10);
            const isOverdue = Boolean(item.date && item.date < todayYmd && !item.completed);
            const primaryUrl = item.url || item.boxUrl;
            const isLocalFile = Boolean(primaryUrl && isSafeDataDocumentUrl(primaryUrl));
            const safeUrl = primaryUrl ? resolveReferenceUrl(primaryUrl) : '';
            return (
              <div
                key={item.id}
                className={`px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                  item.completed ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && onToggleTodo(item)}
                    className={`mt-0.5 shrink-0 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                    title={canEdit ? (item.completed ? 'Mark as active' : 'Mark as completed') : undefined}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 hover:text-[#9E1B32]" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-xs font-bold ${
                          item.completed ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.priority === 'high' && !item.completed && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-red-50 text-[#9E1B32] border border-red-200">
                          High
                        </span>
                      )}
                      {item.date && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border inline-flex items-center gap-1 ${
                            isOverdue
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-50 text-slate-600 border-gray-200'
                          }`}
                        >
                          <CalendarIcon className="w-2.5 h-2.5" />
                          {item.date}
                          {isOverdue ? ' · Overdue' : ''}
                        </span>
                      )}
                      {primaryUrl && (
                        isLocalFile ? (
                          <button
                            type="button"
                            onClick={() => openOrDownloadResource(primaryUrl, item.title)}
                            className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> File
                          </button>
                        ) : safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> Link
                          </a>
                        ) : null
                      )}
                    </div>
                    {item.body && (
                      <p className="text-[11px] text-slate-500 leading-snug">
                        <LinkedReferenceText text={item.body} />
                      </p>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditBlock(item)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                      title="Edit task details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBlock(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface StudentScheduleViewProps {
  blocks: ProjectContentBlock[];
  canEdit: boolean;
  primaryColor: string;
  onAddEventForDate: (dateStr: string, defaultCategory?: string) => void;
  onEditBlock: (block: ProjectContentBlock) => void;
  onDeleteBlock: (blockId: string) => void;
}

const EVENT_TYPE_BADGES: Record<string, string> = {
  'Lab Meeting': 'bg-red-50 text-[#9E1B32] border-red-200',
  'Course / Class': 'bg-blue-50 text-blue-700 border-blue-200',
  'Field Survey': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Deadline / Talk': 'bg-amber-50 text-amber-800 border-amber-200',
};

export const StudentScheduleView: React.FC<StudentScheduleViewProps> = ({
  blocks,
  canEdit,
  primaryColor,
  onAddEventForDate,
  onEditBlock,
  onDeleteBlock,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const todayYmd = new Date().toISOString().slice(0, 10);

  const calendarDays = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number; dateStr: string } | null> = [];
    for (let i = 0; i < firstDayIndex; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return cells;
  }, [monthDate]);

  const sortedEvents = useMemo(() => {
    return [...blocks].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  }, [blocks]);

  const selectedDayEvents = sortedEvents.filter(ev => ev.date === selectedDate);

  return (
    <div className="space-y-3">
      {/* Toolbar: Calendar vs Agenda List + Preset Quick Add */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" style={viewMode === 'calendar' ? { color: primaryColor } : undefined} />
            <span>Calendar View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <List className="w-3.5 h-3.5" style={viewMode === 'list' ? { color: primaryColor } : undefined} />
            <span>Agenda List ({blocks.length})</span>
          </button>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(['Lab Meeting', 'Course / Class', 'Field Survey', 'Deadline / Talk'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => onAddEventForDate(selectedDate, cat)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 font-bold text-[11px] text-slate-700 cursor-pointer"
              >
                + {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? (
        <div className="space-y-3">
          {/* Monthly Navigation */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-gray-200">
            <h4 className="font-extrabold text-sm text-slate-900">
              {monthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h4>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setMonthDate(now);
                  setSelectedDate(now.toISOString().slice(0, 10));
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-slate-100 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
              </button>
            </div>
          </div>

          {/* 7-Column Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="h-24 bg-slate-50/50 rounded-lg" />;
              }
              const dayEvents = sortedEvents.filter(ev => ev.date === cell.dateStr);
              const isToday = cell.dateStr === todayYmd;
              const isSelected = cell.dateStr === selectedDate;
              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`h-24 p-1.5 rounded-lg border flex flex-col justify-start overflow-hidden cursor-pointer transition-all text-left ${isSelected
                      ? 'border-[#9E1B32] ring-1 ring-[#9E1B32]/30 bg-red-50/20'
                      : isToday
                        ? 'border-blue-300 bg-blue-50/20'
                        : 'border-gray-200 bg-white hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${isToday ? 'bg-[#9E1B32] text-white' : 'text-slate-700'
                        }`}
                    >
                      {cell.day}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateStr);
                          onAddEventForDate(cell.dateStr);
                        }}
                        title={`Add schedule on ${cell.dateStr}`}
                        className="text-slate-400 hover:text-[#9E1B32] p-0.5 rounded cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-y-auto">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        onClick={e => {
                          e.stopPropagation();
                          if (canEdit) onEditBlock(ev);
                        }}
                        className={`text-[9px] font-bold px-1 py-0.5 rounded border truncate ${EVENT_TYPE_BADGES[ev.category || ''] || 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        title={`${ev.startTime ? ev.startTime + ' · ' : ''}${ev.title}`}
                      >
                        {ev.startTime ? `${ev.startTime} ` : ''}{ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Date Agenda Drawer */}
          <div className="bg-slate-50 rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-800">
                Schedule for {selectedDate} ({selectedDayEvents.length})
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onAddEventForDate(selectedDate)}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg text-white cursor-pointer inline-flex items-center gap-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-3 h-3" /> Add Event on {selectedDate}
                </button>
              )}
            </div>
            {selectedDayEvents.length === 0 ? (
              <p className="text-[11px] text-slate-500">No events scheduled on this date.</p>
            ) : (
              <div className="space-y-1.5">
                {selectedDayEvents.map(ev => (
                  <ScheduleRow
                    key={ev.id}
                    ev={ev}
                    canEdit={canEdit}
                    primaryColor={primaryColor}
                    onEdit={() => onEditBlock(ev)}
                    onDelete={() => onDeleteBlock(ev.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedEvents.length === 0 ? (
            <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
              No scheduled items yet. Switch to Calendar View or click a quick-add button above to schedule an event.
            </div>
          ) : (
            sortedEvents.map(ev => (
              <ScheduleRow
                key={ev.id}
                ev={ev}
                canEdit={canEdit}
                primaryColor={primaryColor}
                onEdit={() => onEditBlock(ev)}
                onDelete={() => onDeleteBlock(ev.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ScheduleRow: React.FC<{
  ev: ProjectContentBlock;
  canEdit: boolean;
  primaryColor: string;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ ev, canEdit, primaryColor, onEdit, onDelete }) => {
  const href = ev.url || ev.boxUrl;
  const safeHref = href ? sanitizeExternalUrl(href) : '';
  const isLocal = Boolean(href && isSafeDataDocumentUrl(href));
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 flex items-center justify-between gap-2 text-xs">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {ev.category && (
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${EVENT_TYPE_BADGES[ev.category] || 'bg-slate-100 text-slate-700 border-gray-200'
                }`}
            >
              {ev.category}
            </span>
          )}
          {ev.date && (
            <span className="text-[10px] font-bold text-slate-600 inline-flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" /> {ev.date}
            </span>
          )}
          {(ev.startTime || ev.endTime) && (
            <span className="text-[10px] font-bold text-slate-600 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {ev.startTime || ''}{ev.endTime ? `–${ev.endTime}` : ''}
            </span>
          )}
          {ev.location && (
            <span className="text-[10px] font-semibold text-slate-500 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {ev.location}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLocal ? (
            <button
              type="button"
              onClick={() => openOrDownloadResource(href, ev.title)}
              className="font-extrabold hover:underline cursor-pointer"
              style={{ color: primaryColor }}
            >
              {ev.title}
            </button>
          ) : safeHref ? (
            <a href={safeHref} target="_blank" rel="noopener noreferrer" className="font-extrabold hover:underline" style={{ color: primaryColor }}>
              {ev.title}
            </a>
          ) : (
            <span className="font-extrabold text-slate-900">{ev.title}</span>
          )}
          {ev.body && <span className="text-[11px] text-slate-500 truncate max-w-lg">— {ev.body}</span>}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={onEdit} className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={onDelete} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
};

interface StudentQuestionsViewProps {
  blocks: ProjectContentBlock[];
  canEdit: boolean;
  primaryColor: string;
  onQuickAddQuestion: (q: { title: string; body?: string; date: string }) => void;
  onUpdateQuestionBlock: (nextBlock: ProjectContentBlock) => void;
  onEditBlock: (block: ProjectContentBlock) => void;
  onDeleteBlock: (blockId: string) => void;
}

export const StudentQuestionsView: React.FC<StudentQuestionsViewProps> = ({
  blocks,
  canEdit,
  primaryColor,
  onQuickAddQuestion,
  onUpdateQuestionBlock,
  onEditBlock,
  onDeleteBlock,
}) => {
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionNotes, setQuestionNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');

  const openCount = blocks.filter(b => !b.resolved).length;
  const resolvedCount = blocks.filter(b => b.resolved).length;

  const visibleQuestions = blocks.filter(b => {
    if (statusFilter === 'open') return !b.resolved;
    if (statusFilter === 'resolved') return Boolean(b.resolved);
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionTitle.trim()) return;
    onQuickAddQuestion({
      title: questionTitle.trim(),
      body: questionNotes.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
    });
    setQuestionTitle('');
    setQuestionNotes('');
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={questionTitle}
              onChange={e => setQuestionTitle(e.target.value)}
              placeholder="Log a technical or research question for Dr. Liu..."
              className="flex-1 min-w-[220px] px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
            />
            <button
              type="submit"
              disabled={!questionTitle.trim()}
              className="px-3.5 py-1.5 rounded-lg text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Question
            </button>
          </div>
          <input
            type="text"
            value={questionNotes}
            onChange={e => setQuestionNotes(e.target.value)}
            placeholder="Optional context, dataset link, or parameter details..."
            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
          />
        </form>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {([
          ['all', `All Questions (${blocks.length})`],
          ['open', `Open (${openCount})`],
          ['resolved', `Answered (${resolvedCount})`],
        ] as const).map(([key, lbl]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${statusFilter === key ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            style={statusFilter === key ? { backgroundColor: primaryColor } : undefined}
          >
            {lbl}
          </button>
        ))}
      </div>

      {visibleQuestions.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
          No questions recorded yet. Log open research questions above before lab meetings.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleQuestions.map(q => {
            const href = q.url || q.boxUrl;
            const isLocal = Boolean(href && isSafeDataDocumentUrl(href));
            const safeHref = href ? resolveReferenceUrl(href) : '';
            return (
              <div
                key={q.id}
                className={`rounded-xl border px-3.5 py-2.5 space-y-2 text-xs ${q.resolved ? 'bg-emerald-50/30 border-emerald-200' : 'bg-white border-gray-200'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${q.resolved
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                      >
                        <HelpCircle className="w-2.5 h-2.5" />
                        {q.resolved ? 'Answered' : 'Open'}
                      </span>
                      {q.date && <span className="text-[10px] font-bold text-slate-400">{q.date}</span>}
                      {href && (
                        isLocal ? (
                          <button
                            type="button"
                            onClick={() => openOrDownloadResource(href, q.title)}
                            className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> Attachment
                          </button>
                        ) : safeHref ? (
                          <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5">
                            <ExternalLink className="w-2.5 h-2.5" /> Link
                          </a>
                        ) : null
                      )}
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900">{q.title}</h4>
                    {q.body && (
                      <p className="text-xs text-slate-600 whitespace-pre-line">
                        <LinkedReferenceText text={q.body} />
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQuestionBlock({ ...q, resolved: !q.resolved })}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                      >
                        {q.resolved ? 'Reopen' : 'Mark Answered'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnsweringId(answeringId === q.id ? null : q.id);
                          setAnswerDraft(q.answer || '');
                        }}
                        className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                        title="Add / Edit Answer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => onEditBlock(q)} className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => onDeleteBlock(q.id)} className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>

                {q.answer && answeringId !== q.id && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-950">
                    <span className="font-extrabold block text-[10px] uppercase tracking-wider text-emerald-700 mb-0.5">
                      Resolution / Mentor Response
                    </span>
                    <p className="whitespace-pre-line">
                      <LinkedReferenceText text={q.answer} />
                    </p>
                  </div>
                )}

                {canEdit && answeringId === q.id && (
                  <div className="bg-slate-50 border border-gray-200 rounded-lg p-2.5 space-y-2">
                    <textarea
                      rows={2}
                      value={answerDraft}
                      onChange={e => setAnswerDraft(e.target.value)}
                      placeholder="Write mentor feedback, answer, or resolution notes..."
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAnsweringId(null)}
                        className="px-2.5 py-1 rounded bg-white border border-gray-200 text-slate-600 font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateQuestionBlock({
                            ...q,
                            answer: answerDraft.trim() || undefined,
                            resolved: Boolean(answerDraft.trim()),
                          });
                          setAnsweringId(null);
                        }}
                        className="px-3 py-1 rounded text-white font-bold cursor-pointer"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Save Answer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
