(()=>{'use strict';
class FutLivePlayerSprite{
  constructor({element,base='./assets/players/team-1',frameCount=32,fps=8,team='1'}={}){
    this.el=typeof element==='string'?document.querySelector(element):element;
    this.base=base.replace(/\/$/,'');this.frameCount=frameCount;this.fps=fps;this.team=team;
    this.frames=Array.from({length:frameCount},(_,i)=>`${this.base}/frame_${String(i+1).padStart(3,'0')}.png`);
    this.animations={idle:[1,2,3,4],down:[5,6,7,8],right:[9,10,11,12,13,14,15,16],up:[17,18,19,20,21,22,23,24],left:[25,26,27,28],kick:[29,30],slide:[31,32]};
    this.aliases={front:'down',back:'up',run_down:'down',run_right:'right',run_up:'up',run_left:'left',shoot:'kick',tackle:'slide'};
    this.state='idle';this.index=0;this.timer=null;this.img=null;this.returnTimer=null;
    this.directionTimer=null;this.pendingDirection=null;this.directionDebounceMs=120;
    this.mount();this.preload();
  }
  src(frame){return this.frames[Math.max(1,Math.min(this.frameCount,frame))-1]}
  sequence(name=this.state){name=this.aliases[name]||name;return this.animations[name]||this.animations.idle}
  mount(){if(!this.el)return;this.el.classList.add('sprite-player');this.el.innerHTML='';const img=document.createElement('img');img.className='player-sprite-img';img.alt='Jogador Time '+this.team;img.draggable=false;this.el.appendChild(img);this.img=img;this.show(0)}
  preload(){this.frames.forEach(src=>{const i=new Image();i.src=src})}
  show(i=0){const seq=this.sequence();this.index=((i%seq.length)+seq.length)%seq.length;if(this.img)this.img.src=this.src(seq[this.index]);if(this.el)this.el.dataset.anim=this.state}
  setState(name='idle',{restart=true}={}){name=this.aliases[name]||name;if(!this.animations[name])name='idle';if(this.state===name&&!restart)return false;this.state=name;this.index=0;this.show(0);return true}
  play(name=this.state,fps=this.fps,{restart=false}={}){
    if(typeof name==='number'){const legacy=['idle','down','right','up','left','kick','slide'];name=legacy[name]||'idle'}
    name=this.aliases[name]||name;if(!this.animations[name])name='idle';
    if(this.state===name&&this.timer&&!restart)return this;
    this.stop(false);this.setState(name,{restart:true});
    this.timer=setInterval(()=>this.show(this.index+1),1000/Math.max(1,fps));return this
  }
  stop(goIdle=false){if(this.timer){clearInterval(this.timer);this.timer=null}if(goIdle){this.setState('idle');this.show(0)}return this}
  cancelPendingDirection(){if(this.directionTimer){clearTimeout(this.directionTimer);this.directionTimer=null}this.pendingDirection=null}
  move(direction='down'){
    direction=this.aliases[direction]||direction;if(!['up','down','left','right'].includes(direction))direction='down';
    if(this.state===direction&&this.timer){this.cancelPendingDirection();return this}
    if(this.pendingDirection===direction)return this;
    this.cancelPendingDirection();this.pendingDirection=direction;
    const delay=this.state==='idle'||this.state==='kick'||this.state==='slide'?55:this.directionDebounceMs;
    this.directionTimer=setTimeout(()=>{const next=this.pendingDirection;this.directionTimer=null;this.pendingDirection=null;if(next)this.play(next,this.fps)},delay);
    return this
  }
  idle(){
    if(this.state==='idle'&&this.timer){this.cancelPendingDirection();return this}
    this.cancelPendingDirection();
    this.directionTimer=setTimeout(()=>{this.directionTimer=null;if(this.state!=='idle'||!this.timer)this.play('idle',5)},140);
    return this
  }
  resume(){if(!this.timer)this.play(this.state,this.state==='idle'?5:this.fps);return this}
  once(name,{fps=10,returnTo='idle'}={}){this.cancelPendingDirection();clearTimeout(this.returnTimer);this.stop(false);this.setState(name);const seq=this.sequence(),step=1000/Math.max(1,fps);let pos=0;this.show(0);this.timer=setInterval(()=>{pos++;if(pos>=seq.length){this.stop(false);if(returnTo)this.play(returnTo,returnTo==='idle'?5:this.fps);return}this.show(pos)},step);return this}
  kick(){return this.once('kick',{fps:12,returnTo:'idle'})}
  slide(){return this.once('slide',{fps:9,returnTo:'idle'})}
  getState(){return{team:this.team,state:this.state,frame:this.sequence()[this.index],frames:[...this.sequence()],playing:!!this.timer,pendingDirection:this.pendingDirection}}
  destroy(){this.cancelPendingDirection();clearTimeout(this.returnTimer);this.stop(false);if(this.el){this.el.innerHTML='';this.el.classList.remove('sprite-player')}}
}
window.FutLivePlayerSprite=FutLivePlayerSprite;
})();