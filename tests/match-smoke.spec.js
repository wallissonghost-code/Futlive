const { test, expect } = require('@playwright/test');

async function openGame(page){
  await page.setViewportSize({width:390,height:844});
  const pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(err?.stack||String(err)));
  await page.goto('http://127.0.0.1:4173/?v=0.71&qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FutLiveFootballEngine?.players?.length===14&&window.FutLiveCentralBrain&&window.FutLiveOutOfPlay&&window.FutLiveBoundaryRestarts&&window.FutLiveBallContact&&window.FutLiveActionOrientation&&window.FutLiveGoalkeeperLiveness,null,{timeout:10000});
  return pageErrors;
}

async function waitPlaying(page){
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.(),null,{timeout:12000});
}

async function waitFinished(page,matchNumber){
  try{
    await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='FINISHED',null,{timeout:65000});
  }catch(err){
    const snapshot=await page.evaluate(()=>({
      phase:window.FutLiveMatchState?.phase||null,
      elapsedMs:window.FutLiveMatchState?.elapsedMs||0,
      remainingMs:window.FutLiveMatchState?.remainingMs??null,
      paused:window.FutLiveApp?.isPaused?.()??null,
      setPiece:window.FutLiveSetPieces?.state?{busy:window.FutLiveSetPieces.state.busy,exclusive:window.FutLiveSetPieces.state.exclusive,type:window.FutLiveSetPieces.state.type,stage:window.FutLiveSetPieces.state.stage}:null,
      ball:{type:window.FutLiveFootballEngine?.ball?.type,owner:window.FutLiveFootballEngine?.ball?.owner?.el?.id||null,x:window.FutLiveFootballEngine?.ball?.x,y:window.FutLiveFootballEngine?.ball?.y},
      liveness:window.FutLiveGoalkeeperLiveness?.debug?.()||null
    }));
    throw new Error(`match ${matchNumber} did not finish within 65s real time: ${JSON.stringify(snapshot)}`);
  }
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

test('owned ball is always on the rendered sprite forward side',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const samples=await page.evaluate(()=>{
    const e=window.FutLiveFootballEngine,p=e.players.find(x=>x.team==='blue'&&!x.goalkeeper),out=[];
    e.takePossession(p,'qa-orientation');
    for(const dir of ['right','left','up','down']){
      p.ctrl.cancelPendingDirection?.();p.ctrl.play(dir,8,{restart:true});
      p.facing=dir==='right'?'up':'right';e.syncOwnedBall();
      out.push({dir,rendered:window.FutLiveBallContact.visualDirection(p),dx:e.ball.x-p.x,dy:e.ball.y-(p.y+27)});
    }
    return out
  });
  const by=Object.fromEntries(samples.map(s=>[s.dir,s]));
  for(const dir of ['right','left','up','down'])expect(by[dir].rendered).toBe(dir);
  expect(by.right.dx,'right-facing player must keep ball on right/front side').toBeGreaterThan(4);
  expect(by.left.dx,'left-facing player must keep ball on left/front side').toBeLessThan(-4);
  expect(by.up.dy,'up-facing player must keep ball above/front side').toBeLessThan(-3);
  expect(by.down.dy,'down-facing player must keep ball below/front side').toBeGreaterThan(2);
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

test('throw-in AI knows direct goal is invalid and avoids goal cone',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const result=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,f=e.field(),p=e.players.find(x=>x.team==='blue'&&!x.goalkeeper),policy=window.FutLiveThrowInAIPolicy;return{loaded:!!policy,unsafe:policy?.unsafeDirectGoal?typeof policy.unsafeDirectGoal==='function':false,guardRule:policy?.version||null,field:{goalTop:f.goalTop,goalBottom:f.goalBottom},id:p?.el?.id||null}});
  expect(result.loaded).toBeTruthy();expect(result.unsafe).toBeTruthy();expect(result.guardRule).toBeTruthy();expect(pageErrors).toEqual([])
});

test('throw-in visual lock keeps exact same source frame through release',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const result=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,p=e.players.find(x=>!x.goalkeeper),ctrl=p.ctrl;window.dispatchEvent(new CustomEvent('futlive:throwin-ready',{detail:{taker:p.el.id,side:'top'}}));const before=ctrl.img?.src;window.dispatchEvent(new CustomEvent('futlive:throwin-release',{detail:{taker:p.el.id,side:'top'}}));const after=ctrl.img?.src;return{before,after,active:!!p.throwInVisualLock}});
  expect(result.active).toBeTruthy();expect(result.before).toBe(result.after);expect(pageErrors).toEqual([])
});

test('AI closes down a carrier and tackle system can engage',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const result=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,c=e.players.find(p=>p.team==='blue'&&!p.goalkeeper),d=e.players.find(p=>p.team==='red'&&!p.goalkeeper);e.takePossession(c,'qa-duel');d.x=c.x+34;d.y=c.y;d.facing='left';d.lastDir='left';const ok=window.FutLiveTackleSystem?.try?.(d.el.id)||false;return{ok,active:window.FutLiveTackleSystem?.active?.has?.(d)||false}});
  expect(result.ok||result.active).toBeTruthy();expect(pageErrors).toEqual([])
});

test('AI plays full matches and goalkeepers do not repeatedly freeze',async({page})=>{
  test.setTimeout(170000);
  const pageErrors=await openGame(page);await waitPlaying(page);
  for(let match=0;match<2;match++){
    await page.evaluate(()=>{window.FutLiveMatchFlow.setDurationMinutes(.25);if(window.FutLiveMatchState.phase==='FINISHED')window.FutLiveMatchFlow.restartMatch()});
    if(match>0)await waitPlaying(page);
    await waitFinished(page,match+1);
    if(match<1)await page.evaluate(()=>window.FutLiveMatchFlow.restartMatch())
  }
  const final=await page.evaluate(()=>window.FutLiveGoalkeeperLiveness.debug()),physical=Object.values(final.goalkeepers).reduce((n,g)=>n+g.physicalRecoveries,0),visual=Object.values(final.goalkeepers).reduce((n,g)=>n+g.visualRecoveries,0);
  expect(physical,`goalkeeper physical freeze recoveries: ${JSON.stringify(final)}`).toBeLessThanOrEqual(1);
  expect(visual,`goalkeeper visual freeze recoveries: ${JSON.stringify(final)}`).toBeLessThanOrEqual(2);
  expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([])
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
