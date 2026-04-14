import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

// You can add your actual admin emails here
const ADMIN_EMAILS = ['rupesh@example.com', 'admin@hireschema.com'];

export function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email || '')) return;
    
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [user]);

  if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="h-full overflow-y-auto pb-12 pr-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Admin Dashboard</h1>
          <p className="text-zinc-500 mt-1">Manage users, billing, and platform health.</p>
        </div>

        {loading ? (
          <div>Loading users...</div>
        ) : (
          <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Resume Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 font-medium text-zinc-900">{u.email}</td>
                    <td className="px-6 py-4">{u.displayName || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${u.plan === 'pro' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600'}`}>
                        {u.plan || 'free'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">{u.resumeText ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
