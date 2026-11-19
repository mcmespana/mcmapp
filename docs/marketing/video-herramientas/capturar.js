// node shoot.js <out> <url> [step...]   step: "click:Texto" | "wait:ms" | "scroll:px" | "tap:x,y" | "type:texto" | "js:code"
const { chromium } = require('playwright');
(async () => {
  const [out, url, ...steps] = process.argv.slice(2);
  const local = url.includes('localhost');
  const browser = await chromium.launch(local ? {} : { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 798 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: 'light' });
  await ctx.addInitScript(() => { try { localStorage.setItem('addToHomeDismissed', 'true'); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('err:', e.message.slice(0, 160)));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => console.log('goto', e.message));
  await page.waitForTimeout(2500);
  let n = 0;
  for (const s of steps) {
    const [k, ...rest] = s.split(':'); const v = rest.join(':');
    try {
      if (k === 'click') { await page.getByText(v, { exact: false }).first().click({ timeout: 8000 }); await page.waitForTimeout(1800); }
      else if (k === 'clickx') { await page.getByText(v, { exact: true }).first().click({ timeout: 8000 }); await page.waitForTimeout(1800); }
      else if (k === 'label') { await page.getByLabel(v).first().click({ timeout: 8000 }); await page.waitForTimeout(1800); }
      else if (k === 'labeln') { const [l, i] = v.split('#'); await page.getByLabel(l).nth(+i).click({ timeout: 8000 }); await page.waitForTimeout(900); }
      else if (k === 'ttap') { const [x, y] = v.split(',').map(Number); await page.touchscreen.tap(x, y); await page.waitForTimeout(700); }
      else if (k === 'down') { const [x, y] = v.split(',').map(Number); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(700); }
      else if (k === 'fill') { const [ph, val] = v.split('#'); await page.getByPlaceholder(ph).first().fill(val); await page.waitForTimeout(500); }
      else if (k === 'clickn') { const [tx, i] = v.split('#'); await page.getByText(tx, { exact: true }).nth(+i).click({ timeout: 8000 }); await page.waitForTimeout(1800); }
      else if (k === 'clicklast') { await page.getByText(v, { exact: true }).last().click({ timeout: 8000 }); await page.waitForTimeout(1800); }
      else if (k === 'mouseaway') { await page.mouse.move(2, 790); }
      else if (k === 'wait') await page.waitForTimeout(+v);
      else if (k === 'tap') { const [x, y] = v.split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(1500); }
      else if (k === 'scroll') { await page.mouse.move(196, 400); await page.mouse.wheel(0, +v); await page.waitForTimeout(1200); }
      else if (k === 'type') { await page.keyboard.type(v, { delay: 60 }); await page.waitForTimeout(1200); }
      else if (k === 'shot') { await page.evaluate(() => { const walk = (root) => { for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) walk(el.shadowRoot); const t = el.textContent || ''; if (t.includes('cannot contain a nes') && getComputedStyle(el).position === 'fixed') el.style.display = 'none'; } }; walk(document); }); await page.waitForTimeout(200); await page.screenshot({ path: 'shots/' + out + '-' + v + '.png' }); n++; }
      else if (k === 'js') { console.log('js:', JSON.stringify(await page.evaluate(v)).slice(0, 600)); }
    } catch (e) { console.log('step fail', s, e.message.split('\n')[0]); }
  }
  await page.screenshot({ path: 'shots/' + out + '.png' });
  console.log('url:', page.url());
  console.log((await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 700));
  await browser.close();
})();
