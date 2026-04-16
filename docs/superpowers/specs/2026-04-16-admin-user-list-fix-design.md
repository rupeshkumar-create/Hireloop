# Admin User List Fix Design

## Problem

The Super Admin page is intended to show the full Firestore `users` collection, but it currently shows only the signed-in user's document in some sessions.

## Root Cause

The UI and Firestore rules do not use the same Super Admin check semantics:

- The UI checks allowlisted emails case-insensitively by lowercasing the current email.
- Firestore rules compare `request.auth.token.email` against exact string literals.

When the auth token email casing does not exactly match the literals in `firestore.rules`, the collection read is not treated as Super Admin access. The client then behaves like a normal user and only sees the caller's own `users/{uid}` document.

## Immediate Fix

Normalize the email inside `isSuperAdmin()` in `firestore.rules` before comparing against the allowlist so the rules align with the UI.

This keeps the current client-side query in `AdminDashboard` unchanged:

- `onSnapshot(collection(db, 'users'))`

## Follow-Up Hardening

As a later improvement, move the "list all users" operation behind an admin-only backend endpoint that uses `firebase-admin`. That reduces reliance on client-side collection reads for privileged data access while preserving the current admin table UI.

## Verification

- Sign in with an allowlisted admin email.
- Open `/kingdomofkumar`.
- Enter the admin passcode.
- Confirm the users table shows multiple users, not only the current account.
- Confirm a non-admin account still cannot access the admin route or read all user documents.
