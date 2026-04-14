import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useResumeParser } from '../../hooks/useResumeParser';

interface ResumeUploaderProps {
  updateProfile: (data: any) => Promise<void>;
  profile: any;
  onSuccess: () => void;
}

export function ResumeUploader({ updateProfile, profile, onSuccess }: ResumeUploaderProps) {
  const { analyzingResume, handleFileUpload } = useResumeParser(updateProfile, profile);

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-6">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background p-6 rounded-full"
      >
        <FileText className="h-16 w-16 text-foreground-muted" />
      </motion.div>
      <div>
        <h2 className="text-3xl font-bold text-foreground font-display mb-2">Welcome to Hireschema</h2>
        <p className="text-foreground-muted text-lg">You just need to upload your resume once to get started. We'll automatically analyze it and find the best matches.</p>
      </div>
      
      <Card className="w-full mt-8 border-dashed border-2 border-border">
        <CardContent className="pt-6 pb-8 flex flex-col items-center justify-center">
          {analyzingResume ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              <p className="text-foreground-muted font-medium">Analyzing your resume...</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-foreground-muted mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Upload Resume</h3>
              <p className="text-sm text-foreground-muted mb-6">PDF, DOCX, or TXT (Max 5MB)</p>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => handleFileUpload(e.target.files?.[0], onSuccess)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button className="pointer-events-none">Select File</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
