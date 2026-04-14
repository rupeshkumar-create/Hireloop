import React from 'react';
import { Link } from 'react-router-dom';
import { blogPosts } from '../../data/blogPosts';
import { ArrowRight, Calendar } from 'lucide-react';

export function BlogIndex() {
  return (
    <div className="min-h-screen bg-zinc-50 pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 mb-4 font-display">
            The Hireschema Blog
          </h1>
          <p className="text-xl text-zinc-500">
            Insights, strategies, and guides on landing the best remote jobs.
          </p>
        </div>

        <div className="grid gap-8">
          {blogPosts.map((post) => (
            <Link 
              key={post.slug} 
              to={`/blog/${post.slug}`}
              className="block bg-white border border-zinc-200 p-8 hover:shadow-lg hover:-translate-y-1 transition-all rounded-2xl"
            >
              <div className="flex items-center text-sm text-zinc-500 mb-3 gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-3 font-display">
                {post.title}
              </h2>
              <p className="text-zinc-600 mb-6 leading-relaxed">
                {post.excerpt}
              </p>
              <div className="text-orange-500 font-medium flex items-center">
                Read article <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}