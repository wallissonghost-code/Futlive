(()=>{'use strict';
const COMPONENT_VERSION='0.17';
class FutLivePlayerSprite{
  constructor({element,base='./assets/players/team-1',frameCount=32,fps=8,team='1'}={}){
    this.el=typeof element==='string'?document.querySelector(element):element;
    this.base=base.replace(/\/$/,'');this.frameCount=frameCount;this.fps=fps;this.team=team;
    this.frames=Array.from({length:frameCount},(_,i)=>`${this.base}/frame_${String(i+1).padStart(3,'0')}.png`);
    this.animations={idle:[1,2,3,4],down:[5,6,7,8],right:[9,10,11,12,13,14,15,16],up:[17,18,19,20,21,22,23,24],left:[25,26,27,28],kick:[29,30],slide:[31,32]};
    this.aliases={front:'down',back:'up',run_down:'down',run_right:'right',run_up:'up',run_left:'left',shoot:'kick',tackle:'slide'};
    this.state='idle';this.index=0;this.timer=null;this.img=null;this.returnTimer=null;
    this.mount();this.preload();this.syncVisibleVersion();
  }
  syncVisibleVersion(){const v=document.querySelector('.version');if(v)v.textContent='BETA '+COMPONENT_VERSION;try{const u=new URL(location.href);if(u.searchParams.get('v')!==COMPONENT_VERSION){u.searchParams.set('v',COMPONENT_VERSION);u.searchParams.set('cb',Date.now().toString());history.replaceState(null,'',u.toString())}}catch{}}
  src(frame){return this.frames[Math.max(1,Math.min(this.frameCount,frame))-1]}
  sequence(name=this.state){name=this.aliases[name]||name;return this.animations[name]||this.animations.idle}
  mount(){if(!this.el)return;this.el.classList.add('sprite-player');this.el.innerHTML='';const img=document.createElement('img');img.className='player-sprite-img';img.alt='Jogador Time '+this.team;img.draggable=false;this.el.appendChild(img);this.img=img;this.show(0)}
  preload(){this.frames.forEach(src=>{const i=new Image();i.src=src})}
  show(i=0){const seq=this.sequence();this.index=((i%seq.length)+seq.length)%seq.length;if(this.img)this.img.src=this.src(seq[this.index]);if(this.el)this.el.dataset.anim=this.state}
  setState(name='idle',{restart=true}={}){name=this.aliases[name]||name;if(!this.animations[name])name='idle';if(this.state===name&&!restart)return;this.state=name;this.index=0;this.show(0)}
  play(name=this.state,fps=this.fps){this.stop(false);if(typeof name==='number'){const legacy=['idle','down','right','up','left','kick','slide'];name=legacy[name]||'idle'}this.setState(name);this.timer=setInterval(()=>this.show(this.index+1),1000/Math.max(1,fps));return this}
  stop(goIdle=false){if(this.timer){clearInterval(this.timer);this.timer=null}if(goIdle){this.setState('idle');this.show(0)}return this}
  move(direction='down'){return this.play(direction,this.fps)}
  idle(){return this.play('idle',5)}
  once(name,{fps=10,returnTo='idle'}={}){clearTimeout(this.returnTimer);this.stop(false);this.setState(name);const seq=this.sequence(),step=1000/Math.max(1,fps);let pos=0;this.show(0);this.timer=setInterval(()=>{pos++;if(pos>=seq.length){this.stop(false);if(returnTo)this.play(returnTo,returnTo==='idle'?5:this.fps);return}this.show(pos)},step);return this}
  kick(){return this.once('kick',{fps:12,returnTo:'idle'})}
  slide(){return this.once('slide',{fps:9,returnTo:'idle'})}
  getState(){return{team:this.team,state:this.state,frame:this.sequence()[this.index],frames:[...this.sequence()]}}
  destroy(){clearTimeout(this.returnTimer);this.stop(false);if(this.el){this.el.innerHTML='';this.el.classList.remove('sprite-player')}}
}
function mountTeams(){
  window.FutLivePlayers=window.FutLivePlayers||{};
  const slots=[
    ['player1','.p1','1'],['player2','.p2','1'],['player3','.p3','1'],
    ['player4','.p4','2'],['player5','.p5','2'],['player6','.p6','2']
  ];
  for(const [key,selector,team] of slots){
    const el=document.querySelector(selector);if(!el||el.classList.contains('sprite-player'))continue;
    window.FutLivePlayers[key]=new FutLivePlayerSprite({element:el,base:`./assets/players/team-${team}`,frameCount:32,fps:8,team}).idle();
  }
}
window.FutLivePlayerSprite=FutLivePlayerSprite;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountTeams,{once:true});else setTimeout(mountTeams,0);
})();