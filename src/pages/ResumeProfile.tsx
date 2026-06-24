import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Upload,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Briefcase,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Compass,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { reorderCareerPaths } from '../lib/careerPaths';
import { useAuth } from '../contexts/AuthContext';
import type {
  ContactDetails,
  EducationEntry,
  ExperienceEntry,
  StructuredProfile,
  UserProfile,
} from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

function initials(name?: string, email?: string) {
  const source = name || email || 'User';
  return (
    source
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  );
}

function shortId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

function patchStructured(
  profile: UserProfile | null,
  patch: Partial<StructuredProfile>
): StructuredProfile {
  const existing: StructuredProfile = profile?.structuredProfile || {
    skills: [],
    techStack: [],
    seniority: '',
    roles: [],
    industries: [],
  };
  return { ...existing, ...patch };
}

export function ResumeProfile() {
  const { profile, updateProfile } = useAuth();
  const structured = profile?.structuredProfile;
  const analysis = profile?.resumeAnalysis;
  const careerPaths = profile?.careerPaths || [];
  const summary = profile?.resumeSummary || '';

  const allSkills = useMemo(
    () =>
      Array.from(
        new Set([...(structured?.skills || []), ...(structured?.techStack || [])])
      ).filter(Boolean),
    [structured]
  );

  return (
    <div className="hs-view">
      {/* Header */}
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="hs-label mb-2">Parsed from your latest resume</div>
          <h1 className="hs-section-title">Your Resume Profile</h1>
          <p className="mt-2 text-sm text-[var(--hs-app-muted)]">
            Everything Hireschema knows about you. Click any section to edit and save.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/settings" className="hs-btn">
            <Upload className="h-3.5 w-3.5" />
            Re-upload
          </Link>
          <button className="hs-btn" type="button">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Sidebar: identity + quick stats ─────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] font-display text-3xl font-semibold">
            {initials(profile?.displayName, profile?.email)}
          </div>
          <h2 className="text-xl font-semibold">{profile?.displayName || 'Set your name'}</h2>
          <p className="mb-5 text-sm text-[var(--hs-app-muted)]">
            {careerPaths[0] || structured?.seniority || 'Job seeker'}
          </p>

          <div className="space-y-3 rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
            <Stat label="Skills" value={allSkills.length} />
            <Stat label="Experience" value={structured?.experience?.length || 0} />
            <Stat label="Education" value={structured?.education?.length || 0} />
            <Stat
              label="Remote readiness"
              value={analysis?.remoteReadiness?.score != null ? `${analysis.remoteReadiness.score}/100` : '—'}
            />
          </div>
        </aside>

        {/* ── Main: editable sections ─────────────────────────────────────── */}
        <main className="space-y-5">
          <ContactSection profile={profile} updateProfile={updateProfile} />

          <SummarySection profile={profile} updateProfile={updateProfile} />

          <CareerPathsSection profile={profile} updateProfile={updateProfile} />

          <SkillsSection profile={profile} updateProfile={updateProfile} />

          <ExperienceSection profile={profile} updateProfile={updateProfile} />

          <EducationSection profile={profile} updateProfile={updateProfile} />

          <CertificationsSection profile={profile} updateProfile={updateProfile} />

          <AnalysisSection profile={profile} />
        </main>
      </div>
    </div>
  );
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="hs-label">{label}</span>
      <span className="text-base font-semibold text-[var(--hs-app-fg)]">{value}</span>
    </div>
  );
}

function SectionShell({
  icon: Icon,
  title,
  description,
  editing,
  onEdit,
  onSave,
  onCancel,
  saving,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-5 md:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--hs-app-fg)]">{title}</h3>
            {description && (
              <p className="text-xs text-[var(--hs-app-muted)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <Button size="sm" onClick={onSave} disabled={saving}>
                <Check className="mr-1 h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-1.5">
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hs-app-muted)]" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={[
            'w-full rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-3 py-2 text-sm text-[var(--hs-app-fg)]',
            'placeholder:text-[var(--hs-app-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-accent)]/30',
            Icon ? 'pl-9' : '',
          ].join(' ')}
        />
      </div>
    </label>
  );
}

