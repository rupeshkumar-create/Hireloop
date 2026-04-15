import React, { useEffect, useState } from 'react';
import { collection, doc, updateDoc, addDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { PageShell } from '../components/ui/page-shell';
import { motion, AnimatePresence } from 'framer-motion';
import { generateDailyJobsDebug } from '../services/aiService';
import { runAdminGhostMode } from '../services/adminGhostMode';
import { GhostModeModal } from '../components/admin/GhostModeModal';
import type { GhostModeOverrides, GhostModeRunResult, GhostModeTargetUser } from '../types/adminGhostMode';



export function AdminDashboard() {
  const { user, realUser, impersonateUser } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const [passwordInput, setPasswordInput] = useState('');
  
  const adminEmails = ['rupesh7126@gmail.com', 'kv3244@gmail.com', 'rupesh7128@gmail.com'];
  const currentUser = realUser || user;

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailUser, setDetailUser] = useState<any>(null);
  const [newPlan, setNewPlan] = useState<'free' | 'pro'>('free');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [ghostModeUser, setGhostModeUser] = useState<GhostModeTargetUser | null>(null);
  const [ghostModeRunning, setGhostModeRunning] = useState(false);
  const [ghostModeResult, setGhostModeResult] = useState<GhostModeRunResult | null>(null);
  const [editFormData, setEditFormData] = useState({
    jobType: '',
    location: '',
    minSalary: '',
    careerPaths: ''
  });

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    setEditFormData({
      jobType: u.jobType || 'both',
      location: u.location || '',
      minSalary: u.minSalary?.toString() || '',
      careerPaths: (u.careerPaths || []).join(', ')
    });
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const paths = editFormData.careerPaths.split(',').map(s => s.trim()).filter(Boolean);
      await updateDoc(doc(db, 'users', editingUser.id), {
        jobType: editFormData.jobType,
        location: editFormData.location,
        minSalary: editFormData.minSalary ? parseInt(editFormData.minSalary, 10) : null,
        careerPaths: paths,
        updatedAt: new Date().toISOString()
      });
      
      toast.success(`Updated details for ${editingUser.email}`);
      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        jobType: editFormData.jobType,
        location: editFormData.location,
        minSalary: editFormData.minSalary ? parseInt(editFormData.minSalary, 10) : null,
        careerPaths: paths
      } : u));
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user details');
    } finally {
      setSaving(false);
    }
  };

  const getSortableTime = (value: any) => {
    if (!value) return 0;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === 'object' && 'seconds' in value) {
      return value.seconds * 1000;
    }
    return 0;
  };

  const formatDate = (value: any) => {
    if (!value) return '-';
    const rawValue = getSortableTime(value);
    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
  };

  useEffect(() => {
    if (sessionStorage.getItem('super_admin_unlocked') === 'true' && currentUser?.email && adminEmails.includes(currentUser.email.toLowerCase())) {
      setIsAuthenticated(true);
    }
  }, [currentUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === import.meta.env.VITE_SUPER_ADMIN_PASSWORD) {
      if (currentUser?.email && adminEmails.includes(currentUser.email.toLowerCase())) {
        sessionStorage.setItem('super_admin_unlocked', 'true');
        setIsAuthenticated(true);
        toast.success('Admin access granted');
      } else {
        toast.error('Your account is not authorized as a super admin.');
      }
    } else {
      toast.error('Invalid password');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
      // Read the full collection
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        usersData.sort((a, b) => {
          const dateA = getSortableTime(a.createdAt);
          const dateB = getSortableTime(b.createdAt);
          return dateB - dateA;
        });

        setUsers(usersData);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users. ' + error.message);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleChangePlan = async () => {
    if (!selectedUser || !reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setSaving(true);
    try {
      // 1. Update user document
      await updateDoc(doc(db, 'users', selectedUser.id), {
        plan: newPlan,
        updatedAt: new Date().toISOString()
      });

      // 2. Log the action
      await addDoc(collection(db, 'admin_logs'), {
        adminUid: currentUser?.uid || 'unknown_uid',
        adminEmail: currentUser?.email || 'unknown_email',
        targetUserId: selectedUser.id || 'unknown_target_id',
        targetUserEmail: selectedUser.email || 'unknown_target_email',
        oldPlan: selectedUser.plan || 'free',
        newPlan: newPlan,
        reason: reason,
        timestamp: new Date().toISOString()
      });

      toast.success(`User plan updated to ${newPlan}`);
      
      // Update local state
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, plan: newPlan } : u));
      setSelectedUser(null);
      setReason('');
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleRunGhostMode = async (payload: {
    runMode: 'preview' | 'persist';
    inputMode: 'saved' | 'override';
    overrides?: GhostModeOverrides;
  }) => {
    if (!ghostModeUser || !currentUser?.uid || !currentUser?.email) {
      toast.error('Admin identity is required to run Ghost Mode.');
      return;
    }

    setGhostModeRunning(true);
    try {
      const result = await runAdminGhostMode(
        {
          targetUser: ghostModeUser,
          admin: {
            uid: currentUser.uid,
            email: currentUser.email,
          },
          runMode: payload.runMode,
          inputMode: payload.inputMode,
          overrides: payload.overrides,
        },
        {
          generateDebugResult: (input) =>
            generateDailyJobsDebug(
              input.careerPaths,
              input.jobType,
              input.minSalary,
              input.resumeText,
              input.limit,
              input.seenFingerprints,
              input.learningContext,
              input.location,
              input.learningSignals
            ),
          persistDailyJobs: async ({
            userId,
            jobs,
            lastJobFetchTime,
            seenJobFingerprints,
            runDate,
          }) => {
            await setDoc(
              doc(db, 'users', userId),
              {
                dailyJobs: jobs,
                lastJobFetchTime,
                seenJobFingerprints,
              },
              { merge: true }
            );

            await setDoc(
              doc(db, 'users', userId, 'daily_matches', runDate),
              {
                jobs,
                fetchedAt: lastJobFetchTime,
              },
              { merge: true }
            );
          },
          logRun: async (entry) => {
            await addDoc(collection(db, 'admin_logs'), entry);
          },
        }
      );

      setGhostModeResult(result);
      toast.success(
        result.persisted
          ? `Persisted ${result.debug.finalJobs.length} jobs for ${ghostModeUser.email || 'user'}`
          : `Preview ready for ${ghostModeUser.email || 'user'}`
      );
    } catch (error: any) {
      toast.error(error.message || 'Ghost Mode run failed');
    } finally {
      setGhostModeRunning(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center">
        <form onSubmit={handleLogin} className="w-96 rounded-[28px] border border-border bg-surface p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
          <h2 className="mb-2 text-2xl text-foreground">Restricted Area</h2>
          <p className="mb-6 text-sm text-foreground-muted">Enter the admin passcode to unlock billing controls and user access tools.</p>
          <input 
            type="password" 
            placeholder="Enter Passcode"
            className="mb-4 w-full rounded-xl border border-border-strong px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
          />
          <Button type="submit" variant="action" className="w-full">Unlock</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto pb-12">
      <PageShell
        title="Super Admin"
        description={`Manage ${users.length} users and platform billing.`}
        actions={
          <Button variant="outline" onClick={() => {
            sessionStorage.removeItem('super_admin_unlocked');
            setIsAuthenticated(false);
          }}>Lock Panel</Button>
        }
      >

        {loading ? (
          <div className="text-foreground-muted">Loading users...</div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
            <table className="w-full text-sm text-left">
              <thead className="bg-background border-b border-border text-foreground-muted font-medium">
                <tr>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Last Active</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-background">
                    <td className="px-6 py-4 font-medium text-foreground">{u.email}</td>
                    <td className="px-6 py-4 text-foreground-muted">{u.displayName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${u.plan?.toLowerCase() === 'pro' ? 'bg-[rgba(201,100,66,0.14)] text-primary' : 'bg-surface-hover text-foreground-muted'}`}>
                        {u.plan || 'free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {formatDate(u.lastActiveAt)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditUser(u)}>Edit Data</Button>
                      <Button size="sm" variant="outline" onClick={() => setDetailUser(u)}>View Details</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setGhostModeUser(u as GhostModeTargetUser);
                          setGhostModeResult(null);
                        }}
                      >
                        Simulate for User
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        impersonateUser(u.id, u.email);
                        toast.success(`Impersonating ${u.email}`);
                        navigate('/dashboard');
                      }}>Enter Dashboard</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedUser(u);
                        setNewPlan(u.plan?.toLowerCase() === 'pro' ? 'free' : 'pro');
                      }}>Change Plan</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)] max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-lg font-bold mb-4 text-foreground">Edit User: {editingUser.email}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">Job Type</label>
                  <select 
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
                    value={editFormData.jobType}
                    onChange={(e) => setEditFormData({ ...editFormData, jobType: e.target.value })}
                  >
                    <option value="both">Both (Remote & On-site)</option>
                    <option value="remote">Remote Only</option>
                    <option value="onsite">On-site Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">Location</label>
                  <input 
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
                    placeholder="e.g. San Francisco, CA"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">Min Salary (USD)</label>
                  <input 
                    type="number"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
                    placeholder="e.g. 120000"
                    value={editFormData.minSalary}
                    onChange={(e) => setEditFormData({ ...editFormData, minSalary: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">Career Paths (comma separated)</label>
                  <textarea 
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
                    rows={3}
                    placeholder="e.g. Software Engineer, Frontend Developer"
                    value={editFormData.careerPaths}
                    onChange={(e) => setEditFormData({ ...editFormData, careerPaths: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setEditingUser(null)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSaveUserEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Plan Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            >
              <h3 className="text-lg font-bold mb-4 text-foreground">Change Plan: {selectedUser.email}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">New Plan</label>
                  <select 
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value as 'free' | 'pro')}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">Reason for Change (Required)</label>
                  <textarea 
                    required
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3898ec]"
                    rows={3}
                    placeholder="e.g. Paid via manual wire transfer, Refunded, VIP user"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={() => setSelectedUser(null)}>Cancel</Button>
                <Button variant="action" onClick={handleChangePlan} disabled={saving || !reason.trim()}>
                  {saving ? 'Saving...' : 'Confirm Change'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">User Details</h3>
                  <p className="text-sm text-foreground-muted mt-1">{detailUser.email || 'No email found'}</p>
                </div>
                <Button variant="ghost" onClick={() => setDetailUser(null)}>Close</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted mb-1">Name</p>
                  <p className="text-foreground">{detailUser.displayName || '-'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted mb-1">Plan</p>
                  <p className="text-foreground">{detailUser.plan || 'free'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted mb-1">Joined</p>
                  <p className="text-foreground">{formatDate(detailUser.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted mb-1">Last Active</p>
                  <p className="text-foreground">{formatDate(detailUser.lastActiveAt)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted mb-1">Job Type</p>
                  <p className="text-foreground">{detailUser.jobType || '-'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted mb-1">Minimum Salary</p>
                  <p className="text-foreground">{detailUser.minSalary ? `$${detailUser.minSalary}` : '-'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4 mb-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted mb-2">Career Paths</p>
                <p className="text-foreground">
                  {Array.isArray(detailUser.careerPaths) && detailUser.careerPaths.length > 0
                    ? detailUser.careerPaths.join(', ')
                    : '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4 mb-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted mb-2">Learning Profile</p>
                <div className="space-y-2 text-sm text-foreground">
                  <p><span className="text-foreground-muted">Job preferences:</span> {detailUser.learningProfile?.jobPreferences || '-'}</p>
                  <p><span className="text-foreground-muted">Writing style:</span> {detailUser.learningProfile?.writingStyle || '-'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-xs uppercase tracking-wider text-foreground-muted mb-2">Resume Text</p>
                <pre className="whitespace-pre-wrap break-words text-sm text-foreground-muted max-h-80 overflow-y-auto">
                  {detailUser.resumeText || 'No resume uploaded.'}
                </pre>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GhostModeModal
        open={!!ghostModeUser}
        user={ghostModeUser}
        running={ghostModeRunning}
        result={ghostModeResult}
        onClose={() => {
          setGhostModeUser(null);
          setGhostModeResult(null);
        }}
        onRun={handleRunGhostMode}
      />
    </div>
  );
}
