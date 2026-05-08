import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/* ─── Landing-page-scoped styles injected once ─── */
const LP_STYLE = `
  .lp-root {
    --lp-bg:      oklch(97% 0.012 80);
    --lp-surface: oklch(99% 0.005 80);
    --lp-fg:      oklch(20% 0.02 60);
    --lp-muted:   oklch(48% 0.015 60);
    --lp-border:  oklch(89% 0.012 80);
    --lp-accent:  oklch(58% 0.16 35);
    --lp-font-d:  'Iowan Old Style','Charter',Georgia,serif;
    --lp-font-b:  -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    --lp-font-m:  'SF Mono',ui-monospace,'Cascadia Code','JetBrains Mono',monospace;
    background: var(--lp-bg);
    color: var(--lp-fg);
    font-family: var(--lp-font-b);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  /* reset inherited app vars */
  .lp-root * { box-sizing: border-box; }

  /* scroll progress */
  .lp-progress {
    position: fixed; top: 0; left: 0;
    width: 0%; height: 2px;
    background: var(--lp-accent);
    z-index: 200; transition: width 80ms linear;
    pointer-events: none;
  }

  /* custom cursor */
  .lp-cursor {
    position: fixed; width: 8px; height: 8px;
    background: var(--lp-fg); border-radius: 50%;
    pointer-events: none; z-index: 9999;
    transform: translate(-50%,-50%);
    transition: width 200ms ease, height 200ms ease, opacity 200ms ease;
    mix-blend-mode: multiply;
  }
  .lp-cursor-ring {
    position: fixed; width: 36px; height: 36px;
    border: 1px solid var(--lp-fg); border-radius: 50%;
    pointer-events: none; z-index: 9998;
    transform: translate(-50%,-50%);
    transition: width 300ms cubic-bezier(.22,1,.36,1), height 300ms cubic-bezier(.22,1,.36,1),
                opacity 300ms ease, border-color 300ms ease;
    opacity: .5;
  }
  .lp-cursor-link .lp-cursor { width:0;height:0;opacity:0; }
  .lp-cursor-link .lp-cursor-ring { width:56px;height:56px;opacity:1;border-color:var(--lp-accent); }

  /* layout */
  .lp-container { max-width:1200px; margin:0 auto; padding:0 32px; }
  @media(max-width:768px){ .lp-container{ padding:0 20px; } }

  /* typography */
  .lp-eyebrow {
    font-family: var(--lp-font-m); font-size:11px; font-weight:500;
    letter-spacing:.14em; text-transform:uppercase; color:var(--lp-muted);
  }
  .lp-display {
    font-family: var(--lp-font-d); font-weight:400; line-height:1.04;
    letter-spacing:-.02em; color:var(--lp-fg);
  }
  .lp-dh { font-size:clamp(38px,5.2vw,68px); }
  .lp-ds { font-size:clamp(32px,4vw,52px); }
  .lp-body-lg { font-size:16px; line-height:1.65; color:var(--lp-muted); }
  .lp-body-sm { font-size:14px; line-height:1.55; color:var(--lp-muted); }

  /* reveal animations */
  .lp-reveal,.lp-reveal-l,.lp-reveal-r,.lp-reveal-s {
    opacity:0; transition:opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1);
  }
  .lp-reveal     { transform:translateY(28px); }
  .lp-reveal-l   { transform:translateX(-32px); }
  .lp-reveal-r   { transform:translateX(32px); }
  .lp-reveal-s   { transform:scale(.96); transition-duration:.6s; }
  .lp-revealed   { opacity:1 !important; transform:none !important; }
  .lp-d1 { transition-delay:.08s; } .lp-d2 { transition-delay:.18s; }
  .lp-d3 { transition-delay:.28s; } .lp-d4 { transition-delay:.38s; }
  .lp-d5 { transition-delay:.48s; }

  /* nav */
  .lp-nav {
    position:sticky; top:0; z-index:100;
    background:oklch(97% .012 80 / .88);
    backdrop-filter:blur(16px);
    border-bottom:1px solid var(--lp-border);
    transition:box-shadow 300ms ease;
  }
  .lp-nav.lp-scrolled { box-shadow:0 1px 24px oklch(20% .02 60 / .06); }
  .lp-nav-inner {
    display:flex; align-items:center; justify-content:space-between;
    height:60px; max-width:1200px; margin:0 auto; padding:0 32px;
  }
  .lp-wordmark {
    font-family:var(--lp-font-d); font-size:18px; font-weight:400;
    letter-spacing:-.01em; color:var(--lp-fg); text-decoration:none;
    position:relative;
  }
  .lp-wordmark::after {
    content:''; position:absolute; bottom:-2px; left:0; right:100%;
    height:1px; background:var(--lp-accent);
    transition:right 400ms cubic-bezier(.22,1,.36,1);
  }
  .lp-wordmark:hover::after { right:0; }
  .lp-nav-actions { display:flex; align-items:center; gap:24px; }
  .lp-nav-link {
    font-size:14px; color:var(--lp-muted); text-decoration:none;
    position:relative; transition:color 220ms ease;
  }
  .lp-nav-link::after {
    content:''; position:absolute; bottom:-2px; left:0; right:100%;
    height:1px; background:var(--lp-fg);
    transition:right 300ms cubic-bezier(.22,1,.36,1);
  }
  .lp-nav-link:hover { color:var(--lp-fg); }
  .lp-nav-link:hover::after { right:0; }

  /* buttons */
  .lp-btn-p {
    display:inline-flex; align-items:center; gap:6px;
    font-family:var(--lp-font-b); font-size:13px; font-weight:500;
    padding:8px 18px; border-radius:9999px;
    border:1px solid var(--lp-fg); background:var(--lp-fg); color:var(--lp-bg);
    text-decoration:none; cursor:pointer;
    transition:border-color 240ms ease, background 240ms ease, transform 200ms ease, box-shadow 240ms ease;
  }
  .lp-btn-p:hover {
    background:var(--lp-accent); border-color:var(--lp-accent);
    transform:translateY(-1px); box-shadow:0 4px 16px oklch(58% .16 35 / .25);
  }
  .lp-btn-g {
    display:inline-flex; align-items:center; gap:6px;
    font-family:var(--lp-font-b); font-size:14px; font-weight:500;
    padding:10px 22px; border-radius:9999px;
    border:1px solid var(--lp-border); background:transparent; color:var(--lp-fg);
    text-decoration:none; cursor:pointer;
    transition:border-color 240ms ease, transform 200ms ease;
  }
  .lp-btn-g:hover { border-color:var(--lp-muted); transform:translateY(-1px); }
  .lp-cta-main {
    display:inline-flex; align-items:center; gap:8px;
    font-family:var(--lp-font-b); font-size:15px; font-weight:500;
    padding:13px 28px; border-radius:9999px;
    border:1px solid var(--lp-fg); background:var(--lp-fg); color:var(--lp-bg);
    text-decoration:none; cursor:pointer;
    transition:border-color 240ms ease, background 240ms ease, transform 200ms ease, box-shadow 240ms ease;
  }
  .lp-cta-main:hover {
    background:var(--lp-accent); border-color:var(--lp-accent);
    transform:translateY(-2px); box-shadow:0 6px 24px oklch(58% .16 35 / .30);
  }
  .lp-cta-main .lp-arrow { transition:transform 240ms cubic-bezier(.22,1,.36,1); }
  .lp-cta-main:hover .lp-arrow { transform:translateX(4px); }

  /* marquee */
  .lp-marquee-strip {
    background:var(--lp-fg); color:var(--lp-bg); overflow:hidden; padding:10px 0;
  }
  .lp-marquee-inner {
    display:flex; animation:lp-marquee 28s linear infinite; width:max-content;
  }
  .lp-marquee-item {
    font-family:var(--lp-font-m); font-size:11px; letter-spacing:.1em;
    text-transform:uppercase; white-space:nowrap; padding:0 32px;
    display:flex; align-items:center; gap:20px; opacity:.7;
  }
  .lp-marquee-item::after { content:'·'; opacity:.4; font-size:16px; }
  @keyframes lp-marquee {
    from { transform:translateX(0); } to { transform:translateX(-50%); }
  }

  /* hero */
  .lp-hero {
    padding:52px 0 44px; border-bottom:1px solid var(--lp-border);
    position:relative; overflow:hidden;
  }
  .lp-hero::before {
    content:''; position:absolute; inset:0;
    background-image:radial-gradient(circle, oklch(48% .015 60 / .18) 1px, transparent 1px);
    background-size:28px 28px;
    animation:lp-grid-drift 20s ease-in-out infinite alternate;
    pointer-events:none;
  }
  @keyframes lp-grid-drift {
    from { transform:translate(0,0); } to { transform:translate(14px,10px); }
  }
  .lp-hero-grid {
    display:grid; grid-template-columns:1fr 1fr; gap:64px;
    align-items:center; position:relative; z-index:1;
  }
  .lp-hero-left { max-width:560px; }
  .lp-hero-eyebrow { margin-bottom:16px; }
  .lp-hero-hl { margin-bottom:16px; }
  .lp-hero-hl em { font-style:italic; color:var(--lp-accent); }
  .lp-hero-sub { max-width:440px; margin-bottom:28px; }
  .lp-hero-cta-row { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
  .lp-cta-note {
    font-family:var(--lp-font-m); font-size:11px; font-weight:500;
    letter-spacing:.10em; text-transform:uppercase; color:var(--lp-muted);
  }
  /* hero load */
  @keyframes lp-fade-up {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .lp-fi   { animation:lp-fade-up .7s cubic-bezier(.22,1,.36,1) both; }
  .lp-fi-1 { animation-delay:.05s; }
  .lp-fi-2 { animation-delay:.15s; }
  .lp-fi-3 { animation-delay:.30s; }
  .lp-fi-4 { animation-delay:.46s; }

  /* job card mockup */
  .lp-mockup { position:relative; height:360px; }
  .lp-jcard {
    position:absolute;
    background:var(--lp-surface); border:1px solid var(--lp-border);
    padding:24px 28px; width:100%;
    transition:transform 400ms cubic-bezier(.22,1,.36,1);
  }
  .lp-jcard-bk { top:20px;left:14px;right:-14px;opacity:.4;z-index:0; animation:lp-float-c 7s ease-in-out infinite; }
  .lp-jcard-md { top:10px;left:7px;right:-7px;opacity:.68;z-index:1; animation:lp-float-b 6s ease-in-out infinite; }
  .lp-jcard-ft { top:0;left:0;right:0;z-index:2; animation:lp-float-a 5s ease-in-out infinite; }
  @keyframes lp-float-a { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-8px); } }
  @keyframes lp-float-b { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-5px); } }
  @keyframes lp-float-c { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-3px); } }

  .lp-jc-hdr { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
  .lp-jc-company-badge { display:flex; align-items:center; gap:10px; }
  .lp-jc-logo {
    width:36px; height:36px; border:1px solid var(--lp-border); background:var(--lp-bg);
    display:flex; align-items:center; justify-content:center;
    font-family:var(--lp-font-m); font-size:10px; font-weight:600; color:var(--lp-muted); flex-shrink:0;
  }
  .lp-jc-co  { font-size:12px; color:var(--lp-muted); }
  .lp-jc-ttl { font-size:15px; font-weight:500; color:var(--lp-fg); }
  .lp-score-ring { display:flex; flex-direction:column; align-items:center; gap:3px; }
  .lp-score-circle {
    width:44px; height:44px; border-radius:50%;
    border:2px solid transparent;
    background:linear-gradient(var(--lp-surface),var(--lp-surface)) padding-box,
               conic-gradient(var(--lp-fg) 0% 94%, var(--lp-border) 94% 100%) border-box;
    display:flex; align-items:center; justify-content:center;
    font-family:var(--lp-font-m); font-size:13px; font-weight:600; color:var(--lp-fg);
    animation:lp-score-spin 1.2s cubic-bezier(.22,1,.36,1) .8s both;
  }
  @keyframes lp-score-spin {
    from { background:linear-gradient(var(--lp-surface),var(--lp-surface)) padding-box,
                       conic-gradient(var(--lp-fg) 0%,var(--lp-border) 0%) border-box; }
    to   { background:linear-gradient(var(--lp-surface),var(--lp-surface)) padding-box,
                       conic-gradient(var(--lp-fg) 0% 94%,var(--lp-border) 94% 100%) border-box; }
  }
  .lp-score-lbl { font-family:var(--lp-font-m); font-size:9px; text-transform:uppercase; letter-spacing:.1em; color:var(--lp-muted); }
  .lp-jc-tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
  .lp-jc-tag {
    font-family:var(--lp-font-m); font-size:10px; font-weight:500;
    letter-spacing:.06em; padding:4px 10px; border:1px solid var(--lp-border); color:var(--lp-muted);
    transition:border-color 200ms ease, color 200ms ease;
  }
  .lp-jc-tag:hover { border-color:var(--lp-muted); color:var(--lp-fg); }
  .lp-jc-meta { display:flex; gap:20px; padding-top:16px; border-top:1px solid var(--lp-border); }
  .lp-jc-meta-item { font-size:12px; color:var(--lp-muted); }
  .lp-jc-meta-item span { color:var(--lp-fg); font-weight:500; }
  .lp-signal-bar { display:flex; align-items:center; gap:8px; margin-top:14px; }
  .lp-signal-lbl {
    font-family:var(--lp-font-m); font-size:10px; text-transform:uppercase;
    letter-spacing:.1em; color:var(--lp-muted); white-space:nowrap; min-width:80px;
  }
  .lp-bar-track { flex:1; height:3px; background:var(--lp-border); overflow:hidden; }
  .lp-bar-fill { height:100%; background:var(--lp-fg); animation:lp-bar-grow 1.8s cubic-bezier(.22,1,.36,1) .7s both; }
  @keyframes lp-bar-grow { from { width:0%; } }
  .lp-bar-fill.f91 { width:91%; } .lp-bar-fill.f88 { width:88%; } .lp-bar-fill.f74 { width:74%; }
  .lp-live { display:flex; align-items:center; gap:6px; margin-top:12px; }
  .lp-pulse { width:6px; height:6px; border-radius:50%; background:oklch(58% .18 145); position:relative; }
  .lp-pulse::after {
    content:''; position:absolute; inset:-4px; border-radius:50%;
    border:1px solid oklch(58% .18 145);
    animation:lp-pulse-ring 1.6s ease-out infinite;
  }
  @keyframes lp-pulse-ring {
    from { transform:scale(.7); opacity:.8; } to { transform:scale(2); opacity:0; }
  }
  .lp-live-lbl { font-family:var(--lp-font-m); font-size:9px; letter-spacing:.12em; text-transform:uppercase; color:var(--lp-muted); }

  /* stats */
  .lp-stats { border-bottom:1px solid var(--lp-border); }
  .lp-stats-grid {
    display:grid; grid-template-columns:repeat(3,1fr);
    max-width:1200px; margin:0 auto; padding:0 32px;
  }
  .lp-stat {
    padding:40px 32px; border-right:1px solid var(--lp-border);
    position:relative; overflow:hidden;
  }
  .lp-stat:first-child { padding-left:0; }
  .lp-stat:last-child  { border-right:none; padding-right:0; }
  .lp-stat::after {
    content:''; position:absolute; bottom:0; left:0; right:100%;
    height:2px; background:var(--lp-accent);
    transition:right 600ms cubic-bezier(.22,1,.36,1);
  }
  .lp-stat.lp-revealed::after { right:0; }
  .lp-stat-num {
    font-family:var(--lp-font-d); font-size:clamp(36px,5vw,56px);
    font-weight:400; line-height:1; letter-spacing:-.02em; color:var(--lp-fg);
    display:block; margin-bottom:8px;
  }
  .lp-stat-lbl { font-family:var(--lp-font-m); font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:var(--lp-muted); }

  /* how it works */
  .lp-how { padding:96px 0; border-bottom:1px solid var(--lp-border); }
  .lp-section-hdr { display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:64px; gap:32px; }
  .lp-steps { display:grid; grid-template-columns:repeat(3,1fr); }
  .lp-step {
    padding:40px 40px 40px 0; border-right:1px solid var(--lp-border); position:relative;
  }
  .lp-step:last-child { border-right:none; padding-right:0; }
  .lp-step:not(:first-child) { padding-left:40px; }
  .lp-step-num { font-family:var(--lp-font-m); font-size:11px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--lp-muted); margin-bottom:24px; display:block; }
  .lp-step-ttl { font-family:var(--lp-font-d); font-size:24px; font-weight:400; line-height:1.2; letter-spacing:-.01em; color:var(--lp-fg); margin-bottom:14px; }
  .lp-step-body { font-size:15px; line-height:1.65; color:var(--lp-muted); }
  .lp-step-conn {
    position:absolute; top:52px; right:-1px;
    width:1px; height:0; background:var(--lp-accent);
    transition:height 800ms cubic-bezier(.22,1,.36,1);
  }
  .lp-step.lp-revealed .lp-step-conn { height:48px; }

  /* features */
  .lp-features { padding:96px 0; border-bottom:1px solid var(--lp-border); }
  .lp-feat-grid { display:grid; grid-template-columns:5fr 7fr; gap:80px; align-items:start; }
  .lp-feat-left { position:sticky; top:96px; }

  /* animated left-panel body */
  @keyframes lp-feat-in {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:none; }
  }
  .lp-feat-left-body { animation:lp-feat-in 380ms cubic-bezier(.22,1,.36,1) forwards; }
  .lp-feat-left-eyebrow { font-family:var(--lp-font-m); font-size:10px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--lp-accent); margin-bottom:8px; }
  .lp-feat-left-num { font-family:var(--lp-font-m); font-size:11px; font-weight:500; letter-spacing:.08em; color:var(--lp-muted); margin-bottom:16px; }
  .lp-feat-left-title {
    font-family:var(--lp-font-d); font-size:clamp(22px,2.4vw,30px); font-weight:400;
    line-height:1.2; letter-spacing:-.01em; color:var(--lp-fg); margin-bottom:20px;
  }
  .lp-feat-left-desc { font-size:14px; line-height:1.7; color:var(--lp-muted); max-width:280px; }

  /* progress dots */
  .lp-feat-dots { display:flex; flex-direction:column; gap:10px; margin-top:40px; }
  .lp-feat-dot-row { display:flex; align-items:center; gap:12px; cursor:pointer; padding:3px 0; background:none; border:none; text-align:left; }
  .lp-feat-dot-pip {
    width:5px; height:5px; border-radius:50%; flex-shrink:0;
    background:var(--lp-border); transition:background 300ms, transform 300ms;
  }
  .lp-feat-dot-row.lp-feat-dot-active .lp-feat-dot-pip { background:var(--lp-accent); transform:scale(1.5); }
  .lp-feat-dot-lbl { font-family:var(--lp-font-m); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--lp-muted); transition:color 300ms; }
  .lp-feat-dot-row.lp-feat-dot-active .lp-feat-dot-lbl { color:var(--lp-fg); }

  /* right list */
  .lp-feat-list { display:flex; flex-direction:column; }
  .lp-feat-item {
    padding:56px 0; border-top:1px solid var(--lp-border);
    transition:border-color 300ms ease; position:relative;
  }
  .lp-feat-item:last-child { border-bottom:1px solid var(--lp-border); }
  .lp-feat-item.lp-feat-active { border-top-color:var(--lp-accent); }
  .lp-feat-item-hdr { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:12px; }
  .lp-feat-ttl {
    font-family:var(--lp-font-d); font-size:clamp(18px,1.8vw,22px); font-weight:400;
    color:oklch(40% .02 60); transition:color 300ms, letter-spacing 300ms;
  }
  .lp-feat-item.lp-feat-active .lp-feat-ttl { color:var(--lp-fg); letter-spacing:.003em; }
  .lp-feat-tag {
    font-family:var(--lp-font-m); font-size:10px; font-weight:500; letter-spacing:.1em;
    text-transform:uppercase; color:var(--lp-muted); white-space:nowrap; padding-top:4px;
    transition:color 300ms;
  }
  .lp-feat-item.lp-feat-active .lp-feat-tag { color:var(--lp-accent); }
  .lp-feat-desc { font-size:14px; line-height:1.7; color:oklch(55% .015 60); transition:color 300ms; }
  .lp-feat-item.lp-feat-active .lp-feat-desc { color:var(--lp-muted); }

  .lp-pull-quote {
    font-family:var(--lp-font-d); font-size:clamp(22px,3vw,32px); font-weight:400;
    line-height:1.25; letter-spacing:-.01em; color:var(--lp-fg); margin-top:24px;
  }
  .lp-pull-quote em { font-style:italic; }

  /* testimonial */
  .lp-testi {
    padding:96px 0; border-bottom:1px solid var(--lp-border);
    text-align:center; position:relative; overflow:hidden;
  }
  .lp-testi::before {
    content:'"'; position:absolute;
    font-family:var(--lp-font-d); font-size:clamp(300px,40vw,600px);
    line-height:.8; color:oklch(20% .02 60 / .04);
    top:50%; left:50%; transform:translate(-50%,-30%);
    pointer-events:none; user-select:none;
  }
  .lp-testi-mark { font-family:var(--lp-font-d); font-size:80px; line-height:.8; color:var(--lp-accent); display:block; margin-bottom:24px; }
  .lp-testi-body {
    font-family:var(--lp-font-d); font-size:clamp(22px,3vw,36px); font-weight:400;
    line-height:1.3; letter-spacing:-.01em; color:var(--lp-fg);
    max-width:720px; margin:0 auto 28px; position:relative; z-index:1;
  }
  .lp-testi-body em { font-style:italic; }
  .lp-testi-attr { font-family:var(--lp-font-m); font-size:11px; font-weight:500; letter-spacing:.12em; text-transform:uppercase; color:var(--lp-muted); position:relative; z-index:1; }

  /* pricing */
  .lp-pricing { padding:96px 0; border-bottom:1px solid var(--lp-border); }
  .lp-pricing-grid {
    display:grid; grid-template-columns:1fr 1fr; margin-top:56px;
    border:1px solid var(--lp-border);
  }
  .lp-plan { padding:48px; transition:background 300ms ease; }
  .lp-plan:hover { background:var(--lp-surface); }
  .lp-plan:first-child { border-right:1px solid var(--lp-border); }
  .lp-plan-name { font-family:var(--lp-font-m); font-size:11px; font-weight:500; letter-spacing:.14em; text-transform:uppercase; color:var(--lp-muted); margin-bottom:20px; display:block; }
  .lp-plan-price { font-family:var(--lp-font-d); font-size:48px; font-weight:400; line-height:1; letter-spacing:-.02em; color:var(--lp-fg); margin-bottom:8px; }
  .lp-plan-period { font-size:14px; color:var(--lp-muted); margin-bottom:32px; display:block; }
  .lp-plan-features { list-style:none; padding:0; display:flex; flex-direction:column; gap:12px; margin-bottom:36px; }
  .lp-plan-feature { display:flex; align-items:flex-start; gap:12px; font-size:14px; color:var(--lp-muted); line-height:1.5; }
  .lp-feat-dot { width:4px; height:4px; border-radius:50%; background:var(--lp-muted); margin-top:7px; flex-shrink:0; }

  /* cta */
  .lp-cta { padding:96px 0; border-bottom:1px solid var(--lp-border); }
  .lp-cta-inner { display:flex; align-items:flex-end; justify-content:space-between; gap:48px; }

  /* footer */
  .lp-footer { border-top:1px solid var(--lp-border); }
  .lp-footer-top { padding:64px 0 48px; }
  .lp-footer-grid {
    display:grid; grid-template-columns:2.2fr 1fr 1fr 1fr; gap:48px; align-items:start;
  }
  /* brand column */
  .lp-footer-logo { font-family:var(--lp-font-d); font-size:20px; font-weight:400; color:var(--lp-fg); text-decoration:none; display:block; margin-bottom:12px; }
  .lp-footer-tagline { font-size:13px; line-height:1.6; color:var(--lp-muted); max-width:210px; margin-bottom:28px; }
  .lp-footer-socials { display:flex; gap:10px; }
  .lp-footer-social {
    width:34px; height:34px; border:1px solid var(--lp-border); border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    color:var(--lp-muted); text-decoration:none;
    transition:border-color 200ms, color 200ms, background 200ms;
  }
  .lp-footer-social:hover { border-color:var(--lp-fg); color:var(--lp-fg); background:var(--lp-surface); }
  /* nav columns */
  .lp-footer-col-ttl {
    font-family:var(--lp-font-m); font-size:10px; font-weight:600;
    letter-spacing:.14em; text-transform:uppercase; color:var(--lp-fg);
    margin-bottom:18px; display:block;
  }
  .lp-footer-col-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:11px; }
  .lp-footer-col-list a { font-size:13px; color:var(--lp-muted); text-decoration:none; transition:color 200ms; }
  .lp-footer-col-list a:hover { color:var(--lp-fg); }
  /* status badge */
  .lp-status-badge {
    display:inline-flex; align-items:center; gap:7px; margin-top:20px;
    padding:5px 10px; border:1px solid oklch(72% .12 145 / .5);
    border-radius:20px; font-family:var(--lp-font-m); font-size:10px;
    letter-spacing:.06em; color:oklch(52% .14 145); background:oklch(96% .04 145 / .3);
  }
  .lp-status-dot { width:6px; height:6px; border-radius:50%; background:oklch(60% .18 145); flex-shrink:0; animation:lp-pulse-g 2s ease-in-out infinite; }
  @keyframes lp-pulse-g { 0%,100%{ opacity:1; } 50%{ opacity:.45; } }
  /* bottom bar */
  .lp-footer-bottom { border-top:1px solid var(--lp-border); padding:20px 0; }
  .lp-footer-bottom-inner { display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap; }
  .lp-footer-copy { font-family:var(--lp-font-m); font-size:11px; letter-spacing:.04em; color:oklch(60% .015 60); }
  .lp-footer-legal { display:flex; gap:20px; list-style:none; padding:0; margin:0; flex-wrap:wrap; }
  .lp-footer-legal a { font-size:11px; color:oklch(60% .015 60); text-decoration:none; transition:color 200ms; }
  .lp-footer-legal a:hover { color:var(--lp-fg); }

  /* responsive */
  @media(max-width:900px){
    .lp-hero-grid { grid-template-columns:1fr; gap:56px; }
    .lp-hero-right { display:none; }
    .lp-hero-left { max-width:100%; }
    .lp-stats-grid { grid-template-columns:1fr; padding:0 20px; }
    .lp-stat { border-right:none; border-bottom:1px solid var(--lp-border); padding:32px 0; }
    .lp-stat:last-child { border-bottom:none; }
    .lp-steps { grid-template-columns:1fr; }
    .lp-step { border-right:none; border-bottom:1px solid var(--lp-border); padding:40px 0; }
    .lp-step:last-child { border-bottom:none; }
    .lp-step:not(:first-child) { padding-left:0; }
    .lp-feat-grid { grid-template-columns:1fr; gap:48px; }
    .lp-feat-left { position:static; }
    .lp-pricing-grid { grid-template-columns:1fr; }
    .lp-plan:first-child { border-right:none; border-bottom:1px solid var(--lp-border); }
    .lp-plan { padding:40px 24px; }
    .lp-cta-inner { flex-direction:column; align-items:flex-start; }
    .lp-footer-grid { grid-template-columns:1fr 1fr; gap:40px; }
    .lp-footer-bottom-inner { flex-direction:column; align-items:flex-start; gap:12px; }
    .lp-section-hdr { flex-direction:column; align-items:flex-start; }
    .lp-nav-actions .lp-nav-link:not(:last-child) { display:none; }
  }
  @media(max-width:600px){
    .lp-hero { padding:32px 0 28px; }
    .lp-how,.lp-features,.lp-testi,.lp-pricing,.lp-cta { padding:64px 0; }
    .lp-footer-grid { grid-template-columns:1fr; gap:32px; }
  }
  @media(prefers-reduced-motion:reduce){
    .lp-reveal,.lp-reveal-l,.lp-reveal-r,.lp-reveal-s { opacity:1 !important; transform:none !important; }
    .lp-cursor,.lp-cursor-ring { display:none !important; }
  }
`;

