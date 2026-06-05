import { useState } from 'react';
import { toast } from 'sonner';
import { suggestCareerPaths } from '../services/aiService';
import { generateCareerPathSuggestions } from '../services/careerPathGenerator';
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

      if (!resumeCleaned || resumeCleaned.length < 10) {
        console.error('Resume extraction failed or content too short:', { 
          rawLength: rawText.length, 
          cleanedLength: resumeCleaned?.length 
        });
        toast.error('Could not extract readable text from this file. Please try a different format or ensure the file is not a scanned image.');
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
      // Deterministic backfill — if the AI didn't pick out a location, scan
      // the resume header ourselves. Without a location set, remote-region
      // eligibility (e.g. "filter out US-only roles for an India user")
      // can't run downstream, so this is a critical safety net.
      const { extractLocationFromResume } = await import('../services/remoteEligibility');
      const regexLocation = extractLocationFromResume(resumeCleaned);
      const resolvedLocation =
        (extractedPreferences?.location && extractedPreferences.location.trim()) ||
        regexLocation.rawLabel ||
        profile?.preferences?.locations?.[0] ||
        '';
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
          locations: resolvedLocation ? [resolvedLocation] : profile?.preferences?.locations || [],
        });
      const legacyPreferenceFields =
        syncLegacyPreferenceFields(normalizedPreferences);
      toast.success("Job preferences automatically configured!");

      let extractedStructuredProfile = await extractResume(resumeCleaned);
      let displayName = profile?.displayName;

      if (extractedStructuredProfile) {
        structuredProfile = extractedStructuredProfile;
        toast.success("Structured resume profile created!");
        
        // Use extracted name as source of truth if available
        if (extractedStructuredProfile.fullName && extractedStructuredProfile.fullName.length > 2) {
          displayName = extractedStructuredProfile.fullName;
          toast.success(`Profile name updated to: ${displayName}`);
        }
      }

      const extractedResumeSummary = await summarizeResume(resumeCleaned);
      if (extractedResumeSummary) {
        resumeSummary = extractedResumeSummary;
      }

      let careerPathSuggestions = profile?.careerPathSuggestions;
      let selectedCareerPathId = profile?.selectedCareerPathId;

      // Always generate new career paths for a new resume upload
      if (!options?.careerPathsOverride || options.careerPathsOverride.length === 0) {
        console.log('Generating career path suggestions for resume...');
        const suggestedPaths = await generateCareerPathSuggestions(
          resumeCleaned,
          profile?.antiSlopEnabled !== false
        );
        console.log('Suggested paths received:', suggestedPaths);
        
        if (suggestedPaths && suggestedPaths.length > 0) {
          paths = suggestedPaths.map(p => p.title);
          careerPathSuggestions = suggestedPaths;
          selectedCareerPathId = suggestedPaths[0].id;
          console.log('Updated paths list:', paths);
          toast.success("Career paths automatically detected!");
        } else {
          console.warn('No career paths were suggested by the AI.');
          toast.info("Could not auto-generate career paths. You can add them manually in settings.");
        }
      }

      const resumeAnalysis = await analyzeResume(resumeCleaned, paths);
      if (resumeAnalysis) {
        analysis = resumeAnalysis;
        toast.success("Resume analysis complete!");
      }

      console.log('Final profile update payload:', {
        resumeRaw: '...',
        resumeCleaned: '...',
        resumeSummary,
        structuredProfile,
        careerPaths: paths,
        displayName
      });

      await updateProfile({
        resumeRaw,
        resumeCleaned,
        resumeSummary,
        structuredProfile,
        preferences: normalizedPreferences,
        resumeText: resumeCleaned,
        careerPaths: paths,
        careerPathSuggestions,
        selectedCareerPathId,
        displayName,
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
        const pdfjsLib = await import('pdfjs-dist');
        // unpkg is more reliable for specific versioned ESM modules than cdnjs
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Better text extraction that handles individual items and spacing
          const pageText = textContent.items
            .map((item: any) => {
              if ('str' in item) return item.str;
              return '';
            })
            .join(' ');
          
          fullText += pageText + '\n';
        }
        text = fullText;
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
    } catch (err: any) {
      console.error("Error parsing file", err);
      toast.error(`Could not parse the file: ${err.message || 'Unknown error'}. Please try a different format.`);
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
