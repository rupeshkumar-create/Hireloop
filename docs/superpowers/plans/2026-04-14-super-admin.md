# Super Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a highly secure, hidden Super Admin panel to manage users, view stats, and manually change user plans (with a required reason).

**Architecture:** 
1. The route `/admin` already exists but uses an insecure email array check.
2. We will implement a strict password gate. The user must enter a password that matches `VITE_SUPER_ADMIN_PASSWORD` from `.env`.
3. Upon entering the correct password, it sets a session flag `super_admin_unlocked` so they don't have to enter it on every refresh.
4. The panel will list all users. Each user row will have a "Change Plan" button.
5. Clicking "Change Plan" opens a modal to select "free" or "pro", enter a mandatory reason, and submit. This updates the user's `plan` in Firestore and logs the action in a new `admin_logs` collection.

**Tech Stack:** React, Firestore, Tailwind.

---

### Task 1: Add Environment Variable

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Admin Password variable**
```env
VITE_SUPER_ADMIN_PASSWORD=your_secure_admin_password_here
```

### Task 2: Implement Secure Admin Gateway & User List

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Rewrite AdminDashboard to use password gate and fetch users**
```tsx
import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';

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
    
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by newest first
        usersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
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
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl border border-zinc-200 shadow-sm w-96 text-center">
          <h2 className="text-xl font-bold text-zinc-900 mb-6">Restricted Area</h2>
          <input 
            type="password" 
            placeholder="Enter Passcode"
            className="w-full border border-zinc-300 rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
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
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Super Admin</h1>
            <p className="text-zinc-500 mt-1">Manage {users.length} users and platform billing.</p>
          </div>
          <Button variant="outline" onClick={() => {
            sessionStorage.removeItem('super_admin_unlocked');
            setIsAuthenticated(false);
          }}>Lock Panel</Button>
        </div>

        {loading ? (
          <div>Loading users...</div>
        ) : (
          <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
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
                  <tr key={u.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{u.email}</td>
                    <td className="px-6 py-4">{u.displayName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${u.plan === 'pro' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600'}`}>
                        {u.plan || 'free'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{new Date(u.createdAt).toLocaleDateString()}</td>
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
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Change Plan: {selectedUser.email}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">New Plan</label>
                <select 
                  className="w-full border border-zinc-300 rounded-md px-3 py-2"
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as 'free' | 'pro')}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Reason for Change (Required)</label>
                <textarea 
                  required
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
                  rows={3}
                  placeholder="e.g. Paid via manual wire transfer, Refunded, VIP user"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setSelectedUser(null)}>Cancel</Button>
              <Button onClick={handleChangePlan} disabled={saving || !reason.trim()}>
                {saving ? 'Saving...' : 'Confirm Change'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```