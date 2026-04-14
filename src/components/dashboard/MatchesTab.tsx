import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Briefcase, MapPin, DollarSign, Calendar, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Job, SortOption } from '../../types/dashboard';
import { cn } from '../../lib/utils';

interface MatchesTabProps {
  jobs: Job[];
  loadingJobs: boolean;
  fetchJobs: (force?: boolean) => void;
  filterCompany: string;
  setFilterCompany: (v: string) => void;
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  filterSalary: string;
  setFilterSalary: (v: string) => void;
  sortBy: SortOption;
  setSortBy: (v: SortOption) => void;
  selectedJob: Job | null;
  setSelectedJob: (j: Job | null) => void;
  setAiAction: (v: any) => void;
}

export function MatchesTab({
  jobs, loadingJobs, fetchJobs,
  filterCompany, setFilterCompany,
  filterLocation, setFilterLocation,
  filterSalary, setFilterSalary,
  sortBy, setSortBy,
  selectedJob, setSelectedJob, setAiAction
}: MatchesTabProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl tracking-tight text-foreground">Your Daily Matches</h2>
          <p className="mt-1 text-sm text-foreground-muted">Curated jobs based on your preferences and resume.</p>
        </div>
      </div>

      <div className="mb-4 flex w-full flex-shrink-0 flex-col gap-3 rounded-[28px] border border-border bg-surface p-4 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="grid flex-1 w-full grid-cols-1 gap-3 md:grid-cols-3">
          <Input 
            placeholder="Filter by company..." 
            value={filterCompany} 
            onChange={(e) => setFilterCompany(e.target.value)} 
            className="w-full text-sm"
          />
          <Input 
            placeholder="Filter by location..." 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)} 
            className="w-full text-sm"
          />
          <Input 
            placeholder="Filter by salary..." 
            value={filterSalary} 
            onChange={(e) => setFilterSalary(e.target.value)} 
            className="w-full text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-foreground-muted" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground-muted outline-none focus:ring-2 focus:ring-[#3898ec]"
          >
            <option value="matchScore">Match Score</option>
            <option value="datePosted">Newest First</option>
            <option value="company">Company (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3 pb-8">
        {loadingJobs ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            <p className="text-foreground-muted font-medium animate-pulse">Scouring the web for the best opportunities...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-foreground-muted">No jobs found matching your filters.</div>
        ) : (
          <AnimatePresence>
            {jobs.map((job, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                <Card 
                  className={cn(
                    "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-border-strong",
                    selectedJob === job ? "border-border-strong ring-1 ring-ring" : ""
                  )}
                  onClick={() => { setSelectedJob(job); setAiAction(null); }}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-foreground font-display text-lg">{job.title}</h3>
                        <p className="text-foreground-muted font-medium">{job.company}</p>
                      </div>
                      {job.matchScore !== undefined && (
                        <Badge variant={job.matchScore >= 80 ? 'success' : 'secondary'} className="ml-2 font-semibold">
                          {job.matchScore}% Match
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-foreground-muted">
                      <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-foreground-muted" /> {job.location}</div>
                      <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-foreground-muted" /> {job.salary}</div>
                      {job.datePosted && (
                        <div className="flex items-center"><Calendar className="mr-1.5 h-4 w-4 text-foreground-muted" /> {new Date(job.datePosted).toLocaleDateString()}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
