import fs from 'fs';

// Manual env parsing
const envContent = fs.readFileSync('.env', 'utf-8');
let APIFY_TOKEN = envContent.split('\n').find(line => line.startsWith('APIFY_API_TOKEN='))?.split('=')[1]?.trim();

// Strip quotes if present
if (APIFY_TOKEN && APIFY_TOKEN.startsWith('"') && APIFY_TOKEN.endsWith('"')) {
  APIFY_TOKEN = APIFY_TOKEN.slice(1, -1);
}

async function testApify() {
  if (!APIFY_TOKEN) {
    console.error('APIFY_API_TOKEN is not set in .env');
    return;
  }

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
    "limit": 50,
    "descriptionType": "text",
    "titleSearch": ["Customer Success Manager", "Operations Manager"],
    "aiWorkArrangementFilter": ["Remote OK", "Remote Solely"]
  };

  console.log('Testing Apify with aiWorkArrangementFilter:', JSON.stringify(input, null, 2));

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/fantastic-jobs~career-site-job-listing-api/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Success! Found ${data.length} items.`);
    if (data.length > 0) {
      console.log('Sample arrangements:', data.slice(0, 5).map(i => i.ai_work_arrangement).join(', '));
      console.log('Sample titles:', data.slice(0, 5).map(i => i.title).join(', '));
    } else {
      console.log('No items returned with aiWorkArrangementFilter.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testApify();
