(()=>{'use strict';
const VERSION='0.54';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const other=t=>t==='blue'?'red':'blue';
function boot(){
  const e=window.FutLiveFootballEngine,base=window.FutLiveFootballAI;
  if(!e||!base||!e.players?.length){setTimeout(boot,40);return}
  if(e.__footballTacticsV054)return;e.__footballTacticsV054=true;
  const old={moveToward:e.moveToward.bind(e),choosePassTarget:e.choosePassTarget.bind(e),pass:e.pass.bind(e),takePossession:e.takePossession.bind(e),ownedAI:e.ownedAI.bind(e),freeAI:e.freeAI.bind(e)};
  const state={blue:{lineX:0,width:0,compact:0,pressTrigger:false,marking:new Map()},red:{lineX:0,width:0,compact:0,pressTrigger:false,marking:new Map()}};
  const combo={blue:null,red:null};
  const living=p=>p&&!p.sentOff;
  const fielders=t=>e.players.filter(p=>living(p)&&!p.goalkeeper&&(!t||p.team===t));
  const attack=t=>t==='blue'?1:-1;
  const ownGoal=(t,f)=>t==='blue'?f.left:f.right;
  const oppGoal=(t,f)=>t==='blue'?f.right:f.left;
  const progress=(t,x,f)=>t==='blue'?(x-f.left)/(f.right-f.left):(f.right-x)/(f.right-f.left);
  function secondLastDefenderX(attackingTeam){
    const defs=fielders(other(attackingTeam)).map(p=>p.x).sort((a,b)=>a-b);if(defs.length<2)return null;
    return attackingTeam==='blue'?defs[defs.length-2]:defs[1]
  }
  function offside(attacker,ballX=e.ball.x){
    if(!attacker||attacker.goalkeeper)return false;const line=secondLastDefenderX(attacker.team);if(line==null)return false;
    if(attacker.team==='blue')return attacker.x>Math.max(line,ballX)+5;
    return attacker.x<Math.min(line,ballX)-5
  }
  function updateShape(team,f){
    const s=state[team],brain=base.teams[team],players=fielders(team),a=attack(team),own=ownGoal(team,f),opp=oppGoal(team,f);
    const bp=progress(team,e.ball.x,f),defending=e.ball.owner&&e.ball.owner.team!==team;
    let block=brain.phase==='LOW_BLOCK'?.24:brain.phase==='MID_BLOCK'?.39:brain.phase==='HIGH_PRESS'?.57:defending?.43:.50;
    if(brain.phase==='TRANSITION_DEFENSE')block=.46;if(brain.phase==='LOOSE_BALL')block=.47;
    s.lineX=own+(opp-own)*block;
    const ys=players.map(p=>p.y);const span=ys.length?Math.max(...ys)-Math.min(...ys):0;
    s.width=span;s.compact=clamp(1-span/(f.h*.68),0,1);
    const carrier=e.ball.owner,now=performance.now();
    const badTouch=carrier&&carrier.team!==team&&(now-e.ownerSince<430||carrier.pressureCount>=2);
    const sideline=e.ball.y<f.top+f.h*.18||e.ball.y>f.bottom-f.h*.18;
    const backwardPass=e.ball.type==='pass'&&e.ball.lastTouch?.team!==team&&e.ball.intended&&((e.ball.intended.x-e.ball.lastTouch.x)*attack(e.ball.lastTouch.team)<-8);
    s.pressTrigger=!!(defending&&(badTouch||sideline||backwardPass||brain.phase==='HIGH_PRESS'));
    if(e.game){e.game.dataset[team+'DefLine']=Math.round(s.lineX);e.game.dataset[team+'PressTrigger']=s.pressTrigger?'1':'0'}
  }
  function assignHybridMarks(team){
    const s=state[team],defenders=fielders(team),attackers=fielders(other(team));s.marking.clear();
    const used=new Set();for(const d of defenders){let best=null,score=1e9;for(const a of attackers){if(used.has(a))continue;const danger=progress(a.team,a.x,e.field()),dist=e.dist(d,a),central=Math.abs(a.y-e.field().h*.5);const sc=dist-danger*55+central*.04;if(sc<score){score=sc;best=a}}if(best&&score<130){s.marking.set(d,best);used.add(best)}}
  }
  function tacticalTarget(p,tx,ty){
    if(!living(p)||p.goalkeeper)return{x:tx,y:ty,speed:1};const f=e.field(),s=state[p.team],brain=base.teams[p.team],carrier=e.ball.owner,a=attack(p.team);
    let x=tx,y=ty,mult=1;
    const defending=carrier&&carrier.team!==p.team;
    if(defending){
      const pressor=p===brain.pressor,cover=p===brain.cover;
      if(!pressor&&!cover){const lineSlack=brain.phase==='LOW_BLOCK'?34:brain.phase==='MID_BLOCK'?45:58;x=clamp(x,s.lineX-lineSlack,s.lineX+lineSlack);}
      const mark=s.marking.get(p);if(mark&&!pressor){const zoneWeight=brain.phase==='LOW_BLOCK'?.72:brain.phase==='MID_BLOCK'?.58:.42;x=x*zoneWeight+(mark.x-a*24)*(1-zoneWeight);y=y*zoneWeight+mark.y*(1-zoneWeight)}
      const center=f.h*.5,width=brain.phase==='LOW_BLOCK'?.23:brain.phase==='MID_BLOCK'?.31:.38;y=clamp(y,center-f.h*width,center+f.h*width);
      if(s.pressTrigger&&(pressor||cover)){mult=pressor?1.16:1.04;if(cover&&carrier){x=carrier.x-a*48;y=(carrier.y+y)*.5}}
    }else if(carrier&&carrier.team===p.team&&p!==carrier){
      const c=combo[p.team],now=performance.now();if(c&&now<c.until){if(p===c.runner){x=c.runX;y=c.runY;mult=1.12}else if(p===c.third){x=c.thirdX;y=c.thirdY;mult=1.02}}
      const lane=Math.floor(clamp((y-f.top)/(f.bottom-f.top)*3,0,2));p.aiLane=lane;
      const mates=fielders(p.team).filter(q=>q!==p&&q!==carrier);const sameLane=mates.filter(q=>q.aiLane===lane&&Math.abs(q.x-p.x)<72);if(sameLane.length){y+=p.y<f.h*.5?-22:22}
      if(p.personality==='wing'&&Math.abs(p.y-carrier.y)<58){const overlap=progress(p.team,carrier.x,f)>.35;x=Math.max(x*a, (carrier.x+a*(overlap?88:58))*a)*a;y=clamp(p.home[1]<.5?f.top+f.h*.13:f.bottom-f.h*.13,f.top+28,f.bottom-40)}
      const line=secondLastDefenderX(p.team);if(line!=null){if(p.team==='blue')x=Math.min(x,line-7);else x=Math.max(x,line+7)}
    }
    return{x:clamp(x,f.left+30,f.right-30),y:clamp(y,f.top+30,f.bottom-42),speed:mult}
  }
  e.moveToward=(p,tx,ty,speed,dt)=>{const q=tacticalTarget(p,tx,ty);return old.moveToward(p,q.x,q.y,speed*q.speed,dt)};
  e.choosePassTarget=(c)=>{
    const initial=old.choosePassTarget(c);if(initial&&!offside(initial,c.x))return initial;
    const f=e.field(),a=attack(c.team),cands=fielders(c.team).filter(p=>p!==c&&!offside(p,c.x));let best=null,score=-1e9;
    for(const p of cands){const forward=(p.x-c.x)*a,space=Math.min(...fielders(other(c.team)).map(o=>e.dist(p,o)),120),dist=e.dist(c,p),s=forward*.26+space*.62-dist*.06+(p.personality==='creator'?10:0)+(p.personality==='finisher'?forward>0?12:0:0);if(s>score){score=s;best=p}}
    return best
  };
  e.pass=(c,t)=>{
    if(!c||!t||offside(t,c.x)){const safe=e.choosePassTarget(c);if(!safe||safe===t)return;t=safe}
    const team=c.team,a=attack(team),mates=fielders(team).filter(p=>p!==c&&p!==t),now=performance.now();
    const third=mates.sort((x,y)=>Math.abs(x.y-t.y)-Math.abs(y.y-t.y))[0]||null;
    const canOneTwo=e.dist(c,t)<150&&((t.x-c.x)*a)>12;
    if(canOneTwo){combo[team]={passer:c,runner:c,receiver:t,third,until:now+1250,runX:clamp(t.x+a*92,e.field().left+32,e.field().right-32),runY:clamp(c.y+(c.y<t.y?-28:28),e.field().top+32,e.field().bottom-44),thirdX:third?clamp(t.x-a*52,e.field().left+32,e.field().right-32):0,thirdY:third?clamp((third.y+t.y)*.5,e.field().top+32,e.field().bottom-44):0}}
    return old.pass(c,t)
  };
  e.takePossession=(p,reason='control')=>{if(p&&combo[p.team]&&performance.now()>combo[p.team].until)combo[p.team]=null;return old.takePossession(p,reason)};
  function dribbleBias(c){
    if(!c||c.goalkeeper)return;const f=e.field(),opps=fielders(other(c.team)),near=opps.filter(o=>e.dist(c,o)<62),goalDist=Math.abs(oppGoal(c.team,f)-c.x);let score=c.skill.control*.42+c.skill.composure*.20+(c.personality==='wing'?.18:0)+(goalDist<f.w*.28?.10:0)-near.length*.16;
    c.aiDribbleIntent=score>.38?'TAKE_ON':score>.18?'CARRY':'RELEASE';if(e.game)e.game.dataset.lastDribbleIntent=c.aiDribbleIntent
  }
  e.ownedAI=(dt,f)=>{for(const t of ['blue','red']){updateShape(t,f);assignHybridMarks(t)}dribbleBias(e.ball.owner);return old.ownedAI(dt,f)};
  e.freeAI=(dt,f)=>{for(const t of ['blue','red']){updateShape(t,f);assignHybridMarks(t)}return old.freeAI(dt,f)};
  window.FutLiveFootballTactics={version:VERSION,state,combo,offside,secondLastDefenderX,debug:()=>({blue:{lineX:state.blue.lineX,width:state.blue.width,compact:state.blue.compact,pressTrigger:state.blue.pressTrigger},red:{lineX:state.red.lineX,width:state.red.width,compact:state.red.compact,pressTrigger:state.red.pressTrigger},combo})};
}
boot();
})();