function ReadValue({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  href?: string;
}) {
  if (!value) return null;
  const content = (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-[var(--hs-app-muted)] shrink-0" />
      <span className="text-sm text-[var(--hs-app-fg)] truncate">{value}</span>
    </div>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block min-w-0 hover:text-[var(--hs-app-accent)]" title={label}>
        {content}
      </a>
    );
  }
  return <div className="min-w-0" title={label}>{content}</div>;
}

function TagEditor({
  values,
  onChange,
  placeholder = 'Add and press Enter',
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (values.includes(v)) return;
    onChange([...values, v]);
    setDraft('');
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--hs-app-accent)]/15 px-2.5 py-1 text-xs font-medium text-[var(--hs-app-accent)]"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              className="rounded-full p-0.5 hover:bg-[var(--hs-app-accent)]/25"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-[var(--hs-app-muted)]">No items yet.</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-3 py-2 text-sm text-[var(--hs-app-fg)] placeholder:text-[var(--hs-app-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-accent)]/30"
        />
        <Button variant="outline" onClick={() => add(draft)} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

function ContactSection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const contact = profile?.structuredProfile?.contact || {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ContactDetails>(contact);

  const startEdit = () => {
    setDraft(profile?.structuredProfile?.contact || {});
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      // Clean empty strings → omit so we don't store noise.
      const cleaned: ContactDetails = {};
      (Object.keys(draft) as (keyof ContactDetails)[]).forEach((k) => {
        const v = draft[k];
        if (typeof v === 'string' && v.trim()) cleaned[k] = v.trim();
      });
      await updateProfile({
        structuredProfile: patchStructured(profile, { contact: cleaned }),
        displayName: cleaned.fullName || profile?.displayName,
      });
      toast.success('Contact details saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save contact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      icon={Mail}
      title="Contact"
      description="Used for outreach drafts and résumé exports."
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Full name" value={draft.fullName || ''} onChange={(v) => setDraft({ ...draft, fullName: v })} placeholder="Jane Doe" />
          <TextInput label="Email" value={draft.email || ''} onChange={(v) => setDraft({ ...draft, email: v })} placeholder="jane@example.com" type="email" icon={Mail} />
          <TextInput label="Phone" value={draft.phone || ''} onChange={(v) => setDraft({ ...draft, phone: v })} placeholder="+1 555 0123" icon={Phone} />
          <TextInput label="Location" value={draft.location || ''} onChange={(v) => setDraft({ ...draft, location: v })} placeholder="Bengaluru, India" icon={MapPin} />
          <TextInput label="LinkedIn" value={draft.linkedin || ''} onChange={(v) => setDraft({ ...draft, linkedin: v })} placeholder="linkedin.com/in/…" icon={Linkedin} />
          <TextInput label="GitHub" value={draft.github || ''} onChange={(v) => setDraft({ ...draft, github: v })} placeholder="github.com/…" icon={Github} />
          <TextInput label="Website" value={draft.website || ''} onChange={(v) => setDraft({ ...draft, website: v })} placeholder="https://…" icon={Globe} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadValue icon={Mail} label="Email" value={contact.email || profile?.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
          <ReadValue icon={Phone} label="Phone" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : undefined} />
          <ReadValue icon={MapPin} label="Location" value={contact.location || profile?.location} />
          <ReadValue icon={Linkedin} label="LinkedIn" value={contact.linkedin} href={contact.linkedin ? (contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`) : undefined} />
          <ReadValue icon={Github} label="GitHub" value={contact.github} href={contact.github ? (contact.github.startsWith('http') ? contact.github : `https://${contact.github}`) : undefined} />
          <ReadValue icon={Globe} label="Website" value={contact.website} href={contact.website ? (contact.website.startsWith('http') ? contact.website : `https://${contact.website}`) : undefined} />
          {!contact.email && !contact.phone && !contact.location && !contact.linkedin && !contact.github && !contact.website && (
            <p className="text-sm text-[var(--hs-app-muted)] md:col-span-2">No contact details on file yet. Click Edit to add them.</p>
          )}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function SummarySection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(profile?.resumeSummary || '');

  const startEdit = () => {
    setDraft(profile?.resumeSummary || '');
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ resumeSummary: draft.trim() });
      toast.success('Summary saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save summary.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      icon={Sparkles}
      title="Professional summary"
      description="The 2–3 sentence pitch your AI Copilot uses as a starting point."
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] px-3 py-2 text-sm text-[var(--hs-app-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hs-app-accent)]/30"
          placeholder="Senior engineer with 6 years of building data products at fast-moving startups…"
        />
      ) : profile?.resumeSummary ? (
        <p className="text-sm leading-7 text-[var(--hs-app-fg)]">{profile.resumeSummary}</p>
      ) : (
        <p className="text-sm text-[var(--hs-app-muted)]">No summary yet. Click Edit to write one.</p>
      )}
    </SectionShell>
  );
}

