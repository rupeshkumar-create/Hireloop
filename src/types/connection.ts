export type ConnectionRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface ConnectionRequest {
  id: string;
  candidateUserId: string;
  candidateName: string;
  candidateEmail: string;
  candidateLinkedin?: string;
  jobTitle: string;
  company: string;
  jobUrl?: string;
  trackedJobId?: string;
  recruiterName: string;
  recruiterTitle?: string;
  recruiterEmail?: string;
  recruiterLinkedin?: string;
  introMessage?: string;
  status: ConnectionRequestStatus;
  createdAt: string;
  updatedAt?: string;
}
