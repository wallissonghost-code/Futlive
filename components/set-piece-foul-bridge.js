(()=>{'use strict';
function boot(){
  const e=window.FutLiveFootballEngine,sp=window.FutLiveSetPieces;
  if(!e||!sp){setTimeout(boot,45);return}
  if(e.__setPieceFoulBridgeV059)return;e.__setPieceFoulBridgeV059=true;
  let pendingFoul=null;
  const oldTake=e.takePossession.bind(e);
  window.addEventListener('futlive:foul',ev=>{pendingFoul=ev.detail||null});
  e.takePossession=(p,reason='control')=>{
    const result=oldTake(p,reason);
    if(reason==='foul-restart'&&p){
      const detail=pendingFoul||{victim:p,x:e.ball.x,y:e.ball.y};pendingFoul=null;
      setTimeout(()=>{if(!sp.state.busy)sp.beginFreeKick(detail)},640)
    }
    return result
  };
  window.FutLiveSetPieceFoulBridge={version:'0.59'};
}
boot();
})();