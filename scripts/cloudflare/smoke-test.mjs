import { readFile, appendFile } from 'node:fs/promises';

const { origin } = JSON.parse(await readFile('.cloudflare-state.json', 'utf8'));
const base = origin.replace(/\/$/, '');
let lastError;

for (let attempt = 0; attempt < 8; attempt++) {
  try {
    const health = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(15000),
    });
    const healthBody = await health.json();
    if (!health.ok || healthBody.service !== 'approveflow-worker') {
      throw new Error('Worker health response is invalid.');
    }

    const privateApi = await fetch(`${base}/api/clients`);
    if (
      privateApi.status !== 401 ||
      !privateApi.headers.get('content-type')?.includes('application/json')
    ) {
      throw new Error('Private API did not reject unauthenticated access.');
    }

    const uploadApi = await fetch(`${base}/api/uploads/single/presign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'smoke-test.txt',
        contentType: 'text/plain',
        size: 1,
      }),
    });
    if (uploadApi.status !== 401) {
      throw new Error('Upload-signing API did not reject unauthenticated access.');
    }

    const spa = await fetch(`${base}/app/dashboard`, {
      headers: { 'Sec-Fetch-Mode': 'navigate' },
    });
    if (!spa.ok || !spa.headers.get('content-type')?.includes('text/html')) {
      throw new Error('React SPA navigation failed.');
    }

    const summary =
      'Health, React navigation, private API, and upload authorization checks passed.';
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${summary}\n`);
    }
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

if (lastError) throw lastError;
