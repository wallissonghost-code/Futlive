(()=>{'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function boot(){
  const e=window.FutLiveFootballEngine;if(!e||!e.players?.length){setTimeout(boot,40);return}if(e.__groundGameV042)return;e.__groundGameV042=true;
  const originalTake=e.takePossession.bind(e),originalMove=e.moveToward.bind(e);
  const protection=new Map();
  const activePhase=()=>window.FutLiveMatchState?.phase==='PLAYING';
  const living=p=>p&&!p.sentOff;
  e.linePlayers=(team)=>e.players.filter(p=>p.team===team&&!p.goalkeeper&&!p.sentOff);

  e.takePossession=(p,reason='control')=>{if(!living(p))return;originalTake(p,reason);protection.set(p,performance.now()+420);p.lastPossessionReason=reason};

  function defendersAround(c,r=62){return e.players.filter(p=>living(p)&&!p.goalkeeper&&p.team!==c.team&&e.dist(p,c)<=r).sort((a,b)=>e.dist(a,c)-e.dist(b,c))}
  function forwardVec(p){const d=p.facing||p.lastDir;return d==='left'?[-1,0]:d==='up'?[0,-1]:d==='down'?[0,1]:[1,0]}
  function facingQuality(d,c){const [fx,fy]=forwardVec(d),dx=c.x-d.x,dy=c.y-d.y,m=Math.hypot(dx,dy)||1;return(fx*dx+fy*dy)/m}

  e.challengeOwner=(c,dt)=>{
    if(!activePhase()||!living(c)||performance.now()<(protection.get(c)||0))return false;
    const near=defendersAround(c,34),pressure=defendersAround(c,58).length;if(!near.length)return false;
    for(const d of near){
      const body=e.dist(c,d),foot=e.footDist(d);if(body>c.radius+d.radius+5||foot>23)continue;
      const defend=d.skill.defend||.5,control=c.skill.control||.5,position=facingQuality(d,c),age=performance.now()-e.ownerSince;
      const exposed=(age>520?1:0)+(pressure>=2?1:0)+(control<.62?1:0)+(foot<15?1:0)+(position>.58?1:0);if(exposed<3)continue;
      const edge=defend-control,base=.035+Math.max(0,edge)*.16+(pressure-1)*.035+(foot<14?.035:0)+(position>.65?.025:0);
      if(Math.random()<clamp(base,.02,.18)*dt){e.knockLoose(c,d);protection.set(d,performance.now()+360);return true}
    }
    return false
  };

  // Este módulo cuida somente do contato/pressão física. Formação e home pertencem à IA tática.
  e.moveToward=(p,tx,ty,speed,dt)=>{
    if(p?.sentOff)return 0;
    const c=e.ball.owner;
    if(activePhase()&&living(c)&&!c.goalkeeper){
      if(p===c){
        const press=defendersAround(c,68);p.pressureCount=press.length;
        if(press.length){
          let ax=0,ay=0;
          for(const d of press.slice(0,2)){const dx=c.x-d.x,dy=c.y-d.y,m=Math.hypot(dx,dy)||1,w=1/Math.max(18,e.dist(c,d));ax+=dx/m*w;ay+=dy/m*w}
          const m=Math.hypot(ax,ay)||1,escape=press.length>=2?42:27,weight=press.length>=2?.72:.48;
          const ex=clamp(c.x+ax/m*escape,e.field().left+30,e.field().right-30),ey=clamp(c.y+ay/m*escape,e.field().top+30,e.field().bottom-40);
          tx=tx*(1-weight)+ex*weight;ty=ty*(1-weight)+ey*weight;speed*=press.length>=2?1.08:1.03
        }
      }else if(p.team!==c.team&&Math.hypot(tx-c.x,ty-c.y)<22){
        const attack=c.team==='blue'?1:-1,rank=defendersAround(c,72).indexOf(p),gap=rank===0?18:rank===1?28:34;
        tx=c.x+attack*gap;ty=c.y+(rank===1?(p.y<c.y?-18:18):0);speed*=rank===0?1:.88
      }
    }
    return originalMove(p,tx,ty,speed,dt)
  };

  window.FutLiveGroundGame={version:'0.42',protection,pressureFor:p=>defendersAround(p,62),protect:(p,ms=420)=>protection.set(p,performance.now()+ms)};
}
boot();
})();