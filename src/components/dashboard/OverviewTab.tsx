import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, TrendingUp, Briefcase, Globe, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OverviewTabProps {
  stats: { saved: number; applied: number; interviewing: number };
  statsLoading: boolean;
  profile: any;
  setActiveTab: (tab: 'overview' | 'matches') => void;
}

const COLORS = ['#b8693d', '#3a3a3a', '#898989'];

export function OverviewTab({ stats, statsLoading, profile, setActiveTab }: OverviewTabProps) {
  const chartData = [
    { name: 'Saved', value: stats.saved },
    { name: 'Applied', value: stats.applied },
    { name: 'Interviews', value: stats.interviewing }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 overflow-y-auto pb-8 min-h-0 space-y-8"
    >
      {/* 3D-effect Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-foreground-muted" /> Application Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] w-full pt-4">
            {statsLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-foreground-muted" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex-1 border-border bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">Target Career Paths</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile?.careerPaths?.map((path: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-surface-hover text-foreground text-xs font-medium rounded-md border border-border">
                    {path}
                  </span>
                )) || <span className="text-foreground-muted text-sm">No paths defined</span>}
              </div>
            </CardContent>
          </Card>
          
          <Card className="flex-1 border-border bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">Work Preference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium capitalize text-foreground">
                {profile?.jobType || 'Both'}
              </div>
              {profile?.location && profile.jobType !== 'remote' && (
                <div className="text-sm text-foreground-muted mt-1 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> {profile.location}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-border-strong flex-shrink-0" />
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
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-border-strong flex-shrink-0" />
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
                  <span className="text-2xl font-medium text-foreground">
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
                      <span className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-border-strong flex-shrink-0" />
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-border bg-surface p-8 text-center">
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
