import fs from 'fs';

// Helper functions from the app (simulated)
function pickString(record, keys) {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
    if (Array.isArray(record[key]) && record[key].length > 0 && typeof record[key][0] === 'string') return record[key][0].trim();
  }
  return '';
}

function normalizeApifyItem(record) {
  const jobId = pickString(record, ['job_id', 'id', 'fingerprint']);
  const title = pickString(record, ['job_title', 'title', 'jobTitle', 'positionTitle', 'name', 'positionName']);
  const company = pickString(record, ['company_name', 'company', 'organization', 'organizationName', 'employer', 'organization_name']);
  const location = pickString(record, ['location', 'jobLocation', 'city', 'locationText', 'workplace', 'locations_derived']);
  const description = pickString(record, ['description', 'jobDescription', 'descriptionText', 'description_text', 'text', 'body', 'jobSummary']);
  const applyUrl = pickString(record, ['job_apply_url', 'applyUrl', 'applicationUrl', 'url', 'jobUrl', 'detailUrl', 'link']);
  
  if (!title || !company || !description || !applyUrl) {
    console.log(`Missing fields: title=${!!title}, company=${!!company}, description=${!!description}, applyUrl=${!!applyUrl}`);
    return null;
  }
  
  return { jobId, title, company, description, applyUrl };
}

// Manual env parsing
const envContent = fs.readFileSync('.env', 'utf-8');
let APIFY_TOKEN = envContent.split('\n').find(line => line.startsWith('APIFY_API_TOKEN='))?.split('=')[1]?.trim();
if (APIFY_TOKEN && APIFY_TOKEN.startsWith('"') && APIFY_TOKEN.endsWith('"')) {
  APIFY_TOKEN = APIFY_TOKEN.slice(1, -1);
}

async function testApify() {
  const input = {
    "aiHasSalary": false,
    "aiVisaSponsorshipFilter": false,
    "includeAi": true,
    "includeLinkedIn": false,
    "populateAiRemoteLocation": false,
    "populateAiRemoteLocationDerived": false,
    "remote only (legacy)": false,
    "removeAgency": false,
    "timeRange": "7d",
    "limit": 10,
    "descriptionType": "text",
    "titleSearch": ["Customer Success Manager"],
    "aiWorkArrangementFilter": ["Remote OK", "Remote Solely"]
  };

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/fantastic-jobs~career-site-job-listing-api/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    );

    const data = await response.json();
    console.log(`Success! Found ${data.length} items.`);
    
    for (const item of data) {
      const normalized = normalizeApifyItem(item);
      if (normalized) {
        console.log(`PASSED: ${normalized.title} at ${normalized.company}`);
      } else {
        console.log(`FAILED: ${item.title || 'Untitled'}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testApify();
