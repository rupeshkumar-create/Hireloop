/**
 * Extract hyperlink targets from resume files. Many resumes show "LinkedIn"
 * as visible text while the actual linkedin.com/in/… URL lives only in the
 * PDF link annotation or DOCX <a href>.
 */

export interface ResumeParseResult {
  text: string;
  hyperlinkUrls: string[];
}

const LINKEDIN_PATH_RE =
  /(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\/(?:in|pub)\/[\w%-]+(?:\/[\w%-]+)*/i;

/** Normalize a LinkedIn profile URL to linkedin.com/in/… (no scheme). */
export function normalizeLinkedInUrl(raw: string): string | undefined {
  const decoded = decodeURIComponent(raw.trim()).replace(/&amp;/gi, '&');
  const match = decoded.match(LINKEDIN_PATH_RE);
  if (!match) return undefined;
  let url = match[0].replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  // Drop tracking query strings
  url = url.split('?')[0]!.split('#')[0]!.replace(/\/+$/, '');
  return url.toLowerCase();
}

export function collectUrlsFromHyperlinks(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function enrichResumeTextWithHyperlinks(text: string, hyperlinkUrls: string[]): string {
  const urls = collectUrlsFromHyperlinks(hyperlinkUrls);
  if (urls.length === 0) return text;
  return `${text}\n\n${urls.join('\n')}`;
}

export async function extractPdfTextAndUrls(arrayBuffer: ArrayBuffer): Promise<ResumeParseResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const hyperlinkUrls: string[] = [];
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += `${pageText}\n`;

    try {
      const annotations = await page.getAnnotations();
      for (const annot of annotations) {
        const record = annot as { url?: string; unsafeUrl?: string };
        const url = record.url || record.unsafeUrl;
        if (typeof url === 'string' && url.startsWith('http')) {
          hyperlinkUrls.push(url);
        }
      }
    } catch {
      // Some PDF builds omit annotations — text-only fallback still works.
    }
  }

  return { text: fullText, hyperlinkUrls: collectUrlsFromHyperlinks(hyperlinkUrls) };
}

export async function extractDocxTextAndUrls(arrayBuffer: ArrayBuffer): Promise<ResumeParseResult> {
  const mammoth = await import('mammoth');
  const [rawResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer }),
    mammoth.convertToHtml({ arrayBuffer }),
  ]);

  const hyperlinkUrls: string[] = [];
  const hrefRe = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(htmlResult.value))) {
    const href = match[1]?.trim();
    if (href && /^https?:\/\//i.test(href)) {
      hyperlinkUrls.push(href);
    }
  }

  return {
    text: rawResult.value,
    hyperlinkUrls: collectUrlsFromHyperlinks(hyperlinkUrls),
  };
}

export function pickLinkedInFromUrls(urls: string[]): string | undefined {
  for (const url of urls) {
    const normalized = normalizeLinkedInUrl(url);
    if (normalized) return normalized;
  }
  return undefined;
}
