(()=>{'use strict';
const CFG=Object.freeze({
  movementBase:'./assets',
  cardBase:'./assets/referee',
  display:{desktop:{width:36,height:42,left:-18,top:-39},mobile:{width:35,height:41,left:-17.5,top:-38},mobileMaxWidth:390},
  idleSpeed:2.5,
  walkFps:{min:8,normal:9,max:10,normalSpeed:58,maxSpeed:92},
  axisHysteresis:1.68,
  minDirectionHoldMs:680,
  directionConfirmMs:360,
  vectorSmoothingMs:280,
  motionDeadZone:.18,
  cardStepMs:260,
  cardHoldMs:620,
  cardFallback:{desktop:{width:46,height:52,scale:1.35,offsetX:-16,offsetY:-23,anchorY:.86},mobile:{width:44,height:50,scale:1.38,offsetX:-15,offsetY:-22,anchorY:.86}},
  hitbox:{offsetX:0,offsetY:-10,rx:7,ry:11},
  avoidance:{radius:27,bodyRadius:9,maxLateral:7.5}
});
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const MOVE=Object.freeze({walk_down:range(1,8),walk_right:range(9,16),walk_up:range(17,24),walk_left:range(25,32)});
const CARD=Object.freeze({card_yellow:['card_yellow_01.png','card_yellow_02.png'],card_red:['card_red_01.png','card_red_02.png']});
const moveUrl=n=>`${CFG.movementBase}/frame_${String(n).padStart(3,'0')}.png`;
const cardUrl=name=>`${CFG.cardBase}/${name}`;
class FutLiveRefereeSprite{
constructor(el){this.el=el;this.moveImg=document.createElement('img');this.moveImg.className='referee-movement-img';this.moveImg.alt='Árbitro';this.moveImg.draggable=false;this.cardImg=document.createElement('img');this.cardImg.className='referee-card-sprite';this.cardImg.alt='Árbitro';this.cardImg.draggable=false;this.label=document.createElement('span');this.label.className='referee-label';this.label.textContent='Juiz';this.el.innerHTML='';this.el.appendChild(this.moveImg);this.el.appendChild(this.cardImg);this.el.appendChild(this.label);this.direction='down';this.pendingDirection=null;this.pendingSince=0;this.lastDirectionAt=performance.now();this.anim='walk_down';this.index=0;this.moving=false;this.lastMotionAt=performance.now();this.smoothDX=0;this.smoothDY=0;this.walkPhase=0;this.lastAnimAt=performance.now();this.cardBusy=false;this.cardAnim=null;this.cardStartedAt=0;this.cardIndex=0;this.available=new Map();this.installStyle();this.preload();this.layoutMovement();this.showIdle('down');window.addEventListener('resize',()=>this.layoutMovement(),{passive:true})}
installStyle(){if(document.getElementById('refereeSpriteStyle'))return;const s=document.createElement('style');s.id='refereeSpriteStyle';s.textContent=`.referee-agent{position:absolute;z-index:5;width:0;height:0;pointer-events:none;overflow:visible}.referee-movement-img,.referee-card-sprite{position:absolute;display:block;object-fit:contain;object-position:50% 100%;filter:none;pointer-events:none}.referee-card-sprite{display:none}.referee-label{position:absolute;left:50%;top:-47px;transform:translateX(-50%);font:600 7px/1 system-ui,-apple-system,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 1px 2px #000,0 0 2px #000;opacity:.82;pointer-events:none}@media(max-width:390px){.referee-label{top:-46px;font-size:6.5px}}`;document.head.appendChild(s)}
preload(){for(let n=1;n<=32;n++){const src=moveUrl(n),i=new Image();i.onload=()=>this.available.set(src,true);i.onerror=()=>{this.available.set(src,false);console.warn('[Futlive][RefereeSprite] frame de movimento ausente:',src)};i.src=src}for(const[anim,files]of Object.entries(CARD))for(const f of files){const src=cardUrl(f),i=new Image();i.onload=()=>this.available.set(src,true);i.onerror=()=>{this.available.set(src,false);console.warn('[Futlive][RefereeSprite] frame de cartão ausente:',src,'animação:',anim)};i.src=src}}
isMobile(){return window.matchMedia(`(max-width:${CFG.display.mobileMaxWidth}px)`).matches}
layoutMovement(){const c=this.isMobile()?CFG.display.mobile:CFG.display.desktop;this.moveImg.style.width=c.width+'px';this.moveImg.style.height=c.height+'px';this.moveImg.style.left=c.left+'px';this.moveImg.style.top=c.top+'px'}
movementFrames(anim){return MOVE[anim]||MOVE.walk_down}walkAnim(dir){return`walk_${dir}`}
showMovement(anim,index=0){const frames=this.movementFrames(anim);this.anim=anim;this.index=((index%frames.length)+frames.length)%frames.length;const n=frames[this.index],src=moveUrl(n);this.cardImg.style.display='none';this.moveImg.style.display='block';if(!this.moveImg.src.endsWith(`frame_${String(n).padStart(3,'0')}.png`))this.moveImg.src=src;this.el.dataset.anim=anim;this.el.dataset.direction=this.direction;this.el.dataset.frame=String(n)}
showIdle(dir=this.direction){this.moving=false;this.direction=dir||this.direction;this.pendingDirection=null;this.showMovement(this.walkAnim(this.direction),0);this.lastAnimAt=performance.now()}
smoothVector(dx,dy,t){const dt=Math.max(1,Math.min(50,t-this.lastMotionAt));this.lastMotionAt=t;const alpha=1-Math.exp(-dt/CFG.vectorSmoothingMs);this.smoothDX+=(dx-this.smoothDX)*alpha;this.smoothDY+=(dy-this.smoothDY)*alpha;return[this.smoothDX,this.smoothDY]}
chooseDirection(rawDX,rawDY,speed,t){const[dx,dy]=this.smoothVector(rawDX,rawDY,t),ax=Math.abs(dx),ay=Math.abs(dy);if(Math.hypot(dx,dy)<CFG.motionDeadZone)return this.direction;const currentHorizontal=this.direction==='left'||this.direction==='right';let next=this.direction;if(currentHorizontal){if(ay>ax*CFG.axisHysteresis)next=dy>=0?'down':'up';else if(ax>ay*.82)next=dx>=0?'right':'left'}else{if(ax>ay*CFG.axisHysteresis)next=dx>=0?'right':'left';else if(ay>ax*.82)next=dy>=0?'down':'up'}if(next===this.direction){this.pendingDirection=null;return this.direction}if(t-this.lastDirectionAt<CFG.minDirectionHoldMs)return this.direction;if(this.pendingDirection!==next){this.pendingDirection=next;this.pendingSince=t;return this.direction}if(t-this.pendingSince<CFG.directionConfirmMs)return this.direction;this.direction=next;this.lastDirectionAt=t;this.pendingDirection=null;return this.direction}
fpsForSpeed(speed){const f=CFG.walkFps;if(speed<=f.normalSpeed){const p=Math.max(0,Math.min(1,(speed-CFG.idleSpeed)/(f.normalSpeed-CFG.idleSpeed)));return f.min+(f.normal-f.min)*p}const p=Math.max(0,Math.min(1,(speed-f.normalSpeed)/(f.maxSpeed-f.normalSpeed)));return f.normal+(f.max-f.normal)*p}
updateMotion(dx,dy,speed,t=performance.now()){if(this.cardBusy){this.updateCard(t);return}const rawMag=Math.hypot(dx,dy);if(speed<=CFG.idleSpeed||rawMag<.01){this.smoothDX*=.88;this.smoothDY*=.88;if(this.moving)this.showIdle(this.direction);this.lastAnimAt=t;return}const dir=this.chooseDirection(dx,dy,speed,t),anim=this.walkAnim(dir),frames=this.movementFrames(anim),fps=this.fpsForSpeed(speed);const elapsed=Math.max(0,Math.min(80,t-this.lastAnimAt));this.lastAnimAt=t;this.walkPhase+=elapsed*fps/1000;const nextIndex=Math.floor(this.walkPhase)%frames.length;this.moving=true;if(this.anim!==anim||this.index!==nextIndex)this.showMovement(anim,nextIndex)}
safeCardFiles(anim){const files=CARD[anim]||[],ok=files.filter(f=>this.available.get(cardUrl(f))!==false);if(ok.length)return ok;console.warn('[Futlive][RefereeSprite] animação de cartão indisponível:',anim);return[]}
applyCardLayout(){const c=this.isMobile()?CFG.cardFallback.mobile:CFG.cardFallback.desktop;this.cardImg.style.width=c.width+'px';this.cardImg.style.height=c.height+'px';this.cardImg.style.left=c.offsetX+'px';this.cardImg.style.top=c.offsetY+'px';this.cardImg.style.transform=`scale(${c.scale})`;this.cardImg.style.transformOrigin=`50% ${c.anchorY*100}%`}
showCard(index){const files=this.safeCardFiles(this.cardAnim);if(!files.length){this.cardBusy=false;this.showIdle(this.direction);return}this.cardIndex=Math.max(0,Math.min(files.length-1,index));this.applyCardLayout();this.moveImg.style.display='none';this.cardImg.style.display='block';const file=files[this.cardIndex],src=cardUrl(file);if(!this.cardImg.src.endsWith(file))this.cardImg.src=src;this.el.dataset.anim=this.cardAnim;this.el.dataset.frame=file}
playCard(kind){this.cardAnim=kind==='red'?'card_red':'card_yellow';this.cardBusy=true;this.moving=false;this.pendingDirection=null;this.cardStartedAt=performance.now();this.showCard(0)}
updateCard(t){if(!this.cardBusy)return;const files=this.safeCardFiles(this.cardAnim),elapsed=t-this.cardStartedAt;if(files.length>1&&elapsed>=CFG.cardStepMs&&this.cardIndex!==files.length-1)this.showCard(files.length-1);if(elapsed>=CFG.cardStepMs+CFG.cardHoldMs){this.cardBusy=false;this.cardAnim=null;this.smoothDX=this.smoothDY=0;this.lastMotionAt=t;this.lastAnimAt=t;this.showIdle(this.direction)}}
getBallHitbox(x,y){return{x:x+CFG.hitbox.offsetX,y:y+CFG.hitbox.offsetY,rx:CFG.hitbox.rx,ry:CFG.hitbox.ry}}getAvoidanceConfig(){return CFG.avoidance}destroy(){this.cardBusy=false;this.el.innerHTML=''}
}
window.FutLiveRefereeSprite=FutLiveRefereeSprite;window.FutLiveRefereeSpriteConfig={CFG,MOVE,CARD};
})();