const MARQUEE_ITEMS = [
  'Remote · Worldwide', '50+ Resume Signals', 'AI Match Scoring', 'ATS Integrity Checks',
  'Cover Letter Drafts', 'Daily Fresh Matches', 'Learning Loop', 'Job Tracker Built-in',
];

const FEATURES = [
  { title: 'Hard validation before AI scoring', tag: 'Validator', desc: 'Deterministic rules reject every listing that fails remote, location, salary, freshness, or link checks. AI never scores a listing that hasn\'t cleared the hard filter first.' },
  { title: 'Resume-grounded match scores', tag: 'AI Engine', desc: 'The match score is derived from your actual resume text — not job title keywords. Experience depth, skill overlap, seniority calibration, and salary range all factor into the final ranking.' },
  { title: 'A system that learns from you', tag: 'Learning Loop', desc: 'Every save, dismiss, and application is a signal. The next cycle\'s Scout queries adjust accordingly — boosting what you engage with, suppressing what you skip.' },
  { title: 'Application drafts on demand', tag: 'AI Tasks', desc: 'Generate a tailored cover letter, a resume variant for a specific role, or a set of interview prep questions — all grounded in your profile and the actual job description.' },
  { title: 'Tracker built in', tag: 'Job Tracker', desc: 'Every matched job flows into a built-in tracker. Move listings through stages, add notes, mark applied — a clean record of your search without a separate spreadsheet.' },
];

