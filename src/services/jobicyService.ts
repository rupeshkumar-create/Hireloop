import { SerperJob } from './serperService';

function stripHtml(html: string) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function mapLocationToGeo(location: string): string {
  if (!location) return '';
  const loc = location.toLowerCase();
  if (loc.includes('us') || loc.includes('united states') || loc.includes('america')) return 'usa';
  if (loc.includes('canada')) return 'canada';
  if (loc.includes('uk') || loc.includes('united kingdom') || loc.includes('london')) return 'uk';
  if (loc.includes('australia')) return 'australia';
  if (loc.includes('germany')) return 'germany';
  if (loc.includes('france')) return 'france';
  if (loc.includes('spain')) return 'spain';
  if (loc.includes('europe') || loc.includes('eu')) return 'europe';
  if (loc.includes('latam') || loc.includes('latin america')) return 'latam';
  if (loc.includes('apac') || loc.includes('asia')) return 'apac';
  if (loc.includes('emea')) return 'emea';
  return '';
}

export async function searchJobicy(tags: string[], location: string): Promise<SerperJob[]> {
  const allJobs: SerperJob[] = [];
  const seenIds = new Set();
  const geo = mapLocationToGeo(location);

  // To avoid rate limits, we'll only use the top 2 tags
  const searchTags = tags.slice(0, 2);
  if (searchTags.length === 0) searchTags.push('software');

  for (const tag of searchTags) {
    try {
      const safeTag = tag.replace(/\s+/g, '-').toLowerCase();
      // Only include geo if it's a known mapping. Jobicy defaults to global/anywhere.
      const url = `https://jobicy.com/api/v2/remote-jobs?count=30&tag=${encodeURIComponent(safeTag)}${geo ? `&geo=${geo}` : ''}`;
      console.log('Fetching from Jobicy:', url);
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Hireschema/1.0'
        }
      });
      
      if (!res.ok) {
        console.warn(`Jobicy fetch failed with status: ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      
      if (data.success === false) {
        console.warn(`Jobicy API returned false success for tag: ${tag}. Message:`, data.message);
        continue;
      }

      if (data.jobs && Array.isArray(data.jobs)) {
        for (const j of data.jobs) {
          if (!seenIds.has(j.id)) {
            seenIds.add(j.id);
            
            const pubDate = new Date(j.pubDate);
            const diffTime = Math.abs(new Date().getTime() - pubDate.getTime());
            const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            let salary = '';
            if (j.salaryMin) {
              salary = `$${j.salaryMin}${j.salaryMax ? ` - $${j.salaryMax}` : ''} ${j.salaryCurrency} ${j.salaryPeriod}`;
            }

            allJobs.push({
              title: j.jobTitle,
              company: j.companyName,
              location: j.jobGeo,
              description: stripHtml(j.jobDescription),
              applyLink: j.url,
              salary,
              postedAt: j.pubDate,
              daysOld,
              requiresRelocation: false // Jobicy jobs are natively remote
            });
          }
        }
      }
    } catch (e) {
      console.error("Jobicy fetch error:", e);
    }
  }
  
  return allJobs;
}
