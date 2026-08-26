(()=>{'use strict';
function boot(){
  const game=document.getElementById('game'),pauseBtn=document.getElementById('pauseBtn');
  const engine=window.FutLiveFootballEngine;
  if(!game||!pauseBtn||!engine){setTimeout(boot,100);return}

  // Ritmo: acelera levemente sem voltar ao efeito 'correria'.
  engine.players.forEach(p=>{p.baseSpeed*=p.goalkeeper?1.10:1.16;p.speed*=p.goalkeeper?1.10:1.16});

  // Goleiro fica na frente da linha, nunca dentro da rede.
  engine.pinGoalkeeper=(p,f)=>{
    p.x=p.team==='blue'?f.left+46:f.right-46;
    p.y=engine.clamp(p.y,f.goalTop+8,f.goalBottom-27-6);
  };
  engine.goalkeepers.forEach(g=>engine.pinGoalkeeper(g,engine.field()));

  const overlay=document.createElement('div');
  overlay.className='returnOverlay';
  overlay.innerHTML='<div class="returnCard"><h2>Partida pausada</h2><p>Você saiu do jogo. Quer continuar de onde parou ou reiniciar a partida?</p><div class="returnActions"><button class="restartGame" type="button">REINICIAR</button><button class="continueGame" type="button">CONTINUAR</button></div></div>';
  document.body.appendChild(overlay);
  const restart=overlay.querySelector('.restartGame'),cont=overlay.querySelector('.continueGame');

  let autoPaused=false;
  function pauseForExit(){
    if(game.classList.contains('is-paused')){autoPaused=false;return}
    pauseBtn.click();
    autoPaused=true;
  }
  function showReturn(){if(autoPaused)overlay.classList.add('show')}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForExit();else showReturn()});
  window.addEventListener('pagehide',pauseForExit);
  window.addEventListener('pageshow',()=>{if(!document.hidden)showReturn()});

  cont.addEventListener('click',()=>{
    overlay.classList.remove('show');
    if(autoPaused&&game.classList.contains('is-paused'))pauseBtn.click();
    autoPaused=false;
  });
  restart.addEventListener('click',()=>{
    engine.score={blue:0,red:0};
    engine.renderScore();
    engine.resetBall();
    overlay.classList.remove('show');
    if(game.classList.contains('is-paused'))pauseBtn.click();
    autoPaused=false;
  });

  const v=document.querySelector('.version');if(v)v.textContent='BETA 0.35';
}
boot();
})();