// ─── Career paths ────────────────────────────────────────────────────────────

function CareerPathsSection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string[]>(profile?.careerPaths || []);

  const startEdit = () => {
    setDraft(profile?.careerPaths || []);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ careerPaths: draft });
      toast.success('Career paths saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save career paths.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      icon={Compass}
      title="Career paths"
      description="Order matters: #1 is searched first, then #2, then #3 when Scout finds your 10 daily jobs."
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <div className="space-y-2">
          <TagEditor values={draft} onChange={setDraft} placeholder="e.g. Senior Frontend Engineer" />
          {draft.length > 1 && (
            <p className="text-[11px] text-[var(--hs-app-muted)]">Use arrows to set priority (1 = highest).</p>
          )}
          {draft.map((path, index) => (
            <div key={`${path}-${index}`} className="flex items-center gap-2 rounded-md border border-[var(--hs-app-border)] px-3 py-2">
              <span className="font-mono text-[11px] text-[var(--hs-app-accent)] w-6">#{index + 1}</span>
              <span className="flex-1 text-sm">{path}</span>
              <button
                type="button"
                className="rounded p-1 hover:bg-[var(--hs-app-bg)]"
                disabled={index === 0}
                onClick={() => setDraft(reorderCareerPaths(draft, index, index - 1))}
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-[var(--hs-app-bg)]"
                disabled={index >= draft.length - 1}
                onClick={() => setDraft(reorderCareerPaths(draft, index, index + 1))}
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (profile?.careerPaths || []).length > 0 ? (
        <ol className="space-y-2">
          {(profile?.careerPaths || []).map((p, i) => (
            <li key={p} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-[11px] text-[var(--hs-app-accent)]">#{i + 1}</span>
              <span className="hs-pill">{p}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-[var(--hs-app-muted)]">No career paths saved yet.</p>
      )}
    </SectionShell>
  );
}

// ─── Skills ──────────────────────────────────────────────────────────────────

function SkillsSection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<string[]>(profile?.structuredProfile?.skills || []);
  const [techStack, setTechStack] = useState<string[]>(profile?.structuredProfile?.techStack || []);

  const startEdit = () => {
    setSkills(profile?.structuredProfile?.skills || []);
    setTechStack(profile?.structuredProfile?.techStack || []);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ structuredProfile: patchStructured(profile, { skills, techStack }) });
      toast.success('Skills saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save skills.');
    } finally {
      setSaving(false);
    }
  };

  const viewSkills = profile?.structuredProfile?.skills || [];
  const viewStack = profile?.structuredProfile?.techStack || [];

  return (
    <SectionShell
      icon={Sparkles}
      title="Skills & tech stack"
      description="Powers resume tailoring and match scoring."
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <div className="space-y-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Skills</div>
            <TagEditor values={skills} onChange={setSkills} placeholder="e.g. Product strategy" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Tech stack</div>
            <TagEditor values={techStack} onChange={setTechStack} placeholder="e.g. TypeScript" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Skills</div>
            {viewSkills.length === 0 ? (
              <p className="text-sm text-[var(--hs-app-muted)]">None yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewSkills.map((s) => <span key={s} className="hs-pill">{s}</span>)}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Tech stack</div>
            {viewStack.length === 0 ? (
              <p className="text-sm text-[var(--hs-app-muted)]">None yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewStack.map((s) => <span key={s} className="hs-pill hs-pill-success">{s}</span>)}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ─── Experience ──────────────────────────────────────────────────────────────

function ExperienceSection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const seed = profile?.structuredProfile?.experience || [];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ExperienceEntry[]>(seed);

  const startEdit = () => {
    setDraft(profile?.structuredProfile?.experience || []);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ structuredProfile: patchStructured(profile, { experience: draft }) });
      toast.success('Experience saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save experience.');
    } finally {
      setSaving(false);
    }
  };

  const patch = (id: string, patch: Partial<ExperienceEntry>) =>
    setDraft(draft.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => setDraft(draft.filter((e) => e.id !== id));
  const add = () =>
    setDraft([
      ...draft,
      { id: shortId(`new-${Date.now()}`), title: '', company: '', highlights: [] },
    ]);

  return (
    <SectionShell
      icon={Briefcase}
      title="Experience"
      description="Roles Scout uses to score job seniority and fit."
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <div className="space-y-4">
          {draft.length === 0 && (
            <p className="text-sm text-[var(--hs-app-muted)]">No roles yet — add your first below.</p>
          )}
          {draft.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <TextInput label="Title" value={entry.title} onChange={(v) => patch(entry.id, { title: v })} placeholder="Senior Engineer" />
                <TextInput label="Company" value={entry.company} onChange={(v) => patch(entry.id, { company: v })} placeholder="Acme Inc" />
                <TextInput label="Location" value={entry.location || ''} onChange={(v) => patch(entry.id, { location: v })} placeholder="Remote · US" />
                <div className="grid grid-cols-2 gap-3">
                  <TextInput label="Start" value={entry.startDate || ''} onChange={(v) => patch(entry.id, { startDate: v })} placeholder="2023-01" />
                  <TextInput label="End" value={entry.endDate || ''} onChange={(v) => patch(entry.id, { endDate: v })} placeholder="Present" />
                </div>
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2 text-xs text-[var(--hs-app-muted)]">
                  <input
                    type="checkbox"
                    checked={!!entry.current}
                    onChange={(e) => patch(entry.id, { current: e.target.checked })}
                  />
                  Currently in this role
                </label>
              </div>
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Highlights</div>
                <TagEditor
                  values={entry.highlights || []}
                  onChange={(v) => patch(entry.id, { highlights: v })}
                  placeholder="One outcome per line, press Enter"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => remove(entry.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove role
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add role
          </Button>
        </div>
      ) : seed.length === 0 ? (
        <p className="text-sm text-[var(--hs-app-muted)]">No experience extracted yet. Click Edit to add roles.</p>
      ) : (
        <div className="space-y-4">
          {seed.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--hs-app-fg)]">{entry.title || 'Untitled role'}</div>
                  <div className="text-sm text-[var(--hs-app-muted)]">
                    {entry.company}
                    {entry.location ? ` · ${entry.location}` : ''}
                  </div>
                </div>
                <div className="text-xs text-[var(--hs-app-muted)]">
                  {entry.startDate || '—'}{' '}
                  {entry.current ? '· Present' : entry.endDate ? `– ${entry.endDate}` : ''}
                </div>
              </div>
              {entry.highlights && entry.highlights.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm text-[var(--hs-app-muted)] space-y-1.5">
                  {entry.highlights.map((h, i) => (
                    <li key={i} className="leading-6">{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Education ───────────────────────────────────────────────────────────────

function EducationSection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const seed = profile?.structuredProfile?.education || [];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EducationEntry[]>(seed);

  const startEdit = () => {
    setDraft(profile?.structuredProfile?.education || []);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ structuredProfile: patchStructured(profile, { education: draft }) });
      toast.success('Education saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save education.');
    } finally {
      setSaving(false);
    }
  };

  const patch = (id: string, p: Partial<EducationEntry>) =>
    setDraft(draft.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const remove = (id: string) => setDraft(draft.filter((e) => e.id !== id));
  const add = () =>
    setDraft([...draft, { id: shortId(`new-${Date.now()}`), school: '' }]);

  return (
    <SectionShell
      icon={GraduationCap}
      title="Education"
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <div className="space-y-3">
          {draft.length === 0 && (
            <p className="text-sm text-[var(--hs-app-muted)]">No education yet — add an entry below.</p>
          )}
          {draft.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <TextInput label="School" value={entry.school} onChange={(v) => patch(entry.id, { school: v })} placeholder="MIT" />
                <TextInput label="Degree" value={entry.degree || ''} onChange={(v) => patch(entry.id, { degree: v })} placeholder="B.S." />
                <TextInput label="Field" value={entry.field || ''} onChange={(v) => patch(entry.id, { field: v })} placeholder="Computer Science" />
                <div className="grid grid-cols-2 gap-3">
                  <TextInput label="Start" value={entry.startDate || ''} onChange={(v) => patch(entry.id, { startDate: v })} placeholder="2018" />
                  <TextInput label="End" value={entry.endDate || ''} onChange={(v) => patch(entry.id, { endDate: v })} placeholder="2022" />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => remove(entry.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add education
          </Button>
        </div>
      ) : seed.length === 0 ? (
        <p className="text-sm text-[var(--hs-app-muted)]">No education extracted yet. Click Edit to add.</p>
      ) : (
        <div className="space-y-3">
          {seed.map((e) => (
            <div key={e.id} className="rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold text-[var(--hs-app-fg)]">{e.school}</div>
                  <div className="text-sm text-[var(--hs-app-muted)]">
                    {[e.degree, e.field].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
                <div className="text-xs text-[var(--hs-app-muted)]">
                  {[e.startDate, e.endDate].filter(Boolean).join(' – ') || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Certifications + languages (compact paired section) ─────────────────────

function CertificationsSection({
  profile,
  updateProfile,
}: {
  profile: UserProfile | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [certs, setCerts] = useState<string[]>(profile?.structuredProfile?.certifications || []);
  const [langs, setLangs] = useState<string[]>(profile?.structuredProfile?.languages || []);

  const startEdit = () => {
    setCerts(profile?.structuredProfile?.certifications || []);
    setLangs(profile?.structuredProfile?.languages || []);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        structuredProfile: patchStructured(profile, { certifications: certs, languages: langs }),
      });
      toast.success('Saved.');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const viewCerts = profile?.structuredProfile?.certifications || [];
  const viewLangs = profile?.structuredProfile?.languages || [];

  return (
    <SectionShell
      icon={GraduationCap}
      title="Certifications & languages"
      editing={editing}
      onEdit={startEdit}
      onSave={save}
      onCancel={() => setEditing(false)}
      saving={saving}
    >
      {editing ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Certifications</div>
            <TagEditor values={certs} onChange={setCerts} placeholder="AWS Solutions Architect" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Languages</div>
            <TagEditor values={langs} onChange={setLangs} placeholder="English (Fluent)" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Certifications</div>
            {viewCerts.length === 0 ? (
              <p className="text-sm text-[var(--hs-app-muted)]">None yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewCerts.map((c) => <span key={c} className="hs-pill">{c}</span>)}
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-2">Languages</div>
            {viewLangs.length === 0 ? (
              <p className="text-sm text-[var(--hs-app-muted)]">None yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewLangs.map((l) => <span key={l} className="hs-pill">{l}</span>)}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ─── AI analysis: strengths / weaknesses / remote-friendly ───────────────────

function AnalysisSection({ profile }: { profile: UserProfile | null }) {
  const a = profile?.resumeAnalysis;
  if (!a) {
    return (
      <section className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-5 md:p-6">
        <header className="mb-3 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--hs-app-fg)]">AI Resume Analysis</h3>
            <p className="text-xs text-[var(--hs-app-muted)] mt-0.5">Strengths, weaknesses, and remote readiness.</p>
          </div>
        </header>
        <p className="text-sm text-[var(--hs-app-muted)]">No analysis yet. Re-upload your resume in Settings to generate one.</p>
      </section>
    );
  }

  const remote = a.remoteReadiness;

  return (
    <section className="rounded-xl border border-[var(--hs-app-border)] bg-[var(--hs-app-surface)] p-5 md:p-6">
      <header className="mb-5 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--hs-app-accent)]/15 text-[var(--hs-app-accent)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--hs-app-fg)]">AI Resume Analysis</h3>
          <p className="text-xs text-[var(--hs-app-muted)] mt-0.5">
            Auto-generated. Regenerated when you re-upload your resume.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {a.strengths && a.strengths.length > 0 && (
          <AnalysisList icon={Check} title="Strengths" tone="success" items={a.strengths} />
        )}
        {a.weaknesses && a.weaknesses.length > 0 && (
          <AnalysisList icon={AlertTriangle} title="Weaknesses" tone="warn" items={a.weaknesses} />
        )}
        {a.improvements && a.improvements.length > 0 && (
          <AnalysisList icon={Lightbulb} title="Suggested improvements" tone="info" items={a.improvements} />
        )}
        {remote && (
          <div className="rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)]">Remote-friendly</div>
              <div className="text-2xl font-semibold text-[var(--hs-app-accent)]">{remote.score}/100</div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hs-app-bg-alt,#1f2937)]">
              <div
                className="h-full bg-[var(--hs-app-accent)]"
                style={{ width: `${Math.max(0, Math.min(100, remote.score))}%` }}
              />
            </div>
            {remote.tips && remote.tips.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-xs text-[var(--hs-app-muted)] space-y-1">
                {remote.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {a.summary && (
        <div className="mt-5 rounded-lg border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)] mb-1.5">Overall</div>
          <p className="text-sm leading-6 text-[var(--hs-app-fg)]">{a.summary}</p>
        </div>
      )}
    </section>
  );
}

function AnalysisList({
  icon: Icon,
  title,
  tone,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: 'success' | 'warn' | 'info';
  items: string[];
}) {
  // All tones live within the brand palette — warm accent for positive, soft
  // muted neutrals for warn/info. Keeps the landing-page aesthetic consistent
  // across the app.
  const colors = {
    success: {
      bg: 'bg-[var(--hs-app-accent-soft)]',
      bd: 'border-[var(--hs-app-accent)]/25',
      fg: 'text-[var(--hs-app-accent)]',
    },
    warn: {
      bg: 'bg-[var(--hs-app-warn-bg)]',
      bd: 'border-[var(--hs-app-warn)]/25',
      fg: 'text-[var(--hs-app-warn)]',
    },
    info: {
      bg: 'bg-[var(--hs-app-bg)]',
      bd: 'border-[var(--hs-app-border-strong)]',
      fg: 'text-[var(--hs-app-muted)]',
    },
  }[tone];
  return (
    <div className={`rounded-lg border ${colors.bd} ${colors.bg} p-4`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${colors.fg}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${colors.fg}`}>{title}</span>
      </div>
      <ul className="space-y-1.5 text-sm text-[var(--hs-app-fg)] leading-6">
        {items.map((it, i) => <li key={i}>· {it}</li>)}
      </ul>
    </div>
  );
}
