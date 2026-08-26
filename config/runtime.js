window.FutLiveConfig=Object.freeze({
  version:'0.44',
  players:{
    team1:{ids:['player1','player2','player3','player4','player5'],base:'./assets/players/team-1',frames:32,fps:8,team:'1'},
    team2:{ids:['player6','player7','player8','player9','player10'],base:'./assets/players/team-2',frames:32,fps:8,team:'2'}
  },
  field:{
    mode:'camera-follow-16x9',viewportWidthPercent:100,
    map:'./assets/maps/BDA9D67F-DDF2-4429-BF0A-84EC5AE497E8.png',
    goals:{enabled:true,left:'./assets/goals/frame_001.png',right:'./assets/goals/frame_003.png'},
    ball:{base:'./assets/ball',frames:12},
    referee:{base:'./assets/referee',desktop:{width:58,height:66,scale:1.52,offsetX:-20,offsetY:-29,footAnchor:[.5,.84]},mobile:{width:55,height:62,scale:1.56,offsetX:-19,offsetY:-27,footAnchor:[.5,.84]}}
  },
  gifts:{
    blue:[{id:'precision',fixed:true,name:'Rosa',emoji:'🌹',action:'+ Precisão'},{id:'finish',fixed:true,name:'Bola',emoji:'⚽',action:'+ Finalização'},{id:'force',name:'Presente 3',emoji:'🎁',action:'+ Força'},{id:'speed',name:'Presente 4',emoji:'✨',action:'+ Velocidade'},{id:'power',name:'Presente 5',emoji:'🔥',action:'+ Potência'},{id:'defense',name:'Presente 6',emoji:'🛡️',action:'+ Defesa'}],
    red:[{id:'precision',fixed:true,name:'Rosa',emoji:'🌹',action:'+ Precisão'},{id:'finish',fixed:true,name:'Bola',emoji:'⚽',action:'+ Finalização'},{id:'force',name:'Presente 3',emoji:'🎁',action:'+ Força'},{id:'speed',name:'Presente 4',emoji:'✨',action:'+ Velocidade'},{id:'power',name:'Presente 5',emoji:'🔥',action:'+ Potência'},{id:'defense',name:'Presente 6',emoji:'🛡️',action:'+ Defesa'}]
  },
  panel:{gameId:'futlive',name:'Futlive',protocol:'liveplus-match-v1',manifestProtocol:'liveplus-game-manifest-v1'}
});