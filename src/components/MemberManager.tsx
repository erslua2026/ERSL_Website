import React, { useEffect, useState } from 'react';
import { Check, Users, X, Trash2 } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';

export const MemberManager: React.FC = () => {
  const [rows, setRows] = useState<Profile[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setRows((data || []) as Profile[]);
  };
  useEffect(() => { load(); }, []);

  const setRole = async (id: string, role: Profile['role']) => {
    setError('');
    const { error: err } = await supabase!.from('profiles').update({ role }).eq('id', id);
    if (err) {
      setError(
        role === 'collaborator' && err.message.toLowerCase().includes('check')
          ? `Could not assign Collaborator role yet (${err.message}). Run supabase/security_rls_policies.sql in Supabase SQL Editor once to enable 'collaborator' in profiles.`
          : err.message
      );
      return;
    }
    load();
  };

  const remove = async (p: Profile) => {
    if (!confirm(`Remove ${p.email}? (Their auth account stays; delete it in the Supabase dashboard to fully remove.)`)) return;
    const { error: err } = await supabase!.from('profiles').delete().eq('id', p.id);
    if (err) setError(err.message);
    else load();
  };

  const pending = rows.filter(r => r.role === 'pending');

  const roleBadge = (role: Profile['role']) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', cls: 'bg-red-100 text-red-700' };
      case 'member':
        return { label: 'Lab Member', cls: 'bg-emerald-100 text-emerald-700' };
      case 'collaborator':
        return { label: 'Collaborator / External PI', cls: 'bg-blue-100 text-blue-700' };
      default:
        return { label: 'Pending', cls: 'bg-amber-100 text-amber-700' };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold text-slate-800 text-sm">
          Members, External Collaborators &amp; Access Requests{' '}
          {pending.length > 0 && (
            <span className="ml-2 bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </h3>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed">
        <strong>Lab Member</strong> unlocks internal ERSL workspaces (Work Plan, Box Workspace, Teaching, Bulletins, all projects).{' '}
        <strong>Collaborator / External PI</strong> only unlocks <em>Collaborators-only</em> sub-pages on projects where their email is linked (via{' '}
        <em>People → Collaborators</em> or a Project&apos;s <em>Collaborators</em> modal) — internal ERSL lab sections remain hidden.
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>}

      <div className="divide-y divide-gray-100">
        {rows.map(r => {
          const badge = roleBadge(r.role);
          return (
            <div key={r.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-bold text-gray-800">{r.name || '(no name)'}</p>
                <p className="text-gray-500">{r.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${badge.cls}`}>
                  {badge.label}
                </span>

                {r.role === 'pending' && (
                  <>
                    <button
                      onClick={() => setRole(r.id, 'member')}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                      title="Approve as internal ERSL Lab Member"
                    >
                      <Check className="w-3 h-3" /> Lab Member
                    </button>
                    <button
                      onClick={() => setRole(r.id, 'collaborator')}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                      title="Approve as External Project Collaborator / PI (project-scoped access only)"
                    >
                      <Users className="w-3 h-3" /> Collaborator / PI
                    </button>
                  </>
                )}

                {r.role === 'collaborator' && (
                  <>
                    <button
                      onClick={() => setRole(r.id, 'member')}
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      Upgrade to Lab Member
                    </button>
                    <button
                      onClick={() => setRole(r.id, 'pending')}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      title="Revoke access"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {r.role === 'member' && (
                  <>
                    <button
                      onClick={() => setRole(r.id, 'collaborator')}
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-blue-50 text-blue-700 cursor-pointer"
                      title="Restrict to External Collaborator (project-scoped only)"
                    >
                      Set Collaborator
                    </button>
                    <button
                      onClick={() => setRole(r.id, 'admin')}
                      className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      Make admin
                    </button>
                    <button
                      onClick={() => setRole(r.id, 'pending')}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      title="Revoke"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {r.role === 'admin' && (
                  <button
                    onClick={() => setRole(r.id, 'member')}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    Demote to Member
                  </button>
                )}

                <button
                  onClick={() => remove(r)}
                  className="p-1.5 rounded text-red-500 hover:bg-red-50 cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-gray-400 py-3">No accounts yet.</p>}
      </div>
    </div>
  );
};
