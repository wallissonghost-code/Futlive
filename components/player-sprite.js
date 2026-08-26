(()=>{'use strict';
class FutLivePlayerSprite{
  constructor({element,base='./assets/players/team-1',frameCount=32,groupSize=4,fps=8}={}){
    this.el=typeof element==='string'?document.querySelector(element):element;
    this.base=base.replace(/\/$/,'');this.frameCount=frameCount;this.groupSize=groupSize;this.fps=fps;
    this.frames=Array.from({length:frameCount},(_,i)=>`${this.base}/frame_${String(i+1).padStart(3,'0')}.png`);
    this.groups=Array.from({length:Math.ceil(frameCount/groupSize)},(_,g)=>this.frames.slice(g*groupSize,(g+1)*groupSize));
    this.group=0;this.index=0;this.timer=null;this.img=null;
    this.mount();this.preload();
  }
  mount(){if(!this.el)return;this.el.classList.add('sprite-player');this.el.innerHTML='';const img=document.createElement('img');img.className='player-sprite-img';img.alt='Jogador Time 1';img.draggable=false;this.el.appendChild(img);this.img=img;this.show(0)}
  preload(){this.frames.forEach(src=>{const i=new Image();i.src=src})}
  show(i=0){const arr=this.groups[this.group]||this.groups[0];this.index=((i%arr.length)+arr.length)%arr.length;if(this.img)this.img.src=arr[this.index]}
  setGroup(group=0){this.group=Math.max(0,Math.min(this.groups.length-1,Number(group)||0));this.index=0;this.show(0)}
  play(group=this.group){this.stop();this.setGroup(group);this.timer=setInterval(()=>this.show(this.index+1),1000/this.fps)}
  stop(){if(this.timer){clearInterval(this.timer);this.timer=null}}
  destroy(){this.stop();if(this.el){this.el.innerHTML='';this.el.classList.remove('sprite-player')}}
}
window.FutLivePlayerSprite=FutLivePlayerSprite;
})();