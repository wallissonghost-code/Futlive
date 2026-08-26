(()=>{'use strict';
const cfg=window.FutLiveConfig;
if(!cfg)throw new Error('FutLiveConfig não carregado');
const $=id=>document.getElementById(id);
const game=$('game'),pauseBtn=$('pauseBtn'),fx=$('forceFx'),fxText=$('forceFxText');
const giftHud=new LiveGiftHUD({root:'#liveGiftHud',defaults:cfg.gifts});
window.FutLiveHUD=giftHud;

function buildTeam(teamCfg){
  return teamCfg.ids.map(id=>new FutLivePlayerSprite({element:'#'+id,base:teamCfg.base,frameCount:teamCfg.frames,fps:teamCfg.fps,team:teamCfg.team}).idle());
}
const team1=buildTeam(cfg.players.team1),team2=buildTeam(cfg.players.team2),players=[...team1,...team2];
const byId={};cfg.players.team1.ids.forEach((id,i)=>byId[id]=team1[i]);cfg.players.team2.ids.forEach((id,i)=>byId[id]=team2[i]);
window.FutLivePlayers={...byId,team1,team2,all:players};

function syncVersion(){const v=document.querySelector('.version');if(v)v.textContent='BETA '+cfg.version}
syncVersion();setTimeout(syncVersion,300);

let paused=false,fxTimer=null;
function triggerForce(team='blue'){
  team=String(team).toLowerCase().includes('red')||String(team).toLowerCase().includes('vermel')?'red':'blue';
  clearTimeout(fxTimer);fx.classList.remove('show');game.classList.remove('force-blue','force-red');void fx.offsetWidth;
  fxText.textContent=(team==='blue'?'AZUL':'VERMELHO')+' · FORÇA +';fx.classList.add('show');game.classList.add('force-'+team);
  fxTimer=setTimeout(()=>{fx.classList.remove('show');game.classList.remove('force-blue','force-red')},1300);
}
pauseBtn.onclick=()=>{paused=!paused;game.classList.toggle('is-paused',paused);pauseBtn.classList.toggle('paused',paused);pauseBtn.textContent=paused?'▶':'⏸';if(paused)players.forEach(p=>p.stop(false));else players.forEach(p=>p.resume())};
window.FutLiveApp={game,giftHud,players,team1,team2,triggerForce,isPaused:()=>paused};
window.FutLiveTest={force:triggerForce};
})();