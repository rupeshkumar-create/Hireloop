import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function AdminDashboard() {
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPlan, setNewPlan] = useState<'free' | 'pro'>('free');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('super_admin_unlocked') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === import.meta.env.VITE_SUPER_ADMIN_PASSWORD) {
      sessionStorage.setItem('super_admin_unlocked', 'true');
      setIsAuthenticated(true);
      toast.success('Admin access granted');
    } else {
      toast.error('Invalid password');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    // Real-time listener for users collection
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users. Check permissions.');
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
        adminUid: user?.uid,
        adminEmail: user?.email,
        targetUserId: selectedUser.id,
        targetUserEmail: selectedUser.email,
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

  if (!isAuthenticated) {
    // Discreet login screen
    return (
      <div className="flex h-full items-center justify-center">
        <form onSubmit={handleLogin} className="bg-surface p-8 rounded-xl border border-border shadow-sm w-96 text-center">
          <h2 className="text-xl font-bold text-foreground mb-6">Restricted Area</h2>
          <input 
            type="password" 
            placeholder="Enter Passcode"
            className="w-full border border-border-strong rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-foreground focus:outline-none"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
          />
          <Button type="submit" className="w-full">Unlock</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-12 pr-4 relative">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Super Admin</h1>
            <p className="text-foreground-muted mt-1">Manage {users.length} users and platform billing.</p>
          </div>
          <Button variant="outline" onClick={() => {
            sessionStorage.removeItem('super_admin_unlocked');
            setIsAuthenticated(false);
          }}>Lock Panel</Button>
        </div>

        {loading ? (
          <div className="text-foreground-muted">Loading users...</div>
        ) : (
          <div className="bg-surface border border-border shadow-sm overflow-hidden rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-background border-b border-border text-foreground-muted font-medium">
                <tr>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-background">
                    <td className="px-6 py-4 font-medium text-foreground">{u.email}</td>
                    <td className="px-6 py-4 text-foreground-muted">{u.displayName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${u.plan === 'pro' ? 'bg-orange-100 text-orange-700' : 'bg-surface-hover text-foreground-muted'}`}>
                        {u.plan || 'free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedUser(u);
                        setNewPlan(u.plan === 'pro' ? 'free' : 'pro');
                      }}>Change Plan</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Plan Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface/80 backdrop-blur-2xl w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border"
            >
              <h3 className="text-lg font-bold mb-4 text-foreground">Change Plan: {selectedUser.email}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1">New Plan</label>
                  <select 
                    className="w-full border border-border bg-surface/50 backdrop-blur-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-foreground focus:outline-none"
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
                    className="w-full border border-border bg-surface/50 backdrop-blur-sm rounded-md px-3 py-2 focus:ring-2 focus:ring-foreground focus:outline-none text-sm"
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
    </div>
  );
}
