#!/usr/bin/env node
/**
 * Smoke-test public API routes against production (or BASE_URL).
 * Usage: node scripts/smoke-test-api.mjs
 *        BASE_URL=https://www.hireschema.com node scripts/smoke-test-api.mjs
 */

const base = (process.env.BASE_URL || 'https://www.hireschema.com').replace(/\/$/, '');

async function check(name, url, init, assert) {
  const res = await fetch(`${base}${url}`, { redirect: 'follow', ...init });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  try {
    assert({ res, contentType, text, json });
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    if (text && text.length < 300) console.error(`  body: ${text}`);
    else if (text) console.error(`  body: ${text.slice(0, 200)}…`);
    return false;
  }
}

async function main() {
  console.log(`Smoke testing ${base}\n`);

  const results = await Promise.all([
    check(
      'GET /api/blog?limit=3',
      '/api/blog?limit=3',
      { method: 'GET' },
      ({ res, contentType, json }) => {
        if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
        if (!contentType.includes('application/json')) throw new Error(`expected JSON, got ${contentType}`);
        if (!json || !Array.isArray(json.posts)) throw new Error('expected { posts: [] }');
      }
    ),
    check(
      'GET /api/blog/cover?slug=test',
      '/api/blog/cover?slug=test',
      { method: 'GET' },
      ({ res, contentType }) => {
        if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
        if (!contentType.includes('image/svg+xml') && !contentType.includes('svg')) {
          throw new Error(`expected SVG, got ${contentType}`);
        }
      }
    ),
    check(
      'POST /api/jobs (no auth)',
      '/api/jobs',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'request' }),
      },
      ({ res, contentType, json }) => {
        if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
        if (!contentType.includes('application/json')) throw new Error(`expected JSON, got ${contentType}`);
        if (!json?.error) throw new Error('expected JSON error body');
      }
    ),
    check(
      'POST /api/openai (no auth)',
      '/api/openai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      },
      ({ res, contentType, json }) => {
        if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
        if (!contentType.includes('application/json')) throw new Error(`expected JSON, got ${contentType}`);
        if (!json?.error) throw new Error('expected JSON error body');
      }
    ),
    check(
      'GET /api/admin/content-growth (no auth)',
      '/api/admin/content-growth',
      { method: 'GET', headers: { Authorization: 'Bearer invalid' } },
      ({ res, contentType, json }) => {
        if (res.status !== 401 && res.status !== 403) {
          throw new Error(`expected 401/403, got ${res.status}`);
        }
        if (!contentType.includes('application/json')) throw new Error(`expected JSON, got ${contentType}`);
        if (!json?.error) throw new Error('expected JSON error body');
      }
    ),
  ]);

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n${passed}/${total} checks passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
