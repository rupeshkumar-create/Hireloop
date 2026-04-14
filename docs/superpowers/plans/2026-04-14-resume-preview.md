# Resume Preview & Download Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an accurate "Preview Modal" for the generated resume that looks exactly like an A4 paper, ensuring that what the user sees in the preview is identical to the PDF they download.

**Architecture:** 
1. Create a `ResumePreviewModal` component that renders the markdown inside a fixed-width, A4-styled container.
2. Provide a single "Preview & Download" button on the job card instead of three raw download buttons.
3. Update `html2pdf.js` logic to capture this specific A4 container with high fidelity.

**Tech Stack:** React, Tailwind, framer-motion, html2pdf.js

---

### Task 1: Create the ResumePreviewModal Component

**Files:**
- Create: `src/components/dashboard/ResumePreviewModal.tsx`

- [ ] **Step 1: Write the Modal Component**
```tsx
import React, { useRef } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import html2pdf from 'html2pdf.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { Button } from '../ui/button';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  resumeText: string;
  companyName: string;
}

export function ResumePreviewModal({ isOpen, onClose, resumeText, companyName }: Props) {
  const resumeRef = useRef<HTMLDivElement>(null);

  const downloadPdf = () => {
    if (!resumeRef.current) return;
    const opt = {
      margin:       0.5,
      filename:     `Tailored_Resume_${companyName.replace(/\\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(resumeRef.current).save();
  };

  const downloadDocx = () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: resumeText.split('\\n').map(line => new Paragraph({ children: [new TextRun(line)] }))
      }]
    });
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Tailored_Resume_${companyName.replace(/\\s+/g, '_')}.docx`);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-100 w-full max-w-4xl h-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center">
                <FileText className="mr-2 h-5 w-5 text-zinc-500" /> Resume Preview
              </h2>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="outline" onClick={downloadDocx}>Download DOCX</Button>
                <Button size="sm" className="bg-zinc-900 text-white" onClick={downloadPdf}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* A4 Preview Area */}
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-zinc-100">
              <div 
                ref={resumeRef}
                className="bg-white shadow-lg w-full max-w-[800px] min-h-[1056px] p-10 md:p-14 markdown-body prose prose-sm sm:prose-base text-zinc-800"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                <ReactMarkdown>{resumeText}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

### Task 2: Integrate the Modal into JobTracker

**Files:**
- Modify: `src/pages/JobTracker.tsx`

- [ ] **Step 1: Import and state management**
```tsx
import { ResumePreviewModal } from '../components/dashboard/ResumePreviewModal';
// Inside JobTracker component:
const [previewResumeData, setPreviewResumeData] = useState<{text: string, company: string} | null>(null);
```

- [ ] **Step 2: Replace raw download buttons with Preview button**
Around line 506 (inside the Tailored Resume section):
```tsx
// Remove the 3 raw download buttons and replace with:
                          {job.tailoredResume && !editingResume && (
                            <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => setPreviewResumeData({text: job.tailoredResume!, company: job.company})}>
                              <FileText className="mr-2 h-3 w-3" /> Preview & Download
                            </Button>
                          )}
```

- [ ] **Step 3: Add Modal to the bottom of the component tree**
```tsx
// Right before the final </div> return
      <ResumePreviewModal 
        isOpen={!!previewResumeData}
        onClose={() => setPreviewResumeData(null)}
        resumeText={previewResumeData?.text || ''}
        companyName={previewResumeData?.company || ''}
      />
    </div>
  );
```

- [ ] **Step 4: Clean up unused imports/functions**
Remove `html2pdf`, `Document`, `Packer`, `saveAs` from `JobTracker.tsx` as they are now handled inside the modal component.
Remove the old `downloadPdf`, `downloadDocx`, and `downloadResume` functions from `JobTracker.tsx`.
