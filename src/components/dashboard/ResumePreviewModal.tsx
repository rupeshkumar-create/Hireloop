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
      filename:     `Tailored_Resume_${companyName.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };
    html2pdf().set(opt).from(resumeRef.current).save();
  };

  const downloadDocx = () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: resumeText.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] }))
      }]
    });
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Tailored_Resume_${companyName.replace(/\s+/g, '_')}.docx`);
    });
  };

  if (!isOpen) return null;

  return (
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
  );
}