(()=>{'use strict';
const VERSION='0.74.0';
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||typeof e.takePossession!=='function'||!e.players?.length){setTimeout(boot,35);return}
  if(window.FutLivePossessionAuthority)return;
  const engineCommit=e.takePossession.bind(e);
  const hooks={before:[],after:[]};
  const stats={attempts:0,commits:0,blocked:0,errors:0};
  const sort=phase=>hooks[phase].sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name));
  function register(phase,name,fn,priority=0){
    if(!hooks[phase]||typeof fn!=='function'||!name)throw new Error('invalid possession hook');
    const list=hooks[phase],existing=list.find(x=>x.name===name);
    if(existing){existing.fn=fn;existing.priority=priority;sort(phase);return()=>unregister(phase,name)}
    list.push({name,fn,priority});sort(phase);return()=>unregister(phase,name)
  }
  function unregister(phase,name){const list=hooks[phase];if(!list)return false;const i=list.findIndex(x=>x.name===name);if(i<0)return false;list.splice(i,1);return true}
  function runBefore(ctx){
    for(const h of hooks.before){
      try{const r=h.fn(ctx);if(r===false||r?.allow===false){ctx.blockedBy=h.name;ctx.blockReason=r?.reason||'blocked';return false}}
      catch(err){stats.errors++;console.error('[PossessionAuthority before]',h.name,err)}
    }
    return true
  }
  function runAfter(ctx){for(const h of hooks.after){try{h.fn(ctx)}catch(err){stats.errors++;console.error('[PossessionAuthority after]',h.name,err)}}}
  function take(p,reason='control',meta=null){
    stats.attempts++;
    const ctx={player:p||null,reason,meta:meta||null,at:performance.now(),previousOwner:e.ball.owner||null,allowed:true,committed:false,blockedBy:null,blockReason:null};
    if(!p||p.sentOff||p.tempSuspended){ctx.allowed=false;ctx.blockedBy='core';ctx.blockReason='invalid-player';stats.blocked++;return false}
    if(!runBefore(ctx)){ctx.allowed=false;stats.blocked++;window.dispatchEvent(new CustomEvent('futlive:possession-blocked',{detail:{player:p.el?.id||null,reason,blockedBy:ctx.blockedBy,blockReason:ctx.blockReason}}));return false}
    const r=engineCommit(p,reason);
    ctx.committed=r!==false&&e.ball.owner===p;
    if(ctx.committed)stats.commits++;else{stats.blocked++;ctx.allowed=false;ctx.blockedBy='engine';ctx.blockReason='commit-rejected'}
    runAfter(ctx);
    window.dispatchEvent(new CustomEvent('futlive:possession-committed',{detail:{player:p.el?.id||null,team:p.team,reason,committed:ctx.committed}}));
    return ctx.committed?r:false
  }
  e.takePossession=take;
  window.FutLivePossessionAuthority={version:VERSION,registerBefore:(name,fn,priority=0)=>register('before',name,fn,priority),registerAfter:(name,fn,priority=0)=>register('after',name,fn,priority),unregister,stats,debug:()=>({version:VERSION,stats:{...stats},before:hooks.before.map(x=>({name:x.name,priority:x.priority})),after:hooks.after.map(x=>({name:x.name,priority:x.priority})),owner:e.ball.owner?.el?.id||null})};
}
boot();
})();