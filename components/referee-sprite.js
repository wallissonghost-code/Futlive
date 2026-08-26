(()=>{'use strict';
const CFG=Object.freeze({base:'./assets/referee',width:70,height:79,scale:1.85,offsetX:-24,offsetY:-35,footAnchor:{x:0.50,y:0.82},moveFps:8,idleFps:5,directionDebounceMs:110,cardHoldMs:620});
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
    this.direction='down';this.pendingDirection=null;this.directionSince=0;this.anim='idle_down';this.index=0;this.timer=null;this.cardTimer=null;this.cardBusy=false;this.available=new Map();
    this.installStyle();this.preload();this.playIdle('down');
  }
  installStyle(){if(document.getElementById('refereeSpriteStyle'))return;const s=document.createElement('style');s.id='refereeSpriteStyle';s.textContent=`.referee-agent{position:absolute;z-index:5;width:${CFG.width}px;height:${CFG.height}px;transform:translate(${CFG.offsetX}px,${CFG.offsetY}px);pointer-events:none;overflow:visible}.referee-sprite-img{display:block;width:100%;height:100%;object-fit:contain;object-position:50% 100%;transform:scale(${CFG.scale});transform-origin:${CFG.footAnchor.x*100}% ${CFG.footAnchor.y*100}%;filter:drop-shadow(0 4px 5px #0008);pointer-events:none}`;document.head.appendChild(s)}
  preload(){for(const [anim,files] of Object.entries(MAP))for(const f of files){const src=url(f),i=new Image();i.onload=()=>this.available.set(src,true);i.onerror=()=>{this.available.set(src,false);console.warn('[Futlive][RefereeSprite] frame ausente:',src,'animação:',anim)};i.src=src}}
  files(anim){return MAP[anim]||[]}
  safeFiles(anim){const a=this.files(anim),ok=a.filter(f=>this.available.get(url(f))!==false);if(ok.length)return ok;const fallback=this.files('idle_down').filter(f=>this.available.get(url(f))!==false);if(!ok.length)console.warn('[Futlive][RefereeSprite] animação indisponível:',anim,'→ fallback idle');return fallback.length?fallback:['idle_down_01.png']}
  show(anim,index=0){const files=this.safeFiles(anim);this.anim=anim;this.index=((index%files.length)+files.length)%files.length;const src=url(files[this.index]);if(this.img.src.endsWith(files[this.index]))return;this.img.onerror=()=>{console.warn('[Futlive][RefereeSprite] falha ao renderizar:',src);const fb=url('idle_down_01.png');if(!this.img.src.endsWith('idle_down_01.png'))this.img.src=fb};this.img.src=src;this.el.dataset.anim=anim;this.el.dataset.direction=this.direction}
  stop(){if(this.timer){clearInterval(this.timer);this.timer=null}}
  playLoop(anim,fps){if(this.cardBusy)return;if(this.anim===anim&&this.timer)return;this.stop();let i=0;this.show(anim,i);const files=this.safeFiles(anim);if(files.length<2)return;this.timer=setInterval(()=>{i=(i+1)%files.length;this.show(anim,i)},1000/Math.max(1,fps))}
  dirAnim(dir){return `walk_${dir}`}
  idleAnim(dir){return dir==='down'&&this.files('idle_down').length?'idle_down':this.dirAnim(dir)}
  setDirection(dir){if(!['up','down','left','right'].includes(dir))return;if(dir===this.direction){this.pendingDirection=null;return}const now=performance.now();if(this.pendingDirection!==dir){this.pendingDirection=dir;this.directionSince=now;return}if(now-this.directionSince>=CFG.directionDebounceMs){this.direction=dir;this.pendingDirection=null}}
  setMotion(dx,dy,speed=0){if(this.cardBusy)return;const moving=speed>4||Math.hypot(dx,dy)>2.5;if(moving){let dir;if(Math.abs(dx)>Math.abs(dy)*1.12)dir=dx>0?'right':'left';else if(Math.abs(dy)>Math.abs(dx)*1.12)dir=dy>0?'down':'up';else dir=this.direction;this.setDirection(dir);this.playLoop(this.dirAnim(this.direction),CFG.moveFps)}else this.playIdle(this.direction)}
  playIdle(dir=this.direction){if(this.cardBusy)return;this.stop();this.direction=dir||this.direction;const anim=this.idleAnim(this.direction);if(anim==='idle_down')this.playLoop(anim,CFG.idleFps);else this.show(anim,0)}
  playCard(kind){const anim=kind==='red'?'card_red':'card_yellow',files=this.safeFiles(anim);clearTimeout(this.cardTimer);this.cardBusy=true;this.stop();let i=0;this.show(anim,0);const step=files.length>1?260:0;const advance=()=>{if(files.length>1){i=Math.min(files.length-1,i+1);this.show(anim,i)}this.cardTimer=setTimeout(()=>{this.cardBusy=false;this.playIdle(this.direction)},CFG.cardHoldMs)};if(step)this.cardTimer=setTimeout(advance,step);else advance()}
  destroy(){clearTimeout(this.cardTimer);this.stop();this.el.innerHTML=''}
}
window.FutLiveRefereeSprite=FutLiveRefereeSprite;window.FutLiveRefereeSpriteConfig={CFG,MAP};
})();