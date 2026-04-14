import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Briefcase, MapPin, DollarSign, Calendar, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Job, SortOption } from '../../types/dashboard';

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
    <div className="flex-1 flex flex-col overflow-hidden w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 font-display">Your Daily Matches</h1>
          <p className="text-zinc-500 text-sm mt-1">Curated jobs based on your preferences and resume.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 w-full">
        <div className="grid grid-cols-3 gap-3 flex-1 w-full">
          <Input 
            placeholder="Filter by company..." 
            value={filterCompany} 
            onChange={(e) => setFilterCompany(e.target.value)} 
            className="h-9 text-sm w-full"
          />
          <Input 
            placeholder="Filter by location..." 
            value={filterLocation} 
            onChange={(e) => setFilterLocation(e.target.value)} 
            className="h-9 text-sm w-full"
          />
          <Input 
            placeholder="Filter by salary..." 
            value={filterSalary} 
            onChange={(e) => setFilterSalary(e.target.value)} 
            className="h-9 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-zinc-400" />
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-9 text-sm border border-zinc-200 rounded-md px-3 bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-900"
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
            <Loader2 className="h-8 w-8 animate-spin text-zinc-900" />
            <p className="text-zinc-500 font-medium animate-pulse">Scouring the web for the best opportunities...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No jobs found matching your filters.</div>
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
                  className={`cursor-pointer transition-all hover:border-zinc-400 ${selectedJob === job ? 'border-zinc-900 ring-1 ring-zinc-900 shadow-md' : 'border-zinc-200 shadow-sm'}`}
                  onClick={() => { setSelectedJob(job); setAiAction(null); }}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-zinc-900 font-display text-lg">{job.title}</h3>
                        <p className="text-zinc-600 font-medium">{job.company}</p>
                      </div>
                      {job.matchScore !== undefined && (
                        <Badge variant={job.matchScore >= 80 ? 'success' : 'secondary'} className="ml-2 font-semibold">
                          {job.matchScore}% Match
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-zinc-500">
                      <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4 text-zinc-400" /> {job.location}</div>
                      <div className="flex items-center"><DollarSign className="mr-1.5 h-4 w-4 text-zinc-400" /> {job.salary}</div>
                      {job.datePosted && (
                        <div className="flex items-center"><Calendar className="mr-1.5 h-4 w-4 text-zinc-400" /> {new Date(job.datePosted).toLocaleDateString()}</div>
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
