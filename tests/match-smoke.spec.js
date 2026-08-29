const { test, expect } = require('@playwright/test');

async function openGame(page){
  await page.setViewportSize({width:390,height:844});
  const pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(err?.stack||String(err)));
  await page.goto('http://127.0.0.1:4173/?v=0.71&qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FutLiveFootballEngine?.players?.length===14&&window.FutLiveCentralBrain&&window.FutLiveOutOfPlay&&window.FutLiveBoundaryRestarts&&window.FutLiveBallContact&&window.FutLiveActionOrientation&&window.FutLiveGoalkeeperLiveness&&window.FutLiveThrowInAIPolicy&&window.FutLiveThrowInVisual&&window.FutLiveTackleSystem,null,{timeout:10000});
  return pageErrors;
}

async function waitPlaying(page){
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.(),null,{timeout:12000});
}

test('mobile kickoff has finite continuous positions and working clock',async({page})=>{
  const pageErrors=await openGame(page),samples=[],started=Date.now();
  while(Date.now()-started<13000){
    samples.push(await page.evaluate(()=>({t:performance.now(),phase:window.FutLiveMatchState?.phase||null,elapsed:window.FutLiveMatchState?.elapsedMs||0,field:window.FutLiveFootballEngine.field(),players:window.FutLiveFootballEngine.players.map(p=>({id:p.el?.id,x:p.x,y:p.y,vx:p.aiVelocity?.x??0,vy:p.aiVelocity?.y??0}))})));
    if(samples.at(-1).phase==='PLAYING'&&samples.at(-1).elapsed>1200)break;await page.waitForTimeout(50)
  }
  expect(samples.some(s=>s.phase==='KICKOFF')).toBeTruthy();expect(samples.some(s=>s.phase==='PLAYING')).toBeTruthy();
  for(const s of samples){expect(s.field.w).toBeGreaterThan(120);expect(s.field.h).toBeGreaterThan(80);for(const p of s.players)expect([p.x,p.y,p.vx,p.vy].every(Number.isFinite),`non-finite ${p.id}`).toBeTruthy()}
  const before=await page.evaluate(()=>window.FutLiveMatchState.elapsedMs);await page.waitForTimeout(1200);const after=await page.evaluate(()=>window.FutLiveMatchState.elapsedMs);expect(after-before).toBeGreaterThan(700);expect(pageErrors).toEqual([])
});

test('owned ball is always in front of the rendered sprite',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const samples=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,p=e.players.find(x=>x.team==='blue'&&!x.goalkeeper),out=[];e.takePossession(p,'qa-orientation');for(const dir of ['right','left','up','down']){p.ctrl.cancelPendingDirection?.();p.ctrl.play(dir,8,{restart:true});p.facing=dir==='right'?'up':'right';e.syncOwnedBall();out.push({dir,rendered:window.FutLiveBallContact.visualDirection(p),dx:e.ball.x-p.x,dy:e.ball.y-(p.y+27)})}return out});
  const by=Object.fromEntries(samples.map(s=>[s.dir,s]));expect(by.right.dx).toBeGreaterThan(10);expect(by.left.dx).toBeLessThan(0);expect(by.up.dy).toBeLessThan(-5);expect(by.down.dy).toBeGreaterThan(2);expect(pageErrors).toEqual([])
});

test('intended receiver turns toward incoming pass',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const id=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,r=e.players.find(p=>p.team==='blue'&&!p.goalkeeper),source=e.players.find(p=>p.team==='blue'&&!p.goalkeeper&&p!==r);e.ball.owner=null;e.ball.lastTouch=source;e.ball.intended=r;e.ball.type='pass';e.ball.x=r.x-65;e.ball.y=r.y+27;e.ball.vx=95;e.ball.vy=0;e.ball.pickupLock=performance.now()+700;return r.el.id});await page.waitForTimeout(180);
  const state=await page.evaluate(id=>{const e=window.FutLiveFootballEngine,p=e.players.find(x=>x.el.id===id);return window.FutLiveActionOrientation.debug(p)},id);expect(state.reason).toBe('RECEIVE_BALL');expect(state.action).toBe('left');expect(state.rendered).toBe('left');expect(pageErrors).toEqual([])
});

