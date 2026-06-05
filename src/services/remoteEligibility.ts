// Detects whether a remote job is region-restricted, and whether the user's
// country falls inside that restriction. Conservative: when either signal is
// unknown we let the job through (the AI scoring stage is the next gate).

export type RemoteRegion =
  | 'worldwide'
  | 'us'
  | 'canada'
  | 'na'
  | 'eu'
  | 'uk'
  | 'apac'
  | 'india'
  | 'latam'
  | 'unknown';

// ISO-3166 alpha-2 country codes we care about, plus 'UNKNOWN'.
export type UserCountry = string; // e.g. 'US', 'IN', 'GB', 'CA', 'UNKNOWN'

interface DetectInput {
  location: string;
  description?: string;
}

const RX = {
  worldwide: /\b(worldwide|world[\s-]?wide|anywhere|global(ly)?|fully\s+remote\s+anywhere|remote\s+(from\s+)?anywhere)\b/i,
  // "United States only", "US-based", "must reside in the US", "EST/PST timezone", etc.
  usOnly: /\b(u\.?s\.?(a)?\.?\s*(only|based|residents?)|united\s+states\s*(only|based|residents?)|must\s+(be\s+)?(located|reside|based)\s+(in\s+)?(the\s+)?(u\.?s\.?(a)?|united\s+states)|authorized\s+to\s+work\s+in\s+the\s+(u\.?s\.?|united\s+states)|americas?\s+only)\b/i,
  usTz: /\b(est|edt|pst|pdt|cst|cdt|mst|mdt|eastern\s+time|pacific\s+time|central\s+time|mountain\s+time)\b.*\b(only|required|preferred)\b|\bmust\s+overlap\s+(with\s+)?(us|pacific|eastern|pst|est)\b/i,
  canadaOnly: /\b(canada\s*(only|based|residents?)|must\s+(be\s+)?(located|reside|based)\s+(in\s+)?canada)\b/i,
  ukOnly: /\b(u\.?k\.?\s*(only|based|residents?)|united\s+kingdom\s*(only|based|residents?))\b/i,
  euOnly: /\b((eu|europe|emea)\s*(only|based|residents?)|must\s+(be\s+)?(located|reside|based)\s+(in\s+)?(the\s+)?(eu|europe|emea))\b/i,
  apacOnly: /\b((apac|asia(\s+pacific)?)\s*(only|based|residents?)|must\s+(be\s+)?(located|reside|based)\s+(in\s+)?(apac|asia(\s+pacific)?))\b/i,
  indiaOnly: /\b(india\s*(only|based|residents?)|must\s+(be\s+)?(located|reside|based)\s+(in\s+)?india)\b/i,
  latamOnly: /\b(latam|latin\s+america)\s*(only|based|residents?)\b/i,
  // Location-string shorthand. Order matters — we test before the description.
  locUs: /remote[\s,–—\-/()]*((us|usa|u\.s\.|united\s+states|north\s+america))\b/i,
  locCa: /remote[\s,–—\-/()]*((ca|canada))\b/i,
  locUk: /remote[\s,–—\-/()]*((uk|united\s+kingdom|england))\b/i,
  locEu: /remote[\s,–—\-/()]*((eu|europe|emea))\b/i,
  locIn: /remote[\s,–—\-/()]*((india|in))\b/i,
  locApac: /remote[\s,–—\-/()]*((apac|asia\s*pacific|asia))\b/i,
  locLatam: /remote[\s,–—\-/()]*((latam|latin\s+america))\b/i,
};

