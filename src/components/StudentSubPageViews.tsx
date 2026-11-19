import React, { useMemo, useState } from 'react';
import {
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
  Trash2,
} from 'lucide-react';
import { ProjectContentBlock } from '../types';
import { isSafeDataDocumentUrl, openOrDownloadResource, resolveReferenceUrl, sanitizeExternalUrl } from '../lib/boxUtils';
import { LinkedReferenceText } from './LinkedReferenceText';

interface StudentTodoViewProps {
  blocks: ProjectContentBlock[];
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
  canEdit,
  primaryColor,
  onQuickAddTodo,
  onToggleTodo,
  onEditBlock,
  onDeleteBlock,
  onClearCompleted,
}) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const todayYmd = new Date().toISOString().slice(0, 10);
  const completedCount = blocks.filter(b => b.completed).length;
  const pct = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  const filtered = useMemo(() => {
    const list = blocks.filter(b => {
      if (filter === 'active') return !b.completed;
      if (filter === 'done') return Boolean(b.completed);
      return true;
    });
    return [...list].sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)));
  }, [blocks, filter]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onQuickAddTodo({
      title: title.trim(),
      date: dueDate || undefined,
      priority,
      category: 'Weekly To-Do',
    });
    setTitle('');
    setDueDate('');
    setPriority('medium');
  };

  return (
    <div className="space-y-3">
      {/* Inline To-Do Quick Composer */}
      {canEdit && (
        <form onSubmit={handleAdd} className="bg-slate-50 border border-gray-200 rounded-xl p-2.5 flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Add a weekly to-do item and press Enter..."
            className="flex-1 min-w-[200px] px-3 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            title="Target due date (optional)"
            className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-slate-700"
          />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-slate-700"
          >
            <option value="medium">Normal</option>
            <option value="high">High Priority</option>
            <option value="low">Low</option>
          </select>
          <button
            type="submit"
            disabled={!title.trim()}
            className="px-3.5 py-1.5 rounded-lg text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </form>
      )}

      {/* Compact Filter & Completion Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          {([
            ['all', `All (${blocks.length})`],
            ['active', `Active (${blocks.length - completedCount})`],
            ['done', `Completed (${completedCount})`],
          ] as const).map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${filter === key
                  ? 'text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              style={filter === key ? { backgroundColor: primaryColor } : undefined}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
            <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#16a34a' }} />
            </div>
            <span>{completedCount}/{blocks.length} Done ({pct}%)</span>
          </div>
          {canEdit && completedCount > 0 && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="text-[11px] font-bold text-slate-500 hover:text-red-600 underline cursor-pointer"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Checklist Rows */}
      {filtered.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500">
          {blocks.length === 0
            ? 'No weekly to-do tasks yet. Type a task above to start the checklist.'
            : 'No tasks match the selected filter.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {filtered.map(item => {
            const isOverdue = Boolean(item.date && item.date < todayYmd && !item.completed);
            const primaryUrl = item.url || item.boxUrl;
            const isLocalFile = Boolean(primaryUrl && isSafeDataDocumentUrl(primaryUrl));
            const safeUrl = primaryUrl ? resolveReferenceUrl(primaryUrl) : '';
            return (
              <div
                key={item.id}
                className={`px-3.5 py-2.5 flex items-start justify-between gap-3 transition-colors ${item.completed ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                  }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
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

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs sm:text-sm font-bold ${item.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                      >
                        {item.title}
                      </span>

                      {item.priority === 'high' && !item.completed && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-50 text-[#9E1B32] border border-red-200">
                          High
                        </span>
                      )}
                      {item.date && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${isOverdue
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
