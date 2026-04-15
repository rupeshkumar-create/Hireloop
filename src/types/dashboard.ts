export interface Job {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  requirements: string[];
  matchScore?: number;
  datePosted?: string;
  requiresRelocation?: boolean;
}

export type SortOption = 'matchScore' | 'company' | 'datePosted';
