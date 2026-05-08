import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Moon, Sun, ShieldCheck, Zap, Repeat, Layout, Terminal } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const marquee = [
  'Remote · Worldwide',
  '50+ Resume Signals',
  'Apify Job Discovery',
  'ATS Integrity Checks',
  'Cover Letter Drafts',
  'Daily Fresh Matches',
  'Learning Loop',
  'Job Tracker Built-in',
];

const features = [
  {
    title: 'Hard validation before AI scoring',
    tag: 'Validator',
    icon: ShieldCheck,
    desc: "Deterministic rules reject listings that fail remote, location, salary, freshness, or link checks. AI only helps after a job has cleared the practical filters.",
  },
  {
    title: 'Resume-grounded match scores',
    tag: 'Matcher',
    icon: Zap,
    desc: 'The match score is derived from your actual resume text, career paths, seniority, skills, location preferences, and salary floor.',
  },
  {
    title: 'A system that learns from you',
    tag: 'Learning loop',
    icon: Repeat,
    desc: 'Every save, dismiss, application, and click becomes a signal for the next Scout cycle, without overriding your hard filters.',
  },
  {
    title: 'Application drafts on demand',
    tag: 'AI tasks',
    icon: Terminal,
    desc: 'Generate a tailored cover letter, resume variant, cold email, or interview prep set from a real job description when you need it.',
  },
  {
    title: 'Tracker built in',
    tag: 'Pipeline',
    icon: Layout,
    desc: 'Matched jobs flow into a clean tracker so your search does not become a spreadsheet graveyard by week two.',
  },
];

