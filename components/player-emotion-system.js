(()=>{'use strict';
const STATES={
  calm:{key:'calm',label:'CALMO',emoji:'😐',duration:0,mods:{}},
  motivated:{key:'motivated',label:'DETERMINADO',emoji:'🔥',duration:13000,mods:{speed:.07,defend:.06,vision:.03,composure:.03,control:.02},behavior:{press:.08,offball:.07,pass:.02,shoot:.03}},
  angry:{key:'angry',label:'COM RAIVA',emoji:'😡',duration:11500,mods:{speed:.08,defend:.11,shoot:.04,control:-.06,pass:-.10,vision:-.08,composure:-.12},behavior:{press:.14,offball:.04,pass:-.10,shoot:.10}},
  confident:{key:'confident',label:'CONFIANTE',emoji:'😎',duration:14500,mods:{control:.06,shoot:.08,pass:.03,composure:.07,vision:.03,defend:-.02},behavior:{press:.02,offball:.04,pass:-.03,shoot:.12}},
  cocky:{key:'cocky',label:'SE ACHANDO',emoji:'🤩',duration:10500,mods:{shoot:.12,control:.05,speed:.03,pass:-.10,vision:-.08,composure:-.03},behavior:{press:0,offball:.02,pass:-.22,shoot:.25}},
  frustrated:{key:'frustrated',label:'FRUSTRADO',emoji:'😤',duration:10000,mods:{speed:.02,defend:.04,shoot:-.05,control:-.07,pass:-.07,vision:-.05,composure:-.10},behavior:{press:.08,offball:-.03,pass:-.04,shoot:.04}},
  demotivated:{key:'demotivated',label:'DESMOTIVADO',emoji:'😞',duration:12500,mods:{speed:-.12,defend:-.10,control:-.05,vision:-.07,composure:-.08,pass:-.05},behavior:{press:-.15,offball:-.15,pass:.05,shoot:-.10}},
  focused:{key:'focused',label:'FOCADO',emoji:'🧊',duration:15000,mods:{control:.08,pass:.07,vision:.08,composure:.10,speed:-.03,shoot:-.03},behavior:{press:-.02,offball:.02,pass:.10,shoot:-.08}}
};
const PROFILES={
  cold:{label:'Frio',emoji:'🧊',bias:{focused:.55,calm:.45,angry:-.45,frustrated:-.25,demotivated:-.30,confident:.10,motivated:.15,cocky:-.20}},
  explosive:{label:'Explosivo',emoji:'🔥',bias:{angry:.55,motivated:.25,frustrated:.25,confident:.08,cocky:.12,focused:-.18,calm:-.18,demotivated:-.05}},
  competitive:{label:'Competitivo',emoji:'💪',bias:{motivated:.55,focused:.25,confident:.18,angry:.12,frustrated:-.05,demotivated:-.35,cocky:-.05}},
  confident:{label:'Confiante',emoji:'😎',bias:{confident:.50,cocky:.28,motivated:.20,focused:.10,frustrated:-.15,demotivated:-.35,angry:-.08}},
  insecure:{label:'Inseguro',emoji:'😰',bias:{demotivated:.48,frustrated:.40,angry:.08,focused:-.10,confident:-.25,cocky:-.35,motivated:-.05}}
};
const EVENT_WEIGHTS={
  goalScored:{confident:.70,cocky:.38,motivated:.45,focused:.08,frustrated:-.35,demotivated:-.55},
  teamGoal:{motivated:.40,confident:.30,focused:.08,frustrated:-.20,demotivated:-.30},
  assist:{confident:.48,motivated:.38,focused:.15,cocky:.16},
  goalConceded:{angry:.32,frustrated:.38,demotivated:.40,motivated:.20,focused:.15,confident:-.28,cocky:-.38},
  missedClearChance:{frustrated:.62,angry:.25,demotivated:.18,focused:.12,confident:-.28,cocky:-.20},
  badPassSequence:{frustrated:.55,demotivated:.28,angry:.20,focused:.12,confident:-.25},
  importantTackle:{motivated:.48,focused:.38,confident:.28,cocky:.05,demotivated:-.22},
  lostBall:{frustrated:.35,angry:.22,demotivated:.18,focused:.10,confident:-.16},
  importantInterception:{focused:.52,motivated:.40,confident:.25,cocky:.05,frustrated:-.18},
  hardSave:{focused:.55,confident:.45,motivated:.32,cocky:.10,demotivated:-.25},
  equalized:{motivated:.58,confident:.32,focused:.18,demotivated:-.30,frustrated:-.20},
  comeback:{confident:.62,motivated:.58,cocky:.22,focused:.15,demotivated:-.45,frustrated:-.35},
  sufferedComeback:{frustrated:.60,demotivated:.52,angry:.32,motivated:.18,confident:-.45,cocky:-.50}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>performance.now();
function hashNoise(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return((h>>>0)%1000)/1000}
class PlayerEmotionSystem{
  constructor(engine){
    this.engine=engine;this.states=new Map();this.serial=0;this.lastPass=null;this.pendingPasses=new Map();this.badPasses=new Map();this.trailed={blue:false,red:false};this.lastGoalAt=0;this.alwaysVisible=false;this.original={};
    this.installStyles();this.registerPlayers();this.hookEngine();this.timer=setInterval(()=>this.tick(),350);window.FutLiveEmotionSystem=this;this.installDebug();
  }
  registerPlayers(){
    const blueProfiles=['cold','explosive','competitive','confident','insecure'];
    const redProfiles=['competitive','confident','insecure','cold','explosive'];
    for(const p of this.engine.players){
      const profile=(p.team==='blue'?blueProfiles:redProfiles)[p.slot%5];
      const baseSkill={};for(const k of Object.keys(p.skill))baseSkill[k]=Number(p.skill[k]);
      const rec={player:p,profile,state:'calm',intensity:0,startedAt:0,endsAt:0,baseSkill,baseSpeed:Number(p.speed),recent:[],label:null,labelTimer:0};
      this.states.set(p,rec);p.mentalProfile=profile;p.emotionState='calm';p.el.dataset.mentalProfile=profile;p.el.dataset.emotion='calm';
      for(const key of Object.keys(baseSkill))Object.defineProperty(p.skill,key,{configurable:true,enumerable:true,get:()=>this.effectiveSkill(p,key),set:v=>{rec.baseSkill[key]=Number(v)}});
      Object.defineProperty(p,'speed',{configurable:true,enumerable:true,get:()=>rec.baseSpeed*this.modifier(p,'speed'),set:v=>{rec.baseSpeed=Number(v)}});
      const label=document.createElement('span');label.className='emotionTag';p.el.appendChild(label);rec.label=label;
    }
  }
  modifier(p,key){const rec=this.states.get(p);if(!rec||rec.state==='calm')return 1;const def=STATES[rec.state],raw=def.mods?.[key]||0;return 1+clamp(raw*rec.intensity,-.15,.15)}
  effectiveSkill(p,key){const rec=this.states.get(p);if(!rec)return Number(p.skill[key])||0;return clamp(rec.baseSkill[key]*this.modifier(p,key),.05,.99)}
  behavior(p){const rec=this.states.get(p),def=rec?STATES[rec.state]:STATES.calm,i=rec?.intensity||0,b=def.behavior||{};return{state:rec?.state||'calm',intensity:i,press:(b.press||0)*i,offball:(b.offball||0)*i,pass:(b.pass||0)*i,shoot:(b.shoot||0)*i}}
  profile(p){return this.states.get(p)?.profile||'cold'}
  composureResistance(rec){const c=rec.baseSkill.composure??.65;return clamp((c-.45)/.5,0,1)}
  react(p,event,ctx={}){
    const rec=this.states.get(p),weights=EVENT_WEIGHTS[event];if(!rec||!weights)return;
    const resistance=this.composureResistance(rec),profile=PROFILES[rec.profile],scores={};this.serial++;
    for(const state of Object.keys(STATES)){
      if(state==='calm')continue;
      let s=(weights[state]||0)+(profile.bias[state]||0)*.62;
      if(rec.state===state)s+=.14;
      if(['angry','frustrated','demotivated','cocky'].includes(state))s-=resistance*.28;
      if(['focused','calm'].includes(state))s+=resistance*.15;
      if(ctx.trailing&&state==='motivated'&&rec.profile==='competitive')s+=.20;
      if(ctx.leading&&state==='focused'&&rec.profile==='cold')s+=.12;
      s+=(hashNoise(`${p.el.id}:${event}:${this.serial}:${state}`)-.5)*.08;
      scores[state]=s;
    }
    let best='calm',bestScore=.18+resistance*.08;for(const [state,s] of Object.entries(scores))if(s>bestScore){bestScore=s;best=state}
    if(best==='calm'){if(rec.state!=='calm'&&bestScore<.30)this.setState(p,'calm',0,event);return}
    const intensity=clamp(.42+(bestScore-.25)*.48-resistance*.12,.38,1);
    this.setState(p,best,intensity,event);
  }
  setState(p,state,intensity=.7,source='manual'){
    const rec=this.states.get(p);if(!rec||!STATES[state])return;const t=now();rec.state=state;rec.intensity=state==='calm'?0:clamp(intensity,.25,1);rec.startedAt=t;const resistance=this.composureResistance(rec),dur=STATES[state].duration*(.85+resistance*.35);rec.endsAt=state==='calm'?0:t+dur;rec.recent.push({source,state,at:t});rec.recent=rec.recent.slice(-8);p.emotionState=state;p.el.dataset.emotion=state;this.showLabel(rec,source);this.dispatch('emotionchange',{playerId:p.el.id,team:p.team,profile:rec.profile,state,intensity:rec.intensity,source});
  }
  showLabel(rec,source){const def=STATES[rec.state],label=rec.label;if(!label)return;clearTimeout(rec.labelTimer);label.textContent=rec.state==='calm'?'':`${def.emoji} ${def.label}`;label.classList.toggle('show',rec.state!=='calm');if(!this.alwaysVisible&&rec.state!=='calm')rec.labelTimer=setTimeout(()=>label.classList.remove('show'),1700)}
  tick(){const t=now();for(const [p,rec] of this.states){if(rec.state==='calm')continue;const total=Math.max(1,rec.endsAt-rec.startedAt),remaining=rec.endsAt-t;if(remaining<=0){this.setState(p,'calm',0,'decay');continue}const progress=clamp(remaining/total,0,1);rec.intensity=clamp(progress,.18,1);if(this.alwaysVisible){rec.label.classList.add('show');rec.label.textContent=`${STATES[rec.state].emoji} ${STATES[rec.state].label}`}}}
  teamPlayers(team){return this.engine.players.filter(p=>p.team===team)}
  teamReact(team,event,ctx={}){for(const p of this.teamPlayers(team))this.react(p,event,ctx)}
  isDefensiveThird(p,x){const f=this.engine.field();return p.team==='blue'?x<f.left+f.w*.34:x>f.right-f.w*.34}
  hookEngine(){
    const e=this.engine;
    this.original.pass=e.pass.bind(e);e.pass=(c,t)=>{const token=++this.serial;this.pendingPasses.set(c,{token,to:t,at:now()});this.lastPass={from:c,to:t,team:c.team,at:now(),completed:false};this.original.pass(c,t);setTimeout(()=>this.checkPassFailure(c,token),1650)};
    this.original.takePossession=e.takePossession.bind(e);e.takePossession=(p,reason='control')=>{const speed=Math.hypot(e.ball.vx||0,e.ball.vy||0),ballX=e.ball.x;this.original.takePossession(p,reason);if(reason==='pass-received'&&this.lastPass?.to===p){this.lastPass.completed=true;this.pendingPasses.delete(this.lastPass.from);this.badPasses.set(this.lastPass.from,[])}if(reason==='interception'){const important=this.isDefensiveThird(p,ballX)||speed>145;this.react(p,important?'importantInterception':'importantTackle',{leading:this.isLeading(p.team),trailing:this.isTrailing(p.team)})}if(reason==='goalkeeper-save'&&p.goalkeeper&&speed>145)this.react(p,'hardSave',{leading:this.isLeading(p.team),trailing:this.isTrailing(p.team)})};
    this.original.knockLoose=e.knockLoose.bind(e);e.knockLoose=(owner,challenger)=>{const x=e.ball.x,important=this.isDefensiveThird(challenger,x);this.original.knockLoose(owner,challenger);this.react(owner,'lostBall',{leading:this.isLeading(owner.team),trailing:this.isTrailing(owner.team)});if(important)this.react(challenger,'importantTackle',{leading:this.isLeading(challenger.team),trailing:this.isTrailing(challenger.team)})};
    this.original.shoot=e.shoot.bind(e);e.shoot=(c,f)=>{const scoreBefore={blue:e.score.blue,red:e.score.red},goalX=c.team==='blue'?f.right:f.left,clear=Math.abs(goalX-c.x)<f.w*.22;this.original.shoot(c,f);if(clear)setTimeout(()=>{if(e.score.blue===scoreBefore.blue&&e.score.red===scoreBefore.red&&now()-this.lastGoalAt>900)this.react(c,'missedClearChance',{leading:this.isLeading(c.team),trailing:this.isTrailing(c.team)})},1850)};
    this.original.goal=e.goal.bind(e);e.goal=(team)=>{const before={blue:e.score.blue,red:e.score.red},scorer=e.ball.lastTouch&&e.ball.lastTouch.team===team?e.ball.lastTouch:null,assist=this.lastPass?.completed&&scorer&&this.lastPass.to===scorer&&this.lastPass.team===team&&now()-this.lastPass.at<7000?this.lastPass.from:null;this.original.goal(team);const after={blue:e.score.blue,red:e.score.red};if(after.blue===before.blue&&after.red===before.red)return;this.lastGoalAt=now();const other=team==='blue'?'red':'blue';if(scorer)this.react(scorer,'goalScored',{leading:true,trailing:false});for(const p of this.teamPlayers(team))if(p!==scorer)this.react(p,'teamGoal',{leading:this.isLeading(team),trailing:this.isTrailing(team)});if(assist&&assist!==scorer)this.react(assist,'assist',{leading:this.isLeading(team),trailing:false});this.teamReact(other,'goalConceded',{leading:this.isLeading(other),trailing:this.isTrailing(other)});if(after.blue===after.red)this.teamReact(team,'equalized',{leading:false,trailing:false});const teamNowLeads=team==='blue'?after.blue>after.red:after.red>after.blue;if(teamNowLeads&&this.trailed[team]){this.teamReact(team,'comeback',{leading:true,trailing:false});this.teamReact(other,'sufferedComeback',{leading:false,trailing:true});this.trailed[team]=false}this.trailed.blue=this.trailed.blue||(after.blue<after.red);this.trailed.red=this.trailed.red||(after.red<after.blue);this.lastPass=null};
    this.original.choosePassTarget=e.choosePassTarget.bind(e);e.choosePassTarget=(c)=>{const b=this.behavior(c),original=this.original.choosePassTarget(c);if(!c||c.goalkeeper)return original;const f=e.field(),goalX=c.team==='blue'?f.right:f.left,goalDist=Math.abs(goalX-c.x);if((b.state==='cocky'||b.state==='confident')&&b.shoot>.08&&goalDist<f.w*(b.state==='cocky'?.42:.34))return null;if(b.state==='angry'&&goalDist<f.w*.30)return null;if(b.state==='focused'&&original){const mates=e.mates(c.team,c),safe=mates.filter(m=>e.dist(c,m)<f.w*.24).sort((a,bm)=>e.dist(c,a)-e.dist(c,bm))[0];if(safe)return safe}return original};
  }
  checkPassFailure(p,token){const pending=this.pendingPasses.get(p);if(!pending||pending.token!==token)return;this.pendingPasses.delete(p);const arr=(this.badPasses.get(p)||[]).filter(t=>now()-t<8500);arr.push(now());this.badPasses.set(p,arr);if(arr.length>=2){this.react(p,'badPassSequence',{leading:this.isLeading(p.team),trailing:this.isTrailing(p.team)});this.badPasses.set(p,[])}}
  isLeading(team){return team==='blue'?this.engine.score.blue>this.engine.score.red:this.engine.score.red>this.engine.score.blue}
  isTrailing(team){return team==='blue'?this.engine.score.blue<this.engine.score.red:this.engine.score.red<this.engine.score.blue}
  dispatch(name,detail){window.dispatchEvent(new CustomEvent('futlive:'+name,{detail}))}
  installStyles(){if(document.getElementById('emotionStyles'))return;const s=document.createElement('style');s.id='emotionStyles';s.textContent=`.emotionTag{position:absolute;z-index:18;left:50%;bottom:100%;transform:translate(-50%,-8px) scale(.85);white-space:nowrap;padding:4px 7px;border-radius:999px;background:#081019e8;border:1px solid #ffffff2c;color:#fff;font:900 7px/1 system-ui;letter-spacing:.06em;opacity:0;pointer-events:none;transition:.18s ease;text-shadow:none}.emotionTag.show{opacity:1;transform:translate(-50%,-11px) scale(1)}.player[data-emotion="angry"] .emotionTag{border-color:#ff655d88}.player[data-emotion="motivated"] .emotionTag{border-color:#ffb34788}.player[data-emotion="confident"] .emotionTag,.player[data-emotion="cocky"] .emotionTag{border-color:#79b8ff88}.player[data-emotion="demotivated"] .emotionTag{border-color:#9aa4b288}.player[data-emotion="focused"] .emotionTag{border-color:#bdefff88}`;document.head.appendChild(s)}
  installDebug(){window.FutLiveEmotionDebug={inspect:()=>this.engine.players.map(p=>{const r=this.states.get(p);return{id:p.el.id,team:p.team,profile:r.profile,profileLabel:PROFILES[r.profile].label,state:r.state,label:STATES[r.state].label,intensity:+r.intensity.toFixed(2),skills:Object.fromEntries(Object.keys(r.baseSkill).map(k=>[k,+p.skill[k].toFixed(3)])),behavior:this.behavior(p)}}),trigger:(id,event)=>{const p=this.engine.players.find(x=>x.el.id===id);if(p)this.react(p,event,{leading:this.isLeading(p.team),trailing:this.isTrailing(p.team)})},setState:(id,state,intensity=.8)=>{const p=this.engine.players.find(x=>x.el.id===id);if(p)this.setState(p,state,intensity,'debug')},setAlwaysVisible:v=>{this.alwaysVisible=!!v;for(const [,r] of this.states)if(!v)r.label.classList.remove('show')}}}
}
function boot(){const e=window.FutLiveFootballEngine;if(!e?.players?.length){setTimeout(boot,120);return}if(window.FutLiveEmotionSystem)return;new PlayerEmotionSystem(e)}
boot();window.FutLivePlayerEmotionSystemClass=PlayerEmotionSystem;
})();