import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Save, FileText, Mail, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import ReactMarkdown from 'react-markdown';

interface AssetEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'email' | 'resume' | 'cover' | 'interview';
  initialContent: string;
  onSave: (newContent: string) => Promise<void>;
  onAiImprove: (instruction: string) => Promise<void>;
  isAiLoading: boolean;
}

export function AssetEditorModal({
  isOpen, onClose, title, type, initialContent, onSave, onAiImprove, isAiLoading
}: AssetEditorModalProps) {
  const [content, setContent] = useState(initialContent);
  const [instruction, setInstruction] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(content);
    setIsSaving(false);
  };

  const handleImprove = async () => {
    if (!instruction.trim()) return;
    await onAiImprove(instruction);
    setInstruction('');
  };

  // Sync content if it changes from outside (e.g. after AI improve finishes)
  React.useEffect(() => {
    if (initialContent !== content && !isAiLoading) {
      setContent(initialContent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, isAiLoading]);

  const Icon = type === 'email' ? Mail : type === 'resume' ? FileText : MessageSquare;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.55)] backdrop-blur-md p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex h-[85vh] w-[80vw] max-w-[1200px] flex-col overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border bg-background/50 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-hover text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-medium text-foreground">{title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Close editor"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:bg-foreground hover:text-surface hover:shadow-md focus:outline-none focus:ring-2 focus:ring-foreground/40"
                >
                  <X className="h-5 w-5" strokeWidth={2.25} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Side: AI Assistant */}
              <div className="w-1/3 flex flex-col border-r border-border bg-surface-hover/30 p-6">
                <div className="flex items-center gap-2 mb-4 text-foreground-muted font-medium">
                  <Sparkles className="h-5 w-5" />
                  <h3>AI Copilot</h3>
                </div>
                <p className="text-sm text-foreground-muted mb-4">
                  Tell the AI how you want to modify this document. It will automatically rewrite the content on the right.
                </p>
                <div className="space-y-3 flex-1">
                  <textarea
                    className="w-full h-32 rounded-lg border border-border bg-background p-3 text-sm resize-none outline-none transition-[border-color,box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:border-[var(--ember-400)] focus-visible:shadow-[var(--ember-glow)]"
                    placeholder="e.g., Make it shorter, tone down the enthusiasm, highlight my React skills..."
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {['Make it shorter', 'More professional', 'Focus on leadership', 'Fix grammar'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setInstruction(preset)}
                        className="text-xs px-3 py-1.5 rounded-md border border-border bg-background text-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  disabled={!instruction.trim() || isAiLoading}
                  onClick={handleImprove}
                >
                  {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {isAiLoading ? 'Improving...' : 'Apply Changes'}
                </Button>
              </div>

              {/* Right Side: Advanced Editor */}
              <div className="w-2/3 flex flex-col bg-background relative">
                {isAiLoading && (
                  <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                <div className="flex items-center justify-between border-b border-border px-6 py-2 bg-surface">
                  <div className="flex rounded-full border border-border bg-background p-1">
                    <button
                      className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors border border-transparent ${viewMode === 'edit' ? 'bg-[var(--ember-tint)] border-[var(--ember-400)] text-foreground' : 'text-foreground-muted hover:text-foreground'}`}
                      onClick={() => setViewMode('edit')}
                    >
                      Edit
                    </button>
                    <button
                      className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors border border-transparent ${viewMode === 'preview' ? 'bg-[var(--ember-tint)] border-[var(--ember-400)] text-foreground' : 'text-foreground-muted hover:text-foreground'}`}
                      onClick={() => setViewMode('preview')}
                    >
                      Preview
                    </button>
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={isSaving || isAiLoading}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  {viewMode === 'edit' ? (
                    <textarea
                      className="absolute inset-0 w-full h-full p-6 text-sm font-mono leading-relaxed bg-background text-foreground resize-none focus:outline-none focus:ring-0 border-none"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Start typing or use the AI Copilot..."
                      spellCheck="false"
                    />
                  ) : (
                    <div className={`absolute inset-0 w-full h-full p-8 overflow-y-auto ${type === 'resume' ? 'light bg-white text-black print:p-0' : 'bg-background text-foreground'}`}>
                      <div className={`markdown-body prose max-w-none ${type === 'resume' ? 'prose-zinc' : 'prose-sm prose-invert dark:prose-invert'}`}>
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
