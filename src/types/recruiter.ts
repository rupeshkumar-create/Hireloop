export interface RecruiterContact {
  name: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
  company?: string;
  source?: 'apify' | 'apollo' | 'manual' | 'jill';
}

export function isRecruiterReachable(contact: RecruiterContact | null | undefined): boolean {
  if (!contact) return false;
  return Boolean(contact.email?.trim() || contact.linkedinUrl?.trim());
}
