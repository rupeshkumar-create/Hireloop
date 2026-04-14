import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { blogPosts } from '../../data/blogPosts';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Calendar, User } from 'lucide-react';

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.slug === slug);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return <Navigate to="/blog" />;
  }

  return (
    <div className="min-h-screen bg-white pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-6">
        <Link to="/blog" className="inline-flex items-center text-zinc-500 hover:text-zinc-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
        </Link>
        
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-6 font-display leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-6 text-sm text-zinc-500 border-y border-zinc-100 py-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </div>
          </div>
        </header>

        <article className="prose prose-zinc lg:prose-lg max-w-none markdown-body text-zinc-800 leading-relaxed">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}