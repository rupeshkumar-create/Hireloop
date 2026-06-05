---
description: Update Firestore schema, TypeScript types, and firestore.rules in sync
---

Update the HireSchema data model safely — keeping DATABASE_SCHEMA.md, TypeScript types, and firestore.rules consistent.

## What I need from you

Tell me:
1. Which collection is changing (`users`, `trackedJobs`, `daily_matches`, `cronRuns`, `admin_logs`)
2. What field(s) are being added, removed, or renamed
3. The TypeScript type (e.g. `string | null`, `boolean`, `Record<string, number>`)
4. Whether the field is required or optional
5. Read/write rules: who can access it (owner only, admin only, public read, etc.)

## Steps I will follow

1. **Update `DATABASE_SCHEMA.md`** — add/remove/update the field in the relevant collection table

2. **Update TypeScript types** — find and update the interface in `src/types/` (usually `dailyJob.ts`, `dashboard.ts`, or inline in service files). Run `npm run lint` to catch type errors.

3. **Update `firestore.rules`** — add field validation if the field requires type enforcement. Follow the existing pattern: `request.resource.data.fieldName is <type>`. Remember to run `npm run deploy:rules` after.

4. **Check service files** — grep for any code that reads or writes the changed field and update as needed.

## Firestore rules conventions

- User data: `request.auth.uid == userId` ownership check
- Admin bypass: service account writes from Firebase Admin SDK bypass rules (no client-side admin writes)
- New required fields: add to `request.resource.data.keys().hasAll([...])` if the collection has a keys check
- Never expose another user's data: no cross-uid reads in rules

After all changes: run `npm run lint` then `npm run deploy:rules`.
