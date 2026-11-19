import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit2,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  Person,
  ProjectTrackerAllocation,
  ProjectTrackerRound,
  ProjectTrackerStageStatus,
} from '../types';

interface ProjectWorkplanTrackerProps {
  rounds: ProjectTrackerRound[];
  people?: Person[];
  canEdit: boolean;
  isAdmin: boolean;
  primaryColor?: string;
  projectTitle: string;
  onChangeRounds: (nextRounds: ProjectTrackerRound[]) => void;
}

const STAGE_META: Record<
  ProjectTrackerStageStatus,
  { label: string; short: string; cls: string; dot: string }
> = {
  not_started: {
    label: 'Not Started',
    short: 'Not Started',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    short: 'In Progress',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
  },
  qc_checked: {
    label: 'QC Checked',
    short: 'QC Checked',
    cls: 'bg-purple-100 text-purple-800 border-purple-300',
    dot: 'bg-purple-500',
  },
  reprocessing: {
    label: 'Reprocessing',
    short: 'Reprocess',
    cls: 'bg-blue-100 text-blue-800 border-blue-300',
    dot: 'bg-blue-500',
  },
  verified: {
    label: 'Verified Complete',
    short: 'Verified',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dot: 'bg-emerald-500',
  },
};

export const ProjectWorkplanTracker: React.FC<ProjectWorkplanTrackerProps> = ({
  rounds,
  people = [],
  canEdit,
  isAdmin,
  primaryColor = '#9E1B32',
  projectTitle,
  onChangeRounds,
}) => {
  const [filterMember, setFilterMember] = useState<string>('all');
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
    targetCount: string;
    finishedCount: string;
    status: ProjectTrackerStageStatus;
    deliverDate: string;
    checkDate: string;
    notes: string;
  } | null>(null);

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
    let totalTarget = 0;
    let totalFinished = 0;
    let totalVerified = 0;
    const byMember: Record<string, { target: number; finished: number; verified: number }> = {};

    rounds.forEach(r => {
      r.allocations.forEach(a => {
        const t = Math.max(0, Number(a.targetCount) || 0);
        const f = Math.max(0, Number(a.finishedCount) || 0);
        totalTarget += t;
        totalFinished += f;
        if (a.status === 'verified') totalVerified += f > 0 ? f : t;
        const key = a.memberName.trim() || 'Team Member';
        if (!byMember[key]) byMember[key] = { target: 0, finished: 0, verified: 0 };
        byMember[key].target += t;
        byMember[key].finished += f;
        if (a.status === 'verified') byMember[key].verified += f > 0 ? f : t;
      });
    });

    const pct = totalTarget > 0 ? Math.min(100, Math.round((totalFinished / totalTarget) * 100)) : 0;
    const verifiedPct = totalTarget > 0 ? Math.min(100, Math.round((totalVerified / totalTarget) * 100)) : 0;
    return { totalTarget, totalFinished, totalVerified, pct, verifiedPct, byMember };
  }, [rounds]);

  const visibleRounds = useMemo(() => {
    if (filterMember === 'all') return rounds;
    return rounds.filter(r =>
      r.allocations.some(a => a.memberName.trim().toLowerCase() === filterMember.toLowerCase())
    );
  }, [rounds, filterMember]);

  const handleSaveRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundModal.label.trim()) return;
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
      onChangeRounds(next);
    } else {
      const nextRound: ProjectTrackerRound = {
        id: `pt-round-${Date.now()}`,
        label: roundModal.label.trim(),
        scope: roundModal.scope.trim() || undefined,
        dueDate: roundModal.dueDate || undefined,
        notes: roundModal.notes.trim() || undefined,
        allocations: [],
      };
      onChangeRounds([...rounds, nextRound]);
    }
    setRoundModal({ open: false, existing: null, label: '', scope: '', dueDate: '', notes: '' });
  };

  const handleDeleteRound = (round: ProjectTrackerRound) => {
    if (!confirm(`Delete "${round.label}" and its team progress entries?`)) return;
    onChangeRounds(rounds.filter(r => r.id !== round.id));
  };

  const handleToggleRoundStage = (
    roundId: string,
    field: 'deliverCompleted' | 'collectCompleted' | 'checkCompleted' | 'backupCompleted'
  ) => {
    if (!canEdit) return;
    onChangeRounds(
      rounds.map(r => (r.id === roundId ? { ...r, [field]: !r[field] } : r))
    );
  };

  const handleSaveAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocModal || !allocModal.memberName.trim()) return;
    const nextAlloc: ProjectTrackerAllocation = {
      id: allocModal.existing?.id || `pt-alloc-${Date.now()}`,
      memberName: allocModal.memberName.trim(),
      targetCount: Math.max(0, parseInt(allocModal.targetCount, 10) || 0),
      finishedCount: Math.max(0, parseInt(allocModal.finishedCount, 10) || 0),
      status: allocModal.status,
      deliverDate: allocModal.deliverDate.trim() || undefined,
      checkDate: allocModal.checkDate.trim() || undefined,
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
    onChangeRounds(next);
    setAllocModal(null);
  };

  const handleDeleteAllocation = (roundId: string, allocId: string) => {
    if (!confirm('Remove this member allocation from the work round?')) return;
    onChangeRounds(
      rounds.map(r =>
        r.id === roundId ? { ...r, allocations: r.allocations.filter(a => a.id !== allocId) } : r
      )
    );
  };

  const handleInlineProgressChange = (
    roundId: string,
    allocId: string,
    patch: Partial<ProjectTrackerAllocation>
  ) => {
    if (!canEdit) return;
    onChangeRounds(
      rounds.map(r =>
        r.id === roundId
          ? {
              ...r,
              allocations: r.allocations.map(a => (a.id === allocId ? { ...a, ...patch } : a)),
            }
          : r
      )
    );
  };

  const handleExportCsv = () => {
    const header = ['Round/Sprint', 'Scope', 'Due Date', 'Member', 'Finished', 'Target', 'Status', 'Deliver', 'Check', 'Notes'];
    const rows: string[][] = [header];
    rounds.forEach(r => {
      if (r.allocations.length === 0) {
        rows.push([r.label, r.scope || '', r.dueDate || '', '', '0', '0', 'not_started', '', '', r.notes || '']);
      } else {
        r.allocations.forEach(a => {
          rows.push([
            r.label,
            r.scope || '',
            r.dueDate || '',
            a.memberName,
            String(a.finishedCount),
            String(a.targetCount),
            STAGE_META[a.status].label,
            a.deliverDate || '',
            a.checkDate || '',
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
    a.download = `${projectTitle.slice(0, 32).replace(/[^A-Za-z0-9]+/g, '_')}_workplan_progress.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeRosterSuggestions = people
    .filter(p => (p.group || 'member') === 'member')
    .map(p => p.name);

  return (
    <div className="space-y-3.5 text-left">
      {/* Compact Executive Progress Strip */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-3 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Overall Progress
              </span>
              <span className="text-lg font-black text-white">
                {stats.totalFinished.toLocaleString()}{' '}
                <span className="text-xs font-semibold text-slate-400">
                  / {stats.totalTarget.toLocaleString()} ({stats.pct}%)
                </span>
              </span>
            </div>
            <div className="h-7 w-px bg-slate-700 hidden sm:block" />
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block">
                Verified Complete
              </span>
              <span className="text-sm font-black text-emerald-300">
                {stats.totalVerified.toLocaleString()} ({stats.verifiedPct}%)
              </span>
            </div>
            <div className="h-7 w-px bg-slate-700 hidden sm:block" />
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Rounds / Sprints
              </span>
              <span className="text-sm font-black text-white">{rounds.length}</span>
            </div>
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
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  setRoundModal({
                    open: true,
                    existing: null,
                    label: `Round ${rounds.length + 1}`,
                    scope: '',
                    dueDate: '',
                    notes: '',
                  })
                }
                className="px-3 py-1 rounded-lg text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Work Round</span>
              </button>
            )}
          </div>
        </div>

        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${stats.pct}%`, backgroundColor: '#10b981' }}
          />
        </div>

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
              All Team
            </button>
            {memberNames.map(name => {
              const m = stats.byMember[name];
              const mPct = m && m.target > 0 ? Math.round((m.finished / m.target) * 100) : 0;
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
                  <span className="text-[9px] opacity-80">
                    {m?.finished || 0}/{m?.target || 0} ({mPct}%)
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Round / Sprint Allocation Rows */}
      {visibleRounds.length === 0 ? (
        <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-xs text-gray-500 space-y-2">
          <p className="font-bold text-slate-700">No work plan rounds tracked for this project yet.</p>
          {canEdit && (
            <button
              type="button"
              onClick={() =>
                setRoundModal({
                  open: true,
                  existing: null,
                  label: 'Round 1',
                  scope: '',
                  dueDate: '',
                  notes: '',
                })
              }
              className="px-3.5 py-1.5 rounded-lg text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-3.5 h-3.5" /> Add First Work Round
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleRounds.map(round => {
            const roundTarget = round.allocations.reduce((s, a) => s + (a.targetCount || 0), 0);
            const roundDone = round.allocations.reduce((s, a) => s + (a.finishedCount || 0), 0);
            const roundPct = roundTarget > 0 ? Math.min(100, Math.round((roundDone / roundTarget) * 100)) : 0;

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
                    <span className="text-[11px] font-extrabold text-slate-700">
                      {roundDone}/{roundTarget} ({roundPct}%)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    {(
                      [
                        ['deliverCompleted', 'Delivered'],
                        ['collectCompleted', 'Collected'],
                        ['checkCompleted', 'QC Checked'],
                        ['backupCompleted', 'Backed Up'],
                      ] as const
                    ).map(([field, lbl]) => {
                      const active = Boolean(round[field]);
                      return (
                        <button
                          key={field}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleToggleRoundStage(round.id, field)}
                          className={`px-2 py-0.5 rounded-full font-bold border inline-flex items-center gap-1 ${
                            active
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-white text-slate-500 border-gray-200'
                          } ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{lbl}</span>
                        </button>
                      );
                    })}

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setAllocModal({
                              roundId: round.id,
                              existing: null,
                              memberName: activeRosterSuggestions[0] || '',
                              targetCount: '10',
                              finishedCount: '0',
                              status: 'not_started',
                              deliverDate: '',
                              checkDate: '',
                              notes: '',
                            })
                          }
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" /> Member
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
                          title="Edit round"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRound(round)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                            title="Delete round"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {round.notes && (
                  <div className="px-3.5 py-1.5 text-[11px] text-slate-600 bg-amber-50/40 border-b border-gray-100">
                    {round.notes}
                  </div>
                )}

                {round.allocations.length === 0 ? (
                  <div className="px-3.5 py-2.5 text-[11px] text-slate-400 italic flex items-center justify-between">
                    <span>No member allocations added to this round yet.</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setAllocModal({
                            roundId: round.id,
                            existing: null,
                            memberName: activeRosterSuggestions[0] || '',
                            targetCount: '10',
                            finishedCount: '0',
                            status: 'not_started',
                            deliverDate: '',
                            checkDate: '',
                            notes: '',
                          })
                        }
                        className="text-xs font-bold not-italic hover:underline cursor-pointer"
                        style={{ color: primaryColor }}
                      >
                        + Assign Member
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {round.allocations.map(alloc => {
                      const st = STAGE_META[alloc.status || 'not_started'];
                      const pct =
                        alloc.targetCount > 0
                          ? Math.min(100, Math.round((alloc.finishedCount / alloc.targetCount) * 100))
                          : 0;
                      return (
                        <div
                          key={alloc.id}
                          className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50/60"
                        >
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                            <Users className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900">{alloc.memberName}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-slate-50 border border-gray-200 rounded-md px-2 py-0.5 text-[11px]">
                              <input
                                type="number"
                                min={0}
                                disabled={!canEdit}
                                value={alloc.finishedCount}
                                onChange={e =>
                                  handleInlineProgressChange(round.id, alloc.id, {
                                    finishedCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                                className="w-12 bg-white border border-gray-200 rounded px-1 py-0.5 text-center font-bold text-slate-900"
                              />
                              <span className="text-slate-400 font-bold">/</span>
                              <span className="font-bold text-slate-700">{alloc.targetCount}</span>
                              <span className="text-[10px] font-bold text-slate-500 ml-1">({pct}%)</span>
                            </div>

                            <select
                              disabled={!canEdit}
                              value={alloc.status}
                              onChange={e =>
                                handleInlineProgressChange(round.id, alloc.id, {
                                  status: e.target.value as ProjectTrackerStageStatus,
                                })
                              }
                              className={`text-[11px] font-bold px-2 py-1 rounded-md border cursor-pointer ${st.cls}`}
                            >
                              {(Object.keys(STAGE_META) as ProjectTrackerStageStatus[]).map(k => (
                                <option key={k} value={k}>
                                  {STAGE_META[k].label}
                                </option>
                              ))}
                            </select>

                            {alloc.deliverDate && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Del: {alloc.deliverDate}
                              </span>
                            )}
                            {alloc.checkDate && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                QC: {alloc.checkDate}
                              </span>
                            )}
                            {alloc.notes && (
                              <span className="text-[10px] text-slate-600 max-w-[200px] truncate" title={alloc.notes}>
                                · {alloc.notes}
                              </span>
                            )}

                            {canEdit && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAllocModal({
                                      roundId: round.id,
                                      existing: alloc,
                                      memberName: alloc.memberName,
                                      targetCount: String(alloc.targetCount),
                                      finishedCount: String(alloc.finishedCount),
                                      status: alloc.status,
                                      deliverDate: alloc.deliverDate || '',
                                      checkDate: alloc.checkDate || '',
                                      notes: alloc.notes || '',
                                    })
                                  }
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                  title="Edit allocation"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAllocation(round.id, alloc.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                  title="Remove member"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
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

      {/* Modal: Add / Edit Round */}
      {roundModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <h3 className="font-extrabold text-sm">
                {roundModal.existing ? 'Edit Work Plan Round' : 'Add Work Plan Round'}
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
                <label className="font-bold text-gray-700 block mb-1">Round / Work Package Name *</label>
                <input
                  value={roundModal.label}
                  onChange={e => setRoundModal(prev => ({ ...prev, label: e.target.value }))}
                  required
                  placeholder="e.g. Round 1 · Basin Delineation"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Scope / Region / Deliverables</label>
                <input
                  value={roundModal.scope}
                  onChange={e => setRoundModal(prev => ({ ...prev, scope: e.target.value }))}
                  placeholder="e.g. Lower Mississippi HUC-4 / SWOT Passes"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Target Due Date</label>
                <input
                  type="date"
                  value={roundModal.dueDate}
                  onChange={e => setRoundModal(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Notes (Optional)</label>
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
                  Save Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Member Allocation */}
      {allocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: primaryColor }}>
              <h3 className="font-extrabold text-sm">
                {allocModal.existing ? 'Update Member Progress' : 'Assign Member to Round'}
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
                <label className="font-bold text-gray-700 block mb-1">Member Name *</label>
                <input
                  list="ersl-tracker-member-list"
                  value={allocModal.memberName}
                  onChange={e => setAllocModal(prev => (prev ? { ...prev, memberName: e.target.value } : null))}
                  required
                  placeholder="Select or type researcher name"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
                <datalist id="ersl-tracker-member-list">
                  {activeRosterSuggestions.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Done Count</label>
                  <input
                    type="number"
                    min={0}
                    value={allocModal.finishedCount}
                    onChange={e => setAllocModal(prev => (prev ? { ...prev, finishedCount: e.target.value } : null))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Target Count</label>
                  <input
                    type="number"
                    min={0}
                    value={allocModal.targetCount}
                    onChange={e => setAllocModal(prev => (prev ? { ...prev, targetCount: e.target.value } : null))}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Verification / Progress Status</label>
                <select
                  value={allocModal.status}
                  onChange={e =>
                    setAllocModal(prev =>
                      prev ? { ...prev, status: e.target.value as ProjectTrackerStageStatus } : null
                    )
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white font-semibold"
                >
                  {(Object.keys(STAGE_META) as ProjectTrackerStageStatus[]).map(k => (
                    <option key={k} value={k}>
                      {STAGE_META[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Deliver Date (Optional)</label>
                  <input
                    value={allocModal.deliverDate}
                    onChange={e => setAllocModal(prev => (prev ? { ...prev, deliverDate: e.target.value } : null))}
                    placeholder="e.g. 11/19"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">QC Check Date (Optional)</label>
                  <input
                    value={allocModal.checkDate}
                    onChange={e => setAllocModal(prev => (prev ? { ...prev, checkDate: e.target.value } : null))}
                    placeholder="e.g. 11/24"
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">Notes (Optional)</label>
                <input
                  value={allocModal.notes}
                  onChange={e => setAllocModal(prev => (prev ? { ...prev, notes: e.target.value } : null))}
                  placeholder="Optional QA notes or basin IDs..."
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
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
