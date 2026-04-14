import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ArrowLeft } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      <nav className="border-b border-zinc-200 bg-white/80 backdrop-blur-xl fixed top-0 w-full z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center justify-center rounded-none bg-zinc-900 shadow-md h-8 w-8">
            <Briefcase className="h-4 w-4 text-white" />
          </Link>
          <span className="font-bold text-xl tracking-tight">Hireschema</span>
          <div className="flex-1"></div>
          <Link to="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24 prose prose-zinc">
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        
        <h2>1. Introduction</h2>
        <p>Welcome to Hireschema. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>

        <h2>2. The Data We Collect About You</h2>
        <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows:</p>
        <ul>
          <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
          <li><strong>Contact Data</strong> includes email address and telephone numbers.</li>
          <li><strong>Resume Data</strong> includes your uploaded resumes, employment history, and career preferences.</li>
          <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location.</li>
        </ul>

        <h2>3. How We Use Your Personal Data</h2>
        <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
        <ul>
          <li>To register you as a new user.</li>
          <li>To provide our AI recruiting agent services, including analyzing your resume and finding job matches.</li>
          <li>To process and deliver your order, including managing payments.</li>
          <li>To send you daily job alert emails.</li>
        </ul>

        <h2>4. Data Security</h2>
        <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.</p>

        <h2>5. Your Legal Rights</h2>
        <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data and (where the lawful ground of processing is consent) to withdraw consent.</p>

        <h2>6. Contact Us</h2>
        <p>If you have any questions about this privacy policy or our privacy practices, please contact us at support@hireschema.com.</p>
      </main>
    </div>
  );
}
