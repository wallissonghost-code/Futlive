(()=>{'use strict';
function bind(){
  const stage=document.getElementById('fieldStage'),camera=document.getElementById('fieldCamera'),root=document.getElementById('game');
  const engine=window.FutLiveFootballEngine;
  if(!stage||!camera||!root||!engine){setTimeout(bind,80);return}
  engine.game=stage;
  engine.field=()=>{
    const r=stage.getBoundingClientRect();
    return{w:r.width,h:r.height,left:r.width*.022,right:r.width*.978,top:r.height*.035,bottom:r.height*.965,goalTop:r.height*.365,goalBottom:r.height*.635,goalDepth:r.width*.035}
  };
  const syncPause=()=>stage.classList.toggle('is-paused',root.classList.contains('is-paused'));
  new MutationObserver(syncPause).observe(root,{attributes:true,attributeFilter:['class']});
  syncPause();
  engine.resetBall();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let currentLeft=0;
  function cameraLoop(){
    const cw=camera.clientWidth,sw=stage.offsetWidth;
    if(cw&&sw){
      const bx=Number.isFinite(engine.ball?.x)?engine.ball.x:sw/2;
      const desired=cw/2-bx;
      const minLeft=Math.min(0,cw-sw),maxLeft=0;
      const target=clamp(desired,minLeft,maxLeft);
      currentLeft+=(target-currentLeft)*0.08;
      stage.style.left=currentLeft.toFixed(2)+'px';
    }
    requestAnimationFrame(cameraLoop);
  }
  cameraLoop();
  const version=document.querySelector('.version');if(version)version.textContent='BETA '+(window.FutLiveConfig?.version||'0.30');
}
bind();
})();