const FREE_FEATURES = [
  'Up to 1 matched job per day',
  'Resume parsing and profile setup',
  'Daily job refresh cycle',
  'Built-in job tracker',
];

const PRO_FEATURES = [
  '10 matched jobs per day',
  'AI cover letter and resume tailoring',
  'Interview prep questions per role',
  'Career path recommendations',
  'Priority learning loop updates',
  'Daily email digest of top matches',
];

function ArrowIcon() {
  return (
    <svg className="lp-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  );
}

export function LandingPage() {
  const { user, loading } = useAuth();
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [activeFeat, setActiveFeat] = useState(0);

  // inject styles once
  useEffect(() => {
    const id = 'lp-styles';
    if (!document.getElementById(id)) {
      const tag = document.createElement('style');
      tag.id = id;
      tag.textContent = LP_STYLE;
      document.head.appendChild(tag);
    }
    return () => {
      // keep styles alive while navigating (minor perf win)
    };
  }, []);

  // scroll progress + nav shadow
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      if (progressRef.current) progressRef.current.style.width = pct + '%';
      if (navRef.current) navRef.current.classList.toggle('lp-scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // custom cursor
  useEffect(() => {
    const cur = cursorRef.current;
    const ring = cursorRingRef.current;
    const root = rootRef.current;
    if (!cur || !ring || !root) return;

    let mx = 0, my = 0, rx = 0, ry = 0;
    let raf: number;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px'; cur.style.top = my + 'px';
    };
    const animRing = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      raf = requestAnimationFrame(animRing);
    };
    raf = requestAnimationFrame(animRing);
    document.addEventListener('mousemove', onMove);

    const links = root.querySelectorAll('a, button');
    const onEnter = () => root.classList.add('lp-cursor-link');
    const onLeave = () => root.classList.remove('lp-cursor-link');
    links.forEach(el => { el.addEventListener('mouseenter', onEnter); el.addEventListener('mouseleave', onLeave); });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // scroll reveals + stat counters
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('lp-revealed');

        // counter animation
        const numEl = e.target.querySelector<HTMLElement>('[data-count]') || (e.target.hasAttribute('data-count') ? e.target as HTMLElement : null);
        const countEls = e.target.querySelectorAll<HTMLElement>('[data-count]');
        countEls.forEach(el => animateCount(el));

        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.lp-reveal,.lp-reveal-l,.lp-reveal-r,.lp-reveal-s,.lp-stat,.lp-step').forEach(el => io.observe(el));

    return () => io.disconnect();
  }, []);

  // feature item scroll tracking
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.feat);
            if (!Number.isNaN(idx)) setActiveFeat(idx);
          }
        });
      },
      { rootMargin: '-20% 0px -55% 0px' },
    );
    document.querySelectorAll('[data-feat]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // magnetic buttons
  useEffect(() => {
    const btns = document.querySelectorAll<HTMLElement>('.lp-cta-main,.lp-btn-p');
    const handlers: Array<[HTMLElement, (e: MouseEvent) => void, () => void]> = [];
    btns.forEach(btn => {
      const onMove = (e: MouseEvent) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top  + r.height / 2);
        btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.18}px) translateY(-1px)`;
      };
      const onLeave = () => { btn.style.transform = ''; };
      btn.addEventListener('mousemove', onMove as EventListener);
      btn.addEventListener('mouseleave', onLeave);
      handlers.push([btn, onMove as (e: MouseEvent) => void, onLeave]);
    });
    return () => {
      handlers.forEach(([btn, mv, lv]) => {
        btn.removeEventListener('mousemove', mv as EventListener);
        btn.removeEventListener('mouseleave', lv);
      });
    };
  }, []);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div ref={rootRef} className="lp-root">
      <div ref={progressRef} className="lp-progress" />
      <div ref={cursorRef} className="lp-cursor" />
      <div ref={cursorRingRef} className="lp-cursor-ring" />

      {/* ── Nav ── */}
      <nav ref={navRef} className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-wordmark">Hireschema</Link>
          <div className="lp-nav-actions">
            <a href="#how" className="lp-nav-link">How it works</a>
            <a href="#features" className="lp-nav-link">Features</a>
            <a href="#pricing" className="lp-nav-link">Pricing</a>
            <Link to="/login" className="lp-nav-link">Sign in</Link>
            <Link to="/login" className="lp-btn-p">Start free</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">
            <div className="lp-hero-left">
              <p className="lp-eyebrow lp-hero-eyebrow lp-fi lp-fi-1">AI Recruiting Agent · Remote Only</p>
              <h1 className="lp-display lp-dh lp-hero-hl lp-fi lp-fi-2">
                The quiet agent<br />
                that finds your<br />
                <em>next</em> remote role.
              </h1>
              <p className="lp-body-lg lp-hero-sub lp-fi lp-fi-3">
                Upload your resume. Hireschema scouts the global job market daily, scores every match against your profile, and delivers only the roles worth your attention.
              </p>
              <div className="lp-hero-cta-row lp-fi lp-fi-4">
                <Link to="/login" className="lp-cta-main">
                  Start for free <ArrowIcon />
                </Link>
                <span className="lp-cta-note">No credit card required</span>
              </div>
            </div>

            <div className="lp-hero-right lp-fi lp-fi-3">
              <div className="lp-mockup">
                <div className="lp-jcard lp-jcard-bk">
                  <div className="lp-jc-hdr">
                    <div className="lp-jc-company-badge">
                      <div className="lp-jc-logo">LN</div>
                      <div><div className="lp-jc-co">Linear Inc.</div><div className="lp-jc-ttl">Senior Product Designer</div></div>
                    </div>
                  </div>
                </div>
                <div className="lp-jcard lp-jcard-md">
                  <div className="lp-jc-hdr">
                    <div className="lp-jc-company-badge">
                      <div className="lp-jc-logo">ST</div>
                      <div><div className="lp-jc-co">Stripe</div><div className="lp-jc-ttl">Staff Software Engineer</div></div>
                    </div>
                  </div>
                </div>
                <div className="lp-jcard lp-jcard-ft">
                  <div className="lp-jc-hdr">
                    <div className="lp-jc-company-badge">
                      <div className="lp-jc-logo">VR</div>
                      <div><div className="lp-jc-co">Vercel</div><div className="lp-jc-ttl">Senior Full-Stack Engineer</div></div>
                    </div>
                    <div className="lp-score-ring">
                      <div className="lp-score-circle">94</div>
                      <span className="lp-score-lbl">Match</span>
                    </div>
                  </div>
                  <div className="lp-jc-tags">
                    {['React', 'Next.js', 'TypeScript', 'Remote · Global', '$180k–$220k'].map(t => (
                      <span key={t} className="lp-jc-tag">{t}</span>
                    ))}
                  </div>
                  <div className="lp-signal-bar"><span className="lp-signal-lbl">Resume fit</span><div className="lp-bar-track"><div className="lp-bar-fill f91" /></div></div>
                  <div className="lp-signal-bar"><span className="lp-signal-lbl">Seniority</span><div className="lp-bar-track"><div className="lp-bar-fill f88" /></div></div>
                  <div className="lp-signal-bar"><span className="lp-signal-lbl">ATS quality</span><div className="lp-bar-track"><div className="lp-bar-fill f74" /></div></div>
                  <div className="lp-jc-meta">
                    <div className="lp-jc-meta-item">Posted <span>2 days ago</span></div>
                    <div className="lp-jc-meta-item">Applications <span>Active</span></div>
                    <div className="lp-jc-meta-item">ATS <span>Clean</span></div>
                  </div>
                  <div className="lp-live">
                    <div className="lp-pulse" />
                    <span className="lp-live-lbl">Agent scanning now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="lp-marquee-strip" aria-hidden="true">
        <div className="lp-marquee-inner">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="lp-marquee-item">{item}</span>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="lp-stats">
        <div className="lp-stats-grid">
          <div className="lp-stat lp-reveal lp-d1">
            <span className="lp-stat-num" data-count="100" data-suffix="%">100%</span>
            <span className="lp-stat-lbl">Remote jobs — no on-site, ever</span>
          </div>
          <div className="lp-stat lp-reveal lp-d2">
            <span className="lp-stat-num" data-count="50" data-suffix="+">50+</span>
            <span className="lp-stat-lbl">Resume signals parsed per cycle</span>
          </div>
          <div className="lp-stat lp-reveal lp-d3">
            <span className="lp-stat-num">Daily</span>
            <span className="lp-stat-lbl">Fresh matches, every morning</span>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="lp-how">
        <div className="lp-container">
          <div className="lp-section-hdr">
            <div className="lp-reveal-l">
              <p className="lp-eyebrow" style={{ marginBottom: 12 }}>The autonomous pipeline</p>
              <h2 className="lp-display lp-ds">Three steps.<br />Zero noise.</h2>
            </div>
            <p className="lp-body-lg lp-reveal-r" style={{ maxWidth: 300 }}>
              The agent runs on its own. You show up when there's something worth seeing.
            </p>
          </div>
          <div className="lp-steps">
            {[
              { n: '01 / Upload', t: 'Feed the agent your resume', b: 'Hireschema parses your experience into 50+ semantic signals — skills, seniority, preferred domains, career trajectory. This becomes your match baseline. Set once, refined over time.' },
              { n: '02 / Scout', t: 'The agent searches globally', b: 'Each morning, Scout generates precision queries from your profile, harvests live listings, deduplicates, and applies deterministic hard filters: remote-only, salary floor, freshness, ATS integrity.' },
              { n: '03 / Match', t: 'You get only the top results', b: 'AI enrichment scores each validated listing against your actual resume. The final ranking blends fit, freshness, company quality, and salary signal. Your dashboard shows today\'s best — nothing else.' },
            ].map((s, i) => (
              <div key={s.n} className={`lp-step lp-reveal lp-d${i + 1}`}>
                <span className="lp-step-num">{s.n}</span>
                <h3 className="lp-step-ttl">{s.t}</h3>
                <p className="lp-step-body">{s.b}</p>
                {i < 2 && <div className="lp-step-conn" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="lp-features">
        <div className="lp-container">
          <div className="lp-feat-grid">

            {/* sticky left — updates as you scroll right */}
            <div className="lp-feat-left lp-reveal-l">
              <p className="lp-feat-left-eyebrow">Why Hireschema</p>
              <div key={activeFeat} className="lp-feat-left-body">
                <p className="lp-feat-left-num">0{activeFeat + 1} / 0{FEATURES.length}</p>
                <h3 className="lp-feat-left-title">{FEATURES[activeFeat].title}</h3>
                <p className="lp-feat-left-desc">{FEATURES[activeFeat].desc}</p>
              </div>
              {/* progress dots */}
              <div className="lp-feat-dots">
                {FEATURES.map((f, i) => (
                  <button
                    key={f.tag}
                    className={`lp-feat-dot-row${i === activeFeat ? ' lp-feat-dot-active' : ''}`}
                    onClick={() => {
                      document.querySelector<HTMLElement>(`[data-feat="${i}"]`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    <span className="lp-feat-dot-pip" />
                    <span className="lp-feat-dot-lbl">{f.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* scrollable right — each item activates the left panel */}
            <div className="lp-feat-list">
              {FEATURES.map((f, i) => (
                <div
                  key={f.tag}
                  data-feat={i}
                  className={`lp-feat-item lp-reveal lp-d${i + 1}${i === activeFeat ? ' lp-feat-active' : ''}`}
                >
                  <div className="lp-feat-item-hdr">
                    <h3 className="lp-feat-ttl">{f.title}</h3>
                    <span className="lp-feat-tag">{f.tag}</span>
                  </div>
                  <p className="lp-feat-desc">{f.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="lp-testi">
        <div className="lp-container">
          <span className="lp-testi-mark lp-reveal-s">&ldquo;</span>
          <blockquote className="lp-testi-body lp-reveal" style={{ transitionDelay: '0.1s' }}>
            I went from spending 3 hours a day on job boards to checking a single dashboard each morning.
            The matches were <em>actually relevant</em> — because it read my resume, not just my job title.
          </blockquote>
          <p className="lp-testi-attr lp-reveal" style={{ transitionDelay: '0.2s' }}>
            — Product Manager · 4 years remote · Landed a role in 6 weeks
          </p>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="lp-pricing">
        <div className="lp-container">
          <div className="lp-section-hdr">
            <div className="lp-reveal-l">
              <p className="lp-eyebrow" style={{ marginBottom: 12 }}>Pricing</p>
              <h2 className="lp-display lp-ds">Start free.<br />Scale when ready.</h2>
            </div>
          </div>
          <div className="lp-pricing-grid lp-reveal-s" style={{ transitionDelay: '0.1s' }}>
            <div className="lp-plan">
              <span className="lp-plan-name">Free</span>
              <div className="lp-plan-price">$0</div>
              <span className="lp-plan-period">forever — no card needed</span>
              <ul className="lp-plan-features">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="lp-plan-feature"><span className="lp-feat-dot" />{f}</li>
                ))}
              </ul>
              <Link to="/login" className="lp-btn-g">Get started</Link>
            </div>
            <div className="lp-plan">
              <span className="lp-plan-name">Pro</span>
              <div className="lp-plan-price">$19</div>
              <span className="lp-plan-period">per month — cancel anytime</span>
              <ul className="lp-plan-features">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="lp-plan-feature"><span className="lp-feat-dot" />{f}</li>
                ))}
              </ul>
              <Link to="/login" className="lp-btn-p">Start Pro trial</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-container">
          <div className="lp-cta-inner">
            <div className="lp-reveal-l">
              <p className="lp-eyebrow" style={{ marginBottom: 16 }}>Ready to start</p>
              <h2 className="lp-display lp-ds">Your next role is out there.<br />The agent will find it.</h2>
            </div>
            <div style={{ flexShrink: 0 }} className="lp-reveal-r">
              <Link to="/login" className="lp-cta-main" style={{ display: 'inline-flex' }}>
                Start for free <ArrowIcon />
              </Link>
              <p className="lp-body-sm" style={{ marginTop: 10 }}>No credit card required.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-container">
            <div className="lp-footer-grid">

              {/* Brand column */}
              <div>
                <Link to="/" className="lp-footer-logo">Hireschema</Link>
                <p className="lp-footer-tagline">Your autonomous job-search agent. Daily matches, zero noise.</p>
                <div className="lp-footer-socials">
                  <a href="https://twitter.com/hireschema" className="lp-footer-social" aria-label="X / Twitter" rel="noopener noreferrer" target="_blank">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631z"/></svg>
                  </a>
                  <a href="https://linkedin.com/company/hireschema" className="lp-footer-social" aria-label="LinkedIn" rel="noopener noreferrer" target="_blank">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                  <a href="https://github.com/hireschema" className="lp-footer-social" aria-label="GitHub" rel="noopener noreferrer" target="_blank">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                  </a>
                  <a href="mailto:hello@hireschema.com" className="lp-footer-social" aria-label="Email">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
                  </a>
                </div>
                <div className="lp-status-badge">
                  <span className="lp-status-dot" />
                  All systems operational
                </div>
              </div>

              {/* Product column */}
              <div>
                <span className="lp-footer-col-ttl">Product</span>
                <ul className="lp-footer-col-list">
                  <li><Link to="/dashboard">Dashboard</Link></li>
                  <li><Link to="/jobs">Job Tracker</Link></li>
                  <li><Link to="/dashboard">Resume Builder</Link></li>
                  <li><Link to="/dashboard">Interview Prep</Link></li>
                  <li><Link to="/settings">Settings</Link></li>
                </ul>
              </div>

              {/* Company column */}
              <div>
                <span className="lp-footer-col-ttl">Company</span>
                <ul className="lp-footer-col-list">
                  <li><a href="#about">About</a></li>
                  <li><a href="#pricing">Pricing</a></li>
                  <li><a href="#changelog">Changelog</a></li>
                  <li><a href="mailto:hello@hireschema.com">Contact</a></li>
                  <li><a href="#blog">Blog</a></li>
                </ul>
              </div>

              {/* Legal column */}
              <div>
                <span className="lp-footer-col-ttl">Legal</span>
                <ul className="lp-footer-col-list">
                  <li><Link to="/privacy">Privacy Policy</Link></li>
                  <li><Link to="/terms">Terms of Service</Link></li>
                  <li><Link to="/cookies">Cookie Policy</Link></li>
                  <li><Link to="/gdpr">Data &amp; GDPR</Link></li>
                  <li><Link to="/security">Security</Link></li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="lp-footer-bottom">
          <div className="lp-container">
            <div className="lp-footer-bottom-inner">
              <span className="lp-footer-copy">
                © {new Date().getFullYear()} Hireschema, Inc. · All rights reserved.
              </span>
              <ul className="lp-footer-legal">
                <li><Link to="/privacy">Privacy</Link></li>
                <li><Link to="/terms">Terms</Link></li>
                <li><Link to="/cookies">Cookies</Link></li>
                <li><Link to="/gdpr">GDPR</Link></li>
                <li><a href="mailto:hello@hireschema.com">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* animated counter helper */
function animateCount(el: HTMLElement) {
  const target = parseInt(el.dataset.count || '0', 10);
  const suffix = el.dataset.suffix || '';
  if (isNaN(target)) return;
  const duration = 1200;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