export function detectRemoteRegion({ location, description }: DetectInput): RemoteRegion {
  const loc = (location || '').trim();
  const desc = (description || '').slice(0, 4000);

  // Strongest signal: explicit "Worldwide" in the location string.
  if (RX.worldwide.test(loc)) return 'worldwide';

  // Location-string shorthand (most ATS feeds put the restriction here).
  if (RX.locUs.test(loc)) return 'us';
  if (RX.locCa.test(loc)) return 'canada';
  if (RX.locUk.test(loc)) return 'uk';
  if (RX.locEu.test(loc)) return 'eu';
  if (RX.locIn.test(loc)) return 'india';
  if (RX.locApac.test(loc)) return 'apac';
  if (RX.locLatam.test(loc)) return 'latam';

  // Description-level eligibility clauses.
  if (RX.usOnly.test(desc) || RX.usTz.test(desc)) return 'us';
  if (RX.canadaOnly.test(desc)) return 'canada';
  if (RX.ukOnly.test(desc)) return 'uk';
  if (RX.euOnly.test(desc)) return 'eu';
  if (RX.indiaOnly.test(desc)) return 'india';
  if (RX.apacOnly.test(desc)) return 'apac';
  if (RX.latamOnly.test(desc)) return 'latam';

  // Worldwide hint in description as a last resort.
  if (RX.worldwide.test(desc)) return 'worldwide';

  return 'unknown';
}

const COUNTRY_TO_REGIONS: Record<string, RemoteRegion[]> = {
  US: ['us', 'na'],
  CA: ['canada', 'na'],
  MX: ['na', 'latam'],
  GB: ['uk', 'eu'],
  IE: ['eu'],
  DE: ['eu'],
  FR: ['eu'],
  NL: ['eu'],
  ES: ['eu'],
  IT: ['eu'],
  PT: ['eu'],
  PL: ['eu'],
  SE: ['eu'],
  NO: ['eu'],
  DK: ['eu'],
  FI: ['eu'],
  IN: ['india', 'apac'],
  SG: ['apac'],
  AU: ['apac'],
  NZ: ['apac'],
  JP: ['apac'],
  CN: ['apac'],
  PH: ['apac'],
  ID: ['apac'],
  VN: ['apac'],
  TH: ['apac'],
  BR: ['latam'],
  AR: ['latam'],
  MX_LATAM: ['latam'],
  CL: ['latam'],
  CO: ['latam'],
  PE: ['latam'],
};

