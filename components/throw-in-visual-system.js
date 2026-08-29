(()=>{'use strict';
const VERSION='0.72.0';
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,45);return}if(window.FutLiveThrowInVisual)return;
  const active=new Map(),pid=p=>p?.el?.id||null,byId=id=>e.players.find(p=>pid(p)===id)||null;
  if(!document.getElementById('futlive-throwin-visual-lock-style')){
    const st=document.createElement('style');st.id='futlive-throwin-visual-lock-style';
    st.textContent='@keyframes futliveThrowJump{0%{transform:translateY(0)}42%{transform:translateY(-9px)}72%{transform:translateY(-3px)}100%{transform:translateY(0)}}.player.throw-in-visual-lock{z-index:44!important}.player.throw-in-visual-lock .player-sprite-img{opacity:1!important;visibility:visible!important;transition:none!important;transform:none!important;filter:drop-shadow(0 3px 5px #0009)!important}.player.throw-in-jump .player-sprite-img{animation:futliveThrowJump 440ms cubic-bezier(.2,.72,.32,1) 1!important}';
    document.head.appendChild(st)
  }
  function lockPose(p,dir,side){if(!p?.ctrl)return;const old=active.get(p);if(old?.timer)clearTimeout(old.timer);p.ctrl.cancelPendingDirection?.();p.ctrl.stop?.(false);p.ctrl.setState?.(dir,{restart:true});p.ctrl.show?.(0);const st=p.ctrl.getState?.()||{},frame=st.frame||p.ctrl.sequence?.(dir)?.[0]||null;active.set(p,{dir,side,frame,released:false,timer:null});p.throwInVisualLock=true;p.facing=dir;p.lastDir=dir;p.el?.classList.add('throw-in-visual-lock')}
  function forceFrame(p,s){if(!p?.ctrl||!s)return;p.ctrl.cancelPendingDirection?.();p.ctrl.stop?.(false);if(p.ctrl.state!==s.dir)p.ctrl.setState?.(s.dir,{restart:true});if(s.frame&&p.ctrl.img&&p.ctrl.src)p.ctrl.img.src=p.ctrl.src(s.frame);else p.ctrl.show?.(0);p.facing=s.dir;p.lastDir=s.dir}
  function releasePose(p){const s=active.get(p);if(!s)return;s.released=true;forceFrame(p,s);p.el?.classList.remove('throw-in-jump');void p.el?.offsetWidth;p.el?.classList.add('throw-in-jump');s.timer=setTimeout(()=>{p.el?.classList.remove('throw-in-visual-lock','throw-in-jump');p.throwInVisualLock=false;active.delete(p);p.ctrl?.cancelPendingDirection?.();p.ctrl?.idle?.()},470)}
  function guard(){for(const [p,s] of active){forceFrame(p,s)}requestAnimationFrame(guard)}requestAnimationFrame(guard);
  window.addEventListener('futlive:throwin-ready',ev=>{const d=ev.detail||{},p=byId(d.taker);if(p)lockPose(p,d.side==='top'?'down':'up',d.side)});
  window.addEventListener('futlive:throwin-release',ev=>{const p=byId(ev.detail?.taker);if(p)releasePose(p)});
  window.addEventListener('futlive:restart-recovered',()=>{for(const [p,s] of active){if(s.timer)clearTimeout(s.timer);p.el?.classList.remove('throw-in-visual-lock','throw-in-jump');p.throwInVisualLock=false;p.ctrl?.idle?.()}active.clear()});
  window.FutLiveThrowInVisual={version:VERSION,active,debug:()=>Object.fromEntries([...active].map(([p,s])=>[pid(p),{dir:s.dir,side:s.side,frame:s.frame,released:s.released,state:p.ctrl?.getState?.()}]))};
}
boot();
})();