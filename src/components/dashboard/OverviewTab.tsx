import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, TrendingUp, Briefcase, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';

interface OverviewTabProps {
  stats: { saved: number; applied: number; interviewing: number };
  statsLoading: boolean;
  profile: any;
  setActiveTab: (tab: 'overview' | 'matches') => void;
}

export function OverviewTab({ stats, statsLoading, profile, setActiveTab }: OverviewTabProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 overflow-y-auto pb-8 min-h-0"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">Saved Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium text-foreground">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.saved}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">Applications Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium text-foreground">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.applied}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium text-foreground">
              {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.interviewing}
            </div>
          </CardContent>
        </Card>
      </div>

      {profile?.resumeAnalysis ? (
        <div className="space-y-6">
          <h3 className="text-2xl text-foreground">Resume Analysis</h3>
          <p className="text-foreground-muted">{profile.resumeAnalysis.summary}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border bg-surface">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.resumeAnalysis.strengths.map((strength: string, i: number) => (
                    <li key={i} className="text-sm text-foreground-muted flex items-start">
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="leading-relaxed">{strength}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border bg-surface">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.resumeAnalysis.improvements.map((improvement: string, i: number) => (
                    <li key={i} className="text-sm text-foreground-muted flex items-start">
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="leading-relaxed">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Remote Readiness Card */}
          {profile.resumeAnalysis.remoteReadiness && (
            <Card className="border-border bg-surface">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" /> Remote Readiness
                  </CardTitle>
                  <span className="text-2xl font-bold text-foreground">
                    {profile.resumeAnalysis.remoteReadiness.score}/100
                  </span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${profile.resumeAnalysis.remoteReadiness.score}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {profile.resumeAnalysis.remoteReadiness.tips.map((tip: string, i: number) => (
                    <li key={i} className="text-sm text-foreground-muted flex items-start">
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-2xl rounded-[28px] border border-border bg-surface p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.05)]">
          <Briefcase className="h-12 w-12 text-foreground-muted mx-auto mb-4" />
          <h3 className="mb-2 text-2xl text-foreground">Ready to find your next role?</h3>
          <p className="text-foreground-muted mb-6">We've analyzed your resume and are ready to find the best matches for you. Check your daily matches to see what we found.</p>
          <Button variant="action" onClick={() => setActiveTab('matches')} size="lg">
            View Daily Matches
          </Button>
        </div>
      )}
    </motion.div>
  );
}
