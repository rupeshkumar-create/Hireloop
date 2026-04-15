import { useState } from 'react';
import { toast } from 'sonner';
import { suggestCareerPaths } from '../services/aiService';
import {
  normalizeResumeText,
  type NormalizedUserPreferences,
  normalizeUserPreferences,
  syncLegacyPreferenceFields,
} from '../services/validator';

interface ProcessResumeTextOptions {
  onSuccess?: () => void;
  successMessage?: string;
  showSuccessToast?: boolean;
  careerPathsOverride?: string[];
  preferencesOverride?: NormalizedUserPreferences;
}

export function useResumeParser(updateProfile: (data: any) => Promise<void>, profile: any) {
  const [analyzingResume, setAnalyzingResume] = useState(false);

  const processResumeText = async (
    rawText: string,
    options?: ProcessResumeTextOptions
  ): Promise<boolean> => {
    setAnalyzingResume(true);

    try {
      const resumeRaw = rawText;
      const resumeCleaned = normalizeResumeText(resumeRaw);

      if (!resumeCleaned) {
        toast.error('The provided resume text did not contain readable content.');
        return false;
      }

      let paths = options?.careerPathsOverride ?? profile?.careerPaths ?? [];
      let analysis = profile?.resumeAnalysis;
      let structuredProfile = profile?.structuredProfile;
      let resumeSummary = profile?.resumeSummary || '';

      toast.info("Analyzing resume for structured profile and preferences...");
      const {
        analyzeResume,
        extractJobPreferences,
        extractResume,
        summarizeResume,
      } = await import('../services/aiService');

      const extractedPreferences = await extractJobPreferences(resumeCleaned);
      const normalizedPreferences =
        options?.preferencesOverride ??
        normalizeUserPreferences({
          remoteOnly:
            extractedPreferences?.jobType === 'remote' ||
            profile?.preferences?.remoteOnly,
          salaryFloor:
            extractedPreferences?.minSalary ??
            profile?.preferences?.salaryFloor ??
            null,
          locations: extractedPreferences?.location
            ? [extractedPreferences.location]
            : profile?.preferences?.locations || [],
        });
      const legacyPreferenceFields =
        syncLegacyPreferenceFields(normalizedPreferences);
      toast.success("Job preferences automatically configured!");

      const extractedStructuredProfile = await extractResume(resumeCleaned);
      if (extractedStructuredProfile) {
        structuredProfile = extractedStructuredProfile;
        toast.success("Structured resume profile created!");
      }

      const extractedResumeSummary = await summarizeResume(resumeCleaned);
      if (extractedResumeSummary) {
        resumeSummary = extractedResumeSummary;
      }

      if (!options?.careerPathsOverride || options.careerPathsOverride.length === 0) {
        const suggestedPaths = await suggestCareerPaths(
          resumeCleaned,
          profile?.antiSlopEnabled !== false
        );
        if (suggestedPaths && suggestedPaths.length > 0) {
          paths = suggestedPaths;
          toast.success("Career paths automatically detected!");
        }
      }

      const resumeAnalysis = await analyzeResume(resumeCleaned, paths);
      if (resumeAnalysis) {
        analysis = resumeAnalysis;
        toast.success("Resume analysis complete!");
      }

      await updateProfile({
        resumeRaw,
        resumeCleaned,
        resumeSummary,
        structuredProfile,
        preferences: normalizedPreferences,
        resumeText: resumeCleaned,
        careerPaths: paths,
        resumeAnalysis: analysis,
        jobType: legacyPreferenceFields.jobType,
        minSalary: legacyPreferenceFields.minSalary,
        location: legacyPreferenceFields.location,
      });

      if (options?.showSuccessToast !== false) {
        toast.success(options?.successMessage || "Resume processed successfully!");
      }
      options?.onSuccess?.();
      return true;
    } catch (error: any) {
      if (error.message === 'AI_QUOTA_EXCEEDED') {
        toast.error('AI Quota Exceeded: Your OpenRouter account has run out of credits. Please add funds to analyze your resume.', { duration: 6000 });
      } else {
        console.error("Error saving resume to Firestore:", error);
        toast.error(`Failed to save resume: ${error.message || 'Unknown error'}`);
      }
      return false;
    } finally {
      setAnalyzingResume(false);
    }
  };

  const handleFileUpload = async (file: File | undefined, onSuccess: () => void) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    setAnalyzingResume(true);
    let text = '';
    
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.md')) {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        // @ts-ignore
        const pdfWorkerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // @ts-ignore
          const pageText = textContent.items.map((item) => item.str).join(' ');
          text += pageText + '\n';
        }
      } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        toast.error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
        setAnalyzingResume(false);
        return;
      }
    } catch (err) {
      console.error("Error parsing file", err);
      toast.error("Could not parse the file. Please try a different format.");
      setAnalyzingResume(false);
      return;
    }

    await processResumeText(text, {
      onSuccess,
      successMessage: 'Resume uploaded successfully!',
    });
  };

  return { analyzingResume, handleFileUpload, processResumeText };
}
