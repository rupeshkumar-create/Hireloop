import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { HireloopLogo } from '../brand/HireloopLogo';
import { WhatsAppSupportLink } from '../support/WhatsAppSupportLink';
import { WhatsAppFloatingButton } from '../support/WhatsAppFloatingButton';
import '../../styles/blogLanding.css';

interface BlogLayoutProps {
  children: React.ReactNode;
}

export function BlogLayout({ children }: BlogLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="blog-lp-root min-h-screen flex flex-col">
      <nav className="blog-lp-nav">
        <div className="blog-lp-nav-inner">
          <Link to="/" className="blog-lp-wordmark">
            <HireloopLogo height={26} />
          </Link>
          <div className="blog-lp-nav-actions">
            <Link to="/blog" className="blog-lp-nav-link">
              Hiring Guides
            </Link>
            <Link to="/" className="blog-lp-nav-link hidden sm:inline">
              Home
            </Link>
            <WhatsAppSupportLink className="blog-lp-nav-link hidden text-[#128C7E] hover:text-[#075E54] md:inline-flex" />
            {user ? (
              <Link to="/dashboard" className="blog-lp-btn-p">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="blog-lp-btn-p">
                Get Started
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="blog-lp-footer">
        <p className="blog-lp-footer-copy">
          © {new Date().getFullYear()} Hireloop ·{' '}
          <Link to="/privacy" className="blog-lp-nav-link">
            Privacy
          </Link>
          {' · '}
          <Link to="/terms" className="blog-lp-nav-link">
            Terms
          </Link>
          {' · '}
          <WhatsAppSupportLink className="blog-lp-nav-link text-[#128C7E] hover:text-[#075E54]" />
        </p>
      </footer>
      <WhatsAppFloatingButton />
    </div>
  );
}
