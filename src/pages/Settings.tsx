import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Save, Upload, X, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '../components/ui/page-shell';
import { useResumeParser } from '../hooks/useResumeParser';
import {
  hasResumeTextChanged,
  normalizeUserPreferences,
  syncLegacyPreferenceFields,
} from '../services/validator';
import {
  computeMatchReadiness,
  computeNextJobDeliveryAt,
  normalizeDeliverySettings,
} from '../services/jobDeliveryProfile';
import {
  DEFAULT_TARGET_MARKETS,
  normalizeTargetMarkets,
  type TargetMarket,
  TARGET_MARKET_OPTIONS,
} from '../lib/targetMarkets';
import { WhatsAppSupportLink } from '../components/support/WhatsAppSupportLink';
import { WHATSAPP_SUPPORT_PHONE_DISPLAY } from '../lib/whatsappSupport';

const PREDEFINED_PATHS = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Product Manager", "Project Manager", "Data Scientist", "Data Analyst",
  "UX Designer", "UI Designer", "DevOps Engineer", "Marketing Manager"
];

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function Settings() {
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const { analyzingResume, handleFileUpload, processResumeText } = useResumeParser(updateProfile, profile);
  const [formData, setFormData] = useState({
    careerPaths: [] as string[],
    resumeText: '',
    resumeAnalysis: undefined as any,
    receiveDailyAlerts: true,
    antiSlopEnabled: true,
    deliveryTimezone: DEFAULT_TIMEZONE,
    preferredDeliveryHour: '8',
    remoteOnly: true,
    salaryFloor: '',
    locations: '',
    targetMarkets: [...DEFAULT_TARGET_MARKETS] as TargetMarket[],
  });

  useEffect(() => {
    if (profile) {
      const prefs = normalizeUserPreferences(
        profile.matchingPreferences ||
          profile.preferences || {
            remoteOnly: profile.jobType !== 'both',
            salaryFloor: profile.minSalary,
            locations: profile.location ? [profile.location] : [],
          }
      );
      setFormData({
        careerPaths: profile.careerPaths || [],
        resumeText: profile.resumeText || '',
        resumeAnalysis: profile.resumeAnalysis,
        receiveDailyAlerts: profile.receiveDailyAlerts !== false,
        antiSlopEnabled: profile.antiSlopEnabled !== false,
        deliveryTimezone: profile.deliveryTimezone || DEFAULT_TIMEZONE,
        preferredDeliveryHour: String(profile.preferredDeliveryHour ?? 8),
        remoteOnly: prefs.remoteOnly,
        salaryFloor: prefs.salaryFloor ? String(prefs.salaryFloor) : '',
        locations: prefs.locations.join(', '),
        targetMarkets: normalizeTargetMarkets(profile.targetMarkets),
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddPath = (path: string) => {
    if (path.trim() && !formData.careerPaths.includes(path.trim()) && formData.careerPaths.length < 10) {
      setFormData(prev => ({ ...prev, careerPaths: [...prev.careerPaths, path.trim()] }));
      setNewPath('');
    }
  };

  const handleRemovePath = (pathToRemove: string) => {
    setFormData(prev => ({ ...prev, careerPaths: prev.careerPaths.filter(p => p !== pathToRemove) }));
  };

  const toggleTargetMarket = (id: TargetMarket) => {
    setFormData((prev) => {
      const current = prev.targetMarkets;
      if (current.includes(id)) {
        const next = current.filter((m) => m !== id);
        return { ...prev, targetMarkets: next.length > 0 ? next : [...DEFAULT_TARGET_MARKETS] };
      }
      if (id === 'worldwide') return { ...prev, targetMarkets: ['worldwide'] };
      const withoutWorldwide = current.filter((m) => m !== 'worldwide');
      return { ...prev, targetMarkets: [...withoutWorldwide, id] };
    });
  };

  const handleResumeInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    await handleFileUpload(file, () => {});
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = normalizeUserPreferences({
        remoteOnly: formData.remoteOnly,
        salaryFloor: formData.salaryFloor,
        locations: formData.locations,
      });
      const legacy = syncLegacyPreferenceFields(preferences);
      const delivery = normalizeDeliverySettings({
        deliveryTimezone: formData.deliveryTimezone,
        preferredDeliveryHour: formData.preferredDeliveryHour,
      });
      const matchReadiness = computeMatchReadiness({
        resumeText: formData.resumeText,
        careerPaths: formData.careerPaths,
      });
      const nextJobDeliveryAt = computeNextJobDeliveryAt(
        delivery.deliveryTimezone,
        delivery.preferredDeliveryHour
      );
      const resumeChanged = hasResumeTextChanged(
        profile?.resumeCleaned || profile?.resumeText || '',
        formData.resumeText
      );

      if (resumeChanged) {
        const processed = await processResumeText(formData.resumeText, {
          showSuccessToast: false,
          careerPathsOverride: formData.careerPaths,
          preferencesOverride: preferences,
        });

        if (!processed) {
          return;
        }

        await updateProfile({
          careerPaths: formData.careerPaths,
          preferences,
          matchingPreferences: preferences,
          jobType: legacy.jobType,
          location: legacy.location,
          minSalary: legacy.minSalary,
          targetMarkets: formData.targetMarkets,
          deliveryTimezone: delivery.deliveryTimezone,
          preferredDeliveryHour: delivery.preferredDeliveryHour,
          nextJobDeliveryAt,
          matchReadiness,
          receiveDailyAlerts: formData.receiveDailyAlerts,
          antiSlopEnabled: formData.antiSlopEnabled,
        });
        toast.success('Preferences and resume updated.');
        return;
      }

      await updateProfile({
        careerPaths: formData.careerPaths,
        preferences,
        matchingPreferences: preferences,
        jobType: legacy.jobType,
        location: legacy.location,
        minSalary: legacy.minSalary,
        targetMarkets: formData.targetMarkets,
        deliveryTimezone: delivery.deliveryTimezone,
        preferredDeliveryHour: delivery.preferredDeliveryHour,
        nextJobDeliveryAt,
        matchReadiness,
        resumeText: formData.resumeText,
        resumeAnalysis: formData.resumeAnalysis,
        receiveDailyAlerts: formData.receiveDailyAlerts,
        antiSlopEnabled: formData.antiSlopEnabled,
      });
      toast.success('Preferences saved.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hs-view h-full overflow-y-auto pb-12">
      <PageShell
        title="Settings"
        description="Manage your job search preferences, billing, and resume."
        className="max-w-4xl"
      >

        <Card id="billing-plan">
          <CardHeader>
            <CardTitle>Your plan</CardTitle>
            <CardDescription>Jack is completely free for job seekers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
              <div>
                <p className="font-medium text-foreground">Everything included</p>
                <p className="text-sm text-foreground-muted mt-1">
                  Daily matches, Jack chat, introductions, mock interviews, salary coaching, and pipeline — no subscription required.
                </p>
              </div>
              <div className="flex items-center text-foreground font-medium">
                <CheckCircle2 className="mr-2 h-5 w-5 text-[var(--hs-app-accent)]" /> Free
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="job-preferences">
          <CardHeader>
            <CardTitle>Job Preferences</CardTitle>
            <CardDescription>These preferences filter Scout matches and daily job delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground-muted">Minimum salary (USD / year)</label>
                <Input
                  name="salaryFloor"
                  type="number"
                  min={0}
                  step={1000}
                  value={formData.salaryFloor}
                  onChange={handleChange}
                  placeholder="e.g. 120000"
                />
                <p className="text-xs text-foreground-muted">Leave blank for no minimum.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground-muted">Target locations</label>
                <Input
                  name="locations"
                  value={formData.locations}
                  onChange={handleChange}
                  placeholder="Remote, US, Canada"
                />
                <p className="text-xs text-foreground-muted">Comma-separated. Used for region eligibility hints.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground-muted">Target hiring markets</label>
              <p className="text-xs text-foreground-muted">
                Scout discovery and ranking prioritize these regions (default: US, Europe, UK).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TARGET_MARKET_OPTIONS.map((opt) => {
                  const selected = formData.targetMarkets.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleTargetMarket(opt.id)}
                      className={[
                        'text-left rounded-xl border px-4 py-3 transition-all',
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:border-primary/40',
                      ].join(' ')}
                    >
                      <div className="font-medium text-sm text-foreground">{opt.label}</div>
                      <div className="text-xs text-foreground-muted mt-0.5">{opt.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <input
                type="checkbox"
                id="remoteOnly"
                name="remoteOnly"
                checked={formData.remoteOnly}
                onChange={handleChange}
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <div>
                <label htmlFor="remoteOnly" className="text-sm font-medium text-foreground">
                  Prioritize flexible &amp; distributed roles
                </label>
                <p className="mt-1 text-sm text-foreground-muted">
                  When enabled, Scout prioritizes flexible and distributed listings. Turn off to allow hybrid and on-site matches too.
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <label className="text-sm font-medium text-foreground-muted">Career Paths / Desired Titles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.careerPaths.map(path => (
                  <div key={path} className="flex items-center bg-surface-hover text-foreground px-3 py-1.5 rounded-md text-sm border border-border">
                    {path}
                    <button onClick={() => handleRemovePath(path)} className="ml-2 text-foreground-muted hover:text-foreground-muted">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {formData.careerPaths.length === 0 && (
                  <span className="text-sm text-foreground-muted italic">No career paths added. Upload your resume to auto-generate!</span>
                )}
              </div>
              
              <div className="flex gap-2 max-w-md mb-4">
                <Input 
                  placeholder="Add a custom career path..." 
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPath(newPath)}
                  disabled={formData.careerPaths.length >= 10}
                />
                <Button variant="secondary" onClick={() => handleAddPath(newPath)} disabled={!newPath.trim() || formData.careerPaths.length >= 10}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground-muted mb-2 uppercase tracking-wider">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_PATHS.filter(p => !formData.careerPaths.includes(p)).map(path => (
                    <button
                      key={path}
                      onClick={() => handleAddPath(path)}
                      disabled={formData.careerPaths.length >= 10}
                      className="text-xs bg-surface border border-border text-foreground-muted px-2.5 py-1 rounded-full hover:border-border-strong hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      + {path}
                    </button>
                  ))}
                </div>
              </div>
            </div>



            <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground-muted">Delivery Timezone</label>
                <Input
                  name="deliveryTimezone"
                  value={formData.deliveryTimezone}
                  onChange={handleChange}
                  placeholder="Asia/Kolkata"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground-muted">Preferred Delivery Hour</label>
                <select
                  name="preferredDeliveryHour"
                  value={formData.preferredDeliveryHour}
                  onChange={handleChange}
                  className="flex h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={String(hour)}>
                      {hour.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="receiveDailyAlerts"
                  name="receiveDailyAlerts"
                  checked={formData.receiveDailyAlerts}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <div>
                  <label htmlFor="receiveDailyAlerts" className="text-sm font-medium text-foreground">
                    Daily Scout automation
                  </label>
                  <p className="mt-1 text-sm text-foreground-muted">
                    When enabled, Scout runs on your schedule and delivers fresh matches. Turn off to pause all automated runs.
                  </p>
                </div>
              </div>

              {profile?.automationPausedReason === 'inactive_3d' ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                  Scout was paused after 3 days without a visit. Opening Hireschema again re-enables automation — save preferences here to confirm your delivery settings.
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="antiSlopEnabled"
                  name="antiSlopEnabled"
                  checked={formData.antiSlopEnabled}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <div>
                  <label htmlFor="antiSlopEnabled" className="text-sm font-medium text-foreground">
                    Human-sounding AI copy
                  </label>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Applies anti-slop filters to generated emails, resumes, and interview prep.
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        <Card id="support">
          <CardHeader>
            <CardTitle>Help &amp; support</CardTitle>
            <CardDescription>Questions about matches, billing, or your account? Chat with us on WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppSupportLink
              className="inline-flex rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-sm font-medium text-[#128C7E] hover:bg-[#25D366]/15"
              showPhone
            >
              Message on WhatsApp
            </WhatsAppSupportLink>
            <p className="mt-3 text-xs text-foreground-muted">
              Opens WhatsApp with a pre-filled greeting to our team ({WHATSAPP_SUPPORT_PHONE_DISPLAY}).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
            <CardDescription>Upload your resume (PDF/DOCX/TXT) or paste it below. This is used to tailor applications and calculate match scores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" className="relative overflow-hidden" disabled={analyzingResume}>
                {analyzingResume ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {analyzingResume ? 'Analyzing Resume...' : 'Upload Resume'}
                <input 
                  type="file" 
                  accept=".pdf,.txt,.md,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  onChange={handleResumeInputChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={analyzingResume}
                />
              </Button>
              <span className="text-xs text-foreground-muted">Supports .pdf, .docx, .txt. Max 5MB. Uploading will auto-generate career paths.</span>
            </div>
            <Textarea 
              name="resumeText" 
              placeholder="Or paste your full resume text here..." 
              className="min-h-[300px] font-mono text-xs"
              value={formData.resumeText}
              onChange={handleChange}
            />
          </CardContent>
          <CardFooter className="flex justify-end border-t border-border pt-6">
            <Button onClick={handleSave} disabled={saving || analyzingResume}>
              {saving ? 'Saving...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </PageShell>
    </div>
  );
}
