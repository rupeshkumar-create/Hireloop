import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Briefcase, FileText, LayoutGrid, ArrowRight, CheckCircle2, Star, Globe, Terminal, Code2, Send, ChevronDown, Shield, Mail, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

const TypewriterText = ({ text, delay = 0 }: { text: string, delay?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const startTyping = () => {
      let i = 0;
      setDisplayedText('');
      interval = setInterval(() => {
        setDisplayedText(text.slice(0, i));
        i++;
        if (i > text.length) {
          clearInterval(interval);
          setTimeout(startTyping, 3000); // Restart after 3s
        }
      }, 30);
    };
    const initialTimer = setTimeout(startTyping, delay);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [text, delay]);

  return <span>{displayedText}<span className="animate-pulse">_</span></span>;
};

export function LandingPage() {
  const { user, loading } = useAuth();
  const { scrollYProgress } = useScroll();
  const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] flex-col justify-center overflow-hidden px-6 pb-24 pt-12 md:pt-20">
        <div className="relative z-10 mx-auto max-w-7xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="mb-6 text-5xl leading-[0.98] tracking-[-0.04em] text-foreground md:text-7xl lg:text-[5.5rem]">
              Your AI agent for <br className="hidden md:block" />
              <span className="text-foreground-muted">remote job hunting.</span>
            </h1>
            <p className="mx-auto mb-5 max-w-2xl text-lg leading-8 text-foreground-muted md:text-xl">
              Built exclusively for remote job seekers. Upload your resume and let the agent find, filter, and apply to remote opportunities worldwide - while you focus on what matters.
            </p>
            <p className="mb-10 inline-block rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground-muted">
              Not for in-office or on-site roles. 100% remote job opportunities only.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link to="/login">
                <Button variant="action" size="lg" className="h-14 px-8 text-base">
                  Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <span className="text-sm text-foreground-muted font-medium">Free to start. No credit card required.</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agent Workflow Section */}
      <section id="agent-workflow" className="relative border-y border-border bg-background py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-20 text-center">
            <h2 className="mb-4 text-3xl tracking-tight text-foreground md:text-5xl">The Autonomous Pipeline</h2>
            <p className="text-foreground-muted text-lg">Watch how the Hireschema agent handles the entire application lifecycle.</p>
          </div>

          <div className="space-y-32">
            {/* Step 1: Upload */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              <div className="order-2 md:order-1">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface font-mono text-xs font-medium tracking-[0.2em] text-foreground">01</div>
                <h3 className="mb-4 text-3xl text-foreground">Feed the Agent</h3>
                <p className="text-lg text-foreground-muted leading-relaxed mb-6">
                  Upload your master resume. The agent instantly parses your experience, extracts your core skills, and establishes a baseline profile to match against the global job market.
                </p>
                <ul className="space-y-3 text-foreground-muted font-medium">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-foreground" /> Extracts 50+ semantic data points</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-foreground" /> Identifies optimal career trajectories</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-foreground" /> Sets baseline for match-scoring</li>
                </ul>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="absolute inset-0 rotate-3 rounded-xl bg-border"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} 
                  className="relative z-10 flex h-80 flex-col items-center justify-center rounded-xl border border-border bg-surface p-8"
                >
                  <FileText className="h-16 w-16 text-foreground-muted mb-6" />
                  <div className="w-full space-y-3 max-w-xs mx-auto">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                      <motion.div 
                        animate={{ width: ["0%", "100%", "0%"] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="h-full bg-foreground"
                      ></motion.div>
                    </div>
                    <div className="flex justify-between text-xs text-foreground-muted font-mono">
                      <span>Analyzing document structure...</span>
                      <span>Looping...</span>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-2 justify-center">
                    {['React', 'Node.js', 'System Design', 'Leadership'].map((tag, i) => (
                      <motion.span 
                        key={tag}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
                        className="rounded-md border border-border bg-surface-hover px-3 py-1 text-xs font-medium text-foreground-muted"
                      >
                        {tag}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Step 2: Search */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              <div className="relative">
                <div className="absolute inset-0 -rotate-3 rounded-xl bg-border-strong"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }} 
                  className="relative z-10 flex h-80 flex-col overflow-hidden rounded-xl border border-border bg-surface p-6 font-mono text-sm"
                >
                  <div className="flex items-center gap-2 mb-4 border-b border-border-strong pb-4">
                    <div className="h-3 w-3 rounded-full bg-surface-hover"></div>
                    <div className="h-3 w-3 rounded-full bg-surface-hover"></div>
                    <div className="h-3 w-3 rounded-full bg-surface-hover"></div>
                    <span className="text-foreground-muted text-xs ml-2">agent_runtime.sh</span>
                  </div>
                  <div className="text-foreground-muted space-y-2 flex-1 overflow-hidden">
                    <p><TypewriterText text="> Initializing Deep Web Sourcing protocols..." delay={200} /></p>
                    <p><TypewriterText text='> Generating Boolean: "remote" AND "React" AND "TypeScript" (site:greenhouse.io OR site:lever.co)' delay={1200} /></p>
                    <p><TypewriterText text="> Bypassing job boards. Scraping direct ATS listings..." delay={2200} /></p>
                    <p><TypewriterText text="> Found 1,420 raw matches." delay={3000} /></p>
                    <p><TypewriterText text="> Applying semantic filters (Salary > $120k)..." delay={3800} /></p>
                    <motion.div 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 4, delay: 4.5 }}
                      className="text-foreground mt-4 font-medium"
                    >
                      [SUCCESS] Curated 10 high-probability matches.
                    </motion.div>
                  </div>
                </motion.div>
              </div>
              <div>
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface font-mono text-xs font-medium tracking-[0.2em] text-foreground">02</div>
                <h3 className="mb-4 text-3xl text-foreground">Deep Web Sourcing</h3>
                <p className="text-lg text-foreground-muted leading-relaxed mb-6">
                  The AI acts as an elite executive sourcer. It deeply analyzes your specific tech stack and generates highly optimized Boolean search queries. Instead of scraping noisy job boards, it scours the internet and directly searches Applicant Tracking Systems (Greenhouse, Lever, Workable) to find hidden remote gems perfectly matched to your resume.
                </p>
                <ul className="space-y-3 text-foreground-muted font-medium">
                  <li className="flex items-center gap-2"><Globe className="h-5 w-5 text-foreground" /> Bypasses noisy job boards to find direct listings</li>
                  <li className="flex items-center gap-2"><Terminal className="h-5 w-5 text-foreground" /> Generates complex Boolean ATS queries based on your skills</li>
                  <li className="flex items-center gap-2"><Star className="h-5 w-5 text-foreground" /> Scores and ranks the hidden matches against your resume</li>
                </ul>
              </div>
            </motion.div>

            {/* Step 3: Tailor */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              <div className="order-2 md:order-1">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface font-mono text-xs font-medium tracking-[0.2em] text-foreground">03</div>
                <h3 className="mb-4 text-3xl text-foreground">Autonomous Tailoring</h3>
                <p className="text-lg text-foreground-muted leading-relaxed mb-6">
                  Sending a generic resume is a waste of time. The agent reads the specific job description and automatically rewrites bullet points, swaps keywords, and restructures your file to beat the ATS.
                </p>
                <ul className="space-y-3 text-foreground-muted font-medium">
                  <li className="flex items-center gap-2"><Code2 className="h-5 w-5 text-foreground" /> Injects missing job description keywords</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-foreground" /> Rewrites bullets for maximum impact</li>
                  <li className="flex items-center gap-2"><FileText className="h-5 w-5 text-foreground" /> Generates a ready-to-download Markdown file</li>
                </ul>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="absolute inset-0 rotate-2 rounded-xl bg-border"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 3.8, ease: "easeInOut" }} 
                  className="relative z-10 flex h-80 flex-col rounded-xl border border-border bg-surface p-6"
                >
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                    <span className="text-xs font-medium text-foreground-muted">ORIGINAL</span>
                    <ArrowRight className="h-4 w-4 text-foreground-muted" />
                    <span className="text-xs font-medium text-foreground">TAILORED BY AGENT</span>
                  </div>
                  <div className="flex-1 flex gap-4 overflow-hidden text-[10px] md:text-xs font-mono">
                    <div className="flex-1 rounded-xl border border-border bg-background p-4 text-foreground-muted line-through decoration-border-strong decoration-2">
                      - Built web apps using React.<br/><br/>
                      - Managed state for the team.<br/><br/>
                      - Improved speed by 20%.
                    </div>
                    <div className="flex-1 rounded-xl border border-border-strong bg-surface-hover p-4 text-foreground">
                      - Architected scalable <span className="rounded-md bg-border-strong px-1 text-foreground">React/Next.js</span> applications.<br/><br/>
                      - Implemented complex state management using <span className="rounded-md bg-border-strong px-1 text-foreground">Redux Toolkit</span>.<br/><br/>
                      - Optimized Core Web Vitals, reducing LCP by <span className="rounded-md bg-border-strong px-1 text-foreground">20%</span>.
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Step 4: Outreach */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              <div className="relative">
                <div className="absolute inset-0 -rotate-2 rounded-xl bg-border"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }} 
                  className="relative z-10 flex h-80 flex-col overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <div className="bg-surface-hover p-3 flex items-center gap-4 border-b border-border">
                    <div className="text-xs text-foreground-muted font-medium">New Message</div>
                  </div>
                  <div className="p-4 border-b border-border space-y-2 text-sm">
                    <div className="flex"><span className="text-foreground-muted w-16">To:</span> <span className="text-foreground font-medium">hiring@stripe.com</span></div>
                    <div className="flex"><span className="text-foreground-muted w-16">Subject:</span> <span className="text-foreground font-medium">Application for Frontend Engineer - [Your Name]</span></div>
                  </div>
                  <div className="p-4 text-sm text-foreground-muted leading-relaxed flex-1 bg-background">
                    <p>Hi Team,</p>
                    <p className="mt-2">I noticed the Frontend Engineer opening and was impressed by the recent updates to your API dashboard.</p>
                    <p className="mt-2 inline-block rounded-md bg-border px-2 py-1 text-foreground animate-pulse">
                      [Agent is drafting based on your 5 years of React experience...]
                    </p>
                  </div>
                  <div className="p-3 bg-surface border-t border-border flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <FileText className="h-4 w-4" /> Tailored_Resume.md attached
                    </div>
                    <Button size="sm" className="px-4"><Send className="h-3 w-3 mr-2" /> Send via Gmail</Button>
                  </div>
                </motion.div>
              </div>
              <div>
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface font-mono text-xs font-medium tracking-[0.2em] text-foreground">04</div>
                <h3 className="mb-4 text-3xl text-foreground">1-Click Outreach</h3>
                <p className="text-lg text-foreground-muted leading-relaxed mb-6">
                  Applying through portals is a black hole. The agent drafts a highly personalized cold email directed at the hiring manager, attaches your newly tailored resume, and opens it directly in your Gmail ready to send.
                </p>
                <ul className="space-y-3 text-foreground-muted font-medium">
                  <li className="flex items-center gap-2"><Mail className="h-5 w-5 text-foreground" /> Opens directly in your native Gmail</li>
                  <li className="flex items-center gap-2"><Shield className="h-5 w-5 text-foreground" /> Sends from your own email address</li>
                  <li className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-foreground" /> Automatically logs to your Kanban tracker</li>
                </ul>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-background py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-foreground-muted">
            <Globe className="h-3 w-3" /> Remote Job Seekers Only
          </div>
          <h2 className="mb-6 text-4xl tracking-tight text-foreground md:text-5xl">Land your next remote role faster.</h2>
          <p className="mb-10 text-lg text-foreground-muted">
            Hireschema is purpose-built for remote professionals. If you're looking for an office job, this isn't for you. If you want to work from anywhere - deploy your agent now.
          </p>
          <Link to="/login">
            <Button size="lg" className="h-14 px-8 text-base">
              Start your free remote job search
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