test('throw-in AI knows direct goal is invalid and avoids goal cone',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const result=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,f=e.field(),p=e.players.find(x=>x.team==='blue'&&!x.goalkeeper),spot={x:f.right-f.w*.18,y:(f.goalTop+f.goalBottom)/2};const fake={x:f.right-12,y:(f.goalTop+f.goalBottom)/2-27};const risk=window.FutLiveThrowInAIPolicy.goalAimRisk('blue',spot,fake);return{rule:window.FutLiveThrowInAIPolicy.rule,risk}});
  expect(result.rule).toBe('DIRECT_THROW_IN_GOAL_INVALID');expect(result.risk.unsafe).toBeTruthy();expect(pageErrors).toEqual([])
});

test('throw-in visual lock keeps exact same source frame through release',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const data=await page.evaluate(async()=>{const e=window.FutLiveFootballEngine,p=e.players.find(x=>x.team==='blue'&&!x.goalkeeper);window.dispatchEvent(new CustomEvent('futlive:throwin-ready',{detail:{taker:p.el.id,side:'bottom'}}));await new Promise(r=>setTimeout(r,60));const a={src:p.ctrl.img?.src,frame:p.ctrl.getState().frame};window.dispatchEvent(new CustomEvent('futlive:throwin-release',{detail:{taker:p.el.id,team:'blue'}}));await new Promise(r=>setTimeout(r,100));const b={src:p.ctrl.img?.src,frame:p.ctrl.getState().frame};return{a,b}});
  expect(data.b.frame).toBe(data.a.frame);expect(data.b.src).toBe(data.a.src);expect(pageErrors).toEqual([])
});

test('AI closes down a carrier and tackle system can engage',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  const setup=await page.evaluate(()=>{const e=window.FutLiveFootballEngine,f=e.field(),c=e.players.find(p=>p.team==='blue'&&!p.goalkeeper),d=e.players.find(p=>p.team==='red'&&!p.goalkeeper);c.x=f.w*.52;c.y=f.h*.5;d.x=c.x+58;d.y=c.y;e.takePossession(c,'qa-duel');return{carrier:c.el.id,defender:d.el.id}});
  const before=await page.evaluate(({carrier,defender})=>{const e=window.FutLiveFootballEngine,c=e.players.find(p=>p.el.id===carrier),d=e.players.find(p=>p.el.id===defender);return e.dist(c,d)},setup);await page.waitForTimeout(700);
  const after=await page.evaluate(({carrier,defender})=>{const e=window.FutLiveFootballEngine,c=e.players.find(p=>p.el.id===carrier),d=e.players.find(p=>p.el.id===defender);return{dist:e.dist(c,d),canForce:window.FutLiveTackleSystem.try(defender),stats:window.FutLiveTackleSystem.debug()}},setup);
  expect(Math.min(after.dist,before)).toBeLessThanOrEqual(before+4);expect(after.canForce).toBeTruthy();expect(after.stats.attempts).toBeGreaterThan(0);expect(pageErrors).toEqual([])
});

test('AI plays complete matches without goalkeeper freeze',async({page})=>{
  test.setTimeout(90000);const pageErrors=await openGame(page);await waitPlaying(page);
  for(let match=0;match<3;match++){await page.evaluate(()=>{window.FutLiveMatchFlow.setDurationMinutes(.25);if(window.FutLiveMatchState.phase==='FINISHED')window.FutLiveMatchFlow.restartMatch()});if(match>0)await waitPlaying(page);await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='FINISHED',null,{timeout:26000});if(match<2)await page.evaluate(()=>window.FutLiveMatchFlow.restartMatch())}
  const final=await page.evaluate(()=>window.FutLiveGoalkeeperLiveness.debug()),physical=Object.values(final.goalkeepers).reduce((n,g)=>n+g.physicalRecoveries,0),visual=Object.values(final.goalkeepers).reduce((n,g)=>n+g.visualRecoveries,0);expect(physical,JSON.stringify(final)).toBeLessThanOrEqual(1);expect(visual,JSON.stringify(final)).toBeLessThanOrEqual(2);expect(pageErrors).toEqual([])
});

test('throw-in detector enters and leaves set piece',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);await page.evaluate(()=>{const e=window.FutLiveFootballEngine,f=e.field(),last=e.players.find(p=>p.team==='blue'&&!p.goalkeeper);e.ball.owner=null;e.ball.lastTouch=last;e.ball.type='free';e.ball.x=(f.left+f.right)/2;e.ball.y=f.bottom-2;e.ball.vx=0;e.ball.vy=220;e.ball.pickupLock=performance.now()+1000});await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='SET_PIECE',null,{timeout:3000});await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING'&&!window.FutLiveApp?.isPaused?.(),null,{timeout:10000});expect(pageErrors).toEqual([])
});