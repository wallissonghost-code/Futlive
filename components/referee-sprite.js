(()=>{'use strict';
const CFG=Object.freeze({
  base:'./assets/referee',
  // Mesmo render real usado pelos players no game.css.
  desktop:{width:70,height:79,scale:1.85,offsetX:-24,offsetY:-35,footAnchor:{x:.50,y:.82}},
  mobile:{width:66,height:75,scale:1.90,offsetX:-22,offsetY:-33,footAnchor:{x:.50,y:.82}},
  mobileMaxWidth:390,
  idleSpeed:7,
  minWalkFps:4.8,
  maxWalkFps:9.2,
  maxReferenceSpeed:92,
  axisHysteresis:1.08,
  directionHoldMs:42,
  cardStepMs:260,
  cardHoldMs:620,
  hitbox:{offsetX:0,offsetY:-18,rx:12,ry:19}
});
const MAP=Object.freeze({
  idle_down:['idle_down_01.png','idle_down_02.png','idle_down_03.png','idle_down_04.png'],
  walk_down:['walk_down_01.png','walk_down_02.png','walk_down_03.png','walk_down_04.png'],
  walk_right:['walk_right_01.png','walk_right_02.png','walk_right_03.png','walk_right_04.png','walk_right_05.png','walk_right_06.png','walk_right_07.png','walk_right_08.png'],
  walk_up:['walk_up_01.png','walk_up_02.png','walk_up_03.png','walk_up_04.png','walk_up_05.png','walk_up_06.png','walk_up_07.png','walk_up_08.png'],
  walk_left:['walk_left_01.png','walk_left_02.png','walk_left_03.png','walk_left_04.png'],
  card_yellow:['card_yellow_01.png','card_yellow_02.png'],
  card_red:['card_red_01.png','card_red_02.png']
});
const url=name=>`${CFG.base}/${name}`;
class FutLiveRefereeSprite{
  constructor(el){
    this.el=el;this.img=document.createElement('img');this.img.className='referee-sprite-img';this.img.alt='Árbitro';this.img.draggable=false;this.el.innerHTML='';this.el.appendChild(this.img);
    this.direction='down';this.pendingDirection=null;this.pendingSince=0;this.anim='idle_down';this.index=0;this.lastFrameAt=0;this.moving=false;
    this.cardBusy=false;this.cardAnim=null;this.cardStartedAt=0;this.cardFinishedAt=0;this.available=new Map();
    this.installStyle();this.preload();this.showIdle('down');
  }
  installStyle(){
    if(document.getElementById('refereeSpriteStyle'))return;
    const d=CFG.desktop,m=CFG.mobile,s=document.createElement('style');s.id='refereeSpriteStyle';
    s.textContent=`.referee-agent{position:absolute;z-index:5;width:${d.width}px;height:${d.height}px;transform:translate(${d.offsetX}px,${d.offsetY}px);pointer-events:none;overflow:visible}.referee-sprite-img{display:block;width:100%;height:100%;object-fit:contain;object-position:50% 100%;transform:scale(${d.scale});transform-origin:${d.footAnchor.x*100}% ${d.footAnchor.y*100}%;filter:drop-shadow(0 4px 5px #0008);pointer-events:none}@media(max-width:${CFG.mobileMaxWidth}px){.referee-agent{width:${m.width}px;height:${m.height}px;transform:translate(${m.offsetX}px,${m.offsetY}px)}.referee-sprite-img{transform:scale(${m.scale});transform-origin:${m.footAnchor.x*100}% ${m.footAnchor.y*100}%}}`;
    document.head.appendChild(s)
  }
  preload(){for(const [anim,files] of Object.entries(MAP))for(const f of files){const src=url(f),i=new Image();i.onload=()=>this.available.set(src,true);i.onerror=()=>{this.available.set(src,false);console.warn('[Futlive][RefereeSprite] frame ausente:',src,'animação:',anim)};i.src=src}}
  files(anim){return MAP[anim]||[]}
  safeFiles(anim){const a=this.files(anim),ok=a.filter(f=>this.available.get(url(f))!==false);if(ok.length)return ok;const fallback=this.files('idle_down').filter(f=>this.available.get(url(f))!==false);console.warn('[Futlive][RefereeSprite] animação indisponível:',anim,'→ fallback idle');return fallback.length?fallback:['idle_down_01.png']}
  show(anim,index=0){const files=this.safeFiles(anim);this.anim=anim;this.index=((index%files.length)+files.length)%files.length;const file=files[this.index],src=url(file);if(!this.img.src.endsWith(file)){this.img.onerror=()=>{console.warn('[Futlive][RefereeSprite] falha ao renderizar:',src);if(!this.img.src.endsWith('idle_down_01.png'))this.img.src=url('idle_down_01.png')};this.img.src=src}this.el.dataset.anim=anim;this.el.dataset.direction=this.direction}
  walkAnim(dir){return `walk_${dir}`}
  idleFrame(dir){if(dir==='down'&&this.files('idle_down').length)return{anim:'idle_down',index:0};return{anim:this.walkAnim(dir),index:0}}
  showIdle(dir=this.direction){this.moving=false;this.direction=dir||this.direction;const f=this.idleFrame(this.direction);this.show(f.anim,f.index);this.lastFrameAt=performance.now()}
  chooseDirection(dx,dy,t){
    const ax=Math.abs(dx),ay=Math.abs(dy);if(ax<.01&&ay<.01)return this.direction;
    const currentHorizontal=this.direction==='left'||this.direction==='right';let axis;
    if(currentHorizontal)axis=ay>ax*CFG.axisHysteresis?'vertical':'horizontal';else axis=ax>ay*CFG.axisHysteresis?'horizontal':'vertical';
    const next=axis==='horizontal'?(dx>=0?'right':'left'):(dy>=0?'down':'up');
    if(next===this.direction){this.pendingDirection=null;return this.direction}
    const sameAxis=(currentHorizontal&&(next==='left'||next==='right'))||(!currentHorizontal&&(next==='up'||next==='down'));
    if(sameAxis){this.direction=next;this.pendingDirection=null;return next}
    if(this.pendingDirection!==next){this.pendingDirection=next;this.pendingSince=t;return this.direction}
    if(t-this.pendingSince>=CFG.directionHoldMs){this.direction=next;this.pendingDirection=null}
    return this.direction
  }
  fpsForSpeed(speed){const p=Math.max(0,Math.min(1,(speed-CFG.idleSpeed)/(CFG.maxReferenceSpeed-CFG.idleSpeed)));return CFG.minWalkFps+(CFG.maxWalkFps-CFG.minWalkFps)*p}
  updateMotion(dx,dy,speed,t=performance.now()){
    if(this.cardBusy){this.updateCard(t);return}
    const mag=Math.hypot(dx,dy);if(speed<=CFG.idleSpeed||mag<.08){if(this.moving)this.showIdle(this.direction);return}
    const dir=this.chooseDirection(dx,dy,t),anim=this.walkAnim(dir),files=this.safeFiles(anim),fps=this.fpsForSpeed(speed);
    if(!this.moving||this.anim!==anim){this.moving=true;this.show(anim,0);this.lastFrameAt=t;return}
    const frameMs=1000/fps;if(t-this.lastFrameAt>=frameMs){const steps=Math.max(1,Math.floor((t-this.lastFrameAt)/frameMs));this.show(anim,(this.index+steps)%files.length);this.lastFrameAt+=steps*frameMs}
  }
  playCard(kind){this.cardAnim=kind==='red'?'card_red':'card_yellow';this.cardBusy=true;this.moving=false;this.cardStartedAt=performance.now();this.cardFinishedAt=0;this.show(this.cardAnim,0)}
  updateCard(t){if(!this.cardBusy)return;const files=this.safeFiles(this.cardAnim),elapsed=t-this.cardStartedAt;if(files.length>1&&elapsed>=CFG.cardStepMs&&this.index!==files.length-1)this.show(this.cardAnim,files.length-1);const endAt=CFG.cardStepMs+CFG.cardHoldMs;if(elapsed>=endAt){this.cardBusy=false;this.cardAnim=null;this.cardFinishedAt=t;this.showIdle(this.direction)}}
  getBallHitbox(x,y){return{x:x+CFG.hitbox.offsetX,y:y+CFG.hitbox.offsetY,rx:CFG.hitbox.rx,ry:CFG.hitbox.ry}}
  destroy(){this.cardBusy=false;this.el.innerHTML=''}
}
window.FutLiveRefereeSprite=FutLiveRefereeSprite;window.FutLiveRefereeSpriteConfig={CFG,MAP};
})();