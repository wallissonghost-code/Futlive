const { test, expect } = require('@playwright/test');

async function openGame(page){
  await page.setViewportSize({width:390,height:844});
  const pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(err?.stack||String(err)));
  await page.goto('http://127.0.0.1:4173/?v=0.67&qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FutLiveFootballEngine?.players?.length===14&&window.FutLiveCentralBrain&&window.FutLiveOutOfPlay&&window.FutLiveBoundaryRestarts&&window.FutLiveBallContact&&window.FutLiveActionOrientation,null,{timeout:10000});
  return pageErrors;
}

async function waitPlaying(page){
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.(),null,{timeout:12000});
}

test('mobile kickoff has finite continuous positions and working clock',async({page})=>{
  const pageErrors=await openGame(page),samples=[],started=Date.now();
  while(Date.now()-started<13000){
    samples.push(await page.evaluate(()=>({
      t:performance.now(),phase:window.FutLiveMatchState?.phase||null,elapsed:window.FutLiveMatchState?.elapsedMs||0,
      field:window.FutLiveFootballEngine.field(),
      players:window.FutLiveFootballEngine.players.map(p=>({id:p.el?.id,x:p.x,y:p.y,vx:p.aiVelocity?.x??0,vy:p.aiVelocity?.y??0}))
    })));
    if(samples.at(-1).phase==='PLAYING'&&samples.at(-1).elapsed>1200)break;
    await page.waitForTimeout(50);
  }
  expect(samples.some(s=>s.phase==='KICKOFF')).toBeTruthy();
  expect(samples.some(s=>s.phase==='PLAYING')).toBeTruthy();
  for(const s of samples){
    expect(s.field.w,`field width @ ${s.phase}`).toBeGreaterThan(120);
    expect(s.field.h,`field height @ ${s.phase}`).toBeGreaterThan(80);
    for(const p of s.players){expect([p.x,p.y,p.vx,p.vy].every(Number.isFinite),`non-finite state ${p.id} @ ${s.phase}`).toBeTruthy()}
  }
  const suspicious=[];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dt=b.t-a.t;if(dt>180)continue;
    for(const p of b.players){const prev=a.players.find(x=>x.id===p.id);if(!prev)continue;const d=Math.hypot(p.x-prev.x,p.y-prev.y);if(d>34&&(a.phase==='KICKOFF'||b.phase==='PLAYING'))suspicious.push({id:p.id,d,from:a.phase,to:b.phase})}
  }
  expect(suspicious,`post-kickoff jumps: ${JSON.stringify(suspicious)}`).toEqual([]);
  const before=await page.evaluate(()=>window.FutLiveMatchState.elapsedMs);await page.waitForTimeout(1200);const after=await page.evaluate(()=>window.FutLiveMatchState.elapsedMs);
  expect(after-before).toBeGreaterThan(700);expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
});

test('owned ball is always in front of the rendered sprite',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const samples=await page.evaluate(()=>{
    const e=window.FutLiveFootballEngine,p=e.players.find(x=>x.team==='blue'&&!x.goalkeeper),out=[];
    e.takePossession(p,'qa-orientation');
    for(const dir of ['right','left','up','down']){
      p.ctrl.cancelPendingDirection?.();p.ctrl.play(dir,8,{restart:true});
      p.facing=dir==='right'?'up':'right';
      e.syncOwnedBall();
      out.push({dir,rendered:window.FutLiveBallContact.visualDirection(p),dx:e.ball.x-p.x,dy:e.ball.y-(p.y+27)});
    }
    return out
  });
  const by=Object.fromEntries(samples.map(s=>[s.dir,s]));
  expect(by.right.rendered).toBe('right');expect(by.right.dx).toBeGreaterThan(10);
  expect(by.left.rendered).toBe('left');expect(by.left.dx).toBeLessThan(0);
  expect(by.up.rendered).toBe('up');expect(by.up.dy).toBeLessThan(-5);
  expect(by.down.rendered).toBe('down');expect(by.down.dy).toBeGreaterThan(2);
  expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
});

test('intended receiver turns toward incoming pass',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const id=await page.evaluate(()=>{
    const e=window.FutLiveFootballEngine,r=e.players.find(p=>p.team==='blue'&&!p.goalkeeper),source=e.players.find(p=>p.team==='blue'&&!p.goalkeeper&&p!==r);
    e.ball.owner=null;e.ball.lastTouch=source;e.ball.intended=r;e.ball.type='pass';e.ball.x=r.x-65;e.ball.y=r.y+27;e.ball.vx=95;e.ball.vy=0;e.ball.pickupLock=performance.now()+700;return r.el.id
  });
  await page.waitForTimeout(180);
  const state=await page.evaluate(id=>{const e=window.FutLiveFootballEngine,p=e.players.find(x=>x.el.id===id);return window.FutLiveActionOrientation.debug(p)},id);
  expect(state.reason).toBe('RECEIVE_BALL');expect(state.action).toBe('left');expect(state.rendered).toBe('left');
  expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
});

test('throw-in detector enters and leaves set piece',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  await page.evaluate(()=>{
    const e=window.FutLiveFootballEngine,f=e.field(),last=e.players.find(p=>p.team==='blue'&&!p.goalkeeper);
    e.ball.owner=null;e.ball.lastTouch=last;e.ball.type='free';e.ball.x=(f.left+f.right)/2;e.ball.y=f.bottom-2;e.ball.vx=0;e.ball.vy=220;e.ball.pickupLock=performance.now()+1000;
  });
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='SET_PIECE',null,{timeout:3000});
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.(),null,{timeout:10000});
  expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
});
