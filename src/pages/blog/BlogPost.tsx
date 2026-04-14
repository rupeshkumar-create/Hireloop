import React, { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Calendar, User, Share2, Linkedin, Twitter, MessageCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { BlogPost as BlogPostType } from '../../data/blogPosts';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchPost = async () => {
      try {
        const q = query(collection(db, 'blog_posts'), where('slug', '==', slug), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setPost(snapshot.docs[0].data() as BlogPostType);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!post) {
    return <Navigate to="/blog" />;
  }

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(post.title);

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
              {new Date((post as any).publishDate || post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </div>
          </div>
        </header>

        <article className="prose prose-zinc lg:prose-lg max-w-none markdown-body text-zinc-800 leading-relaxed mb-16">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </article>

        {/* Share Buttons */}
        <div className="border-t border-zinc-200 pt-8 mt-12">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2 mb-6">
            <Share2 className="w-5 h-5 text-orange-500" /> Share this article
          </h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareTitle}`, '_blank')}>
              <Linkedin className="w-4 h-4" /> LinkedIn
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`, '_blank')}>
              <Twitter className="w-4 h-4" /> X (Twitter)
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => window.open(`https://reddit.com/submit?url=${shareUrl}&title=${shareTitle}`, '_blank')}>
              <MessageCircle className="w-4 h-4" /> Reddit
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied to clipboard!');
            }}>
              <LinkIcon className="w-4 h-4" /> Copy Link
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}