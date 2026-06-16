export interface GeoLocation {
  id: string;
  name: string;
  region: string;
  timezoneNote: string;
  salaryCurrency: string;
  popularChannels: string[];
  hiringNotes: string[];
}

export const GEO_LOCATIONS: GeoLocation[] = [
  {
    id: 'united-states',
    name: 'United States',
    region: 'North America',
    timezoneNote: 'Multiple US time zones — East Coast overlap is often required even for “remote” roles.',
    salaryCurrency: 'USD',
    popularChannels: ['LinkedIn', 'Wellfound', 'Greenhouse/Lever feeds', 'referrals'],
    hiringNotes: [
      'State-level pay transparency laws increase salary visibility on postings.',
      'Remote-washing remains common — verify location lines in the description.',
      'Referrals and warm intros still compress hiring loops.',
    ],
  },
  {
    id: 'united-kingdom',
    name: 'United Kingdom',
    region: 'Europe',
    timezoneNote: 'GMT/BST — strong overlap with EU and partial US East Coast hours.',
    salaryCurrency: 'GBP',
    popularChannels: ['LinkedIn', 'Otta', 'company ATS pages', 'specialist remote boards'],
    hiringNotes: [
      'Right-to-work and contractor IR35 rules affect eligibility.',
      'Salary bands often listed in GBP with remote-friendly startups growing post-2020.',
    ],
  },
  {
    id: 'germany',
    name: 'Germany',
    region: 'Europe',
    timezoneNote: 'CET — EU remote roles often require EU/EEA work authorization.',
    salaryCurrency: 'EUR',
    popularChannels: ['LinkedIn', 'Otta', 'EU remote boards', 'Berlin startup ecosystem'],
    hiringNotes: [
      'English-speaking remote roles exist but EU work rights are frequently required.',
      'Collective agreements affect compensation in some industries.',
    ],
  },
  {
    id: 'canada',
    name: 'Canada',
    region: 'North America',
    timezoneNote: 'ET/PT splits — Toronto/Vancouver hubs with US-aligned schedules.',
    salaryCurrency: 'CAD',
    popularChannels: ['LinkedIn', 'Wellfound', 'Remote OK', 'local startup networks'],
    hiringNotes: [
      'Many US companies hire Canadians as remote employees with simpler timezone alignment.',
      'Provincial labor rules can affect employment vs contractor offers.',
    ],
  },
  {
    id: 'philippines',
    name: 'Philippines',
    region: 'Southeast Asia',
    timezoneNote: 'PHT — popular for US customer-facing and ops remote roles.',
    salaryCurrency: 'PHP / USD',
    popularChannels: ['OnlineJobs.ph', 'LinkedIn', 'Remote OK', 'BPO transition roles'],
    hiringNotes: [
      'Strong English proficiency is a market advantage.',
      'BPO veterans often transition to global remote SaaS roles.',
    ],
  },
  {
    id: 'australia',
    name: 'Australia',
    region: 'Oceania',
    timezoneNote: 'AEST — partial overlap with US West late night and APAC mornings.',
    salaryCurrency: 'AUD',
    popularChannels: ['LinkedIn', 'Seek', 'Remote OK', 'APAC remote communities'],
    hiringNotes: [
      'APAC-headquartered remote roles are growing in SaaS and fintech.',
      'Superannuation and employment type affect total comp.',
    ],
  },
  {
    id: 'brazil',
    name: 'Brazil',
    region: 'Latin America',
    timezoneNote: 'BRT — reasonable overlap with US East for many product and engineering teams.',
    salaryCurrency: 'BRL / USD',
    popularChannels: ['LinkedIn', 'Remote OK', 'LatAm remote communities', 'US startups hiring LatAm'],
    hiringNotes: [
      'USD-denominated contractor roles are common from US employers.',
      'Strong GitHub and portfolio presence helps overcome geography bias.',
    ],
  },
  {
    id: 'nigeria',
    name: 'Nigeria',
    region: 'Africa',
    timezoneNote: 'WAT — growing remote talent pool for global startups.',
    salaryCurrency: 'NGN / USD',
    popularChannels: ['LinkedIn', 'Remote OK', 'Andela alumni network', 'global contractor marketplaces'],
    hiringNotes: [
      'Payment rails and contract clarity matter — confirm USD/EUR pay and tools upfront.',
      'Developer communities produce strong candidates for distributed engineering teams.',
    ],
  },
  {
    id: 'pakistan',
    name: 'Pakistan',
    region: 'South Asia',
    timezoneNote: 'PKT — similar overlap profile to India for US/EU remote teams.',
    salaryCurrency: 'PKR / USD',
    popularChannels: ['LinkedIn', 'Remote OK', 'freelance-to-full-time pipelines', 'referrals'],
    hiringNotes: [
      'Verify tax and contract structure for cross-border remote work.',
      'Strong engineering and design talent pools compete globally on portfolios.',
    ],
  },
  {
    id: 'india',
    name: 'India',
    region: 'South Asia',
    timezoneNote: 'IST (UTC+5:30) — overlap with US East morning and EU afternoon is common for remote contracts.',
    salaryCurrency: 'INR / USD',
    popularChannels: ['LinkedIn', 'Wellfound', 'Remote OK', 'company career pages', 'referrals'],
    hiringNotes: [
      'Many US and EU companies hire remote ICs in India as contractors or through EOR partners.',
      'Clarify whether a “remote” post allows India-based applicants — many listings still geo-restrict.',
      'Strong English communication and async documentation habits are differentiators.',
      'Portfolio and GitHub links matter heavily for engineering roles.',
    ],
  },
];
