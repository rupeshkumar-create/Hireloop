import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Save, Upload, X, Plus, Loader2, CreditCard, CheckCircle2, Sparkles } from 'lucide-react';
import { suggestCareerPaths } from '../services/aiService';
import { toast } from 'sonner';

const PREDEFINED_PATHS = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Product Manager", "Project Manager", "Data Scientist", "Data Analyst",
  "UX Designer", "UI Designer", "DevOps Engineer", "Marketing Manager"
];

export function Settings() {
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [formData, setFormData] = useState({
    careerPaths: [] as string[],
    jobType: 'remote',
    minSalary: '',
    resumeText: '',
    resumeAnalysis: undefined as any,
    receiveDailyAlerts: true,
    antiSlopEnabled: true,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        careerPaths: profile.careerPaths || [],
        jobType: profile.jobType || 'remote',
        minSalary: profile.minSalary?.toString() || '',
        resumeText: profile.resumeText || '',
        resumeAnalysis: profile.resumeAnalysis,
        receiveDailyAlerts: profile.receiveDailyAlerts !== false,
        antiSlopEnabled: profile.antiSlopEnabled !== false,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    setAnalyzing(true);
    let text = '';
    
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        const pdfWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          text += pageText + '\n';
        }
      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        alert("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
        setAnalyzing(false);
        return;
      }
    } catch (err) {
      console.error("Error parsing file", err);
      alert("Could not parse the file. Please try a different format or paste the text directly.");
      setAnalyzing(false);
      return;
    }

    setFormData(prev => ({ ...prev, resumeText: text }));
    
    // Analyze resume for career paths and feedback
    if (text.trim()) {
      const paths = await suggestCareerPaths(text);
      if (paths && paths.length > 0) {
        setFormData(prev => ({ ...prev, careerPaths: paths }));
      }
      
      const { analyzeResume } = await import('../services/aiService');
      const analysis = await analyzeResume(text, paths || []);
      if (analysis) {
        setFormData(prev => ({ ...prev, resumeAnalysis: analysis }));
      }
    }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({
      careerPaths: formData.careerPaths,
      jobType: formData.jobType,
      minSalary: formData.minSalary ? parseInt(formData.minSalary, 10) : null,
      resumeText: formData.resumeText,
      resumeAnalysis: formData.resumeAnalysis,
      receiveDailyAlerts: formData.receiveDailyAlerts,
      antiSlopEnabled: formData.antiSlopEnabled,
    });
    setSaving(false);
  };

  const handleUpgrade = async () => {
    // In a real app, this would redirect to Dodo Payments checkout.
    // For now, we simulate opening a checkout window or redirect.
    toast.info('Redirecting to Dodo Payments checkout...');
    
    // Example format for Dodo payments:
    // window.location.href = "https://checkout.dodopayments.com/buy/pdt_0Ncd0EFikepaQdgRk8tUR?email=" + profile?.email;
  };

  return (
    <div className="h-full overflow-y-auto pb-12 pr-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Settings</h1>
          <p className="text-zinc-500 mt-1">Manage your job search preferences and resume.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Billing & Plan</CardTitle>
            <CardDescription>Manage your subscription and upgrade to Pro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-zinc-900">Current Plan: <span className="uppercase text-indigo-600">{profile?.plan || 'Free'}</span></p>
                <p className="text-sm text-zinc-500 mt-1">
                  {profile?.plan === 'pro' 
                    ? 'You have access to all premium features including 10 daily AI job matches.' 
                    : 'Upgrade to Pro for 10 daily AI job matches, 1-Click Cold Emails, and Interview Prep.'}
                </p>
              </div>
              {profile?.plan === 'pro' ? (
                <div className="flex items-center text-emerald-600 font-medium">
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Active
                </div>
              ) : (
                <CreditCard className="h-6 w-6 text-zinc-400" />
              )}
            </div>

            {profile?.plan !== 'pro' && (
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <label className="text-sm font-medium text-zinc-700">Choose a Plan</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 p-4 rounded-xl border border-zinc-200 bg-white">
                    <h4 className="font-semibold text-zinc-900">Monthly Pro</h4>
                    <p className="text-2xl font-bold mt-1 mb-4">$9<span className="text-sm font-normal text-zinc-500">/mo</span></p>
                    <a 
                      href={`https://checkout.dodopayments.com/buy/pdt_0Ncd07LOU49HVOMyEEY6D?email=${profile?.email || ''}&redirect_url=${encodeURIComponent(window.location.origin + '/dashboard?payment=success')}`}
                      className="w-full inline-flex justify-center items-center h-10 px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors font-medium text-sm"
                    >
                      Subscribe Monthly
                    </a>
                  </div>
                  <div className="flex-1 p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">SAVE 25%</div>
                    <h4 className="font-semibold text-indigo-900">Yearly Pro</h4>
                    <p className="text-2xl font-bold mt-1 mb-4 text-indigo-900">$79<span className="text-sm font-normal text-indigo-600/70">/yr</span></p>
                    <a 
                      href={`https://checkout.dodopayments.com/buy/pdt_0Ncd0EFikepaQdgRk8tUR?email=${profile?.email || ''}&redirect_url=${encodeURIComponent(window.location.origin + '/dashboard?payment=success')}`}
                      className="w-full inline-flex justify-center items-center h-10 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium text-sm"
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
              <label className="text-sm font-medium text-zinc-700">Career Paths / Desired Titles</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.careerPaths.map(path => (
                  <div key={path} className="flex items-center bg-zinc-100 text-zinc-800 px-3 py-1.5 rounded-md text-sm border border-zinc-200">
                    {path}
                    <button onClick={() => handleRemovePath(path)} className="ml-2 text-zinc-400 hover:text-zinc-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {formData.careerPaths.length === 0 && (
                  <span className="text-sm text-zinc-500 italic">No career paths added. Upload your resume to auto-generate!</span>
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
                <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_PATHS.filter(p => !formData.careerPaths.includes(p)).map(path => (
                    <button
                      key={path}
                      onClick={() => handleAddPath(path)}
                      disabled={formData.careerPaths.length >= 10}
                      className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full hover:border-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
                    >
                      + {path}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-100">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Work Type</label>
                <select 
                  name="jobType" 
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                  value={formData.jobType}
                  onChange={handleChange}
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                  <option value="any">Any</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Minimum Salary (USD)</label>
                <Input 
                  name="minSalary" 
                  type="number" 
                  placeholder="e.g. 120000" 
                  value={formData.minSalary} 
                  onChange={handleChange} 
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-zinc-700 block">Daily Job Alerts</label>
                <p className="text-xs text-zinc-500 mt-0.5">Receive an email every day with your top AI-curated job matches.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="receiveDailyAlerts"
                  className="sr-only peer" 
                  checked={formData.receiveDailyAlerts}
                  onChange={handleChange}
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
              </label>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-zinc-700 block flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-zinc-900" />
                  AI Humanizer (Anti-Slop Filter)
                </label>
                <p className="text-xs text-zinc-500 mt-0.5 max-w-[80%]">
                  Prevents the AI from using robotic buzzwords like "delve", "robust", or "tapestry" in your emails and tailored resumes. Keeps your writing concise and professional.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="antiSlopEnabled"
                  className="sr-only peer" 
                  checked={formData.antiSlopEnabled}
                  onChange={handleChange}
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
              </label>
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
              <Button variant="outline" className="relative overflow-hidden" disabled={analyzing}>
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {analyzing ? 'Analyzing Resume...' : 'Upload Resume'}
                <input 
                  type="file" 
                  accept=".pdf,.txt,.md,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={analyzing}
                />
              </Button>
              <span className="text-xs text-zinc-500">Supports .pdf, .docx, .txt. Max 5MB. Uploading will auto-generate career paths.</span>
            </div>
            <Textarea 
              name="resumeText" 
              placeholder="Or paste your full resume text here..." 
              className="min-h-[300px] font-mono text-xs"
              value={formData.resumeText}
              onChange={handleChange}
            />
          </CardContent>
          <CardFooter className="flex justify-end border-t border-zinc-100 pt-6">
            <Button onClick={handleSave} disabled={saving || analyzing}>
              {saving ? 'Saving...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
