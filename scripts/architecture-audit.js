const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[],warn=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),exists=p=>fs.existsSync(path.join(root,p));
const html=read('index.html');
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]).filter(s=>s.startsWith('./')).map(s=>s.slice(2));
const counts=new Map();for(const s of scripts)counts.set(s,(counts.get(s)||0)+1);for(const [s,n] of counts)if(n>1)fail.push(`duplicate active script: ${s} x${n}`);
const required=['components/football-engine-v032.js','components/football-ai-system.js','components/football-tactics-system.js','components/set-piece-system.js','components/boundary-restart-system.js','components/out-of-play-system.js','components/possession-authority-system.js','app/system-health.js'];for(const s of required)if(!scripts.includes(s))fail.push(`missing active module: ${s}`);
const order=['components/set-piece-system.js','components/boundary-restart-system.js','components/out-of-play-system.js'];for(let i=1;i<order.length;i++)if(scripts.indexOf(order[i-1])>scripts.indexOf(order[i]))fail.push(`wrong load order: ${order[i-1]} must precede ${order[i]}`);
const possessionIndex=scripts.indexOf('components/possession-authority-system.js');
if(possessionIndex<0)fail.push('possession authority missing');
else{const later=scripts.slice(possessionIndex+1).filter(s=>exists(s)&&/(?:\be|\bengine)\.takePossession\s*=/.test(read(s)));if(later.length)fail.push(`takePossession patched after central authority: ${later.join(', ')}`)}
const forbidden=['components/football-engine.js','components/football-engine-v031.js','app/gameplay-v035.js','config/lineup-v031.js'];for(const p of forbidden)if(exists(p))fail.push(`legacy file must not live on main: ${p}`);
const dynamicCore=[];for(const s of scripts){if(!s.endsWith('.js')||!exists(s))continue;const c=read(s);if(/createElement\(['"]script['"]\)/.test(c)&&/(football|out-of-play|boundary-restart|set-piece|goalkeeper|tackle|throw-in)/.test(c))dynamicCore.push(s)}if(dynamicCore.length)fail.push(`dynamic core loader forbidden: ${dynamicCore.join(', ')}`);
const runtime=read('config/runtime.js'),version=(runtime.match(/version:'([^']+)'/)||[])[1];if(!version)fail.push('runtime version missing');for(const v of [...html.matchAll(/[?&]v=([0-9.]+)/g)].map(m=>m[1]))if(v!==version)fail.push(`cache version mismatch: ${v} != ${version}`);
const engineLoads=scripts.filter(s=>/components\/football-engine(?:-v\d+)?\.js$/.test(s));if(engineLoads.length!==1)fail.push(`exactly one football engine must load, found ${engineLoads.length}`);
// Baseline 0.74: a lista legada permanece explícita, mas possession-authority é o último gate obrigatório.
const authority={
 moveToward:['components/football-ai-system.js','components/football-tactics-system.js','components/player-intelligence-system.js','components/match-context-ai-system.js','components/ball-contact-system.js','components/ground-gameplay-system.js','components/player-tackle-system.js','components/referee-system.js'],
 takePossession:['components/football-tactics-system.js','components/player-intelligence-system.js','components/match-context-ai-system.js','components/technical-ball-actions-system.js','components/aerial-ball-system.js','components/player-emotion-system.js','components/ground-gameplay-system.js','components/set-piece-foul-bridge.js','components/throw-in-rules-system.js','components/possession-authority-system.js'],
 pass:['components/football-tactics-system.js','components/player-intelligence-system.js','components/match-context-ai-system.js','components/technical-ball-actions-system.js','components/aerial-ball-system.js','components/player-emotion-system.js','components/pass-orientation-system.js'],
 ownedAI:['components/football-ai-system.js','components/football-tactics-system.js','components/player-intelligence-system.js','components/match-context-ai-system.js','components/technical-ball-actions-system.js','components/ai-runtime-coordinator.js','components/player-movement-stability-system.js'],
 freeAI:['components/football-ai-system.js','components/football-tactics-system.js','components/match-context-ai-system.js','components/ai-runtime-coordinator.js','components/player-movement-stability-system.js','components/loose-ball-reactivity-system.js'],
 intercept:['components/football-ai-system.js','components/technical-ball-actions-system.js','components/aerial-ball-system.js','components/ai-runtime-coordinator.js'],
 physics:['components/technical-ball-actions-system.js','components/aerial-ball-system.js','components/out-of-play-system.js','components/throw-in-rules-system.js']
};
const seen={};for(const [method,allowed] of Object.entries(authority)){seen[method]=[];for(const s of scripts){if(!s.endsWith('.js')||!exists(s))continue;const c=read(s),re=new RegExp(`(?:\\be|\\bengine)\\.${method}\\s*=`);if(re.test(c)&&!s.includes('football-engine-v032.js')){seen[method].push(s);if(!allowed.includes(s))fail.push(`undeclared ${method} authority: ${s}`)}}for(const s of seen[method])if(!allowed.includes(s))fail.push(`unexpected ${method} patch: ${s}`)}
if(seen.takePossession.at(-1)!=='components/possession-authority-system.js')fail.push(`possession authority must be final takePossession writer, got ${seen.takePossession.at(-1)||'none'}`);
if(fail.length){console.error('\nARCHITECTURE AUDIT FAILED');for(const x of [...new Set(fail)])console.error(' - '+x);process.exit(1)}
console.log(`Architecture OK | active scripts=${scripts.length} | runtime=${version}`);for(const [m,list] of Object.entries(seen))console.log(` authority ${m}: ${list.join(' -> ')||'core only'}`);
