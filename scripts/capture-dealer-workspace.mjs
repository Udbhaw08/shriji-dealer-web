import { spawn } from 'node:child_process';
import fs from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\udbha\\AppData\\Local\\Temp\\chrome_ws_' + Date.now();
const port = 9340;

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'http://localhost:5173/',
]);

function call(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const tabs = await listRes.json();
  const tab = tabs.find(t => t.url.includes('localhost:5173')) || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res) => { ws.onopen = res; });

  await call(ws, 'Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    mobile: true,
    screenOrientation: { angle: 0, type: 'portraitPrimary' }
  });

  // Inject session for dealer Test One with real location Mumbai, Maharashtra
  await call(ws, 'Runtime.evaluate', {
    expression: `(() => {
      const dealerSession = {
        role: "dealer",
        status: "approved",
        userStatus: "active",
        userId: "f3319624-cf78-4325-9cbb-71ac5c18af03",
        phone: "+918082790886",
        phone_verified: true,
        fullName: "Test One",
        email: "hetjasani28@gmail.com",
        email_verified: true,
        authRole: "dealer",
        canSeeDealerPrice: true,
        dealerId: "f3319624-cf78-4325-9cbb-71ac5c18af03",
        dealer: {
          id: "f3319624-cf78-4325-9cbb-71ac5c18af03",
          name: "Test One",
          phone: "+918082790886",
          city: "Mumbai",
          state: "Maharashtra",
          address: "Borivali, Mumbai, 400101",
          status: "approved",
          dealer_code: "DE-RPQ-3767",
          price_tier: "Mumbai PL Oct 2026",
          gst_treatment: "Unregistered Business",
          gst_number: null,
          hide_staff_dealer_price: false
        }
      };
      localStorage.setItem("shriji.auth.session", JSON.stringify(dealerSession));
      localStorage.setItem("shriji.auth.tokens", JSON.stringify({ accessToken: "mock-jwt", refreshToken: "mock-refresh" }));
    })()`
  });

  // Navigate to /dealer
  await call(ws, 'Page.navigate', { url: 'http://localhost:5173/dealer' });

  // Wait until .dealer-ws-content or .dealer-identity-name is rendered
  let attempts = 0;
  while (attempts < 20) {
    await new Promise(r => setTimeout(r, 400));
    const check = await call(ws, 'Runtime.evaluate', {
      expression: `Boolean(document.querySelector('.dealer-identity-name'))`
    });
    if (check.result?.value === true) break;
    attempts++;
  }

  await new Promise(r => setTimeout(r, 600));

  const shot = await call(ws, 'Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('docs/screenshots/iphone16_dealer_workspace_real_location.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved docs/screenshots/iphone16_dealer_workspace_real_location.png');

  chrome.kill();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  chrome.kill();
  process.exit(1);
});

