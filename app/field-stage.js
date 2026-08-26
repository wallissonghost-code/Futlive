(()=>{'use strict';
function bind(){
  const stage=document.getElementById('fieldStage'),root=document.getElementById('game');
  const engine=window.FutLiveFootballEngine;
  if(!stage||!root||!engine){setTimeout(bind,80);return}
  engine.game=stage;
  engine.field=()=>{
    const r=stage.getBoundingClientRect();
    return{w:r.width,h:r.height,left:r.width*.022,right:r.width*.978,top:r.height*.035,bottom:r.height*.965,goalTop:r.height*.365,goalBottom:r.height*.635,goalDepth:r.width*.035}
  };
  const syncPause=()=>stage.classList.toggle('is-paused',root.classList.contains('is-paused'));
  new MutationObserver(syncPause).observe(root,{attributes:true,attributeFilter:['class']});
  syncPause();
  engine.resetBall();
  const version=document.querySelector('.version');if(version)version.textContent='BETA '+(window.FutLiveConfig?.version||'0.27');
}
bind();
})();