// Timezone → country (only the obvious ones; ambiguous TZs map to UNKNOWN).
const TZ_TO_COUNTRY: Array<[RegExp, string]> = [
  [/^Asia\/Kolkata$|^Asia\/Calcutta$/, 'IN'],
  [/^Asia\/Singapore$/, 'SG'],
  [/^Asia\/Tokyo$/, 'JP'],
  [/^Asia\/Shanghai$|^Asia\/Hong_Kong$/, 'CN'],
  [/^Asia\/Manila$/, 'PH'],
  [/^Asia\/Jakarta$/, 'ID'],
  [/^Asia\/Bangkok$/, 'TH'],
  [/^Asia\/Ho_Chi_Minh$/, 'VN'],
  [/^Australia\//, 'AU'],
  [/^Pacific\/Auckland$/, 'NZ'],
  [/^Europe\/London$/, 'GB'],
  [/^Europe\/Dublin$/, 'IE'],
  [/^Europe\/Berlin$|^Europe\/Munich$/, 'DE'],
  [/^Europe\/Paris$/, 'FR'],
  [/^Europe\/Amsterdam$/, 'NL'],
  [/^Europe\/Madrid$/, 'ES'],
  [/^Europe\/Rome$/, 'IT'],
  [/^Europe\/Lisbon$/, 'PT'],
  [/^Europe\/Warsaw$/, 'PL'],
  [/^Europe\/Stockholm$/, 'SE'],
  [/^Europe\/Oslo$/, 'NO'],
  [/^Europe\/Copenhagen$/, 'DK'],
  [/^Europe\/Helsinki$/, 'FI'],
  [/^America\/Toronto$|^America\/Vancouver$|^America\/Montreal$|^America\/Edmonton$/, 'CA'],
  [/^America\/Mexico_City$/, 'MX'],
  [/^America\/Sao_Paulo$/, 'BR'],
  [/^America\/Buenos_Aires$|^America\/Argentina\//, 'AR'],
  [/^America\/Santiago$/, 'CL'],
  [/^America\/Bogota$/, 'CO'],
  [/^America\/Lima$/, 'PE'],
  [/^America\/(New_York|Los_Angeles|Chicago|Denver|Phoenix|Detroit|Anchorage|Boise|Indianapolis)$/, 'US'],
  [/^US\//, 'US'],
];

const LOCATION_TO_COUNTRY: Array<[RegExp, string]> = [
  [/\b(india|bengaluru|bangalore|hyderabad|mumbai|delhi|pune|chennai|kolkata|gurgaon|noida)\b/i, 'IN'],
  [/\b(united\s+states|u\.?s\.?a\.?|u\.?s\.?|new\s+york|san\s+francisco|seattle|austin|chicago|boston|los\s+angeles)\b/i, 'US'],
  [/\b(canada|toronto|vancouver|montreal|ottawa)\b/i, 'CA'],
  [/\b(united\s+kingdom|u\.?k\.?|london|manchester|edinburgh)\b/i, 'GB'],
  [/\b(germany|berlin|munich|hamburg)\b/i, 'DE'],
  [/\b(france|paris|lyon)\b/i, 'FR'],
  [/\b(netherlands|amsterdam|rotterdam)\b/i, 'NL'],
  [/\b(spain|madrid|barcelona)\b/i, 'ES'],
  [/\b(singapore)\b/i, 'SG'],
  [/\b(australia|sydney|melbourne)\b/i, 'AU'],
  [/\b(brazil|sao\s+paulo)\b/i, 'BR'],
  [/\b(mexico|mexico\s+city)\b/i, 'MX'],
];

/**
 * Deterministic resume-text → "City, Country" extractor. Used to backfill
 * the user's location when the AI-based preference extractor misses it.
 * Scans the first 800 chars (resume header area) for a city/country pair
 * we recognise and returns a normalised "<City>, <Country>" string.
 */
export function extractLocationFromResume(resumeText: string): {
  rawLabel?: string;
  country: UserCountry;
} {
  if (!resumeText) return { country: 'UNKNOWN' };
  // Resume headers typically sit in the first ~800 chars. Looking further down
  // increases the chance of grabbing a former-employer city instead of "home".
  const head = resumeText.slice(0, 800).replace(/\s+/g, ' ');

  for (const [rx, code] of LOCATION_TO_COUNTRY) {
    const match = head.match(rx);
    if (match) {
      const phrase = match[0];
      const countryNames: Record<string, string> = {
        IN: 'India', US: 'United States', CA: 'Canada', GB: 'United Kingdom',
        DE: 'Germany', FR: 'France', NL: 'Netherlands', ES: 'Spain',
        SG: 'Singapore', AU: 'Australia', BR: 'Brazil', MX: 'Mexico',
      };
      // If the matched phrase is already a country name, return it as-is.
      // Otherwise it's a city — pair it with the resolved country.
      const isCountry = /^(india|united\s+states|u\.?s\.?a?|canada|united\s+kingdom|u\.?k\.?|germany|france|netherlands|spain|singapore|australia|brazil|mexico)$/i.test(
        phrase.trim()
      );
      const rawLabel = isCountry
        ? countryNames[code] || phrase
        : `${phrase.replace(/\b\w/g, (c) => c.toUpperCase())}, ${countryNames[code] || code}`;
      return { rawLabel, country: code };
    }
  }
  return { country: 'UNKNOWN' };
}

export interface InferUserCountryInput {
  deliveryTimezone?: string;
  locations?: string[];
}

export function inferUserCountry(input: InferUserCountryInput): UserCountry {
  const tz = (input.deliveryTimezone || '').trim();
  if (tz) {
    for (const [rx, code] of TZ_TO_COUNTRY) {
      if (rx.test(tz)) return code;
    }
  }

  for (const raw of input.locations || []) {
    const value = (raw || '').toString();
    for (const [rx, code] of LOCATION_TO_COUNTRY) {
      if (rx.test(value)) return code;
    }
  }

  return 'UNKNOWN';
}

// Returns true when we should *not* reject — either eligibility is unknown,
// the region is worldwide, or the user's country sits inside the restricted
// region. Returns false only when both sides are known and disjoint.
export function isRegionEligibleForCountry(
  region: RemoteRegion,
  country: UserCountry
): boolean {
  if (region === 'unknown' || region === 'worldwide') return true;
  if (!country || country === 'UNKNOWN') return true;

  const eligibleRegions = COUNTRY_TO_REGIONS[country] || [];
  return eligibleRegions.includes(region);
}
