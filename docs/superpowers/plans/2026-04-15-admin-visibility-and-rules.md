# Admin Visibility And Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the super admin at `/kingdomofkumar` reliably view other users' details and impersonated data without Firestore rule failures.

**Architecture:** Fix the broken rule path for `trackedJobs` reads, keep the existing admin route, and add an explicit user-details view in `AdminDashboard` so “see details” is a first-class action instead of requiring impersonation alone.

**Tech Stack:** React, TypeScript, Firebase Auth, Firestore rules

---

### Task 1: Fix Firestore Read Rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace the invalid tracked-jobs read rule**

```txt
match /trackedJobs/{jobId} {
  allow read: if isDocOwner() || isSuperAdmin();
  allow create: if (isAuthenticated() && isValidTrackedJob(request.resource.data)) || isSuperAdmin();
  allow update: if (isDocOwner() && isValidTrackedJob(request.resource.data) &&
                request.resource.data.userId == resource.data.userId &&
                request.resource.data.createdAt == resource.data.createdAt) || isSuperAdmin();
  allow delete: if isDocOwner() || isSuperAdmin();
}
```

- [ ] **Step 2: Keep `users/{userId}` admin reads explicit**

```txt
match /users/{userId} {
  allow read: if isOwner(userId) || isSuperAdmin();
}
```

### Task 2: Add An Explicit User Details View

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Add a dedicated “View Details” action and modal state**

```ts
const [detailUser, setDetailUser] = useState<any | null>(null);
```

- [ ] **Step 2: Add a button in each row**

```tsx
<Button size="sm" variant="outline" onClick={() => setDetailUser(u)}>
  View Details
</Button>
```

- [ ] **Step 3: Render key fields in a modal**

```tsx
{detailUser && (
  <div>
    <p>{detailUser.email}</p>
    <p>{detailUser.displayName || '-'}</p>
    <p>{detailUser.careerPaths?.join(', ') || '-'}</p>
    <p>{detailUser.jobType || '-'}</p>
    <p>{detailUser.minSalary || '-'}</p>
    <pre>{detailUser.resumeText || 'No resume uploaded.'}</pre>
  </div>
)}
```

### Task 3: Improve Admin Query Error Handling

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`
- Modify: `src/firebase.ts`

- [ ] **Step 1: Route snapshot errors through the shared Firestore error formatter**

```ts
import { db, handleFirestoreError, OperationType } from '../firebase';
```

```ts
}, (error) => {
  try {
    handleFirestoreError(error, OperationType.LIST, 'users');
  } catch (formattedError) {
    console.error('Error fetching users:', formattedError);
  }
  toast.error('Failed to load users. Check permissions.');
  setLoading(false);
});
```

- [ ] **Step 2: Leave impersonation intact but ensure the admin can inspect details even if impersonation is not used**

```tsx
<Button size="sm" variant="outline" onClick={() => {
  impersonateUser(u.id, u.email);
  toast.success(`Impersonating ${u.email}`);
  navigate('/dashboard');
}}>
  Enter Dashboard
</Button>
```

### Task 4: Verify

**Files:**
- Modify: `firestore.rules`
- Modify: `src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Run diagnostics**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Run build**

```bash
npm run build
```
