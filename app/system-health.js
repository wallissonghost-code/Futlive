(()=>{'use strict';
const VERSION='0.73.0';
function boot(){
  const game=document.getElementById('game'),e=window.FutLiveFootballEngine;
  if(!game||!e||!e.players?.length){setTimeout(boot,80);return}
  const required={
    footballAI:!!window.FutLiveFootballAI,
    tactics:!!window.FutLiveFootballTactics,
    aiRuntime:!!window.FutLiveAIRuntime,
    ballContact:!!window.FutLiveBallContact,
    setPieces:!!window.FutLiveSetPieces,
    boundaryRestarts:!!window.FutLiveBoundaryRestarts,
    outOfPlay:!!window.FutLiveOutOfPlay,
    tackle:!!window.FutLiveTackleSystem,
    goalkeeperAI:!!window.FutLiveGoalkeeperAI,
    goalkeeperLiveness:!!window.FutLiveGoalkeeperLiveness,
    actionOrientation:!!window.FutLiveActionOrientation
  };
  const failures=[];
  for(const [k,v] of Object.entries(required))if(!v)failures.push('missing:'+k);
  const expected=window.FutLiveConfig?.version;if(expected!=='0.73')failures.push('runtime-version:'+expected);
  if(window.FutLiveSetPieces?.authority?.boundaries!=='boundary-restart-system')failures.push('boundary-authority');
  if(window.FutLiveOutOfPlay?.authority!=='boundary-restart-system')failures.push('outofplay-authority');
  if(e.players.length!==14)failures.push('players:'+e.players.length);
  const duplicateScripts=[...document.scripts].map(s=>(s.src||'').split('?')[0]).filter(Boolean).reduce((m,s)=>(m.set(s,(m.get(s)||0)+1),m),new Map());
  for(const [src,n] of duplicateScripts)if(n>1&&/Futlive\/(app|components|config)\//.test(src))failures.push('duplicate-script:'+src.split('/').pop());
  const state={version:VERSION,ok:failures.length===0,failures,required,checkedAt:Date.now(),build:window.FutLiveConfig?.build||null};
  game.dataset.architectureHealth=state.ok?'ok':'fail';game.dataset.architectureFailures=failures.join(',');
  window.FutLiveSystemHealth={...state,assert(){if(!state.ok)throw new Error('Futlive architecture unhealthy: '+failures.join(', '));return true},debug:()=>({...state})};
  window.dispatchEvent(new CustomEvent('futlive:system-health',{detail:state}));
}
setTimeout(boot,120);
})();