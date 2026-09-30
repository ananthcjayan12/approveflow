// Renders approveflow-story.html to approveflow-story.mp4 (1920x1080, 30 fps).
// Usage: node demo/render.mjs   (needs ffmpeg and Google Chrome; `npm i playwright-core` once)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30, DUR = 100;
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file://' + path.join(dir, 'approveflow-story.html') + '?render=1');
await page.waitForFunction(() => window.READY);

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart',
  path.join(dir, 'approveflow-story.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });

const total = FPS * DUR;
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.log(`frame ${i}/${total}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('wrote demo/approveflow-story.mp4');
