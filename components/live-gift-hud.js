/* LIVE GIFT HUD COMPONENT v1 */
(()=>{'use strict';
class LiveGiftHUD{
  constructor({root,defaults={blue:[],red:[]},statusEl=null}={}){
    this.root=typeof root==='string'?document.querySelector(root):root;
    if(!this.root)throw new Error('LiveGiftHUD: root não encontrado');
    this.defaults=structuredClone(defaults);
    this.state=structuredClone(defaults);
    this.statusEl=statusEl||this.root.querySelector('[data-livegift-status]');
    this.containers={blue:this.root.querySelector('[data-livegift-rules="blue"]'),red:this.root.querySelector('[data-livegift-rules="red"]')};
    this.render();
  }
  makeFallback(g){const e=document.createElement('span');e.className='gift';e.textContent=g.emoji||'🎁';return e}
  card(g){
    const c=document.createElement('div');c.className='rule';c.dataset.slot=g.id||'';
    let gift;
    if(g.imageUrl||g.giftIcon){gift=document.createElement('img');gift.className='gift';gift.src=g.imageUrl||g.giftIcon;gift.alt=g.name||g.giftName||'Presente';gift.onerror=()=>gift.replaceWith(this.makeFallback(g));}
    else gift=this.makeFallback(g);
    const cp=document.createElement('div');cp.className='copy';
    const b=document.createElement('b');b.textContent=g.action||g.label||'+ Buff';
    const s=document.createElement('small');s.textContent=g.name||g.giftName||g.detail||'Presente';
    cp.append(b,s);c.append(gift,cp);
    if(g.fixed){const l=document.createElement('span');l.className='lock';l.textContent='🔒';c.append(l)}
    return c;
  }
  render(){for(const team of ['blue','red'])this.containers[team]?.replaceChildren(...(this.state[team]||[]).map(g=>this.card(g)))}
  setStatus(text,on=false){if(!this.statusEl)return;this.statusEl.textContent=text;this.statusEl.classList.toggle('on',!!on)}
  applySlot(team,slot,patch={}){
    const item=this.state?.[team]?.find(x=>x.id===slot);if(!item)return false;
    for(const k of ['name','giftName','emoji','imageUrl','giftIcon','action','detail'])if(Object.prototype.hasOwnProperty.call(patch,k))item[k]=patch[k];
    this.render();return true;
  }
  applyConfig(payload){
    if(!payload||typeof payload!=='object')return;
    const slots=Array.isArray(payload.slots)?payload.slots:[payload];
    for(const x of slots){if(!x?.team||!x?.slot)continue;this.applySlot(x.team,x.slot,x)}
  }
  applyRulesSync(rules=[]){
    const list=Array.isArray(rules)?rules:[];
    for(const r of list){
      const actionId=String(r.actionId||r.action||'');
      let team=String(r.team||'').toLowerCase();
      if(!team){if(actionId.includes('blue'))team='blue';else if(actionId.includes('red'))team='red'}
      if(team!=='blue'&&team!=='red')continue;
      let slot=String(r.slot||r.slotId||'');
      if(!slot){const ids=['precision','finish','force','speed','power','defense'];slot=ids.find(id=>actionId.includes(id))||''}
      if(!slot)continue;
      this.applySlot(team,slot,{giftIcon:r.giftIcon||r.imageUrl||'',giftName:r.giftName||r.name||'Presente'});
      const card=this.containers[team]?.querySelector(`[data-slot="${CSS.escape(slot)}"]`);if(card)card.classList.add('sync-live');
    }
  }
  reset(){this.state=structuredClone(this.defaults);this.render()}
  getState(){return structuredClone(this.state)}
}
window.LiveGiftHUD=LiveGiftHUD;
})();
