import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit2,
  Lock,
  Plus,
  Sliders,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  Person,
  ProjectTrackerAllocation,
  ProjectTrackerConfig,
  ProjectTrackerCustomField,
  ProjectTrackerRound,
  ProjectTrackerStageColumn,
  ProjectTrackerStatusOption,
  User,
} from '../types';
import { LinkedReferenceText } from './LinkedReferenceText';

interface ProjectWorkplanTrackerProps {
  rounds: ProjectTrackerRound[];
  config?: ProjectTrackerConfig;
  people?: Person[];
  currentUser?: User | null;
  isAdmin: boolean;
  primaryColor?: string;
  projectTitle: string;
  onChange: (nextRounds: ProjectTrackerRound[], nextConfig: ProjectTrackerConfig) => void;
}

const COLOR_STYLES: Record<
  ProjectTrackerStatusOption['color'],
  { cls: string; dot: string }
> = {
  slate: { cls: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-400' },
  blue: { cls: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
  amber: { cls: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  purple: { cls: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  emerald: { cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  rose: { cls: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' },
};

export const DEFAULT_PROJECT_TRACKER_CONFIG: ProjectTrackerConfig = {
  trackerTitle: 'Project Work Plan & Member Tasks',
  itemNoun: 'Work Package',
  trackMode: 'checklist',
  unitLabel: 'Tasks',
  showSummaryBar: true,
  stages: [],
  statuses: [
    { id: 'not_started', label: 'Not Started', color: 'slate' },
    { id: 'in_progress', label: 'In Progress', color: 'blue' },
    { id: 'needs_review', label: 'Needs Review / Discuss', color: 'amber' },
    { id: 'completed', label: 'Completed', color: 'emerald' },
  ],
  memberFields: [
    { id: 'role', label: 'Deliverable / Method', placeholder: 'e.g. GEE script / Literature review' },
    { id: 'targetDate', label: 'Target Date', placeholder: 'e.g. Nov 30' },
  ],
};

const TRACKER_TEMPLATES: Array<{
  name: string;
  desc: string;
  config: ProjectTrackerConfig;
}> = [
  {
    name: 'Flexible Task & Deliverable Plan',
    desc: 'Each member owns custom tasks, methods, target dates & status (no numeric quotas).',
    config: DEFAULT_PROJECT_TRACKER_CONFIG,
  },
  {
    name: 'Manuscript & Paper Pipeline',
    desc: 'Track co-author sections across Analysis -> Draft -> Review -> Submitted.',
    config: {
      trackerTitle: 'Manuscript & Research Output Plan',
      itemNoun: 'Paper / Section',
      trackMode: 'checklist',
      unitLabel: 'Sections',
      showSummaryBar: true,
      stages: [
        { id: 'analysis', label: 'Analysis Done' },
        { id: 'draft', label: 'Draft Ready' },
        { id: 'pi_review', label: 'PI Reviewed' },
        { id: 'submitted', label: 'Submitted' },
      ],
      statuses: [
        { id: 'not_started', label: 'Planned', color: 'slate' },
        { id: 'in_progress', label: 'Drafting', color: 'blue' },
        { id: 'needs_review', label: 'Advisor Review', color: 'amber' },
        { id: 'completed', label: 'Finalized', color: 'emerald' },
      ],
      memberFields: [
        { id: 'section', label: 'Assigned Section', placeholder: 'Methods / Figures / Discussion' },
        { id: 'targetDate', label: 'Deadline', placeholder: 'Date' },
      ],
    },
  },
  {
    name: 'Model / GeoAI Development Sprints',
    desc: 'Track modeling modules, validation datasets & accuracy checks.',
    config: {
      trackerTitle: 'Modeling & Tool Development Plan',
      itemNoun: 'Sprint / Module',
      trackMode: 'checklist',
      unitLabel: 'Modules',
      showSummaryBar: true,
      stages: [
        { id: 'data_prep', label: 'Data Prepared' },
        { id: 'model_run', label: 'Model Trained' },
        { id: 'validated', label: 'Validated' },
      ],
      statuses: [
        { id: 'not_started', label: 'Queued', color: 'slate' },
        { id: 'in_progress', label: 'Coding / Running', color: 'blue' },
        { id: 'needs_review', label: 'Benchmarking', color: 'purple' },
        { id: 'completed', label: 'Merged / Verified', color: 'emerald' },
      ],
      memberFields: [
        { id: 'component', label: 'Component / Repo', placeholder: 'SAR / Optical / Post-proc' },
        { id: 'metric', label: 'Validation Note / URL', placeholder: 'F1, IoU, or Box link' },
      ],
    },
  },
  {
    name: 'Numeric Count / Scene Production',
    desc: 'Track numeric Done vs Target quotas with custom unit & workflow stages.',
    config: {
      trackerTitle: 'Work Package Production Tracker',
      itemNoun: 'Batch / Round',
      trackMode: 'counts',
      unitLabel: 'Scenes',
      showSummaryBar: true,
      stages: [
        { id: 'assigned', label: 'Assigned' },
        { id: 'processed', label: 'Processed' },
        { id: 'verified', label: 'Verified' },
      ],
      statuses: [
        { id: 'not_started', label: 'Not Started', color: 'slate' },
        { id: 'in_progress', label: 'Processing', color: 'blue' },
        { id: 'qc_checked', label: 'QA Checked', color: 'purple' },
        { id: 'reprocessing', label: 'Needs Revision', color: 'rose' },
        { id: 'verified', label: 'Verified Complete', color: 'emerald' },
      ],
      memberFields: [
        { id: 'region', label: 'Region / Scope', placeholder: 'Basin or Tile ID' },
        { id: 'due', label: 'Check Date', placeholder: 'MM/DD' },
      ],
    },
  },
];

function isDoneStatusId(statusId: string, statuses: ProjectTrackerStatusOption[]): boolean {
  const opt = statuses.find(s => s.id === statusId);
  if (opt?.color === 'emerald') return true;
  return statusId === 'completed' || statusId === 'verified';
}

function getAllocationFieldValue(alloc: ProjectTrackerAllocation, fieldId: string): string {
  if (alloc.customFields && alloc.customFields[fieldId] !== undefined) {
    return alloc.customFields[fieldId];
  }
  if (fieldId === 'deliverDate' || fieldId === 'targetDate') return alloc.deliverDate || '';
  if (fieldId === 'checkDate') return alloc.checkDate || '';
  return '';
}

export const ProjectWorkplanTracker: React.FC<ProjectWorkplanTrackerProps> = ({
  rounds,
  config,
  people = [],
  currentUser,
  isAdmin,
  primaryColor = '#9E1B32',
  projectTitle,
  onChange,
}) => {
  const effectiveConfig: ProjectTrackerConfig = useMemo(() => {
    const base = config || DEFAULT_PROJECT_TRACKER_CONFIG;
    return {
      trackerTitle: base.trackerTitle || DEFAULT_PROJECT_TRACKER_CONFIG.trackerTitle,
      itemNoun: base.itemNoun || DEFAULT_PROJECT_TRACKER_CONFIG.itemNoun,
      trackMode: base.trackMode || 'checklist',
      unitLabel: base.unitLabel || 'Tasks',
      showSummaryBar: base.showSummaryBar ?? true,
      stages: Array.isArray(base.stages) ? base.stages : [],
      statuses:
        Array.isArray(base.statuses) && base.statuses.length > 0
          ? base.statuses
          : DEFAULT_PROJECT_TRACKER_CONFIG.statuses,
      memberFields: Array.isArray(base.memberFields) ? base.memberFields : [],
    };
  }, [config]);

  const [filterMember, setFilterMember] = useState<string>('all');
  const [customizing, setCustomizing] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ProjectTrackerConfig>(effectiveConfig);

  const [roundModal, setRoundModal] = useState<{
    open: boolean;
    existing: ProjectTrackerRound | null;
    label: string;
    scope: string;
    dueDate: string;
    notes: string;
  }>({ open: false, existing: null, label: '', scope: '', dueDate: '', notes: '' });

  const [allocModal, setAllocModal] = useState<{
    roundId: string;
    existing: ProjectTrackerAllocation | null;
    memberName: string;
    taskTitle: string;
    targetCount: string;
    finishedCount: string;
    status: string;
    customFields: Record<string, string>;
    notes: string;
  } | null>(null);

  const isOwnAllocation = (alloc: ProjectTrackerAllocation): boolean => {
    if (!currentUser) return false;
    const uEmail = (currentUser.email || '').trim().toLowerCase();
    const aEmail = (alloc.memberEmail || '').trim().toLowerCase();
    if (uEmail && aEmail && uEmail === aEmail) return true;
    const uName = (currentUser.name || '').trim().toLowerCase();
    const aName = (alloc.memberName || '').trim().toLowerCase();
    return Boolean(uName && aName && (uName === aName || aName.includes(uName) || uName.includes(aName)));
  };

  const canEditAllocation = (alloc: ProjectTrackerAllocation): boolean => {
    return isAdmin || isOwnAllocation(alloc);
  };

  const memberNames = useMemo(() => {
    const names = new Set<string>();
    rounds.forEach(r =>
      r.allocations.forEach(a => {
        if (a.memberName.trim()) names.add(a.memberName.trim());
      })
    );
    return Array.from(names);
  }, [rounds]);

  const stats = useMemo(() => {
    const statuses = effectiveConfig.statuses;
    let totalItems = 0;
    let doneItems = 0;
    let totalTarget = 0;
    let totalFinished = 0;
    const byMember: Record<string, { items: number; done: number; target: number; finished: number }> = {};

    rounds.forEach(r => {
      r.allocations.forEach(a => {
        const done = isDoneStatusId(a.status, statuses);
        const t = Math.max(0, Number(a.targetCount) || 0);
        const f = Math.max(0, Number(a.finishedCount) || 0);
        totalItems += 1;
        if (done) doneItems += 1;
        totalTarget += t;
        totalFinished += f;

        const key = a.memberName.trim() || 'Member';
        if (!byMember[key]) byMember[key] = { items: 0, done: 0, target: 0, finished: 0 };
        byMember[key].items += 1;
        if (done) byMember[key].done += 1;
        byMember[key].target += t;
        byMember[key].finished += f;
      });
    });

    const pct =
      effectiveConfig.trackMode === 'counts'
        ? totalTarget > 0
          ? Math.min(100, Math.round((totalFinished / totalTarget) * 100))
          : 0
        : totalItems > 0
          ? Math.round((doneItems / totalItems) * 100)
          : 0;

    return { totalItems, doneItems, totalTarget, totalFinished, pct, byMember };
  }, [rounds, effectiveConfig.statuses, effectiveConfig.trackMode]);

  const visibleRounds = useMemo(() => {
    if (filterMember === 'all') return rounds;
    return rounds.filter(r =>
      r.allocations.some(a => a.memberName.trim().toLowerCase() === filterMember.toLowerCase())
    );
  }, [rounds, filterMember]);

  const getStageChecked = (round: ProjectTrackerRound, stageId: string): boolean => {
    if (round.stageChecks && round.stageChecks[stageId] !== undefined) {
      return Boolean(round.stageChecks[stageId]);
    }
    if (stageId === 'deliver') return Boolean(round.deliverCompleted);
    if (stageId === 'collect') return Boolean(round.collectCompleted);
    if (stageId === 'check') return Boolean(round.checkCompleted);
    if (stageId === 'backup') return Boolean(round.backupCompleted);
    return false;
  };

  const handleToggleStage = (roundId: string, stageId: string) => {
    if (!isAdmin) return;
    const nextRounds = rounds.map(r => {
      if (r.id !== roundId) return r;
      const cur = getStageChecked(r, stageId);
      return {
        ...r,
        stageChecks: { ...(r.stageChecks || {}), [stageId]: !cur },
      };
    });
    onChange(nextRounds, effectiveConfig);
  };

  const handleSaveRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !roundModal.label.trim()) return;
    if (roundModal.existing) {
      const next = rounds.map(r =>
        r.id === roundModal.existing!.id
          ? {
              ...r,
              label: roundModal.label.trim(),
              scope: roundModal.scope.trim() || undefined,
              dueDate: roundModal.dueDate || undefined,
              notes: roundModal.notes.trim() || undefined,
            }
          : r
      );
      onChange(next, effectiveConfig);
    } else {
      const nextRound: ProjectTrackerRound = {
        id: `pt-round-${Date.now()}`,
        label: roundModal.label.trim(),
        scope: roundModal.scope.trim() || undefined,
        dueDate: roundModal.dueDate || undefined,
        notes: roundModal.notes.trim() || undefined,
        allocations: [],
      };
      onChange([...rounds, nextRound], effectiveConfig);
    }
    setRoundModal({ open: false, existing: null, label: '', scope: '', dueDate: '', notes: '' });
  };

  const handleDeleteRound = (round: ProjectTrackerRound) => {
    if (!isAdmin) return;
    if (!confirm(`Delete "${round.label}" and all member assignments inside it?`)) return;
    onChange(
      rounds.filter(r => r.id !== round.id),
      effectiveConfig
    );
  };

  const handleSaveAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocModal || !allocModal.memberName.trim()) return;
    if (!isAdmin && (!allocModal.existing || !isOwnAllocation(allocModal.existing))) return;

    const matchedPerson = people.find(
      p => p.name.trim().toLowerCase() === allocModal.memberName.trim().toLowerCase()
    );

    const cleanedCustom: Record<string, string> = {};
    Object.entries(allocModal.customFields || {}).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim()) cleanedCustom[k] = v.trim();
    });

    const nextAlloc: ProjectTrackerAllocation = {
      ...(allocModal.existing || {}),
      id: allocModal.existing?.id || `pt-alloc-${Date.now()}`,
      memberName: isAdmin ? allocModal.memberName.trim() : allocModal.existing!.memberName,
      memberEmail: matchedPerson?.email || allocModal.existing?.memberEmail,
      taskTitle: allocModal.taskTitle.trim() || undefined,
      targetCount: isAdmin
        ? Math.max(0, parseInt(allocModal.targetCount, 10) || 0)
        : (allocModal.existing?.targetCount || 0),
      finishedCount: Math.max(0, parseInt(allocModal.finishedCount, 10) || 0),
      status: allocModal.status || effectiveConfig.statuses[0]?.id || 'not_started',
      customFields: Object.keys(cleanedCustom).length > 0 ? cleanedCustom : undefined,
      notes: allocModal.notes.trim() || undefined,
    };

    const next = rounds.map(r => {
      if (r.id !== allocModal.roundId) return r;
      const exists = r.allocations.some(a => a.id === nextAlloc.id);
      return {
        ...r,
        allocations: exists
          ? r.allocations.map(a => (a.id === nextAlloc.id ? nextAlloc : a))
          : [...r.allocations, nextAlloc],
      };
    });
    onChange(next, effectiveConfig);
    setAllocModal(null);
  };

  const handleDeleteAllocation = (roundId: string, allocId: string) => {
    if (!isAdmin) return;
    if (!confirm('Remove this member assignment?')) return;
    onChange(
      rounds.map(r =>
        r.id === roundId ? { ...r, allocations: r.allocations.filter(a => a.id !== allocId) } : r
      ),
      effectiveConfig
    );
  };

  const handleInlineProgressChange = (
    roundId: string,
    alloc: ProjectTrackerAllocation,
    patch: Partial<ProjectTrackerAllocation>
  ) => {
    if (!canEditAllocation(alloc)) return;
    onChange(
      rounds.map(r =>
        r.id === roundId
          ? {
              ...r,
              allocations: r.allocations.map(a => (a.id === alloc.id ? { ...a, ...patch } : a)),
            }
          : r
      ),
      effectiveConfig
    );
  };

  const handleSaveCustomization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const cleanedStatuses = draftConfig.statuses
      .map(s => ({ ...s, label: s.label.trim() }))
      .filter(s => s.label);
    const cleanedStages = draftConfig.stages
      .map(st => ({ ...st, label: st.label.trim() }))
      .filter(st => st.label);
    const cleanedFields = draftConfig.memberFields
      .map(f => ({ ...f, label: f.label.trim() }))
      .filter(f => f.label);

    const nextConfig: ProjectTrackerConfig = {
      ...draftConfig,
      trackerTitle: draftConfig.trackerTitle?.trim() || 'Project Work Plan',
      itemNoun: draftConfig.itemNoun?.trim() || 'Work Package',
      unitLabel: draftConfig.unitLabel?.trim() || 'Items',
      stages: cleanedStages,
      statuses:
        cleanedStatuses.length > 0 ? cleanedStatuses : DEFAULT_PROJECT_TRACKER_CONFIG.statuses,
      memberFields: cleanedFields,
    };
    onChange(rounds, nextConfig);
    setCustomizing(false);
  };

  const handleExportCsv = () => {
    const fieldHeaders = effectiveConfig.memberFields.map(f => f.label);
    const header = [
      effectiveConfig.itemNoun || 'Work Package',
      'Scope',
      'Due Date',
      'Member',
      'Member Task / Focus',
      ...(effectiveConfig.trackMode === 'counts' ? ['Done', 'Target'] : []),
      'Status',
      ...fieldHeaders,
      'Notes',
    ];
    const rows: string[][] = [header];
    rounds.forEach(r => {
      if (r.allocations.length === 0) {
        rows.push([r.label, r.scope || '', r.dueDate || '', '', '', ...(effectiveConfig.trackMode === 'counts' ? ['0', '0'] : []), '', ...fieldHeaders.map(() => ''), r.notes || '']);
      } else {
        r.allocations.forEach(a => {
          const statusLabel = effectiveConfig.statuses.find(s => s.id === a.status)?.label || a.status;
          rows.push([
            r.label,
            r.scope || '',
            r.dueDate || '',
            a.memberName,
            a.taskTitle || '',
            ...(effectiveConfig.trackMode === 'counts'
              ? [String(a.finishedCount), String(a.targetCount)]
              : []),
            statusLabel,
            ...effectiveConfig.memberFields.map(f => getAllocationFieldValue(a, f.id)),
            a.notes || '',
          ]);
        });
      }
    });
    const csv = rows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.slice(0, 32).replace(/[^A-Za-z0-9]+/g, '_')}_project_management.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeRosterSuggestions = people
    .filter(p => (p.group || 'member') === 'member')
    .map(p => p.name);

  return (
    <div className="space-y-3 text-left">
      {/* Header Toolbar + Optional Summary Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2.5 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {effectiveConfig.trackerTitle}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 inline-flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                {isAdmin ? 'Admin Customizer Active' : 'Admin-Configured · Update Own Tasks'}
              </span>
            </div>

            {effectiveConfig.showSummaryBar && (
              <div className="flex flex-wrap items-baseline gap-3 mt-1">
                {effectiveConfig.trackMode === 'counts' ? (
                  <span className="text-base font-black text-white">
                    {stats.totalFinished.toLocaleString()}{' '}
                    <span className="text-xs font-semibold text-slate-400">
                      / {stats.totalTarget.toLocaleString()} {effectiveConfig.unitLabel} ({stats.pct}%)
                    </span>
                  </span>
                ) : (
                  <span className="text-base font-black text-white">
                    {stats.doneItems}{' '}
                    <span className="text-xs font-semibold text-slate-400">
                      / {stats.totalItems} Completed ({stats.pct}%)
                    </span>
                  </span>
                )}
                <span className="text-xs font-bold text-slate-400">
                  · {rounds.length} {effectiveConfig.itemNoun}
                  {rounds.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {rounds.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>CSV</span>
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDraftConfig(JSON.parse(JSON.stringify(effectiveConfig)));
                    setCustomizing(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  title="Admin Only: Customize columns, workflow stages, status options & layout for this project"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Customize Layout</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRoundModal({
                      open: true,
                      existing: null,
                      label: `${effectiveConfig.itemNoun} ${rounds.length + 1}`,
                      scope: '',
                      dueDate: '',
                      notes: '',
                    })
                  }
                  className="px-3 py-1 rounded-lg text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add {effectiveConfig.itemNoun}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {effectiveConfig.showSummaryBar && (
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${stats.pct}%`, backgroundColor: '#10b981' }}
            />
          </div>
        )}

        {memberNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setFilterMember('all')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border ${
                filterMember === 'all'
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              All Team ({memberNames.length})
            </button>
            {memberNames.map(name => {
              const m = stats.byMember[name];
              const summaryText =
                effectiveConfig.trackMode === 'counts'
                  ? `${m?.finished || 0}/${m?.target || 0}`
                  : `${m?.done || 0}/${m?.items || 0}`;
              const active = filterMember === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setFilterMember(active ? 'all' : name)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer border inline-flex items-center gap-1 ${
                    active
                      ? 'bg-white text-slate-900 border-white'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span>{name.split(' ')[0]}</span>
                  <span className="text-[9px] opacity-80">{summaryText}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Work Package Rows */}
      {visibleRounds.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500 space-y-2.5">
          <p className="font-bold text-slate-700">
            No {effectiveConfig.itemNoun?.toLowerCase()}s configured for this project yet.
          </p>
          {isAdmin ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftConfig(JSON.parse(JSON.stringify(effectiveConfig)));
                  setCustomizing(true);
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" /> Customize Structure &amp; Columns
              </button>
              <button
                type="button"
                onClick={() =>
                  setRoundModal({
                    open: true,
                    existing: null,
                    label: `${effectiveConfig.itemNoun} 1`,
                    scope: '',
                    dueDate: '',
                    notes: '',
                  })
                }
                className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-3.5 h-3.5" /> Add First {effectiveConfig.itemNoun}
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Lab administrators can configure project management structure and assign member tasks here.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleRounds.map(round => {
            return (
              <div key={round.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex flex-wrap items-center gap-2">
                    <span
                      className="text-xs font-extrabold px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {round.label}
                    </span>
                    {round.scope && (
                      <span className="text-xs font-bold text-slate-800">{round.scope}</span>
                    )}
                    {round.dueDate && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-slate-600">
                        Due: {round.dueDate}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {effectiveConfig.stages.map(stage => {
                      const active = getStageChecked(round, stage.id);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggleStage(round.id, stage.id)}
                          className={`px-2 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${
                            active
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-white text-slate-500 border-gray-200'
                          } ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{stage.label}</span>
                        </button>
                      );
                    })}

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setAllocModal({
                              roundId: round.id,
                              existing: null,
                              memberName: activeRosterSuggestions[0] || '',
                              taskTitle: '',
                              targetCount: '1',
                              finishedCount: '0',
                              status: effectiveConfig.statuses[0]?.id || 'not_started',
                              customFields: {},
                              notes: '',
                            })
                          }
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" /> Assign Member
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRoundModal({
                              open: true,
                              existing: round,
                              label: round.label,
                              scope: round.scope || '',
                              dueDate: round.dueDate || '',
                              notes: round.notes || '',
                            })
                          }
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                          title={`Edit ${effectiveConfig.itemNoun}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRound(round)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          title={`Delete ${effectiveConfig.itemNoun}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {round.notes && (
                  <div className="px-3.5 py-1.5 text-[11px] text-slate-600 bg-amber-50/40 border-b border-gray-100">
                    <LinkedReferenceText text={round.notes} />
                  </div>
                )}

                {round.allocations.length === 0 ? (
                  <div className="px-3.5 py-2.5 text-[11px] text-slate-400 italic flex items-center justify-between">
                    <span>No member tasks assigned yet.</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setAllocModal({
                            roundId: round.id,
                            existing: null,
                            memberName: activeRosterSuggestions[0] || '',
                            taskTitle: '',
                            targetCount: '1',
                            finishedCount: '0',
                            status: effectiveConfig.statuses[0]?.id || 'not_started',
                            customFields: {},
                            notes: '',
                          })
                        }
                        className="text-xs font-bold not-italic hover:underline cursor-pointer"
                        style={{ color: primaryColor }}
                      >
                        + Assign Member Task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {round.allocations.map(alloc => {
                      const statusOpt =
                        effectiveConfig.statuses.find(s => s.id === alloc.status) ||
                        effectiveConfig.statuses[0] ||
                        { id: 'not_started', label: 'Not Started', color: 'slate' as const };
                      const stStyle = COLOR_STYLES[statusOpt.color] || COLOR_STYLES.slate;
                      const editable = canEditAllocation(alloc);
                      const pct =
                        alloc.targetCount > 0
                          ? Math.min(100, Math.round((alloc.finishedCount / alloc.targetCount) * 100))
                          : 0;

                      return (
                        <div
                          key={alloc.id}
                          className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50/60"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${stStyle.dot}`} />
                              <Users className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-900">{alloc.memberName}</span>
                              {alloc.taskTitle && (
                                <span className="text-xs font-semibold text-slate-700">
                                  — {alloc.taskTitle}
                                </span>
                              )}
                            </div>

                            {(effectiveConfig.memberFields.length > 0 || alloc.notes) && (
                              <div className="flex flex-wrap items-center gap-2 pl-5 text-[11px] text-slate-500">
                                {effectiveConfig.memberFields.map(field => {
                                  const val = getAllocationFieldValue(alloc, field.id);
                                  if (!val) return null;
                                  return (
                                    <span
                                      key={field.id}
                                      className="bg-slate-100 border border-gray-200 px-1.5 py-0.2 rounded text-[10px]"
                                    >
                                      <strong className="text-slate-700">{field.label}:</strong>{' '}
                                      <LinkedReferenceText text={val} />
                                    </span>
                                  );
                                })}
                                {alloc.notes && (
                                  <span className="text-slate-600">
                                    · <LinkedReferenceText text={alloc.notes} />
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            {effectiveConfig.trackMode === 'counts' && (
                              <div className="flex items-center gap-1 bg-slate-50 border border-gray-200 rounded-md px-2 py-0.5 text-[11px]">
                                <input
                                  type="number"
                                  min={0}
                                  disabled={!editable}
                                  value={alloc.finishedCount}
                                  onChange={e =>
                                    handleInlineProgressChange(round.id, alloc, {
                                      finishedCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                  }
                                  className="w-12 bg-white border border-gray-200 rounded px-1 py-0.5 text-center font-bold text-slate-900 disabled:bg-slate-100"
                                />
                                <span className="text-slate-400 font-bold">/</span>
                                <span className="font-bold text-slate-700">{alloc.targetCount}</span>
                                <span className="text-[10px] font-bold text-slate-500 ml-0.5">({pct}%)</span>
                              </div>
                            )}

                            <select
                              disabled={!editable}
                              value={alloc.status}
                              onChange={e =>
                                handleInlineProgressChange(round.id, alloc, { status: e.target.value })
                              }
                              className={`text-[11px] font-bold px-2 py-1 rounded-md border ${stStyle.cls} ${
                                editable ? 'cursor-pointer' : 'cursor-default opacity-90'
                              }`}
                            >
                              {effectiveConfig.statuses.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            {editable && (
                              <button
                                type="button"
                                onClick={() => {
                                  const initialCustom: Record<string, string> = {};
                                  effectiveConfig.memberFields.forEach(f => {
                                    initialCustom[f.id] = getAllocationFieldValue(alloc, f.id);
                                  });
                                  setAllocModal({
                                    roundId: round.id,
                                    existing: alloc,
                                    memberName: alloc.memberName,
                                    taskTitle: alloc.taskTitle || '',
                                    targetCount: String(alloc.targetCount),
                                    finishedCount: String(alloc.finishedCount),
                                    status: alloc.status,
                                    customFields: initialCustom,
                                    notes: alloc.notes || '',
                                  });
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title={isAdmin ? 'Edit assignment' : 'Update my progress & notes'}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAllocation(round.id, alloc.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                title="Remove member"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ADMIN ONLY MODAL: CUSTOMIZE PROJECT MANAGEMENT STRUCTURE */}
      {isAdmin && customizing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <div>
                <h3 className="font-extrabold text-sm">Customize Project Management Structure (Admin Only)</h3>
                <p className="text-[11px] text-white/80">Design the exact workflow, columns, and status options for this project.</p>
              </div>
              <button type="button" onClick={() => setCustomizing(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomization} className="p-5 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
              {/* 1-Click Starter Layouts */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">Apply a Starter Layout (or customize below)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TRACKER_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => setDraftConfig(JSON.parse(JSON.stringify(tpl.config)))}
                      className="p-2.5 rounded-xl border border-gray-200 bg-slate-50 hover:bg-red-50/50 hover:border-[#9E1B32]/40 text-left cursor-pointer transition-colors"
                    >
                      <div className="font-extrabold text-slate-900">{tpl.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-gray-200 rounded-xl p-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Header Title</label>
                  <input
                    value={draftConfig.trackerTitle || ''}
                    onChange={e => setDraftConfig(prev => ({ ...prev, trackerTitle: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Group / Row Label</label>
                  <input
                    value={draftConfig.itemNoun || ''}
                    onChange={e => setDraftConfig(prev => ({ ...prev, itemNoun: e.target.value }))}
                    placeholder="Work Package, Milestone, Phase..."
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Progress Tracking Mode</label>
                  <select
                    value={draftConfig.trackMode || 'checklist'}
                    onChange={e =>
                      setDraftConfig(prev => ({
                        ...prev,
                        trackMode: e.target.value as 'counts' | 'checklist',
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="checklist">Task &amp; Status Checklist (No Counts)</option>
                    <option value="counts">Numeric Progress (Done / Target)</option>
                  </select>
                </div>
              </div>

              {draftConfig.trackMode === 'counts' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Count Unit Label</label>
                    <input
                      value={draftConfig.unitLabel || ''}
                      onChange={e => setDraftConfig(prev => ({ ...prev, unitLabel: e.target.value }))}
                      placeholder="e.g. Watersheds, Maps, Images"
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2 font-bold text-gray-700 pt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.showSummaryBar ?? true}
                      onChange={e => setDraftConfig(prev => ({ ...prev, showSummaryBar: e.target.checked }))}
                    />
                    Show Top Progress Summary Bar
                  </label>
                </div>
              )}

              {/* Workflow Stage Pills (Optional) */}
              <div className="space-y-2 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-slate-800 block">Workflow Stage Checkboxes per Group (Optional)</span>
                    <span className="text-[10px] text-slate-500">Leave empty if you only want individual member tasks &amp; statuses.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftConfig(prev => ({
                        ...prev,
                        stages: [...prev.stages, { id: `stg-${Date.now()}`, label: 'New Stage' }],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Stage
                  </button>
                </div>
                {draftConfig.stages.length > 0 && (
                  <div className="space-y-1.5">
                    {draftConfig.stages.map((st, idx) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <input
                          value={st.label}
                          onChange={e => {
                            const val = e.target.value;
                            setDraftConfig(prev => ({
                              ...prev,
                              stages: prev.stages.map((x, i) => (i === idx ? { ...x, label: val } : x)),
                            }));
                          }}
                          className="flex-1 p-1.5 border border-gray-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraftConfig(prev => ({
                              ...prev,
                              stages: prev.stages.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Member Columns / Fields */}
              <div className="space-y-2 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-slate-800 block">Custom Columns per Member Assignment</span>
                    <span className="text-[10px] text-slate-500">Define what fields each member tracks (e.g. Role, Dataset, Deadline, Repo Link).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftConfig(prev => ({
                        ...prev,
                        memberFields: [
                          ...prev.memberFields,
                          { id: `fld-${Date.now()}`, label: 'Custom Field', placeholder: 'Enter value...' },
                        ],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Column
                  </button>
                </div>
                {draftConfig.memberFields.map((fld, idx) => (
                  <div key={fld.id} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={fld.label}
                      placeholder="Column Name"
                      onChange={e => {
                        const val = e.target.value;
                        setDraftConfig(prev => ({
                          ...prev,
                          memberFields: prev.memberFields.map((x, i) => (i === idx ? { ...x, label: val } : x)),
                        }));
                      }}
                      className="col-span-5 p-1.5 border border-gray-300 rounded"
                    />
                    <input
                      value={fld.placeholder || ''}
                      placeholder="Hint / Placeholder (optional)"
                      onChange={e => {
                        const val = e.target.value;
                        setDraftConfig(prev => ({
                          ...prev,
                          memberFields: prev.memberFields.map((x, i) => (i === idx ? { ...x, placeholder: val } : x)),
                        }));
                      }}
                      className="col-span-6 p-1.5 border border-gray-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraftConfig(prev => ({
                          ...prev,
                          memberFields: prev.memberFields.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Status Dropdown Options */}
              <div className="space-y-2 border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800">Member Status Dropdown Options</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftConfig(prev => ({
                        ...prev,
                        statuses: [
                          ...prev.statuses,
                          { id: `st-${Date.now()}`, label: 'Custom Status', color: 'blue' },
                        ],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Status
                  </button>
                </div>
                {draftConfig.statuses.map((opt, idx) => (
                  <div key={opt.id} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={opt.label}
                      onChange={e => {
                        const val = e.target.value;
                        setDraftConfig(prev => ({
                          ...prev,
                          statuses: prev.statuses.map((x, i) => (i === idx ? { ...x, label: val } : x)),
                        }));
                      }}
                      className="col-span-7 p-1.5 border border-gray-300 rounded"
                    />
                    <select
                      value={opt.color}
                      onChange={e => {
                        const val = e.target.value as ProjectTrackerStatusOption['color'];
                        setDraftConfig(prev => ({
                          ...prev,
                          statuses: prev.statuses.map((x, i) => (i === idx ? { ...x, color: val } : x)),
                        }));
                      }}
                      className="col-span-4 p-1.5 border border-gray-300 rounded bg-white font-semibold"
                    >
                      <option value="slate">Gray</option>
                      <option value="blue">Blue</option>
                      <option value="amber">Amber / Discuss</option>
                      <option value="purple">Purple / QA</option>
                      <option value="emerald">Green (Done)</option>
                      <option value="rose">Red / Alert</option>
                    </select>
                    <button
                      type="button"
                      disabled={draftConfig.statuses.length <= 1}
                      onClick={() =>
                        setDraftConfig(prev => ({
                          ...prev,
                          statuses: prev.statuses.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer disabled:opacity-30 flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCustomizing(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-white font-bold cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Save Project Management Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN ONLY MODAL: Add / Edit Group / Work Package */}
      {isAdmin && roundModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <h3 className="font-extrabold text-sm">
                {roundModal.existing ? `Edit ${effectiveConfig.itemNoun}` : `Add ${effectiveConfig.itemNoun}`}
              </h3>
              <button
                type="button"
                onClick={() => setRoundModal({ open: false, existing: null, label: '', scope: '', dueDate: '', notes: '' })}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRound} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{effectiveConfig.itemNoun} Title *</label>
                <input
                  value={roundModal.label}
                  onChange={e => setRoundModal(prev => ({ ...prev, label: e.target.value }))}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Objective / Scope</label>
                <input
                  value={roundModal.scope}
                  onChange={e => setRoundModal(prev => ({ ...prev, scope: e.target.value }))}
                  placeholder="Optional scope, study basin, or milestone goal"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Target Date</label>
                <input
                  type="date"
                  value={roundModal.dueDate}
                  onChange={e => setRoundModal(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Notes / Reference Links (Optional)</label>
                <textarea
                  rows={2}
                  value={roundModal.notes}
                  onChange={e => setRoundModal(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRoundModal({ open: false, existing: null, label: '', scope: '', dueDate: '', notes: '' })}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-white font-bold cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Assignment / Own Progress Update Modal */}
      {allocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <h3 className="font-extrabold text-sm">
                {allocModal.existing
                  ? isAdmin
                    ? 'Edit Member Assignment'
                    : 'Update My Progress & Notes'
                  : 'Assign Member Task'}
              </h3>
              <button
                type="button"
                onClick={() => setAllocModal(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAllocation} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Team Member *</label>
                <input
                  list="ersl-tracker-member-list"
                  disabled={!isAdmin}
                  value={allocModal.memberName}
                  onChange={e => setAllocModal(prev => (prev ? { ...prev, memberName: e.target.value } : null))}
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-slate-100"
                />
                <datalist id="ersl-tracker-member-list">
                  {activeRosterSuggestions.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Member Responsibility / Deliverable</label>
                <input
                  disabled={!isAdmin}
                  value={allocModal.taskTitle}
                  onChange={e => setAllocModal(prev => (prev ? { ...prev, taskTitle: e.target.value } : null))}
                  placeholder="Specific sub-task or focus for this member..."
                  className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-slate-100"
                />
              </div>

              {effectiveConfig.trackMode === 'counts' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Done ({effectiveConfig.unitLabel})</label>
                    <input
                      type="number"
                      min={0}
                      value={allocModal.finishedCount}
                      onChange={e => setAllocModal(prev => (prev ? { ...prev, finishedCount: e.target.value } : null))}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Target ({effectiveConfig.unitLabel})</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!isAdmin}
                      value={allocModal.targetCount}
                      onChange={e => setAllocModal(prev => (prev ? { ...prev, targetCount: e.target.value } : null))}
                      className="w-full p-2 border border-gray-300 rounded-lg disabled:bg-slate-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-bold text-gray-700 block mb-1">Status</label>
                <select
                  value={allocModal.status}
                  onChange={e =>
                    setAllocModal(prev => (prev ? { ...prev, status: e.target.value } : null))
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                >
                  {effectiveConfig.statuses.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {effectiveConfig.memberFields.map(field => (
                <div key={field.id}>
                  <label className="font-bold text-gray-700 block mb-1">{field.label}</label>
                  <input
                    value={allocModal.customFields[field.id] || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setAllocModal(prev =>
                        prev
                          ? { ...prev, customFields: { ...prev.customFields, [field.id]: val } }
                          : null
                      );
                    }}
                    placeholder={field.placeholder || ''}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              ))}

              <div>
                <label className="font-bold text-gray-700 block mb-1">Notes / Reference URL / DOI (Optional)</label>
                <input
                  value={allocModal.notes}
                  onChange={e => setAllocModal(prev => (prev ? { ...prev, notes: e.target.value } : null))}
                  placeholder="Progress update, DOI, or UA Box link..."
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAllocModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-white font-bold cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
