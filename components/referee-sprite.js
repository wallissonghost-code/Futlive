(()=>{'use strict';
const CFG=Object.freeze({
  base:'./assets/referee',
  // BETA 0.46: tamanho aparente normalizado pelos pixels NÃO transparentes dos 28 frames de movimento.
  targetVisibleHeight:{desktop:69.5,mobile:68.3},
  mobileMaxWidth:390,
  // Layout legado mantido EXCLUSIVAMENTE como fallback para os 4 frames de cartão (29–32), não auditados nesta etapa.
  cardFallback:{desktop:{width:46,height:52,scale:1.35,offsetX:-16,offsetY:-23,anchorY:.86},mobile:{width:44,height:50,scale:1.38,offsetX:-15,offsetY:-22,anchorY:.86}},
  idleSpeed:9,
  minWalkFps:4.6,
  maxWalkFps:8.8,
  maxReferenceSpeed:92,
  axisHysteresis:1.30,
  minDirectionHoldMs:320,
  inversionRatio:1.45,
  inversionMinSpeed:42,
  vectorSmoothingMs:190,
  motionDeadZone:.12,
  cardStepMs:260,
  cardHoldMs:620,
  hitbox:{offsetX:0,offsetY:-10,rx:7,ry:11},
  avoidance:{radius:27,bodyRadius:9,maxLateral:7.5}
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
// Metadados calculados diretamente do alpha dos 28 PNGs enviados: canvas + bounding box não transparente.
const FRAME_META=Object.freeze({
  'idle_down_01.png':{w:193,h:219,x0:1,y0:10,x1:191,y1:219},
  'idle_down_02.png':{w:193,h:219,x0:2,y0:10,x1:193,y1:219},
  'idle_down_03.png':{w:193,h:219,x0:0,y0:10,x1:178,y1:219},
  'idle_down_04.png':{w:194,h:219,x0:4,y0:10,x1:193,y1:219},
  'walk_down_01.png':{w:193,h:219,x0:1,y0:10,x1:172,y1:219},
  'walk_down_02.png':{w:193,h:219,x0:47,y0:10,x1:192,y1:218},
  'walk_down_03.png':{w:194,h:219,x0:21,y0:11,x1:194,y1:219},
  'walk_down_04.png':{w:192,h:219,x0:0,y0:12,x1:167,y1:219},
  'walk_right_01.png':{w:193,h:237,x0:16,y0:0,x1:193,y1:237},
  'walk_right_02.png':{w:193,h:237,x0:0,y0:0,x1:187,y1:237},
  'walk_right_03.png':{w:193,h:237,x0:2,y0:0,x1:193,y1:237},
  'walk_right_04.png':{w:194,h:237,x0:0,y0:0,x1:193,y1:237},
  'walk_right_05.png':{w:193,h:237,x0:1,y0:0,x1:178,y1:237},
  'walk_right_06.png':{w:193,h:237,x0:5,y0:1,x1:188,y1:237},
  'walk_right_07.png':{w:194,h:237,x0:1,y0:0,x1:194,y1:237},
  'walk_right_08.png':{w:192,h:237,x0:0,y0:0,x1:171,y1:234},
  'walk_up_01.png':{w:193,h:238,x0:33,y0:0,x1:179,y1:238},
  'walk_up_02.png':{w:193,h:238,x0:6,y0:0,x1:187,y1:238},
  'walk_up_03.png':{w:193,h:238,x0:15,y0:0,x1:193,y1:238},
  'walk_up_04.png':{w:194,h:238,x0:0,y0:0,x1:180,y1:238},
  'walk_up_05.png':{w:193,h:238,x0:25,y0:0,x1:193,y1:236},
  'walk_up_06.png':{w:193,h:238,x0:0,y0:0,x1:192,y1:238},
  'walk_up_07.png':{w:194,h:238,x0:35,y0:0,x1:182,y1:237},
  'walk_up_08.png':{w:192,h:238,x0:32,y0:4,x1:175,y1:236},
  'walk_left_01.png':{w:193,h:333,x0:26,y0:0,x1:193,y1:241},
  'walk_left_02.png':{w:193,h:333,x0:0,y0:0,x1:169,y1:239},
  'walk_left_03.png':{w:193,h:333,x0:32,y0:0,x1:193,y1:314},
  'walk_left_04.png':{w:194,h:333,x0:0,y0:0,x1:194,y1:309}
});
const url=name=>`${CFG.base}/${name}`;
class FutLiveRefereeSprite{
  constructor(el){
    this.el=el;this.img=document.createElement('img');this.img.className='referee-sprite-img';this.img.alt='Árbitro';this.img.draggable=false;this.el.innerHTML='';this.el.appendChild(this.img);
    this.direction='down';this.pendingDirection=null;this.pendingSince=0;this.lastDirectionAt=performance.now();
    this.anim='idle_down';this.index=0;this.lastFrameAt=0;this.moving=false;this.lastMotionAt=performance.now();this.smoothDX=0;this.smoothDY=0;
    this.cardBusy=false;this.cardAnim=null;this.cardStartedAt=0;this.available=new Map();
    this.installStyle();this.preload();this.showIdle('down');
  }
  installStyle(){
    if(document.getElementById('refereeSpriteStyle'))return;
    const s=document.createElement('style');s.id='refereeSpriteStyle';
    // A coordenada .referee-agent agora É o ponto lógico dos pés. O PNG é posicionado ao redor dela frame a frame.
    s.textContent=`.referee-agent{position:absolute;z-index:5;width:0;height:0;pointer-events:none;overflow:visible}.referee-sprite-img{position:absolute;display:block;max-width:none;max-height:none;object-fit:fill;transform:none;transform-origin:0 0;filter:drop-shadow(0 3px 4px #0008);pointer-events:none;will-change:left,top,width,height}`;
    document.head.appendChild(s)
  }
  preload(){for(const [anim,files] of Object.entries(MAP))for(const f of files){const src=url(f),i=new Image();i.onload=()=>this.available.set(src,true);i.onerror=()=>{this.available.set(src,false);console.warn('[Futlive][RefereeSprite] frame ausente:',src,'animação:',anim)};i.src=src}}
  files(anim){return MAP[anim]||[]}
  safeFiles(anim){const a=this.files(anim),ok=a.filter(f=>this.available.get(url(f))!==false);if(ok.length)return ok;const fallback=this.files('idle_down').filter(f=>this.available.get(url(f))!==false);console.warn('[Futlive][RefereeSprite] animação indisponível:',anim,'→ fallback idle');return fallback.length?fallback:['idle_down_01.png']}
  isMobile(){return window.matchMedia(`(max-width:${CFG.mobileMaxWidth}px)`).matches}
  targetHeight(){return this.isMobile()?CFG.targetVisibleHeight.mobile:CFG.targetVisibleHeight.desktop}
  applyNormalizedLayout(file){
    const m=FRAME_META[file];if(!m)return false;
    const visibleH=Math.max(1,m.y1-m.y0),s=this.targetHeight()/visibleH;
    const centerX=(m.x0+m.x1)/2,footY=m.y1;
    // Escala uniforme baseada na altura VISÍVEL; centro corporal e pés ficam ancorados no mesmo ponto lógico.
    this.img.style.width=(m.w*s).toFixed(3)+'px';
    this.img.style.height=(m.h*s).toFixed(3)+'px';
    this.img.style.left=(-centerX*s).toFixed(3)+'px';
    this.img.style.top=(-footY*s).toFixed(3)+'px';
    this.img.style.transform='none';
    this.img.style.transformOrigin='0 0';
    this.el.dataset.normalized='1';
    this.el.dataset.visibleHeight=String(this.targetHeight());
    return true
  }
  applyCardFallback(){
    const c=this.isMobile()?CFG.cardFallback.mobile:CFG.cardFallback.desktop;
    this.img.style.width=c.width+'px';this.img.style.height=c.height+'px';
    this.img.style.left=c.offsetX+'px';this.img.style.top=c.offsetY+'px';
    this.img.style.transform=`scale(${c.scale})`;this.img.style.transformOrigin=`50% ${c.anchorY*100}%`;
    this.el.dataset.normalized='0'
  }
  show(anim,index=0){
    const files=this.safeFiles(anim);this.anim=anim;this.index=((index%files.length)+files.length)%files.length;
    const file=files[this.index],src=url(file);
    if(!this.applyNormalizedLayout(file))this.applyCardFallback();
    if(!this.img.src.endsWith(file)){this.img.onerror=()=>{console.warn('[Futlive][RefereeSprite] falha ao renderizar:',src);if(!this.img.src.endsWith('idle_down_01.png'))this.img.src=url('idle_down_01.png')};this.img.src=src}
    this.el.dataset.anim=anim;this.el.dataset.direction=this.direction;this.el.dataset.frame=file
  }
  walkAnim(dir){return `walk_${dir}`}
  idleFrame(dir){if(dir==='down'&&this.files('idle_down').length)return{anim:'idle_down',index:0};return{anim:this.walkAnim(dir),index:0}}
  showIdle(dir=this.direction){this.moving=false;this.direction=dir||this.direction;this.pendingDirection=null;const f=this.idleFrame(this.direction);this.show(f.anim,f.index);this.lastFrameAt=performance.now()}
  smoothVector(dx,dy,t){const dt=Math.max(1,Math.min(50,t-this.lastMotionAt));this.lastMotionAt=t;const alpha=1-Math.exp(-dt/CFG.vectorSmoothingMs);this.smoothDX+=(dx-this.smoothDX)*alpha;this.smoothDY+=(dy-this.smoothDY)*alpha;return[this.smoothDX,this.smoothDY]}
  chooseDirection(rawDX,rawDY,speed,t){
    const [dx,dy]=this.smoothVector(rawDX,rawDY,t),ax=Math.abs(dx),ay=Math.abs(dy);if(Math.hypot(dx,dy)<CFG.motionDeadZone)return this.direction;
    const currentHorizontal=this.direction==='left'||this.direction==='right';
    if(currentHorizontal&&Math.sign(rawDX)!==0&&((this.direction==='right'&&rawDX<0)||(this.direction==='left'&&rawDX>0))&&Math.abs(rawDX)>Math.abs(rawDY)*CFG.inversionRatio&&speed>=CFG.inversionMinSpeed){this.direction=rawDX>0?'right':'left';this.lastDirectionAt=t;this.pendingDirection=null;return this.direction}
    if(!currentHorizontal&&Math.sign(rawDY)!==0&&((this.direction==='down'&&rawDY<0)||(this.direction==='up'&&rawDY>0))&&Math.abs(rawDY)>Math.abs(rawDX)*CFG.inversionRatio&&speed>=CFG.inversionMinSpeed){this.direction=rawDY>0?'down':'up';this.lastDirectionAt=t;this.pendingDirection=null;return this.direction}
    let next=this.direction;
    if(currentHorizontal){if(ay>ax*CFG.axisHysteresis)next=dy>=0?'down':'up';else if(ax>=ay)next=dx>=0?'right':'left'}
    else{if(ax>ay*CFG.axisHysteresis)next=dx>=0?'right':'left';else if(ay>=ax)next=dy>=0?'down':'up'}
    if(next===this.direction){this.pendingDirection=null;return this.direction}
    if(t-this.lastDirectionAt<CFG.minDirectionHoldMs)return this.direction;
    if(this.pendingDirection!==next){this.pendingDirection=next;this.pendingSince=t;return this.direction}
    if(t-this.pendingSince>=CFG.minDirectionHoldMs){this.direction=next;this.lastDirectionAt=t;this.pendingDirection=null}
    return this.direction
  }
  fpsForSpeed(speed){const p=Math.max(0,Math.min(1,(speed-CFG.idleSpeed)/(CFG.maxReferenceSpeed-CFG.idleSpeed)));return CFG.minWalkFps+(CFG.maxWalkFps-CFG.minWalkFps)*p}
  updateMotion(dx,dy,speed,t=performance.now()){
    if(this.cardBusy){this.updateCard(t);return}
    const rawMag=Math.hypot(dx,dy);if(speed<=CFG.idleSpeed||rawMag<.035){this.smoothDX*=.88;this.smoothDY*=.88;if(this.moving)this.showIdle(this.direction);return}
    const dir=this.chooseDirection(dx,dy,speed,t),anim=this.walkAnim(dir),files=this.safeFiles(anim),fps=this.fpsForSpeed(speed);
    if(!this.moving||this.anim!==anim){this.moving=true;this.show(anim,0);this.lastFrameAt=t;return}
    const frameMs=1000/fps;if(t-this.lastFrameAt>=frameMs){const steps=Math.max(1,Math.floor((t-this.lastFrameAt)/frameMs));this.show(anim,(this.index+steps)%files.length);this.lastFrameAt+=steps*frameMs}
  }
  playCard(kind){this.cardAnim=kind==='red'?'card_red':'card_yellow';this.cardBusy=true;this.moving=false;this.pendingDirection=null;this.cardStartedAt=performance.now();this.show(this.cardAnim,0)}
  updateCard(t){if(!this.cardBusy)return;const files=this.safeFiles(this.cardAnim),elapsed=t-this.cardStartedAt;if(files.length>1&&elapsed>=CFG.cardStepMs&&this.index!==files.length-1)this.show(this.cardAnim,files.length-1);if(elapsed>=CFG.cardStepMs+CFG.cardHoldMs){this.cardBusy=false;this.cardAnim=null;this.smoothDX=this.smoothDY=0;this.lastMotionAt=t;this.showIdle(this.direction)}}
  getBallHitbox(x,y){return{x:x+CFG.hitbox.offsetX,y:y+CFG.hitbox.offsetY,rx:CFG.hitbox.rx,ry:CFG.hitbox.ry}}
  getAvoidanceConfig(){return CFG.avoidance}
  getFrameMeta(file){return FRAME_META[file]||null}
  destroy(){this.cardBusy=false;this.el.innerHTML=''}
}
window.FutLiveRefereeSprite=FutLiveRefereeSprite;window.FutLiveRefereeSpriteConfig={CFG,MAP,FRAME_META};
})();