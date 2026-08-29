(()=>{'use strict';
function bind(){
  const stage=document.getElementById('fieldStage'),camera=document.getElementById('fieldCamera'),root=document.getElementById('game');
  const engine=window.FutLiveFootballEngine;
  if(!stage||!camera||!root||!engine){setTimeout(bind,80);return}
  engine.game=stage;

  // A geometria do campo é estado físico do jogo. Um reflow temporário do Safari
  // não pode transformar o campo em 0x0 e contaminar a simulação.
  let lastGeometry=null;
  const readGeometry=()=>{
    const r=stage.getBoundingClientRect(),w=r.width,h=r.height;
    if(Number.isFinite(w)&&Number.isFinite(h)&&w>=120&&h>=80){
      lastGeometry={w,h,left:w*.022,right:w*.978,top:h*.035,bottom:h*.965,goalTop:h*.365,goalBottom:h*.635,goalDepth:w*.035};
    }
    return lastGeometry;
  };
  // Captura uma geometria válida antes de qualquer loop de partida.
  readGeometry();
  engine.field=()=>readGeometry()||{
    w:stage.offsetWidth||790,
    h:stage.offsetHeight||445,
    left:(stage.offsetWidth||790)*.022,
    right:(stage.offsetWidth||790)*.978,
    top:(stage.offsetHeight||445)*.035,
    bottom:(stage.offsetHeight||445)*.965,
    goalTop:(stage.offsetHeight||445)*.365,
    goalBottom:(stage.offsetHeight||445)*.635,
    goalDepth:(stage.offsetWidth||790)*.035
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