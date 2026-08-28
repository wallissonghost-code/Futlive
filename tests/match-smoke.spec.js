const { test, expect } = require('@playwright/test');

test('Futlive kickoff continuity, clock and throw-in recovery', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err)));

  await page.goto('http://127.0.0.1:4173/?v=0.61&qa=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FutLiveFootballEngine?.players?.length === 14, null, { timeout: 10000 });

  const samples = [];
  const started = Date.now();
  while (Date.now() - started < 13000) {
    samples.push(await page.evaluate(() => ({
      t: performance.now(),
      phase: window.FutLiveMatchState?.phase || null,
      elapsed: window.FutLiveMatchState?.elapsedMs || 0,
      players: (window.FutLiveFootballEngine?.players || []).map(p => ({
        id: p.el?.id || `${p.team}-${p.slot}`,
        x: p.x,
        y: p.y,
        homeX: window.FutLiveFootballEngine.field().w * (p.home?.[0] ?? .5),
        homeY: window.FutLiveFootballEngine.field().h * (p.home?.[1] ?? .5)
      }))
    })));
    if (samples.at(-1).phase === 'PLAYING' && samples.at(-1).elapsed > 900) break;
    await page.waitForTimeout(50);
  }

  expect(samples.some(s => s.phase === 'KICKOFF')).toBeTruthy();
  expect(samples.some(s => s.phase === 'PLAYING')).toBeTruthy();

  const suspicious = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    const dt = b.t - a.t;
    if (dt > 180) continue;
    for (const p of b.players) {
      const prev = a.players.find(x => x.id === p.id);
      if (!prev) continue;
      const d = Math.hypot(p.x - prev.x, p.y - prev.y);
      const landedHome = Math.hypot(p.x - p.homeX, p.y - p.homeY) < 4;
      if (d > 34 && (a.phase === 'KICKOFF' || b.phase === 'PLAYING')) suspicious.push({ id: p.id, d, landedHome, from: a.phase, to: b.phase });
    }
  }
  expect(suspicious, `post-kickoff jumps: ${JSON.stringify(suspicious)}`).toEqual([]);

  const beforeClock = await page.evaluate(() => window.FutLiveMatchState.elapsedMs);
  await page.waitForTimeout(1200);
  const afterClock = await page.evaluate(() => window.FutLiveMatchState.elapsedMs);
  expect(afterClock - beforeClock).toBeGreaterThan(700);

  await page.evaluate(() => {
    const e = window.FutLiveFootballEngine, f = e.field();
    const last = e.players.find(p => p.team === 'blue' && !p.goalkeeper);
    e.ball.owner = null;
    e.ball.lastTouch = last;
    e.ball.type = 'free';
    e.ball.x = (f.left + f.right) / 2;
    e.ball.y = f.bottom - 2;
    e.ball.vx = 0;
    e.ball.vy = 220;
    e.ball.pickupLock = performance.now() + 1000;
  });

  await page.waitForFunction(() => window.FutLiveMatchState?.phase === 'SET_PIECE', null, { timeout: 3000 });
  await page.waitForFunction(() => window.FutLiveMatchState?.phase === 'PLAYING', null, { timeout: 10000 });

  const restartState = await page.evaluate(() => ({
    phase: window.FutLiveMatchState?.phase,
    setPiece: window.FutLiveSetPieces?.state ? { busy: window.FutLiveSetPieces.state.busy, type: window.FutLiveSetPieces.state.type, stage: window.FutLiveSetPieces.state.stage } : null,
    boundary: window.FutLiveBoundaryRestarts ? { version: window.FutLiveBoundaryRestarts.version, exclusive: window.FutLiveBoundaryRestarts.exclusive } : null
  }));
  expect(restartState.phase).toBe('PLAYING');
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
});
