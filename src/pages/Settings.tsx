import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Save, Upload, X, Plus, Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
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
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        careerPaths: profile.careerPaths || [],
        resumeText: profile.resumeText || '',
        resumeAnalysis: profile.resumeAnalysis,
        receiveDailyAlerts: profile.receiveDailyAlerts !== false,
        antiSlopEnabled: profile.antiSlopEnabled !== false,
        deliveryTimezone: profile.deliveryTimezone || DEFAULT_TIMEZONE,
        preferredDeliveryHour: String(profile.preferredDeliveryHour ?? 8),
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
        remoteOnly: true, // Defaults to remote only
        salaryFloor: '',
        locations: [],
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
            <CardTitle>Billing & Plan</CardTitle>
            <CardDescription>Manage your subscription and upgrade to Pro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
              <div>
                <p className="font-medium text-foreground">Current Plan: <span className="uppercase text-primary">{profile?.plan || 'Free'}</span></p>
                <p className="text-sm text-foreground-muted mt-1">
                  {profile?.plan?.toLowerCase() === 'pro' 
                    ? 'You have access to all premium features including 10 daily AI job matches.' 
                    : 'Upgrade to Pro for 10 daily AI job matches, 1-Click Cold Emails, and Interview Prep.'}
                </p>
              </div>
              {profile?.plan?.toLowerCase() === 'pro' ? (
                <div className="flex items-center text-foreground font-medium">
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Active
                </div>
              ) : (
                <CreditCard className="h-6 w-6 text-foreground-muted" />
              )}
            </div>

            {profile?.plan?.toLowerCase() !== 'pro' && (
              <div className="space-y-3 pt-4 border-t border-border">
                <label className="text-sm font-medium text-foreground-muted">Choose a Plan</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 p-4 rounded-xl border border-border bg-surface">
                    <h4 className="font-medium text-foreground">Monthly Pro</h4>
                    <p className="text-2xl font-medium mt-1 mb-4">$9<span className="text-sm font-normal text-foreground-muted">/mo</span></p>
                    <a 
                      href={`https://checkout.dodopayments.com/buy/pdt_0Ncd07LOU49HVOMyEEY6D?email=${profile?.email || ''}&redirect_url=${encodeURIComponent(window.location.origin + '/dashboard?payment=success')}`}
                      className="w-full inline-flex justify-center items-center h-10 px-4 py-2 rounded-full border border-border bg-surface-hover text-foreground transition-[border-color,background-color,color,transform,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] font-medium text-sm hover:border-[var(--ember-400)] focus-visible:outline-none focus-visible:shadow-[var(--ember-glow)] active:bg-[var(--ember-tint)] active:scale-[0.985]"
                    >
                      Subscribe Monthly
                    </a>
                  </div>
                  <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-surface p-4">
                    <div className="absolute right-0 top-0 rounded-bl-md border-b border-l border-border bg-background px-2 py-0.5 text-[10px] font-medium text-[var(--ember-400)]">SAVE 25%</div>
                    <h4 className="font-medium text-foreground">Yearly Pro</h4>
                    <p className="mb-4 mt-1 text-2xl font-medium text-foreground">$79<span className="text-sm font-normal text-foreground-muted">/yr</span></p>
                    <a 
                      href={`https://checkout.dodopayments.com/buy/pdt_0Ncd0EFikepaQdgRk8tUR?email=${profile?.email || ''}&redirect_url=${encodeURIComponent(window.location.origin + '/dashboard?payment=success')}`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border bg-surface-hover px-4 py-2 text-sm font-medium text-foreground transition-[border-color,background-color,color,transform,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--ember-400)] focus-visible:outline-none focus-visible:shadow-[var(--ember-glow)] active:bg-[var(--ember-tint)] active:scale-[0.985]"
                    >
                      Subscribe Yearly
                    </a>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Preferences</CardTitle>
            <CardDescription>These preferences are used to curate your daily job feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
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