function JobMockup() {
  return (
    <div className="hs-job-stack" aria-hidden="true">
      <div className="hs-job-card back">
        <div className="flex items-center gap-3">
          <span className="hs-company-mark">LN</span>
          <div>
            <div className="text-xs text-[var(--hs-land-muted)]">Linear</div>
            <div className="text-sm font-semibold">Product Engineer</div>
          </div>
        </div>
      </div>
      <div className="hs-job-card mid">
        <div className="flex items-center gap-3">
          <span className="hs-company-mark">ST</span>
          <div>
            <div className="text-xs text-[var(--hs-land-muted)]">Stripe</div>
            <div className="text-sm font-semibold">Operations Manager</div>
          </div>
        </div>
      </div>
      <div className="hs-job-card front">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="hs-company-mark">VR</span>
            <div>
              <div className="text-xs text-[var(--hs-land-muted)]">Vercel</div>
              <div className="text-[15px] font-semibold">Customer Success Manager</div>
            </div>
          </div>
          <span className="hs-score" style={{ '--score': '94%' } as React.CSSProperties}>94</span>
        </div>
        <div className="hs-tags mb-4">
          <span className="hs-tag">Remote · Global</span>
          <span className="hs-tag">Customer Success</span>
          <span className="hs-tag">Operations</span>
          <span className="hs-tag">$60k+</span>
        </div>
        {[
          ['Resume fit', '91%'],
          ['Seniority', '88%'],
          ['ATS quality', '74%'],
        ].map(([label, width]) => (
          <div key={label} className="mb-3 flex items-center gap-3">
            <span className="w-24 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--hs-land-muted)]">{label}</span>
            <span className="h-[3px] flex-1 bg-[var(--hs-land-border)]">
              <span className="block h-full bg-[var(--hs-land-fg)]" style={{ width }} />
            </span>
          </div>
        ))}
        <div className="mt-5 flex gap-5 border-t border-[var(--hs-land-border)] pt-4 text-xs text-[var(--hs-land-muted)]">
          <span>Posted <strong className="text-[var(--hs-land-fg)]">2 days ago</strong></span>
          <span>Applications <strong className="text-[var(--hs-land-fg)]">Active</strong></span>
          <span>ATS <strong className="text-[var(--hs-land-fg)]">Clean</strong></span>
        </div>
        <div className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--hs-land-muted)]">
          <span className="hs-dot" />
          Agent scanning now
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="hs-landing">
      <nav className="hs-land-nav">
        <div className="hs-land-container hs-land-nav-inner">
          <Link to="/" className="hs-land-wordmark text-lg text-[var(--hs-land-fg)] no-underline">Hireschema</Link>
          <div className="flex items-center gap-6">
            <a href="#how" className="hidden text-sm text-[var(--hs-land-muted)] no-underline transition hover:text-[var(--hs-land-fg)] md:inline">How it works</a>
            <a href="#features" className="hidden text-sm text-[var(--hs-land-muted)] no-underline transition hover:text-[var(--hs-land-fg)] md:inline">Features</a>
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hs-land-border)] text-[var(--hs-land-muted)] transition hover:bg-[var(--hs-land-surface)] hover:text-[var(--hs-land-fg)]"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden text-sm text-[var(--hs-land-muted)] no-underline transition hover:text-[var(--hs-land-fg)] sm:inline">Sign in</Link>
            <Link to="/login" className="hs-land-cta !px-5 !py-2 !text-[13px]">Start free</Link>
          </div>
        </div>
      </nav>

      <section className="hs-land-hero">
        <div className="hs-land-container">
          <div className="hs-land-hero-grid">
            <div className="max-w-[560px]">
              <p className="hs-land-eyebrow mb-7">AI Recruiting Agent · Remote Only</p>
              <h1 className="hs-display hs-display-hero mb-6">
                The quiet agent<br />
                that finds your<br />
                <em className="text-[var(--hs-land-accent)]">next</em> remote role.
              </h1>
              <p className="mb-10 max-w-[460px] text-lg leading-8 text-[var(--hs-land-muted)]">
                Upload your resume. Hireschema scouts job sources daily, scores every match against your profile, and delivers only the roles worth your attention.
              </p>
              <div className="flex flex-wrap items-center gap-5">
                <Link to="/login" className="hs-land-cta">
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--hs-land-muted)]">No credit card required</span>
              </div>
            </div>
            <JobMockup />
          </div>
        </div>
      </section>

      <div className="hs-marquee" aria-hidden="true">
        <div className="hs-marquee-inner">
          {[...marquee, ...marquee].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
      </div>

      <section className="border-b border-[var(--hs-land-border)]">
        <div className="hs-land-container hs-land-stats">
          <div className="hs-land-stat pl-0">
            <span className="hs-display block text-[clamp(36px,5vw,56px)] leading-none">100%</span>
            <span className="hs-land-eyebrow mt-3 block">Remote-first search</span>
          </div>
          <div className="hs-land-stat">
            <span className="hs-display block text-[clamp(36px,5vw,56px)] leading-none">50+</span>
            <span className="hs-land-eyebrow mt-3 block">Resume signals parsed</span>
          </div>
          <div className="hs-land-stat pr-0">
            <span className="hs-display block text-[clamp(36px,5vw,56px)] leading-none">Daily</span>
            <span className="hs-land-eyebrow mt-3 block">Fresh matches</span>
          </div>
        </div>
      </section>

      <section id="how" className="hs-land-section">
        <div className="hs-land-container">
          <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <p className="hs-land-eyebrow mb-3">The autonomous pipeline</p>
              <h2 className="hs-display hs-display-section">Three steps.<br />Zero noise.</h2>
            </div>
            <p className="max-w-xs text-lg leading-8 text-[var(--hs-land-muted)]">The agent runs on its own. You show up when there is something worth seeing.</p>
          </div>
          <div className="hs-land-steps">
            <div className="hs-land-step pl-0">
              <span className="hs-land-eyebrow mb-6 block">01 / Upload</span>
              <h3 className="hs-display mb-4 text-2xl">Feed the agent your resume</h3>
              <p className="text-[15px] leading-7 text-[var(--hs-land-muted)]">Hireschema parses your experience into semantic signals: skills, seniority, preferred domains, location, salary floor, and career trajectory.</p>
            </div>
            <div className="hs-land-step">
              <span className="hs-land-eyebrow mb-6 block">02 / Scout</span>
              <h3 className="hs-display mb-4 text-2xl">The agent searches daily</h3>
              <p className="text-[15px] leading-7 text-[var(--hs-land-muted)]">Scout pulls live listings, deduplicates, and applies deterministic filters before ranking anything against your profile.</p>
            </div>
            <div className="hs-land-step pr-0">
              <span className="hs-land-eyebrow mb-6 block">03 / Match</span>
              <h3 className="hs-display mb-4 text-2xl">You get the top results</h3>
              <p className="text-[15px] leading-7 text-[var(--hs-land-muted)]">The final shortlist blends fit, freshness, company signal, salary, and your learning history into a calm dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="hs-land-section bg-[var(--hs-land-surface)] !py-24">
        <div className="hs-land-container hs-feature-grid">
          <div className="md:sticky md:top-32 h-fit">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="hs-land-eyebrow mb-5 text-[var(--hs-land-accent)]">Why Hireschema</p>
              <h2 className="hs-display text-[clamp(28px,4vw,42px)] font-semibold leading-[1.15] mb-6">
                The interface is calm.<br />
                <span className="text-[var(--hs-land-accent)]">The agent is <span className="italic font-serif">not</span>.</span>
              </h2>
              <p className="max-w-sm text-[15px] leading-relaxed text-[var(--hs-land-muted)]">
                While you are busy, the engine is running Scout queries, validating listings, scoring fits, and building a ranked shortlist.
              </p>
              <div className="mt-12 hidden md:block">
                <div className="h-px w-24 bg-[var(--hs-land-border)] mb-4" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--hs-land-muted)]">
                  Autonomous Job Discovery
                </p>
              </div>
            </motion.div>
          </div>
          <div className="space-y-4">
            {features.map((feature, idx) => (
              <motion.article 
                key={feature.title} 
                className={`hs-feature-item !py-24 ${idx === 0 ? 'border-t-0 pt-0' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="flex items-start gap-5">
                  <div className="mt-1 p-2.5 rounded-lg border border-[var(--hs-land-border)] bg-[var(--hs-land-bg)]">
                    <feature.icon className="h-5 w-5 text-[var(--hs-land-accent)]" />
                  </div>
                  <div>
                    <div className="hs-feature-tag mb-4">{feature.tag}</div>
                    <h3 className="hs-display text-2xl font-semibold mb-4 group-hover:text-[var(--hs-land-accent)] transition-colors tracking-tight">{feature.title}</h3>
                    <p className="text-[15px] leading-relaxed text-[var(--hs-land-muted)] max-w-xl">{feature.desc}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="hs-land-section">
        <div className="hs-land-container">
          <p className="hs-land-eyebrow mb-3">Pricing</p>
          <h2 className="hs-display hs-display-section">Start free.<br />Scale when ready.</h2>
          <div className="grid grid-cols-2 gap-8 mt-14">
            <div className="hs-price-card relative overflow-hidden border border-[var(--hs-land-border)] p-8">
              <span className="hs-land-eyebrow mb-5 block">Free</span>
              <div className="hs-display mb-2 text-5xl font-semibold">$0</div>
              <p className="mb-8 text-sm text-[var(--hs-land-muted)]">forever · no card needed</p>
              <ul className="mb-12 space-y-4 text-[14px] leading-relaxed text-[var(--hs-land-muted)]">
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Up to 5 matched jobs per day</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Resume parsing and profile setup</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Daily job refresh cycle</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Built-in job tracker</li>
              </ul>
              <Link to="/login" className="hs-land-cta w-full !bg-transparent !text-[var(--hs-land-fg)] hover:!bg-[var(--hs-land-surface)]">Get started</Link>
            </div>
            <div className="hs-price-card relative overflow-hidden bg-[var(--hs-land-bg)]">
              <div className="absolute top-0 right-0 p-4">
                <span className="hs-pill hs-pill-success text-[9px]">Most Popular</span>
              </div>
              <span className="hs-land-eyebrow mb-5 block text-[var(--hs-land-accent)]">Pro</span>
              <div className="hs-display mb-2 text-5xl font-semibold">$19</div>
              <p className="mb-8 text-sm text-[var(--hs-land-muted)]">per month · cancel anytime</p>
              <ul className="mb-12 space-y-4 text-[14px] leading-relaxed text-[var(--hs-land-muted)]">
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Unlimited daily matches</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> AI cover letter and resume tailoring</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Interview prep per role</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Career path recommendations</li>
                <li className="flex items-center gap-3"><Zap className="h-3.5 w-3.5 text-[var(--hs-land-accent)]" /> Daily email digest of top matches</li>
              </ul>
              <Link to="/login" className="hs-land-cta w-full">Start Pro trial</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="hs-land-section">
        <div className="hs-land-container flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <p className="hs-land-eyebrow mb-4">Ready to start</p>
            <h2 className="hs-display hs-display-section">Your next role is out there.<br />The agent will find it.</h2>
          </div>
          <div>
            <Link to="/login" className="hs-land-cta">
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-sm text-[var(--hs-land-muted)]">No credit card required.</p>
          </div>
        </div>
      </section>

      <footer className="hs-land-container flex flex-col justify-between gap-4 py-10 text-sm text-[var(--hs-land-muted)] md:flex-row">
        <Link to="/" className="hs-land-wordmark text-[var(--hs-land-fg)] no-underline">Hireschema</Link>
        <div className="flex gap-5">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/login">Sign in</Link>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">© 2026 Hireschema</span>
      </footer>
    </div>
  );
}
