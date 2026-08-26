window.FutLiveConfig=Object.freeze({
  version:'0.26',
  players:{
    team1:{ids:['player1','player2','player3'],base:'./assets/players/team-1',frames:32,fps:8,team:'1'},
    team2:{ids:['player4','player5','player6'],base:'./assets/players/team-2',frames:32,fps:8,team:'2'}
  },
  field:{
    mode:'css-safe',
    map:'./assets/maps/16F9F5B2-A968-4629-A9C0-6ABF47EB5B94.jpeg',
    goals:{left:'./assets/goals/frame_001.png',right:'./assets/goals/frame_003.png'}
  },
  gifts:{
    blue:[
      {id:'precision',fixed:true,name:'Rosa',emoji:'🌹',action:'+ Precisão'},
      {id:'finish',fixed:true,name:'Bola',emoji:'⚽',action:'+ Finalização'},
      {id:'force',name:'Presente 3',emoji:'🎁',action:'+ Força'},
      {id:'speed',name:'Presente 4',emoji:'✨',action:'+ Velocidade'},
      {id:'power',name:'Presente 5',emoji:'🔥',action:'+ Potência'},
      {id:'defense',name:'Presente 6',emoji:'🛡️',action:'+ Defesa'}
    ],
    red:[
      {id:'precision',fixed:true,name:'Rosa',emoji:'🌹',action:'+ Precisão'},
      {id:'finish',fixed:true,name:'Bola',emoji:'⚽',action:'+ Finalização'},
      {id:'force',name:'Presente 3',emoji:'🎁',action:'+ Força'},
      {id:'speed',name:'Presente 4',emoji:'✨',action:'+ Velocidade'},
      {id:'power',name:'Presente 5',emoji:'🔥',action:'+ Potência'},
      {id:'defense',name:'Presente 6',emoji:'🛡️',action:'+ Defesa'}
    ]
  },
  panel:{gameId:'futlive',name:'Futlive',protocol:'liveplus-match-v1',manifestProtocol:'liveplus-game-manifest-v1'}
});