import fs from 'node:fs/promises';

const BASE_URL = 'http://10.197.58.228:3000/';
const APP_URL = `${BASE_URL}?capture=1`;
const DEVTOOLS_JSON_URL = 'http://127.0.0.1:9222/json';
const OUTPUT_DIR = new URL('./assets/', import.meta.url);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pages = await (await fetch(DEVTOOLS_JSON_URL)).json();
const target = pages.find((page) => page.type === 'page' && page.url.startsWith(BASE_URL));

if (!target) {
  throw new Error(`App page not found for ${BASE_URL}`);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (!msg.id || !pending.has(msg.id)) return;
  const { resolve, reject } = pending.get(msg.id);
  pending.delete(msg.id);
  if (msg.error) reject(new Error(JSON.stringify(msg.error)));
  else resolve(msg.result);
};

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = (expression) => send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
});

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await send('Page.enable');
await send('Page.bringToFront');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
await send('Page.navigate', { url: APP_URL });
await wait(1200);

await evaluate(`(() => {
  const style = document.createElement('style');
  style.dataset.captureStyle = 'true';
  style.textContent = '* { animation-duration: 0s !important; transition-duration: 0s !important; }';
  document.head.appendChild(style);
})()`);

await evaluate(`(async () => {
  const login = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin1234', sessionHours: 168 }),
  });
  const session = await login.json();
  localStorage.setItem('ace_auth_token', session.token);
  location.reload();
})()`);

await wait(3000);

await evaluate(`(() => {
  const style = document.querySelector('[data-capture-style="true"]') || document.createElement('style');
  style.dataset.captureStyle = 'true';
  style.textContent = '* { animation-duration: 0s !important; transition-duration: 0s !important; }';
  document.head.appendChild(style);
})()`);

const settle = async () => {
  await wait(400);
  await evaluate(`document.getAnimations().forEach((animation) => {
    try { animation.finish(); } catch (_) {}
  })`);
  await wait(200);
};

const waitForText = async (text) => {
  for (let i = 0; i < 25; i += 1) {
    const result = await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
    if (result.result?.value) {
      await settle();
      return;
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for text: ${text}`);
};

const screenshot = async (name, captureBeyondViewport = true) => {
  await settle();
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport,
    fromSurface: true,
  });
  await fs.writeFile(new URL(`${name}.png`, OUTPUT_DIR), Buffer.from(result.data, 'base64'));
};

const clickByText = async (text) => {
  await evaluate(`Array.from(document.querySelectorAll('button, a, [role="button"]')).find((el) => el.textContent.trim() === ${JSON.stringify(text)})?.click()`);
};

await screenshot('screenshot-dashboard-agent');
await screenshot('screenshot-dashboard-agent-focused', false);
await clickByText('重点句');
await waitForText('重点句跟读');
await screenshot('screenshot-textbook-sentences');
await screenshot('screenshot-textbook-sentences-focused', false);
await clickByText('AI外教');
await waitForText('AI 私人外教');
await screenshot('screenshot-ai-tutor');
await screenshot('screenshot-ai-tutor-focused', false);
await clickByText('管理');
await waitForText('教师洞察 Agent');
await screenshot('screenshot-teacher-agent');
await evaluate(`Array.from(document.querySelectorAll('*')).forEach((el) => {
  if (el.scrollHeight > el.clientHeight + 80) el.scrollTop = 720;
})`);
await wait(500);
await screenshot('screenshot-teacher-agent-focused', false);

const body = await evaluate('document.body.innerText');
ws.close();

console.log(JSON.stringify({
  ok: true,
  hasTeacherAgent: String(body.result?.value || '').includes('教师洞察 Agent'),
}, null, 2));
