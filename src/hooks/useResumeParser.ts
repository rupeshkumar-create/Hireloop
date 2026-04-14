import { useState } from 'react';
import { toast } from 'sonner';
import { suggestCareerPaths } from '../services/aiService';

export function useResumeParser(updateProfile: (data: any) => Promise<void>, profile: any) {
  const [analyzingResume, setAnalyzingResume] = useState(false);

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

    try {
      let paths = profile?.careerPaths || [];
      let analysis = profile?.resumeAnalysis;
      let jobType = profile?.jobType || 'remote';
      let minSalary = profile?.minSalary || null;

      if (text.trim()) {
        toast.info("Analyzing resume for career paths and preferences...");
        const suggestedPaths = await suggestCareerPaths(text);
        if (suggestedPaths && suggestedPaths.length > 0) {
          paths = suggestedPaths;
          toast.success("Career paths automatically detected!");
        }
        
        const { analyzeResume, extractJobPreferences } = await import('../services/aiService');
        
        // Extract Job Preferences (Type & Salary)
        const preferences = await extractJobPreferences(text);
        if (preferences) {
          jobType = preferences.jobType;
          minSalary = preferences.minSalary;
          toast.success("Job preferences automatically configured!");
        }

        // Analyze Resume
        const resumeAnalysis = await analyzeResume(text, paths);
        if (resumeAnalysis) {
          analysis = resumeAnalysis;
          toast.success("Resume analysis complete!");
        }
      }

      await updateProfile({
        resumeText: text,
        careerPaths: paths,
        resumeAnalysis: analysis,
        jobType,
        minSalary,
      });
      toast.success("Resume uploaded successfully!");
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error saving resume to Firestore:", error);
      toast.error(`Failed to save resume: ${error.message || 'Unknown error'}`);
    } finally {
      setAnalyzingResume(false);
    }
  };

  return { analyzingResume, handleFileUpload };
}
