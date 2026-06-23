import { describe, expect, it } from 'vitest';
import { extractContactFromText } from '../../services/aiService';
import {
  enrichResumeTextWithHyperlinks,
  normalizeLinkedInUrl,
  pickLinkedInFromUrls,
} from '../resumeHyperlinks';

describe('resumeHyperlinks', () => {
  it('normalizes linkedin URLs from hyperlink targets', () => {
    expect(
      normalizeLinkedInUrl('https://www.linkedin.com/in/rupesh-kumar?utm_source=share')
    ).toBe('linkedin.com/in/rupesh-kumar');
  });

  it('picks linkedin from a list of mixed hyperlinks', () => {
    expect(
      pickLinkedInFromUrls([
        'https://github.com/rupesh',
        'https://linkedin.com/in/rupesh7126',
        'https://mysite.dev',
      ])
    ).toBe('linkedin.com/in/rupesh7126');
  });

  it('extracts linkedin when visible text is only the word LinkedIn', () => {
    const text = `
      Rupesh Kumar
      Email: rupesh7126@gmail.com
      LinkedIn | GitHub
    `;
    const hyperlinks = ['https://www.linkedin.com/in/rupesh7126'];
    const contact = extractContactFromText(text, hyperlinks);
    expect(contact.linkedin).toBe('linkedin.com/in/rupesh7126');
    expect(contact.email).toBe('rupesh7126@gmail.com');
  });

  it('enriches resume text with hyperlink URLs for downstream parsers', () => {
    const enriched = enrichResumeTextWithHyperlinks('Name\nLinkedIn', [
      'https://linkedin.com/in/jane-doe',
    ]);
    expect(enriched).toContain('linkedin.com/in/jane-doe');
  });
});
