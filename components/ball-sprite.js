(()=>{'use strict';
const FRAME_COUNT=12,BASE='./assets/ball';
function frameSrc(i){return `${BASE}/frame_${String(i).padStart(3,'0')}.png`}
function boot(){
  const ball=document.querySelector('.ball');
  if(!ball){setTimeout(boot,50);return}
  if(ball.dataset.spriteReady==='1')return;
  ball.dataset.spriteReady='1';ball.innerHTML='';
  const img=document.createElement('img');img.className='ball-sprite-img';img.alt='Bola';img.draggable=false;ball.appendChild(img);
  const frames=Array.from({length:FRAME_COUNT},(_,i)=>frameSrc(i+1));frames.forEach(src=>{const p=new Image();p.src=src});
  let idx=0,last=0;
  function draw(t){
    const e=window.FutLiveFootballEngine,phase=window.FutLiveMatchState?.phase;
    let fps=0;
    if(e){
      const speed=Math.hypot(e.ball?.vx||0,e.ball?.vy||0);
      if(phase==='PLAYING'){
        if(e.ball?.owner)fps=7;
        else if(speed>220)fps=16;
        else if(speed>110)fps=12;
        else if(speed>25)fps=8;
        else fps=3;
      }
    }
    if(!img.src)img.src=frames[0];
    if(fps>0&&t-last>=1000/fps){idx=(idx+1)%FRAME_COUNT;img.src=frames[idx];last=t}
    requestAnimationFrame(draw)
  }
  img.src=frames[0];requestAnimationFrame(draw);
  window.FutLiveBallSprite={frames,count:FRAME_COUNT,element:ball,image:img,setFrame:n=>{idx=Math.max(0,Math.min(FRAME_COUNT-1,n-1));img.src=frames[idx]}};
}
boot();
})();