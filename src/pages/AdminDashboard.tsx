import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { runAdminGhostMode } from '../services/adminGhostMode';
import { researchJobs } from '../services/jobResearcher';
import type { CallAIFn } from '../services/jobResearcher';
import { matchAndRankJobs } from '../services/jobMatchingEngine';
import { GhostModeModal } from '../components/admin/GhostModeModal';
import type {
  GhostModeInputMode,
  GhostModeOverrides,
  GhostModeRunMode,
  GhostModeRunResult,
  GhostModeTargetUser,
} from '../types/adminGhostMode';
import type { AdminUserListItem, AdminUserDetail } from '../lib/adminUsers';

// ── Types ────────────────────────────────────────────────────────────────────

type Plan = 'free' | 'pro';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const ts =
    typeof v === 'string' || typeof v === 'number'
      ? new Date(v).getTime()
      : typeof v === 'object' && v !== null && 'seconds' in v
      ? ((v as any).seconds as number) * 1000
      : NaN;
  if (Number.isNaN(ts)) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sortableTime(v: unknown): number {
  if (!v) return 0;
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return ((v as any).seconds as number) * 1000;
  }
  return 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
      plan === 'pro'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    }`}>
      {plan === 'pro' ? 'Pro' : 'Free'}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-5 py-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function AdminModalFrame({
  children,
  onClose,
  maxWidth = 'max-w-2xl',
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[28px] border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.12)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function AdminModalHeader({
  title,
  subtitle,
  aside,
  onClose,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 break-all text-sm text-foreground-muted">{subtitle}</p> : null}
        {aside ? <div className="mt-3">{aside}</div> : null}
      </div>
      <Button variant="ghost" size="sm" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

// ── User Detail Modal ────────────────────────────────────────────────────────

function UserDetailModal({
  user,
  onClose,
}: {
  user: AdminUserDetail;
  onClose: () => void;
}) {
  const fields: [string, unknown][] = [
    ['Email', user.email],
    ['Display Name', user.displayName],
    ['Plan', user.plan],
    ['Job Type', user.jobType],
    ['Location', user.location],
    ['Min Salary', user.minSalary != null ? `$${user.minSalary.toLocaleString()}` : undefined],
    ['Career Paths', user.careerPaths?.join(', ')],
    ['Joined', fmtDate(user.createdAt)],
    ['Last Active', fmtDate(user.lastActiveAt)],
    ['Resume', user.resumeText ? `${user.resumeText.length} chars` : undefined],
    ['Seen Fingerprints', user.seenJobFingerprints?.length],
    ['Job Preferences', user.learningProfile?.jobPreferences],
    ['Writing Style', user.learningProfile?.writingStyle],
  ];

  return (
    <AdminModalFrame onClose={onClose} maxWidth="max-w-4xl">
      <AdminModalHeader
        title="User Details"
        subtitle={user.email || 'Unknown user'}
        aside={<PlanBadge plan={user.plan ?? 'free'} />}
        onClose={onClose}
      />

      <div className="space-y-4 px-6 py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {fields.map(([label, val]) =>
            val != null && val !== '' ? (
              <div key={label} className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted">{label}</p>
                <p className="mt-2 break-words text-sm text-foreground">{String(val)}</p>
              </div>
            ) : null
          )}
        </div>

        {user.resumeText ? (
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <p className="text-xs uppercase tracking-wider text-foreground-muted">Resume Text</p>
            <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-sm text-foreground">
              {user.resumeText}
            </pre>
          </div>
        ) : null}
      </div>
    </AdminModalFrame>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({
  user,
  saving,
  onSave,
  onClose,
}: {
  user: AdminUserListItem;
  saving: boolean;
  onSave: (patch: Partial<AdminUserListItem>) => void;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(user.plan ?? 'free');
  const [jobType, setJobType] = useState(user.jobType ?? 'both');
  const [location, setLocation] = useState(user.location ?? '');
  const [minSalary, setMinSalary] = useState(user.minSalary != null ? String(user.minSalary) : '');
  const [careerPaths, setCareerPaths] = useState((user.careerPaths ?? []).join(', '));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const paths = careerPaths.split(',').map(s => s.trim()).filter(Boolean);
    const salary = minSalary.trim() ? parseInt(minSalary, 10) : null;
    onSave({ plan, jobType, location, minSalary: salary, careerPaths: paths });
  }

  return (
    <AdminModalFrame onClose={onClose} maxWidth="max-w-xl">
      <AdminModalHeader
        title="Edit User"
        subtitle={user.email || 'Unknown user'}
        aside={<PlanBadge plan={plan} />}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="px-6 py-5">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground-muted">Plan</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value as Plan)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground-muted">Job Type</label>
            <select
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            >
              <option value="both">Both</option>
              <option value="remote">Remote</option>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground-muted">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
              placeholder="e.g. New York, NY"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground-muted">Min Salary (USD)</label>
            <input
              type="number"
              value={minSalary}
              onChange={e => setMinSalary(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
              placeholder="e.g. 45000"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground-muted">Career Paths</label>
            <textarea
              value={careerPaths}
              onChange={e => setCareerPaths(e.target.value)}
              className="min-h-[110px] w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
              placeholder="Remote Customer Success Manager, Product Operations"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="action" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </AdminModalFrame>
  );
}

// ── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({
  user,
  deleting,
  onConfirm,
  onClose,
}: {
  user: AdminUserListItem;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AdminModalFrame onClose={onClose} maxWidth="max-w-md">
      <AdminModalHeader
        title="Delete User"
        subtitle={user.email || 'Unknown user'}
        onClose={onClose}
      />

      <div className="px-6 py-5">
        <p className="text-sm leading-6 text-foreground-muted">
          This will permanently delete{' '}
          <span className="font-medium text-foreground">{user.email || 'this user'}</span> from Firebase
          Auth, Firestore, and all tracked jobs. This action cannot be undone.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete User'}
          </Button>
        </div>
      </div>
    </AdminModalFrame>
  );
}

function ActionButton({
  label,
  variant,
  onClick,
}: {
  label: string;
  variant: 'outline' | 'ghost' | 'destructive';
  onClick: () => void;
}) {
  const variantClasses = {
    outline: 'border-border bg-surface text-foreground hover:bg-surface-hover',
    ghost: 'bg-[rgba(128,90,213,0.08)] text-[rgb(109,40,217)] shadow-[0_0_0_1px_rgba(109,40,217,0.16)] hover:bg-[rgba(128,90,213,0.14)]',
    destructive: 'bg-[rgba(220,38,38,0.08)] text-[rgb(185,28,28)] shadow-[0_0_0_1px_rgba(220,38,38,0.14)] hover:bg-[rgba(220,38,38,0.14)]',
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors ${variantClasses[variant]}`}
    >
      {label}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { realUser } = useAuth();

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [detailUser, setDetailUser] = useState<AdminUserDetail | null>(null);
  const [editUser, setEditUser] = useState<AdminUserListItem | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserListItem | null>(null);
  const [ghostUser, setGhostUser] = useState<GhostModeTargetUser | null>(null);
  const [ghostResult, setGhostResult] = useState<GhostModeRunResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ghostRunning, setGhostRunning] = useState(false);

  // ── API helpers ────────────────────────────────────────────────────────────

  const getHeaders = async (): Promise<Record<string, string>> => {
    const token = await realUser?.getIdToken(false);
    if (!token) throw new Error('Not authenticated.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const headers = await getHeaders();
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as any) } });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (!res.ok) throw new Error(data?.error || text || `HTTP ${res.status}`);
    return data;
  };

  // ── Load users ─────────────────────────────────────────────────────────────

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/admin/users');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err: any) {
      toast.error('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const pro = users.filter(u => u.plan === 'pro').length;
    return { total: users.length, pro, free: users.length - pro };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(u =>
      !q ||
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q) ||
      u.careerPaths?.some(p => p.toLowerCase().includes(q))
    );
  }, [users, search]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleViewDetail = async (u: AdminUserListItem) => {
    try {
      const data = await apiCall(`/api/admin/users?userId=${encodeURIComponent(u.id)}`);
      setDetailUser(data.user);
    } catch (err: any) {
      toast.error('Failed to load user details: ' + err.message);
    }
  };

  const handleOpenGhost = async (u: AdminUserListItem) => {
    try {
      const data = await apiCall(`/api/admin/users?userId=${encodeURIComponent(u.id)}`);
      setGhostUser(data.user as GhostModeTargetUser);
      setGhostResult(null);
    } catch (err: any) {
      toast.error('Failed to load user for Ghost Mode: ' + err.message);
    }
  };

  const handleSaveEdit = async (patch: Partial<AdminUserListItem>) => {
    if (!editUser) return;
    setSaving(true);
    try {
      await apiCall(`/api/admin/users?userId=${encodeURIComponent(editUser.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...patch } : u));
      toast.success(`Updated ${editUser.email}`);
      setEditUser(null);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePlan = async (u: AdminUserListItem) => {
    const newPlan: Plan = u.plan === 'pro' ? 'free' : 'pro';
    try {
      await apiCall(`/api/admin/users?userId=${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ plan: newPlan }),
      });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, plan: newPlan } : x));
      toast.success(`${u.email} → ${newPlan}`);
    } catch (err: any) {
      toast.error('Failed to change plan: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await apiCall(`/api/admin/users?userId=${encodeURIComponent(deleteUser.id)}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
      toast.success(`Deleted ${deleteUser.email}`);
      setDeleteUser(null);
    } catch (err: any) {
      toast.error('Failed to delete user: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleRunGhost = async (payload: {
    runMode: GhostModeRunMode;
    inputMode: GhostModeInputMode;
    overrides?: GhostModeOverrides;
  }) => {
    if (!ghostUser || !realUser) return;
    setGhostRunning(true);
    try {
      const result = await runAdminGhostMode(
        {
          targetUser: ghostUser,
          admin: { uid: realUser.uid, email: realUser.email ?? '' },
          runMode: payload.runMode,
          inputMode: payload.inputMode,
          overrides: payload.overrides,
        },
        {
          generateDebugResult: async (input) => {
            // Client-side proxy — routes through /api/openai → OpenRouter
            const clientCallAI: CallAIFn = async (messages, model) => {
              const resp = await fetch('/api/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages, model }),
              });
              if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error((err as any).error || `AI call failed: ${resp.status}`);
              }
              const data = await resp.json();
              return (data as any).choices?.[0]?.message?.content?.trim() || '';
            };

            const { jobs: discovered, sources: sourceBreakdown, totalFound } = await researchJobs(
              {
                careerPaths: input.careerPaths,
                resumeText: input.resumeText,
                jobType: input.jobType,
                location: input.location,
                targetCount: 30,
              },
              clientCallAI
            );

            const matchResult = await matchAndRankJobs(
              discovered,
              {
                careerPaths: input.careerPaths,
                resumeText: input.resumeText,
                jobType: input.jobType,
                seenFingerprints: input.seenFingerprints,
                limit: input.limit,
              },
              clientCallAI
            );

            return {
              harvestedCount: totalFound,
              dedupedCount: totalFound - discovered.length,
              unseenCount: matchResult.scoredCount,
              seenCount: 0,
              usedBackfill: matchResult.usedFallback,
              sourceBreakdown: sourceBreakdown as Record<string, number>,
              scoredCount: matchResult.scoredCount,
              enrichedCount: matchResult.enrichedCount,
              finalJobs: matchResult.jobs,
            };
          },
          persistDailyJobs: async ({ userId, jobs, lastJobFetchTime, seenJobFingerprints, runDate }) => {
            await setDoc(doc(db, 'users', userId), { dailyJobs: jobs, lastJobFetchTime, seenJobFingerprints }, { merge: true });
            await setDoc(doc(db, 'users', userId, 'daily_matches', runDate), { jobs, fetchedAt: lastJobFetchTime }, { merge: true });
          },
          logRun: async (payload) => {
            await addDoc(collection(db, 'admin_logs'), payload);
          },
        }
      );
      setGhostResult(result);
    } catch (err: any) {
      toast.error('Ghost Mode failed: ' + err.message);
    } finally {
      setGhostRunning(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total Users" value={stats.total} />
        <Stat label="Pro" value={stats.pro} />
        <Stat label="Free" value={stats.free} />
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email, name, or career path…"
        className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading users…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Email', 'Plan', 'Joined', 'Last Active', 'Career Paths', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    {search ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.email || '—'}</div>
                      {u.displayName && <div className="text-xs text-muted-foreground">{u.displayName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleTogglePlan(u)} title="Click to toggle plan">
                        <PlanBadge plan={u.plan ?? 'free'} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.lastActiveAt)}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="line-clamp-1 text-muted-foreground">
                        {u.careerPaths?.join(', ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionButton label="View" variant="outline" onClick={() => handleViewDetail(u)} />
                        <ActionButton label="Edit" variant="outline" onClick={() => setEditUser(u)} />
                        <ActionButton label="Ghost" variant="ghost" onClick={() => handleOpenGhost(u)} />
                        <ActionButton label="Delete" variant="destructive" onClick={() => setDeleteUser(u)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Showing {filtered.length} of {users.length} users
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {detailUser && (
        <UserDetailModal user={detailUser} onClose={() => setDetailUser(null)} />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          saving={saving}
          onSave={handleSaveEdit}
          onClose={() => setEditUser(null)}
        />
      )}

      {deleteUser && (
        <DeleteConfirm
          user={deleteUser}
          deleting={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteUser(null)}
        />
      )}

      <GhostModeModal
        open={ghostUser !== null}
        user={ghostUser}
        running={ghostRunning}
        result={ghostResult}
        onRun={handleRunGhost}
        onClose={() => { setGhostUser(null); setGhostResult(null); }}
      />
    </div>
  );
}
