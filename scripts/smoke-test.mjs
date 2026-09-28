const origin = process.env.APP_ORIGIN;
if (!origin) {
  console.log('APP_ORIGIN not configured; skipping remote smoke test.');
  process.exit(0);
}
let last;
for (let i = 0; i < 6; i++) {
  try {
    const health = await fetch(`${origin.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(15000) });
    const body = await health.json();
    if (!health.ok || body.service !== 'approveflow-worker') throw new Error('Health endpoint invalid');
    const spa = await fetch(`${origin.replace(/\/$/, '')}/app/dashboard`);
    if (!spa.ok || !spa.headers.get('content-type')?.includes('text/html')) throw new Error('SPA route failed');
    const privateApi = await fetch(`${origin.replace(/\/$/, '')}/api/clients`);
    if (privateApi.status !== 401) throw new Error('Private API did not reject unauthenticated request');
    console.log('ApproveFlow health, SPA routing and private API checks passed.');
    last = null;
    break;
  } catch (error) {
    last = error;
    if (i < 5) await new Promise(r => setTimeout(r, 5000));
  }
}
if (last) throw last;
