(()=>{'use strict';
const VERSION='0.60';
function boot(){
  const e=window.FutLiveFootballEngine,base=window.FutLiveFootballAI,tactics=window.FutLiveFootballTactics;
  if(!e||!base||!tactics||!e.players?.length){setTimeout(boot,45);return}
  if(e.__aiRuntimeCoordinatorV060)return;e.__aiRuntimeCoordinatorV060=true;
  const perf={frames:0,avgMs:0,maxMs:0,lastMs:0,slowFrames:0,decisionSkips:0};
  const old={ownedAI:e.ownedAI.bind(e),freeAI:e.freeAI.bind(e),intercept:e.intercept.bind(e)};
  let lastOwnerThink=0,lastFreeThink=0,lastInterceptThink=0,lastFrameAt=performance.now();
  function phase(){return window.FutLiveMatchState?.phase||window.FutLiveMatchFlow?.state?.phase||'PLAYING'}
  function blocked(){const p=phase();return !['PLAYING','KICKOFF'].includes(p)||window.FutLiveSetPieces?.state?.busy||window.FutLiveOutOfPlay?.isBusy?.()||window.FutLiveReferee?.busy}
  function cadence(){const n=e.players.filter(p=>!p.sentOff&&!p.tempSuspended).length;return n>=14?{owner:22,free:24,intercept:30}:{owner:18,free:20,intercept:26}}
  function measure(fn){const s=performance.now(),r=fn(),ms=performance.now()-s;perf.frames++;perf.lastMs=ms;perf.avgMs+= (ms-perf.avgMs)/Math.min(perf.frames,240);perf.maxMs=Math.max(perf.maxMs,ms);if(ms>8)perf.slowFrames++;return r}
  e.ownedAI=(dt,f)=>{if(blocked())return;const now=performance.now(),c=cadence();if(now-lastOwnerThink<c.owner){perf.decisionSkips++;return}lastOwnerThink=now;return measure(()=>old.ownedAI(dt,f))};
  e.freeAI=(dt,f)=>{if(blocked())return;const now=performance.now(),c=cadence();if(now-lastFreeThink<c.free){perf.decisionSkips++;return}lastFreeThink=now;return measure(()=>old.freeAI(dt,f))};
  e.intercept=(dt)=>{if(blocked())return;const now=performance.now(),c=cadence();if(now-lastInterceptThink<c.intercept){perf.decisionSkips++;return}lastInterceptThink=now;return old.intercept(dt)};
  function sanitize(){const f=e.field();for(const p of e.players){if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){p.x=f.w*p.home[0];p.y=f.h*p.home[1];p.aiVelocity={x:0,y:0}}if(p.aiVelocity){if(!Number.isFinite(p.aiVelocity.x))p.aiVelocity.x=0;if(!Number.isFinite(p.aiVelocity.y))p.aiVelocity.y=0}p.x=Math.max(f.left+p.radius,Math.min(f.right-p.radius,p.x));p.y=Math.max(f.top+p.radius,Math.min(f.bottom-p.radius,p.y))}if(!Number.isFinite(e.ball.x)||!Number.isFinite(e.ball.y)){e.resetBall();return}if(!Number.isFinite(e.ball.vx))e.ball.vx=0;if(!Number.isFinite(e.ball.vy))e.ball.vy=0}
  function healthLoop(t){if(t-lastFrameAt>250){sanitize();lastFrameAt=t}requestAnimationFrame(healthLoop)}requestAnimationFrame(healthLoop);
  window.FutLiveAIRuntime={version:VERSION,performance:perf,isBlocked:blocked,sanitize,debug:()=>({version:VERSION,phase:phase(),blocked:blocked(),players:e.players.length,avgAiMs:+perf.avgMs.toFixed(3),maxAiMs:+perf.maxMs.toFixed(3),slowFrames:perf.slowFrames,decisionSkips:perf.decisionSkips})};
}
boot();
})();