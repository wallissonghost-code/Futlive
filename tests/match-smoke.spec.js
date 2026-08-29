const { test, expect } = require('@playwright/test');

async function openGame(page){
  await page.setViewportSize({width:390,height:844});
  const pageErrors=[];page.on('pageerror',err=>pageErrors.push(err?.stack||String(err)));
  await page.goto('http://127.0.0.1:4173/?v=0.61&qa=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.FutLiveFootballEngine?.players?.length===14&&window.FutLiveCentralBrain&&window.FutLiveOutOfPlay&&window.FutLiveBoundaryRestarts,null,{timeout:10000});
  await page.evaluate(()=>{
    const e=window.FutLiveFootballEngine,rawMove=e.moveToward.bind(e);
    e.moveToward=(p,tx,ty,speed,dt)=>{window.__qaLastMove={id:p?.el?.id||null,tx,ty,speed,dt,beforeVelocity:p?.aiVelocity?{x:p.aiVelocity.x,y:p.aiVelocity.y}:null,phase:window.FutLiveMatchState?.phase};return rawMove(p,tx,ty,speed,dt)};
    for(const p of e.players){for(const key of ['x','y']){let value=p[key];Object.defineProperty(p,key,{configurable:true,enumerable:true,get(){return value},set(next){if(!Number.isFinite(next)){const id=p.el?.id||`${p.team}-${p.slot}`,f=e.field(),diag={key,next:String(next),id,phase:window.FutLiveMatchState?.phase,x:p.x,y:p.y,speed:p.speed,home:p.home,velocity:p.aiVelocity,radius:p.radius,lastMove:window.__qaLastMove,field:f,ball:{x:e.ball.x,y:e.ball.y,vx:e.ball.vx,vy:e.ball.vy,type:e.ball.type,owner:e.ball.owner?.el?.id||null}};throw new Error(`NON_FINITE_COORD ${JSON.stringify(diag)}`)}value=next}})}}
  });
  return pageErrors;
}

async function waitPlaying(page){await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING',null,{timeout:12000})}

test('mobile kickoff has finite continuous positions and working clock',async({page})=>{
  const pageErrors=await openGame(page),samples=[],started=Date.now();
  while(Date.now()-started<13000){samples.push(await page.evaluate(()=>({t:performance.now(),phase:window.FutLiveMatchState?.phase||null,elapsed:window.FutLiveMatchState?.elapsedMs||0,field:window.FutLiveFootballEngine.field(),players:window.FutLiveFootballEngine.players.map(p=>({id:p.el?.id,x:p.x,y:p.y}))})));if(samples.at(-1).phase==='PLAYING'&&samples.at(-1).elapsed>1200)break;await page.waitForTimeout(50)}
  expect(samples.some(s=>s.phase==='KICKOFF')).toBeTruthy();expect(samples.some(s=>s.phase==='PLAYING')).toBeTruthy();
  for(const s of samples){expect(s.field.w,`field width @ ${s.phase}`).toBeGreaterThan(120);expect(s.field.h,`field height @ ${s.phase}`).toBeGreaterThan(80);for(const p of s.players)expect(Number.isFinite(p.x)&&Number.isFinite(p.y),`non-finite ${p.id} @ ${s.phase}`).toBeTruthy()}
  const suspicious=[];for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],dt=b.t-a.t;if(dt>180)continue;for(const p of b.players){const prev=a.players.find(x=>x.id===p.id);if(!prev)continue;const d=Math.hypot(p.x-prev.x,p.y-prev.y);if(d>34&&(a.phase==='KICKOFF'||b.phase==='PLAYING'))suspicious.push({id:p.id,d,from:a.phase,to:b.phase})}}
  expect(suspicious,`post-kickoff jumps: ${JSON.stringify(suspicious)}`).toEqual([]);
  const before=await page.evaluate(()=>window.FutLiveMatchState.elapsedMs);await page.waitForTimeout(1200);const after=await page.evaluate(()=>window.FutLiveMatchState.elapsedMs);expect(after-before).toBeGreaterThan(700);expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([])
});

test('throw-in detector enters and leaves set piece',async({page})=>{
  const pageErrors=await openGame(page);await waitPlaying(page);
  await page.evaluate(()=>{const e=window.FutLiveFootballEngine,f=e.field(),last=e.players.find(p=>p.team==='blue'&&!p.goalkeeper);e.ball.owner=null;e.ball.lastTouch=last;e.ball.type='free';e.ball.x=(f.left+f.right)/2;e.ball.y=f.bottom-2;e.ball.vx=0;e.ball.vy=220;e.ball.pickupLock=performance.now()+1000});
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='SET_PIECE',null,{timeout:3000});
  await page.waitForFunction(()=>window.FutLiveMatchState?.phase==='PLAYING',null,{timeout:10000});
  expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([])
});
