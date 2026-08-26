(()=>{'use strict';
const ENGINE_VERSION='0.18';
class FutLiveGameEngine{
  constructor({game='#game',ball='.ball'}={}){
    this.game=typeof game==='string'?document.querySelector(game):game;
    this.ballEl=typeof ball==='string'?document.querySelector(ball):ball;
    this.running=true;this.last=performance.now();this.raf=0;this.owner=null;this.lastKick=0;
    this.ball={x:50,y:48,vx:0,vy:0,r:1.2};
    this.goals={left:{x:4,y1:36,y2:64},right:{x:96,y1:36,y2:64}};
    this.home={
      player1:{x:20,y:37},player2:{x:34,y:58},player3:{x:42,y:27},
      player4:{x:80,y:57},player5:{x:66,y:33},player6:{x:57,y:67}
    };
    this.players=[];this.score={blue:1,red:0};this.collectPlayers();this.placeBall();
    this.loop=this.loop.bind(this);this.raf=requestAnimationFrame(this.loop);
    window.FutLiveGameEngine=this;
  }
  collectPlayers(){
    const ids=['player1','player2','player3','player4','player5','player6'];
    this.players=ids.map((id,i)=>{const el=document.getElementById(id);if(!el)return null;const h=this.home[id];return{id,el,sprite:null,team:i<3?'blue':'red',x:h.x,y:h.y,speed:i<3?7.8:7.8,state:'idle',dir:i<3?'right':'left'}}).filter(Boolean);
  }
  resolveSprites(){const map=window.FutLivePlayers||{};for(const p of this.players)p.sprite=map[p.id]||p.sprite}
  placePlayer(p){p.el.style.left=p.x+'%';p.el.style.top=p.y+'%'}
  placeBall(){if(!this.ballEl)return;this.ballEl.style.left=this.ball.x+'%';this.ballEl.style.top=this.ball.y+'%';this.ballEl.style.transform='translate(-50%,-50%)';this.ballEl.style.zIndex='8'}
  setAnim(p,name){if(p.state===name)return;p.state=name;try{if(name==='idle')p.sprite?.idle();else p.sprite?.move(name)}catch{}}
  dirFrom(dx,dy){if(Math.abs(dx)>Math.abs(dy))return dx>=0?'right':'left';return dy>=0?'down':'up'}
  moveToward(p,tx,ty,dt,mult=1){const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);if(d<.15){this.setAnim(p,'idle');return true}const step=Math.min(d,p.speed*mult*dt);p.x+=dx/d*step;p.y+=dy/d*step;p.x=Math.max(6,Math.min(94,p.x));p.y=Math.max(10,Math.min(82,p.y));const dir=this.dirFrom(dx,dy);p.dir=dir;this.setAnim(p,dir);this.placePlayer(p);return false}
  nearest(team){let best=null,bd=1e9;for(const p of this.players){if(p.team!==team)continue;const d=Math.hypot(p.x-this.ball.x,p.y-this.ball.y);if(d<bd){bd=d;best=p}}return best}
  acquire(){if(this.owner)return;const b=this.nearest('blue'),r=this.nearest('red');const db=b?Math.hypot(b.x-this.ball.x,b.y-this.ball.y):99,dr=r?Math.hypot(r.x-this.ball.x,r.y-this.ball.y):99;const p=db<dr?b:r;const d=Math.min(db,dr);if(p&&d<3.2&&Math.hypot(this.ball.vx,this.ball.vy)<18){this.owner=p;this.ball.vx=0;this.ball.vy=0}}
  shoot(p){const now=performance.now();if(now-this.lastKick<650)return;this.lastKick=now;try{p.sprite?.kick()}catch{}const targetX=p.team==='blue'?98:2;const targetY=50+(Math.random()-.5)*18;const dx=targetX-p.x,dy=targetY-p.y,d=Math.hypot(dx,dy)||1;const speed=34+Math.random()*12;this.ball.x=p.x+(p.team==='blue'?2.4:-2.4);this.ball.y=p.y;this.ball.vx=dx/d*speed;this.ball.vy=dy/d*speed;this.owner=null}
  updateOwner(dt){const p=this.owner;if(!p)return;const gx=p.team==='blue'?94:6,gy=50;const distGoal=Math.abs(gx-p.x);if(distGoal<25||Math.random()<dt*.12){this.shoot(p);return}this.moveToward(p,gx,gy,dt,1.08);const off=p.team==='blue'?2.1:-2.1;this.ball.x=p.x+off;this.ball.y=p.y+1.2;this.ball.vx=0;this.ball.vy=0;this.placeBall()}
  updateChasers(dt){if(this.owner)return;const blue=this.nearest('blue'),red=this.nearest('red');for(const p of [blue,red])if(p)this.moveToward(p,this.ball.x,this.ball.y,dt,1.12)}
  updateSupport(dt){const chasers=new Set([this.nearest('blue'),this.nearest('red'),this.owner].filter(Boolean));for(const p of this.players){if(chasers.has(p))continue;const h=this.home[p.id];let tx=h.x,ty=h.y;if(this.owner){const sign=this.owner.team==='blue'?1:-1;const same=p.team===this.owner.team;tx=h.x+(same?sign*7:-sign*4);ty=h.y+(this.ball.y-50)*.13}this.moveToward(p,tx,ty,dt,.62)}
  updateBall(dt){if(this.owner)return;this.ball.x+=this.ball.vx*dt;this.ball.y+=this.ball.vy*dt;const drag=Math.pow(.22,dt);this.ball.vx*=drag;this.ball.vy*=drag;if(this.ball.y<9){this.ball.y=9;this.ball.vy=Math.abs(this.ball.vy)*.75}if(this.ball.y>83){this.ball.y=83;this.ball.vy=-Math.abs(this.ball.vy)*.75}if(this.ball.x<1||this.ball.x>99){const inGoal=this.ball.y>=36&&this.ball.y<=64;if(inGoal){const scoring=this.ball.x>99?'blue':'red';this.goal(scoring);return}this.ball.x=Math.max(1,Math.min(99,this.ball.x));this.ball.vx*=-.7}if(Math.hypot(this.ball.vx,this.ball.vy)<.35){this.ball.vx=0;this.ball.vy=0}this.placeBall();this.acquire()}
  goal(team){this.score[team]++;this.owner=null;this.ball={x:50,y:48,vx:0,vy:0,r:1.2};for(const p of this.players){const h=this.home[p.id];p.x=h.x;p.y=h.y;this.placePlayer(p);this.setAnim(p,'idle')}this.placeBall();const scoreEl=document.querySelector('.scorebox b');if(scoreEl)scoreEl.textContent=this.score.blue+' × '+this.score.red;const fx=document.getElementById('forceFx'),txt=document.getElementById('forceFxText');if(fx&&txt){txt.textContent=(team==='blue'?'AZUL':'VERMELHO')+' · GOL!';fx.classList.remove('show');void fx.offsetWidth;fx.classList.add('show');setTimeout(()=>fx.classList.remove('show'),1200)}}
  update(dt){this.resolveSprites();const paused=this.game?.classList.contains('is-paused');if(paused)return;this.updateOwner(dt);this.updateChasers(dt);this.updateSupport(dt);this.updateBall(dt)}
  loop(now){const dt=Math.min(.035,(now-this.last)/1000||0);this.last=now;if(this.running)this.update(dt);this.raf=requestAnimationFrame(this.loop)}
  pause(){this.running=false}
  resume(){this.running=true;this.last=performance.now()}
  destroy(){cancelAnimationFrame(this.raf);this.running=false}
}
function boot(){if(window.FutLiveGameEngine)return;const game=document.getElementById('game'),ball=document.querySelector('.ball');if(!game||!ball)return;new FutLiveGameEngine({game,ball})}
window.FutLiveGameEngineClass=FutLiveGameEngine;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80),{once:true});else setTimeout(boot,80);
})();