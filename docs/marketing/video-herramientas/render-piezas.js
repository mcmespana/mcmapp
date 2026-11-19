const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('page:', m.text()));
  page.on('pageerror', e => console.log('err:', e.message));
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
  const names = process.argv.slice(2);
  for (const n of names) {
    const t0 = Date.now();
    const res = await page.evaluate(([n]) => window.renderSheet(n, 48, 8, -8), [n]);
    fs.writeFileSync('out/' + n + '.png', Buffer.from(res.url.split(',')[1], 'base64'));
    console.log(n, res.size.map(v => v.toFixed(3)).join('x'), (Date.now() - t0) + 'ms');
  }
  await browser.close();
})();
