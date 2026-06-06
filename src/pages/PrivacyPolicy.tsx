import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-4xl py-12 md:py-16">
      <div className="markdown-body max-w-none rounded-xl border border-border bg-surface p-8 md:p-12">
        <Link to="/" className="mb-8 inline-flex items-center text-sm text-foreground-muted transition-colors no-underline hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
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

        <h2 id="security">4. Data Security</h2>
        <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.</p>
        <p>Authentication is handled through Google Sign-In. Payment data is processed by our payment provider; we do not store full card numbers on our servers. API keys and service credentials are kept server-side and are never exposed in client bundles.</p>

        <h2 id="cookies">5. Cookies & Local Storage</h2>
        <p>We use essential cookies and browser storage to keep you signed in, remember theme preferences, and maintain session state during onboarding. We do not use third-party advertising cookies. You can clear cookies through your browser settings, though doing so will sign you out of the app.</p>

        <h2>6. Your Legal Rights</h2>
        <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data and (where the lawful ground of processing is consent) to withdraw consent.</p>

        <h2>7. Contact Us</h2>
        <p>If you have any questions about this privacy policy or our privacy practices, please contact us at support@hireschema.com.</p>
      </div>
    </div>
  );
}
