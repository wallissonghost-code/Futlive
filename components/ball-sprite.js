(()=>{'use strict';
const FRAME_COUNT=12,BASE='./assets/ball',VISUAL_SIZE=17;
function frameSrc(i){return `${BASE}/frame_${String(i).padStart(3,'0')}.png`}
function loadAerial(){if(window.FutLiveAerialBall||document.querySelector('script[data-futlive-aerial]'))return;const s=document.createElement('script');s.src='./components/aerial-ball-system.js?v=0.61.4';s.dataset.futliveAerial='1';document.head.appendChild(s)}
function boot(){
  const ball=document.querySelector('.ball');
  if(!ball){setTimeout(boot,50);return}
  if(ball.dataset.spriteReady==='1'){loadAerial();return}
  ball.dataset.spriteReady='1';ball.innerHTML='';
  ball.style.width=VISUAL_SIZE+'px';ball.style.height=VISUAL_SIZE+'px';ball.style.background='transparent';ball.style.border='0';ball.style.borderRadius='0';ball.style.boxShadow='none';ball.style.overflow='visible';
  const img=document.createElement('img');img.className='ball-sprite-img';img.alt='Bola';img.draggable=false;img.style.position='absolute';img.style.left='50%';img.style.bottom='0';img.style.transform='translateX(-50%)';img.style.display='block';img.style.height='100%';img.style.width='auto';img.style.maxWidth='none';img.style.objectFit='unset';img.style.pointerEvents='none';img.style.filter='drop-shadow(0 2px 3px #0008)';ball.appendChild(img);
  const frames=Array.from({length:FRAME_COUNT},(_,i)=>frameSrc(i+1));
  const preloaded=frames.map(src=>{const p=new Image();p.src=src;return p});
  let ready=false;Promise.all(preloaded.map(p=>p.decode?p.decode().catch(()=>{}):Promise.resolve())).finally(()=>{ready=true});
  let idx=0,last=0;
  function draw(t){
    const e=window.FutLiveFootballEngine,phase=window.FutLiveMatchState?.phase;
    let fps=0;
    if(e&&ready){
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
  window.FutLiveBallSprite={frames,count:FRAME_COUNT,visualSize:VISUAL_SIZE,element:ball,image:img,setFrame:n=>{idx=Math.max(0,Math.min(FRAME_COUNT-1,n-1));img.src=frames[idx]}};
  loadAerial();
}
boot();
})();