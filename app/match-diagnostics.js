(()=>{'use strict';
const SAMPLE_MS=1000,MAX_SAMPLES=300,MAX_EVENTS=220,MAX_EXPORT_BYTES=480*1024;
let sessionId='',startedAt=0,samples=[],events=[],lastSample=0,exportUrl=null,lastExport=null,fps=0,fpsFrames=0,fpsTick=performance.now();
const n=(v,d=1)=>{const x=Number(v);return Number.isFinite(x)?Number(x.toFixed(d)):0};
const id=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const pid=p=>p?.el?.id||p?.id||null;
function clearExport(){if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null}lastExport=null}
function reset(reason='new-session'){clearExport();sessionId=id();startedAt=Date.now();samples=[];events=[];lastSample=0;mark('diagnostic-reset',{reason})}
function compactDetail(v,depth=0,seen=new WeakSet()){
  if(v==null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number')return Number.isFinite(v)?n(v,2):null;
  if(typeof v==='function'||depth>2)return undefined;
  if(v?.nodeType)return undefined;
  if(typeof v==='object'){
    if(v.el||v.ctrl||('team'in v&&('slot'in v||'goalkeeper'in v)))return{id:pid(v),team:v.team||null,slot:v.slot??null,goalkeeper:!!v.goalkeeper,x:n(v.x),y:n(v.y)};
    if(seen.has(v))return'[circular]';seen.add(v);
    if(Array.isArray(v))return v.slice(0,10).map(x=>compactDetail(x,depth+1,seen)).filter(x=>x!==undefined);
    const out={};for(const[k,x]of Object.entries(v).slice(0,18)){const c=compactDetail(x,depth+1,seen);if(c!==undefined)out[k]=c}return out;
  }
  return String(v);
}
function mark(type,data={}){if(!sessionId){sessionId=id();startedAt=Date.now()}events.push({t:Date.now()-startedAt,type:String(type||'event').slice(0,44),data:compactDetail(data)});if(events.length>MAX_EVENTS)events.shift()}
function playerSnapshot(p){return{id:pid(p),team:p.team,slot:p.slot,gk:!!p.goalkeeper,x:n(p.x),y:n(p.y),facing:p.facing||null,dir:p.lastDir||null,role:p.personality||null,suspended:!!p.tempSuspended,sentOff:!!p.sentOff,yellow:Number(p.yellowCards)||0,red:!!p.redCard};}
function snapshot(){
  const e=window.FutLiveFootballEngine,ms=window.FutLiveMatchState||{},ref=window.FutLiveReferee,sp=window.FutLiveSetPieces?.state,game=document.getElementById('game');if(!e?.players?.length)return null;
  const b=e.ball||{},refEl=document.querySelector('.referee-agent'),rd=ref?Math.hypot((ref.x||0)-(b.x||0),(ref.y||0)-(b.y||0)):null;
  return{t:Date.now()-startedAt,match:{phase:ms.phase||null,elapsed:n(ms.elapsedMs,0),remaining:n(ms.remainingMs,0),duration:n(ms.durationMs,0),paused:!!window.FutLiveApp?.isPaused?.(),score:{blue:Number(e.score?.blue)||0,red:Number(e.score?.red)||0}},fps:n(fps),field:(()=>{const f=e.field();return{w:n(f.w),h:n(f.h),left:n(f.left),right:n(f.right),top:n(f.top),bottom:n(f.bottom)}})(),ball:{x:n(b.x),y:n(b.y),vx:n(b.vx),vy:n(b.vy),speed:n(Math.hypot(b.vx||0,b.vy||0)),type:b.type||null,owner:pid(b.owner),ownerTeam:b.owner?.team||null,lastTouch:pid(b.lastTouch),lastTouchTeam:b.lastTouch?.team||null,intended:pid(b.intended)},players:e.players.map(playerSnapshot),referee:ref?{x:n(ref.x),y:n(ref.y),state:ref.state||null,target:ref.target?{x:n(ref.target.x),y:n(ref.target.y)}:null,followX:n(ref.followX),followY:n(ref.followY),followSide:ref.followSide??null,distanceToBall:n(rd),anim:refEl?.dataset?.anim||null,direction:refEl?.dataset?.direction||null,frame:refEl?.dataset?.frame||null}:null,setPiece:sp?{busy:!!sp.busy,type:sp.type||null,team:sp.team||null,taker:pid(sp.taker),spot:sp.spot?{x:n(sp.spot.x),y:n(sp.spot.y)}:null}:null,lastAction:game?.dataset?.lastAction||null,lastSetPiece:game?.dataset?.lastSetPiece||null};
}
function sample(){const now=Date.now();if(now-lastSample<SAMPLE_MS)return;lastSample=now;const s=snapshot();if(!s)return;samples.push(s);if(samples.length>MAX_SAMPLES)samples.shift()}
function build(note=''){
  sample();const e=window.FutLiveFootballEngine,ms=window.FutLiveMatchState||{};let data={schema:'futlive.match-diagnostic.v1',game:'Futlive',version:window.FutLiveConfig?.version||'unknown',sessionId,createdAt:new Date().toISOString(),sessionStartedAt:new Date(startedAt).toISOString(),note:String(note||'').trim().slice(0,300),limits:{sampleHz:1,maxSamples:MAX_SAMPLES,maxEvents:MAX_EVENTS,maxExportBytes:MAX_EXPORT_BYTES,persistentStorage:false},summary:{phase:ms.phase||null,elapsedMs:Number(ms.elapsedMs)||0,remainingMs:Number(ms.remainingMs)||0,durationMs:Number(ms.durationMs)||0,score:{blue:Number(e?.score?.blue)||0,red:Number(e?.score?.red)||0},samplesCaptured:samples.length,eventsCaptured:events.length,windowMs:samples.length>1?samples[samples.length-1].t-samples[0].t:0},events:[...events],samples:[...samples]};
  let json=JSON.stringify(data,null,2);while(new Blob([json]).size>MAX_EXPORT_BYTES&&data.samples.length>30){data.samples=data.samples.slice(Math.max(1,Math.ceil(data.samples.length*.12)));data.summary.trimmed=true;data.summary.samplesExported=data.samples.length;json=JSON.stringify(data,null,2)}while(new Blob([json]).size>MAX_EXPORT_BYTES&&data.events.length>40){data.events=data.events.slice(20);data.summary.eventsTrimmed=true;json=JSON.stringify(data,null,2)}return{data,json,size:new Blob([json]).size};
}
async function exportDiagnostic(){
  const btn=document.getElementById('generateMatchDiagnostic'),status=document.getElementById('matchDiagnosticStatus'),note=document.getElementById('matchDiagnosticNote')?.value||'';if(btn)btn.disabled=true;
  try{clearExport();const out=build(note),name=`futlive-diagnostico-${sessionId}.json`,file=new File([out.json],name,{type:'application/json'});lastExport={name,size:out.size,at:Date.now()};if(status)status.textContent=`✓ ${Math.round(out.size/1024)} KB · ${out.data.samples.length} amostras · temporário`;
    if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:'Futlive · Diagnóstico de partida',text:'Diagnóstico temporário da partida para análise.',files:[file]});return}catch(e){if(e?.name==='AbortError')return}}
    exportUrl=URL.createObjectURL(file);const a=document.createElement('a');a.href=exportUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();
  }catch(e){console.error('[Futlive Diagnostics]',e);if(status)status.textContent='⚠️ Não foi possível gerar: '+String(e?.message||e)}finally{if(btn)btn.disabled=false}
}
function fpsLoop(t){fpsFrames++;if(t-fpsTick>=1000){fps=fpsFrames*1000/(t-fpsTick);fpsFrames=0;fpsTick=t}requestAnimationFrame(fpsLoop)}requestAnimationFrame(fpsLoop);
const observed=['futlive:matchphase','futlive:matchfinished','futlive:pausechange','futlive:foul','futlive:referee-ball-contact','futlive:outofplay','futlive:goal','futlive:setpiece','futlive:technical-action'];for(const type of observed)window.addEventListener(type,e=>mark(type.replace('futlive:',''),e.detail||{}));
window.addEventListener('futlive:matchrestart',e=>{reset('match-restart');mark('matchrestart',e.detail||{});const s=document.getElementById('matchDiagnosticStatus');if(s)s.textContent='Nova partida · diagnóstico anterior apagado'});
window.addEventListener('pagehide',()=>{clearExport();samples=[];events=[]});
function boot(){const btn=document.getElementById('generateMatchDiagnostic');if(!btn){setTimeout(boot,100);return}if(btn.dataset.bound)return;btn.dataset.bound='1';btn.addEventListener('click',exportDiagnostic);reset('page-load');setInterval(sample,250)}boot();
window.FutLiveMatchDiagnostics={sample,mark,build,exportDiagnostic,reset,get sessionId(){return sessionId},get sampleCount(){return samples.length},get eventCount(){return events.length},get lastExport(){return lastExport}};
})();