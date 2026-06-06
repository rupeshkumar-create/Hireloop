import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import type { Components } from 'react-markdown';

const components: Components = {
  h1: () => null,
  h2: ({ children }) => (
    <h2 className="blog-h2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="blog-h3">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="blog-h4">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="blog-p">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="blog-ul">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="blog-ol">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="blog-li">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="blog-strong">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="blog-em">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="blog-blockquote">{children}</blockquote>
  ),
  hr: () => <hr className="blog-hr" />,
  table: ({ children }) => (
    <div className="blog-table-wrap">
      <table className="blog-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="blog-thead">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="blog-tr">{children}</tr>,
  th: ({ children }) => <th className="blog-th">{children}</th>,
  td: ({ children }) => <td className="blog-td">{children}</td>,
  a: ({ href, children }) => {
    const isInternal = href?.startsWith('/') || href?.includes('hireschema.com/blog/');
    const path = href?.replace(/^https?:\/\/[^/]+/, '') ?? '/';
    if (isInternal && path.startsWith('/')) {
      return (
        <Link to={path} className="blog-link">
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className="blog-link" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
};

interface BlogArticleMarkdownProps {
  content: string;
}

export function BlogArticleMarkdown({ content }: BlogArticleMarkdownProps) {
  return (
    <div className="blog-article markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
