export interface RecruiterContact {
  name: string;
  title: string;
  email: string;
  linkedinUrl?: string;
}

export interface ApolloRecruiterPayload {
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
}

export function normalizeApolloRecruiter(
  payload: ApolloRecruiterPayload
): RecruiterContact | null {
  const email = payload.email?.trim();
  if (!email) {
    return null;
  }

  const fullName =
    payload.name?.trim() ||
    [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim();

  return {
    name: fullName || 'Unknown Recruiter',
    title: payload.title?.trim() || 'Recruiter',
    email,
    linkedinUrl: payload.linkedin_url?.trim() || undefined,
  };
}

import { getAiAuthToken } from './aiAuth';

export async function fetchRecruiterFromApollo(input: {
  company: string;
  jobTitle: string;
}): Promise<RecruiterContact | null> {
  const authToken = await getAiAuthToken();
  if (!authToken) {
    console.warn('Not authenticated; skipping recruiter lookup.');
    return null;
  }

  try {
    const response = await fetch('/api/apollo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        q_organization_name: input.company,
        person_titles: ['Recruiter', 'Talent Partner', 'Hiring Manager'],
        page: 1,
        per_page: 5,
      }),
    });

    if (!response.ok) {
      console.error('Apollo recruiter lookup failed with status:', response.status);
      return null;
    }

    const data = await response.json();
    const people = Array.isArray(data.people) ? data.people : [];

    for (const person of people) {
      const recruiter = normalizeApolloRecruiter(person);
      if (recruiter) {
        return recruiter;
      }
    }

    return null;
  } catch (error) {
    console.error('Apollo recruiter lookup error:', error);
    return null;
  }
}
