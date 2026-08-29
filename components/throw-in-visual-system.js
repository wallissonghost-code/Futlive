(()=>{'use strict';
const VERSION='0.70.0';
function boot(){
  const e=window.FutLiveFootballEngine;
  if(!e||!e.players?.length){setTimeout(boot,45);return}
  if(window.FutLiveThrowInVisual)return;
  const active=new Map();
  const pid=p=>p?.el?.id||null;
  const byId=id=>e.players.find(p=>pid(p)===id)||null;
  if(!document.getElementById('futlive-throwin-visual-lock-style')){
    const st=document.createElement('style');st.id='futlive-throwin-visual-lock-style';
    st.textContent='.player.throw-in-visual-lock{z-index:44!important}.player.throw-in-visual-lock .player-sprite-img{opacity:1!important;visibility:visible!important;transition:none!important;filter:drop-shadow(0 3px 5px #0009)!important}.player.throw-in-release-followthrough .player-sprite-img{transform:scale(1.035)!important;transform-origin:50% 75%!important}';
    document.head.appendChild(st)
  }
  function lockPose(p,dir,side){
    if(!p?.ctrl)return;
    const old=active.get(p);if(old?.timer)clearTimeout(old.timer);
    const s={dir,side,released:false,timer:null};active.set(p,s);
    p.throwInVisualLock=true;p.facing=dir;p.lastDir=dir;
    p.el?.classList.add('throw-in-visual-lock');
    p.ctrl.cancelPendingDirection?.();p.ctrl.stop?.(false);p.ctrl.setState?.(dir,{restart:true});p.ctrl.show?.(0)
  }
  function releasePose(p){
    const s=active.get(p);if(!s)return;s.released=true;
    p.el?.classList.add('throw-in-release-followthrough');
    p.ctrl?.cancelPendingDirection?.();p.ctrl?.stop?.(false);
    if(p.ctrl?.getState?.()?.state!==s.dir)p.ctrl?.setState?.(s.dir,{restart:true});
    p.ctrl?.show?.(1);
    s.timer=setTimeout(()=>{
      p.el?.classList.remove('throw-in-visual-lock','throw-in-release-followthrough');
      p.throwInVisualLock=false;active.delete(p);
      p.ctrl?.cancelPendingDirection?.();p.ctrl?.idle?.()
    },430)
  }
  function guard(){
    for(const [p,s] of active){
      if(!p?.ctrl)continue;
      p.ctrl.cancelPendingDirection?.();
      if(!s.released){
        const st=p.ctrl.getState?.();
        if(st?.state!==s.dir||st?.playing){p.ctrl.stop?.(false);p.ctrl.setState?.(s.dir,{restart:true});p.ctrl.show?.(0)}
        p.facing=s.dir;p.lastDir=s.dir
      }
    }
    requestAnimationFrame(guard)
  }
  requestAnimationFrame(guard);
  window.addEventListener('futlive:throwin-ready',ev=>{
    const d=ev.detail||{},p=byId(d.taker);if(!p)return;
    const dir=d.side==='top'?'down':'up';lockPose(p,dir,d.side)
  });
  window.addEventListener('futlive:throwin-release',ev=>{const p=byId(ev.detail?.taker);if(p)releasePose(p)});
  window.addEventListener('futlive:restart-recovered',()=>{for(const [p,s] of active){if(s.timer)clearTimeout(s.timer);p.el?.classList.remove('throw-in-visual-lock','throw-in-release-followthrough');p.throwInVisualLock=false;p.ctrl?.cancelPendingDirection?.();p.ctrl?.idle?.()}active.clear()});
  window.FutLiveThrowInVisual={version:VERSION,active,debug:()=>Object.fromEntries([...active].map(([p,s])=>[pid(p),{dir:s.dir,side:s.side,released:s.released,state:p.ctrl?.getState?.()}]))};
}
boot();
})();