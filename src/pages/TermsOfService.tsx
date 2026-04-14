import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ArrowLeft } from 'lucide-react';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-surface text-foreground font-sans">
      <nav className="border-b border-border bg-surface/80 backdrop-blur-xl fixed top-0 w-full z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center justify-center rounded-none bg-foreground shadow-md h-8 w-8">
            <Briefcase className="h-4 w-4 text-surface" />
          </Link>
          <span className="font-bold text-xl tracking-tight">Hireschema</span>
          <div className="flex-1"></div>
          <Link to="/" className="text-sm font-medium text-foreground-muted hover:text-foreground flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24 prose prose-zinc">
        <h1>Terms of Service</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using Hireschema ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>

        <h2>2. Description of Service</h2>
        <p>Hireschema provides an AI-powered recruiting agent that analyzes user resumes, searches the internet for relevant job postings, generates personalized cold emails, and tracks job applications. The Service is available via a free tier and a paid subscription tier.</p>

        <h2>3. User Obligations</h2>
        <p>You agree to use the Service only for lawful purposes. You must not use the Service to transmit any material that is illegal, offensive, defamatory, or infringes on the intellectual property rights of others. You are responsible for maintaining the confidentiality of your account credentials.</p>

        <h2>4. Subscriptions and Billing</h2>
        <p>Certain features of the Service are billed on a subscription basis ("Pro Plan"). You will be billed in advance on a recurring and periodic basis (either monthly or annually). Your subscription will automatically renew under the exact same conditions unless you cancel it or we cancel it.</p>
        <p>All payments are processed securely via Dodo Payments. We do not store or process complete credit card information on our servers.</p>

        <h2>5. Intellectual Property</h2>
        <p>The Service and its original content, features, and functionality are and will remain the exclusive property of Hireschema and its licensors. The Service is protected by copyright, trademark, and other laws.</p>

        <h2>6. Disclaimer of Warranties</h2>
        <p>Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We do not warrant that the Service will function uninterrupted, secure or available at any particular time or location, or that any errors or defects will be corrected.</p>
        <p>Hireschema does not guarantee that you will receive job offers, interviews, or employment as a result of using our Service.</p>

        <h2>7. Limitation of Liability</h2>
        <p>In no event shall Hireschema, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>

        <h2>8. Changes to Terms</h2>
        <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>
      </main>
    </div>
  );
}
