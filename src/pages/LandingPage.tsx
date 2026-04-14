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
    return <div className="flex h-screen items-center justify-center bg-slate-50">Loading...</div>;
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-200 overflow-x-hidden">
      {/* Navigation */}
      <nav className="border-b border-zinc-200 bg-white/80 backdrop-blur-xl fixed top-0 w-full z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-none bg-zinc-900 shadow-md">
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">Hireschema</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link to="/login">
              <Button variant="action" size="sm" className="rounded-none shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all px-5">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col justify-center pt-20 pb-20 overflow-hidden">
        {/* Abstract Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Floating Abstract Shapes */}
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [12, 15, 12] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          className="absolute top-1/4 right-[10%] w-32 h-32 bg-zinc-100 border border-zinc-200 -z-10 shadow-xl hidden md:block"
        ></motion.div>
        <motion.div 
          animate={{ y: [0, 20, 0], rotate: [-12, -15, -12] }}
          transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
          className="absolute bottom-1/4 left-[10%] w-24 h-24 bg-zinc-50 border border-zinc-200 -z-10 shadow-xl hidden md:block"
        ></motion.div>

        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 border border-zinc-900 bg-zinc-900 text-white text-xs font-bold px-4 py-2 rounded-none mb-8 tracking-widest uppercase shadow-md">
              <Globe className="h-3 w-3" />
              Remote Jobs Only · Worldwide
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-zinc-900 mb-6 leading-[1.1]">
              Your AI agent for <br className="hidden md:block" />
              <span className="text-zinc-400">remote job hunting.</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-500 mb-4 max-w-2xl mx-auto leading-relaxed">
              Built exclusively for remote job seekers. Upload your resume and let the agent find, filter, and apply to remote opportunities worldwide - while you focus on what matters.
            </p>
            <p className="text-sm text-zinc-400 mb-10 font-medium border border-zinc-200 inline-block px-4 py-2 bg-zinc-50">
              Not for in-office or on-site roles. 100% remote job opportunities only.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button variant="action" size="lg" className="h-14 px-8 text-base rounded-none shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
                  Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <span className="text-sm text-zinc-400 font-medium">Free to start. No credit card required.</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Agent Workflow Section */}
      <section id="agent-workflow" className="py-24 bg-zinc-50 border-y border-zinc-200 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">The Autonomous Pipeline</h2>
            <p className="text-zinc-500 text-lg">Watch how the Hireschema agent handles the entire application lifecycle.</p>
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
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-zinc-900 text-white font-mono font-bold mb-6 shadow-lg border border-zinc-900">01</div>
                <h3 className="text-3xl font-bold mb-4">Feed the Agent</h3>
                <p className="text-lg text-zinc-500 leading-relaxed mb-6">
                  Upload your master resume. The agent instantly parses your experience, extracts your core skills, and establishes a baseline profile to match against the global job market.
                </p>
                <ul className="space-y-3 text-zinc-600 font-medium">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-zinc-900" /> Extracts 50+ semantic data points</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-zinc-900" /> Identifies optimal career trajectories</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-zinc-900" /> Sets baseline for match-scoring</li>
                </ul>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="absolute inset-0 bg-zinc-200 transform rotate-3 rounded-none"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} 
                  className="bg-white rounded-none border border-zinc-300 shadow-xl p-8 relative z-10 h-80 flex flex-col items-center justify-center"
                >
                  <FileText className="h-16 w-16 text-zinc-300 mb-6" />
                  <div className="w-full space-y-3 max-w-xs mx-auto">
                    <div className="h-2 w-full bg-zinc-100 rounded-none overflow-hidden">
                      <motion.div 
                        animate={{ width: ["0%", "100%", "0%"] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        className="h-full bg-zinc-900"
                      ></motion.div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400 font-mono">
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
                        className="px-3 py-1 bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs font-medium rounded-none shadow-sm"
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
                <div className="absolute inset-0 bg-zinc-300 transform -rotate-3 rounded-none"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }} 
                  className="bg-black rounded-none border border-zinc-800 shadow-2xl p-6 relative z-10 h-80 font-mono text-sm overflow-hidden flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-4">
                    <div className="w-3 h-3 rounded-none bg-zinc-700"></div>
                    <div className="w-3 h-3 rounded-none bg-zinc-700"></div>
                    <div className="w-3 h-3 rounded-none bg-zinc-700"></div>
                    <span className="text-zinc-500 text-xs ml-2">agent_runtime.sh</span>
                  </div>
                  <div className="text-zinc-400 space-y-2 flex-1 overflow-hidden">
                    <p><TypewriterText text="> Initializing Deep Web Sourcing protocols..." delay={200} /></p>
                    <p><TypewriterText text='> Generating Boolean: "remote" AND "React" AND "TypeScript" (site:greenhouse.io OR site:lever.co)' delay={1200} /></p>
                    <p><TypewriterText text="> Bypassing job boards. Scraping direct ATS listings..." delay={2200} /></p>
                    <p><TypewriterText text="> Found 1,420 raw matches." delay={3000} /></p>
                    <p><TypewriterText text="> Applying semantic filters (Salary > $120k)..." delay={3800} /></p>
                    <motion.div 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 4, delay: 4.5 }}
                      className="text-white mt-4 font-bold"
                    >
                      [SUCCESS] Curated 10 high-probability matches.
                    </motion.div>
                  </div>
                </motion.div>
              </div>
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-zinc-900 text-white font-mono font-bold mb-6 shadow-lg border border-zinc-900">02</div>
                <h3 className="text-3xl font-bold mb-4">Deep Web Sourcing</h3>
                <p className="text-lg text-zinc-500 leading-relaxed mb-6">
                  The AI acts as an elite executive sourcer. It deeply analyzes your specific tech stack and generates highly optimized Boolean search queries. Instead of scraping noisy job boards, it scours the internet and directly searches Applicant Tracking Systems (Greenhouse, Lever, Workable) to find hidden remote gems perfectly matched to your resume.
                </p>
                <ul className="space-y-3 text-zinc-600 font-medium">
                  <li className="flex items-center gap-2"><Globe className="h-5 w-5 text-zinc-900" /> Bypasses noisy job boards to find direct listings</li>
                  <li className="flex items-center gap-2"><Terminal className="h-5 w-5 text-zinc-900" /> Generates complex Boolean ATS queries based on your skills</li>
                  <li className="flex items-center gap-2"><Star className="h-5 w-5 text-zinc-900" /> Scores and ranks the hidden matches against your resume</li>
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
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-zinc-900 text-white font-mono font-bold mb-6 shadow-lg border border-zinc-900">03</div>
                <h3 className="text-3xl font-bold mb-4">Autonomous Tailoring</h3>
                <p className="text-lg text-zinc-500 leading-relaxed mb-6">
                  Sending a generic resume is a waste of time. The agent reads the specific job description and automatically rewrites bullet points, swaps keywords, and restructures your file to beat the ATS.
                </p>
                <ul className="space-y-3 text-zinc-600 font-medium">
                  <li className="flex items-center gap-2"><Code2 className="h-5 w-5 text-zinc-900" /> Injects missing job description keywords</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-zinc-900" /> Rewrites bullets for maximum impact</li>
                  <li className="flex items-center gap-2"><FileText className="h-5 w-5 text-zinc-900" /> Generates a ready-to-download Markdown file</li>
                </ul>
              </div>
              <div className="order-1 md:order-2 relative">
                <div className="absolute inset-0 bg-zinc-200 transform rotate-2 rounded-none"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 3.8, ease: "easeInOut" }} 
                  className="bg-white rounded-none border border-zinc-300 shadow-xl p-6 relative z-10 h-80 flex flex-col"
                >
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-200">
                    <span className="text-xs font-bold text-zinc-500">ORIGINAL</span>
                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-900">TAILORED BY AGENT</span>
                  </div>
                  <div className="flex-1 flex gap-4 overflow-hidden text-[10px] md:text-xs font-mono">
                    <div className="flex-1 bg-zinc-50 border border-zinc-200 p-4 rounded-none text-zinc-400 line-through decoration-zinc-300 decoration-2 shadow-inner">
                      - Built web apps using React.<br/><br/>
                      - Managed state for the team.<br/><br/>
                      - Improved speed by 20%.
                    </div>
                    <div className="flex-1 bg-zinc-100 p-4 rounded-none text-zinc-900 shadow-sm border border-zinc-300">
                      - Architected scalable <span className="bg-zinc-300 text-zinc-900 px-1 rounded-none">React/Next.js</span> applications.<br/><br/>
                      - Implemented complex state management using <span className="bg-zinc-300 text-zinc-900 px-1 rounded-none">Redux Toolkit</span>.<br/><br/>
                      - Optimized Core Web Vitals, reducing LCP by <span className="bg-zinc-300 text-zinc-900 px-1 rounded-none">20%</span>.
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
                <div className="absolute inset-0 bg-zinc-200 transform -rotate-2 rounded-none"></div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }} 
                  transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }} 
                  className="bg-white rounded-none border border-zinc-300 shadow-xl overflow-hidden relative z-10 h-80 flex flex-col"
                >
                  <div className="bg-zinc-100 p-3 flex items-center gap-4 border-b border-zinc-200">
                    <div className="text-xs text-zinc-500 font-medium">New Message</div>
                  </div>
                  <div className="p-4 border-b border-zinc-100 space-y-2 text-sm">
                    <div className="flex"><span className="text-zinc-400 w-16">To:</span> <span className="text-zinc-900 font-medium">hiring@stripe.com</span></div>
                    <div className="flex"><span className="text-zinc-400 w-16">Subject:</span> <span className="text-zinc-900 font-medium">Application for Frontend Engineer - [Your Name]</span></div>
                  </div>
                  <div className="p-4 text-sm text-zinc-700 leading-relaxed flex-1 bg-zinc-50">
                    <p>Hi Team,</p>
                    <p className="mt-2">I noticed the Frontend Engineer opening and was impressed by the recent updates to your API dashboard.</p>
                    <p className="mt-2 text-zinc-900 bg-zinc-200 inline-block px-1 rounded-none animate-pulse">
                      [Agent is drafting based on your 5 years of React experience...]
                    </p>
                  </div>
                  <div className="p-3 bg-white border-t border-zinc-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <FileText className="h-4 w-4" /> Tailored_Resume.md attached
                    </div>
                    <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-none shadow-md px-4"><Send className="h-3 w-3 mr-2" /> Send via Gmail</Button>
                  </div>
                </motion.div>
              </div>
              <div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-none bg-zinc-900 text-white font-mono font-bold mb-6 shadow-lg border border-zinc-900">04</div>
                <h3 className="text-3xl font-bold mb-4">1-Click Outreach</h3>
                <p className="text-lg text-zinc-500 leading-relaxed mb-6">
                  Applying through portals is a black hole. The agent drafts a highly personalized cold email directed at the hiring manager, attaches your newly tailored resume, and opens it directly in your Gmail ready to send.
                </p>
                <ul className="space-y-3 text-zinc-600 font-medium">
                  <li className="flex items-center gap-2"><Mail className="h-5 w-5 text-zinc-900" /> Opens directly in your native Gmail</li>
                  <li className="flex items-center gap-2"><Shield className="h-5 w-5 text-zinc-900" /> Sends from your own email address</li>
                  <li className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-zinc-900" /> Automatically logs to your Kanban tracker</li>
                </ul>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-zinc-500 text-lg">Start for free, upgrade when you need more power.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white p-8 md:p-10 rounded-none border border-zinc-300 shadow-sm">
              <h3 className="text-2xl font-bold mb-2">Basic</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-zinc-500">/forever</span>
              </div>
              <p className="text-zinc-500 mb-8 pb-8 border-b border-zinc-200">Perfect for casual job seekers getting started.</p>
              <ul className="space-y-4 mb-8">
                {['1 daily AI job match', 'Basic resume tailoring', 'Standard Kanban board', 'Community support'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-700">
                    <CheckCircle2 className="w-5 h-5 text-zinc-900" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button className="w-full h-12 rounded-none shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all" variant="outline">Get Started Free</Button>
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="bg-zinc-900 text-white p-8 md:p-10 rounded-none border border-zinc-900 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-white text-zinc-900 text-xs font-bold px-3 py-1 rounded-none border-l border-b border-zinc-900">POPULAR</div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">$9</span>
                <span className="text-zinc-400">/month</span>
              </div>
              <p className="text-zinc-400 mb-8 pb-8 border-b border-zinc-800">For serious professionals who want to land offers fast.</p>
              <ul className="space-y-4 mb-8">
                {['10 daily AI job matches', 'Advanced resume tailoring', '1-Click Cold Emails', 'Interview Q&A Generation', 'Salary Insights'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/login">
                <Button className="w-full h-12 rounded-none shadow-md bg-white text-zinc-900 hover:bg-zinc-200 hover:shadow-lg hover:-translate-y-0.5 transition-all">Upgrade to Pro</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-zinc-50 border-t border-zinc-200 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 border border-zinc-300 bg-white text-zinc-600 text-xs font-bold px-4 py-2 rounded-none mb-6 tracking-widest uppercase">
            <Globe className="h-3 w-3" /> Remote Job Seekers Only
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Land your next remote role faster.</h2>
          <p className="text-zinc-500 text-lg mb-10">
            Hireschema is purpose-built for remote professionals. If you're looking for an office job, this isn't for you. If you want to work from anywhere - deploy your agent now.
          </p>
          <Link to="/login">
            <Button size="lg" className="h-14 px-8 text-base rounded-none shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all bg-zinc-900 text-white hover:bg-zinc-800">
              Start your free remote job search
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-50/80 backdrop-blur-xl py-12 border-t border-zinc-200/50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-none bg-zinc-900">
                <Briefcase className="h-3 w-3 text-white" />
              </div>
              <span className="font-bold tracking-tight">Hireschema</span>
            </div>
            <p className="text-zinc-500 text-sm max-w-xs">The AI-powered platform exclusively for remote job seekers. Find, track, and land remote roles - from anywhere in the world.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><a href="#pricing" className="hover:text-zinc-900">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li><Link to="/privacy" className="hover:text-zinc-900">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-zinc-900">Terms of Service</Link></li>
              <li><a href="mailto:support@hireschema.com" className="hover:text-zinc-900">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-zinc-200 text-center text-zinc-400 text-sm">
          <p>© {new Date().getFullYear()} Hireschema. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
