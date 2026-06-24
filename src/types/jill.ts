import type { ConnectionRequestStatus } from './connection';

export type IntroThreadStatus =
  | 'candidate_review'
  | 'candidate_accepted'
  | 'sent_to_recruiter'
  | 'recruiter_accepted'
  | 'recruiter_declined'
  | 'scheduled'
  | 'skipped';

export interface RecruiterProfile {
  userId: string;
  companyName: string;
  companyWebsite?: string;
  title?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecruiterJob {
  id: string;
  recruiterUserId: string;
  title: string;
  company: string;
  location: string;
  salaryRange?: string;
  description: string;
  requirements: string[];
  status: 'open' | 'closed' | 'filled';
  createdAt: string;
  updatedAt?: string;
  recruiterName?: string;
  recruiterEmail?: string;
}

export interface IntroThread extends Record<string, unknown> {
  id: string;
  candidateUserId: string;
  candidateName: string;
  candidateEmail: string;
  candidateLinkedin?: string | null;
  jobTitle: string;
  company: string;
  jobUrl?: string | null;
  trackedJobId?: string | null;
  recruiterUserId?: string | null;
  recruiterJobId?: string | null;
  recruiterName: string;
  recruiterTitle?: string;
  recruiterEmail?: string | null;
  recruiterLinkedin?: string | null;
  introMessage?: string | null;
  status: ConnectionRequestStatus;
  threadStatus: IntroThreadStatus;
  jackNarration?: string;
  matchScore?: number;
  emailSent?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export function jackIntroNarration(input: {
  recruiterName: string;
  recruiterTitle?: string;
  company: string;
  jobTitle: string;
  highlight?: string;
}): string {
  const title = input.recruiterTitle ? `, ${input.recruiterTitle}` : '';
  const highlight = input.highlight ? ` He liked your ${input.highlight}.` : '';
  return `${input.recruiterName}${title} at ${input.company} wants to chat about the ${input.jobTitle} role.${highlight}`;
}
