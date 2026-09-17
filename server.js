// ============================================================
// DATE WORDLE — single-file app by @chatpataprani
// ============================================================
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const DEFAULT_ATTEMPTS = 5;
const DB_FILE = path.join(__dirname, "games.json");
const ADMIN_KEYS = [process.env.ADMIN_KEY_1 || "change-me-1", process.env.ADMIN_KEY_2 || "change-me-2"];

function loadDB(){if(!fs.existsSync(DB_FILE))return{};try{return JSON.parse(fs.readFileSync(DB_FILE,"utf8"));}catch{return{};}}
function saveDB(db){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));}
function evaluate(guess,answer){
  const g=guess.split(""),a=answer.split(""),result=new Array(g.length).fill("absent"),remaining={};
  for(let i=0;i<g.length;i++){if(g[i]===a[i])result[i]="correct";else remaining[a[i]]=(remaining[a[i]]||0)+1;}
  for(let i=0;i<g.length;i++){if(result[i]==="correct")continue;if(remaining[g[i]]>0){result[i]="present";remaining[g[i]]--;}}
  return result;
}
function genId(){return crypto.randomBytes(4).toString("hex");}
function cleanText(value,max=160){return String(value||"").trim().slice(0,max);}
function getGame(db,key){if(db[key])return db[key];return Object.values(db).find(g=>g.slug===key);}
function gameLink(req,game){return `${req.protocol}://${req.get("host")}/play/${game.slug||game.id}`;}

app.get("/",(req,res)=>res.send(createPageHTML()));
app.get("/play/:id",(req,res)=>{const db=loadDB(),game=getGame(db,req.params.id);if(!game)return res.status(404).send(notFoundHTML());res.send(playPageHTML(game));});

app.post("/api/create",(req,res)=>{
  const word=String(req.body.word||"").trim().toUpperCase();
  if(!/^[A-Z]{3,12}$/.test(word))return res.status(400).json({error:"Word must be 3-12 letters, A-Z only, no spaces."});
  const mode=["normal","hard","chill"].includes(req.body.mode)?req.body.mode:"normal";
  const attempts=mode==="hard"?3:mode==="chill"?7:DEFAULT_ATTEMPTS;
  let slug=cleanText(req.body.slug,24).toLowerCase().replace(/[^a-z0-9-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"");
  const id=genId(),db=loadDB();
  if(slug&&getGame(db,slug))slug="";
  const game={
    id,slug:slug||null,word,createdAt:Date.now(),solved:false,solvedAt:null,guesses:[],
    mode,attempts,hintsEnabled:!!req.body.hintsEnabled,timerEnabled:!!req.body.timerEnabled,
    reactionsEnabled:!!req.body.reactionsEnabled,theme:["classic","rose","neon","amoled","mint"].includes(req.body.theme)?req.body.theme:"classic",
    message:cleanText(req.body.message,220),reward:cleanText(req.body.reward,220),reaction:null
  };
  db[id]=game;saveDB(db);
  res.json({id,link:gameLink(req,game),options:{mode,attempts,hintsEnabled:game.hintsEnabled,timerEnabled:game.timerEnabled,reactionsEnabled:game.reactionsEnabled,theme:game.theme,message:!!game.message,reward:!!game.reward}});
});

app.post("/api/guess/:id",(req,res)=>{
  const db=loadDB(),game=getGame(db,req.params.id);
  if(!game)return res.status(404).json({error:"Game not found."});
  if(game.solved)return res.json({result:null,solved:true,attemptsLeft:0});
  if(game.guesses.length>=game.attempts)return res.json({result:null,solved:false,exhausted:true,attemptsLeft:0});
  const guess=String(req.body.guess||"").trim().toUpperCase();
  if(guess.length!==game.word.length||!/^[A-Z]+$/.test(guess))return res.status(400).json({error:`Guess must be ${game.word.length} letters.`});
  const result=evaluate(guess,game.word),solved=guess===game.word;
  game.guesses.push({guess,result,at:Date.now()});game.solved=solved;if(solved)game.solvedAt=Date.now();saveDB(db);
  const attemptsLeft=game.attempts-game.guesses.length,exhausted=!solved&&attemptsLeft===0;
  // Never send the secret word to the player.
  res.json({result,solved,exhausted,attemptsLeft,attempts:game.attempts,message:solved?game.message:null,reward:solved?game.reward:null});
});

app.post("/api/hint/:id",(req,res)=>{
  const db=loadDB(),game=getGame(db,req.params.id);
  if(!game)return res.status(404).json({error:"Game not found."});
  if(!game.hintsEnabled)return res.status(403).json({error:"Hints aren't enabled for this game."});
  if(game.solved||game.guesses.length>=game.attempts)return res.status(400).json({error:"No hint available now."});
  if(game.hintUsed)return res.status(400).json({error:"You already used your hint 😭"});
  game.hintUsed=true;game.guesses.push({guess:"[HINT]",result:[],at:Date.now()});saveDB(db);
  const candidates=[];
  for(let i=0;i<game.word.length;i++)if(!game.guesses.some(g=>g.guess&&g.guess[i]===game.word[i]&&g.guess!=="[HINT]"))candidates.push(i);
  const index=candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:0;
  res.json({index,letter:game.word[index],attemptsLeft:Math.max(0,game.attempts-game.guesses.length)});
});

app.post("/api/reaction/:id",(req,res)=>{
  const db=loadDB(),game=getGame(db,req.params.id);
  if(!game)return res.status(404).json({error:"Game not found."});
  if(!game.reactionsEnabled)return res.status(403).json({error:"Reactions aren't enabled."});
  const allowed=["😭","🗿","🤯","❤️"];if(!allowed.includes(req.body.reaction))return res.status(400).json({error:"Invalid reaction."});
  game.reaction=req.body.reaction;saveDB(db);res.json({ok:true});
});

app.get("/api/status/:id",(req,res)=>{
  const db=loadDB(),game=getGame(db,req.params.id);if(!game)return res.status(404).json({error:"Game not found."});
  res.json({solved:!!game.solved,attemptsUsed:game.guesses.filter(g=>g.guess!=="[HINT]").length,attempts:game.attempts,reaction:game.reaction||null});
});

app.post("/api/reveal/:id",(req,res)=>{
  const key=String(req.body.key||"");if(!ADMIN_KEYS.includes(key))return res.status(401).json({error:"Wrong passcode."});
  const db=loadDB(),game=getGame(db,req.params.id);if(!game)return res.status(404).json({error:"Game not found."});res.json({word:game.word});
});

const BASE_CSS=`
:root{--bg:#0e0e12;--panel:#17171d;--border:#2a2a33;--fg:#eee;--muted:#8a8a95;--correct:#4caf6d;--present:#c9a227;--absent:#c0392b;--accent:#ff5d8f}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}html{touch-action:manipulation}body{background:var(--bg);color:var(--fg);font-family:'Courier New',monospace;margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 12px;overflow-x:hidden}body.rose{--accent:#ff5d8f;--panel:#21151c}body.neon{--accent:#00f0ff;--panel:#111b21}body.mint{--accent:#63e6be;--panel:#13201c}body.amoled{--bg:#000;--panel:#080808;--border:#202020}
h1{letter-spacing:.15em;font-size:1.55rem;margin:0 0 5px;text-align:center}.tag{color:var(--muted);font-size:.78rem;margin-bottom:18px;text-align:center}.panel{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:18px;max-width:390px;width:100%}
input[type=text],input[type=password],select{width:100%;background:#0e0e12;border:1px solid var(--border);color:var(--fg);padding:12px;border-radius:7px;font-family:inherit;font-size:.95rem;margin-bottom:9px;min-height:48px;outline:none}input:focus,select:focus{border-color:var(--accent)}button{width:100%;background:var(--accent);color:#111;border:none;padding:11px;border-radius:6px;font-weight:bold;font-family:inherit;font-size:.9rem;cursor:pointer;touch-action:manipulation;user-select:none}button:disabled{opacity:.5;cursor:default}
.options{margin-top:10px;border-top:1px solid var(--border);padding-top:10px}.options summary{cursor:pointer;color:var(--accent);font-weight:bold;margin-bottom:10px}.option{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;font-size:.76rem;color:var(--muted)}.option input{accent-color:var(--accent)}.option input[type=text],.option select{margin:0;min-height:38px;padding:8px}.option label{flex:1}.optional-box{display:none}.optional-box.show{display:block}.link-box{margin-top:12px;background:#0e0e12;border:1px dashed var(--border);padding:9px;border-radius:6px;word-break:break-all;font-size:.78rem}.copy-btn{margin-top:7px;background:var(--border);color:var(--fg)}
.grid{width:min(100%,360px);display:grid;gap:5px;margin:14px auto 10px}.row{display:grid;gap:5px}.cell{aspect-ratio:1;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.12rem;border-radius:4px;text-transform:uppercase}.cell.correct{background:var(--correct);border-color:var(--correct)}.cell.present{background:var(--present);border-color:var(--present)}.cell.absent{background:var(--absent);border-color:var(--absent)}
.keyboard{margin:10px auto 0;display:flex;flex-direction:column;gap:5px;width:100%;max-width:500px}.krow{display:flex;gap:4px;justify-content:center;width:100%}.key{background:var(--border);color:var(--fg);border:none;border-radius:5px;padding:0;flex:1;min-width:0;height:48px;font-weight:bold;font-family:inherit;cursor:pointer;font-size:.78rem}.key.wide{flex:1.55;font-size:.65rem}.key.correct{background:var(--correct)}.key.present{background:var(--present)}.key.absent{background:var(--absent);color:#fff}.tools{display:flex;gap:6px;width:min(100%,500px);margin:8px auto}.tools button{background:var(--border);color:var(--fg);padding:8px;font-size:.72rem}.msg{text-align:center;margin-top:9px;font-size:.88rem;min-height:1.2em}.timer{text-align:center;color:var(--accent);font-size:.78rem;min-height:1.1em}.result-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:13px;margin-top:10px;width:min(100%,390px);text-align:center}.roast{font-weight:bold;line-height:1.5}.share{white-space:pre-line;font-size:.72rem;color:var(--muted);margin-top:8px;text-align:left}.reactions{display:flex;gap:7px;margin-top:10px}.reactions button{background:var(--border);color:var(--fg);font-size:1.1rem}.small{font-size:.7rem;color:var(--muted)}a{color:var(--accent)}.lock{position:fixed;bottom:10px;right:10px;width:36px;height:36px;border-radius:50%;background:var(--panel);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer}.lock-box{position:fixed;bottom:56px;right:10px;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px;width:190px;display:none;z-index:5}.lock-box.open{display:block}.lock-box input{margin-bottom:7px}.lock-box button{padding:8px}.lock-reveal{font-size:.8rem;margin-top:7px;color:var(--fg);word-break:break-all}
@media(max-width:520px){body{padding:18px 9px}.panel{max-width:390px;padding:18px}.grid{width:min(100%,340px);gap:4px;margin-top:12px}.row{gap:4px}.cell{font-size:1rem}.keyboard{width:100%;gap:4px;margin-top:8px}.krow{gap:3px}.key{height:45px;font-size:.72rem}.key.wide{font-size:.6rem}.tag{margin-bottom:14px}.tools button{font-size:.65rem}}@media(max-width:360px){.grid{width:min(100%,310px)}.key{height:42px;font-size:.66rem}.panel{padding:16px}}
`;

function createPageHTML(){return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME — make one</title><style>${BASE_CSS}</style></head><body>
<h1>DATE ME</h1><div class="tag">// pick a word, send the link, watch them struggle 😭</div>
<div class="panel"><input id="word" type="text" maxlength="12" placeholder="SECRET WORD" autocomplete="off" autocapitalize="characters" spellcheck="false">
<button id="createBtn">CREATE LINK</button>
<details class="options"><summary>OPTIONAL EXTRAS ⚙️</summary>
<div class="option"><label>Game mode</label><select id="mode"><option value="normal">Normal · 5 tries</option><option value="hard">Hard · 3 tries</option><option value="chill">Chill · 7 tries</option></select></div>
<div class="option"><label>Theme</label><select id="theme"><option value="classic">Classic</option><option value="rose">Rose</option><option value="neon">Neon</option><option value="mint">Mint</option><option value="amoled">AMOLED</option></select></div>
<div class="option"><label>Hints · costs 1 try</label><input id="hints" type="checkbox"></div>
<div class="option"><label>Speed timer</label><input id="timer" type="checkbox"></div>
<div class="option"><label>Funny reactions</label><input id="reactions" type="checkbox"></div>
<div class="option"><label>Custom link (optional)</label><input id="slug" type="text" maxlength="24" placeholder="birthday-date"></div>
<div class="option"><label>Secret message</label><input id="messageToggle" type="checkbox"></div><div id="messageBox" class="optional-box"><input id="message" type="text" maxlength="220" placeholder="I knew you'd get it ❤️"></div>
<div class="option"><label>Secret reward</label><input id="rewardToggle" type="checkbox"></div><div id="rewardBox" class="optional-box"><input id="reward" type="text" maxlength="220" placeholder="We're going on a date 👀"></div>
</details><div id="out"></div></div><div class="small" style="margin-top:12px">built by @chatpataprani</div>
<script>
const $=id=>document.getElementById(id),wordInput=$('word'),createBtn=$('createBtn');let creating=false;
$('messageToggle').onchange=()=> $('messageBox').classList.toggle('show',$('messageToggle').checked);$('rewardToggle').onchange=()=> $('rewardBox').classList.toggle('show');
async function createGame(){if(creating)return;creating=true;createBtn.disabled=true;const out=$('out');out.innerHTML='';try{const body={word:wordInput.value,mode:$('mode').value,theme:$('theme').value,hintsEnabled:$('hints').checked,timerEnabled:$('timer').checked,reactionsEnabled:$('reactions').checked,slug:$('slug').value,message:$('messageToggle').checked?$ ('message').value:'',reward:$('rewardToggle').checked?$ ('reward').value:''};const res=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(data.error){out.innerHTML='<div class="msg">'+data.error+'</div>';return}out.innerHTML='<div class="link-box">'+data.link+'</div><button class="copy-btn" id="copyBtn">COPY LINK</button><div class="small" style="margin-top:8px">'+data.options.attempts+' tries · '+data.options.theme+' theme'+(data.options.hintsEnabled?' · hint on':'')+(data.options.timerEnabled?' · timer on':'')+'</div>';$('copyBtn').onclick=()=>{navigator.clipboard.writeText(data.link);$('copyBtn').textContent='COPIED!'}}finally{creating=false;createBtn.disabled=false}}
createBtn.onclick=createGame;wordInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createGame()}});
</script></body></html>`}

function playPageHTML(game){return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME</title><style>${BASE_CSS}</style></head><body class="${game.theme}">
<h1>DATE ME</h1><div class="tag">// solve the word · ${game.word.length} letters · ${game.attempts} tries</div><div class="timer" id="timer"></div>
<div class="grid" id="grid"></div><div class="msg" id="msg"></div><div class="keyboard" id="keyboard"></div>
<div class="tools">${game.hintsEnabled?'<button id="hintBtn">💡 HINT · 1 TRY</button>':''}<button id="shareBtn">📋 SHARE</button></div>
<div class="lock" id="lockBtn">⚙️</div><div class="lock-box" id="lockBox"><input id="lockKey" type="password" placeholder="PASSCODE"><button id="lockGo">SPILL IT 🫢</button><div class="lock-reveal" id="lockOut"></div></div>
<script>
const ID=${JSON.stringify(game.id)},LEN=${game.word.length},MAX=${game.attempts},HINT=${!!game.hintsEnabled},TIMER=${!!game.timerEnabled},REACTIONS=${!!game.reactionsEnabled};let row=0,col=0,board=Array.from({length:MAX},()=>Array(LEN).fill('')),done=false,submitting=false,start=Date.now(),elapsed=0;
const grid=document.getElementById('grid');grid.style.gridTemplateRows='repeat('+MAX+',1fr)';
for(let r=0;r<MAX;r++){const rowEl=document.createElement('div');rowEl.className='row';rowEl.style.gridTemplateColumns='repeat('+LEN+',1fr)';for(let c=0;c<LEN;c++){const cell=document.createElement('div');cell.className='cell';cell.id='cell'+r+'-'+c;rowEl.appendChild(cell)}grid.appendChild(rowEl)}
const kb=document.getElementById('keyboard'),keyEls={};function addKey(parent,label,action,wide=false){const b=document.createElement('button');b.type='button';b.className='key'+(wide?' wide':'');b.textContent=label;b.addEventListener('pointerdown',e=>{e.preventDefault();if(!b.disabled)action()},{passive:false});b.addEventListener('click',e=>e.preventDefault());parent.appendChild(b);if(label.length===1)keyEls[label]=b;return b}
['QWERTYUIOP','ASDFGHJKL'].forEach(chars=>{const kr=document.createElement('div');kr.className='krow';for(const ch of chars)addKey(kr,ch,()=>press(ch));kb.appendChild(kr)});const last=document.createElement('div');last.className='krow';const enterB=addKey(last,'ENTER',submit,true);for(const ch of 'ZXCVBNM')addKey(last,ch,()=>press(ch));const backB=addKey(last,'DEL',backspace,true);kb.appendChild(last);
function press(ch){if(done||submitting||col>=LEN)return;board[row][col]=ch;document.getElementById('cell'+row+'-'+col).textContent=ch;col++}function backspace(){if(done||submitting||col<=0)return;col--;board[row][col]='';document.getElementById('cell'+row+'-'+col).textContent=''}
function formatTime(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),ss=String(s%60).padStart(2,'0');return m+':'+ss}
if(TIMER){const timerEl=document.getElementById('timer');setInterval(()=>{if(!done){elapsed=Date.now()-start;timerEl.textContent='⏱ '+formatTime(elapsed)}},250)}
function roast(){const roasts=["BRO REALLY HAD 5 CHANCES AND STILL GOT COOKED 😭","THE WORD WAS FIGHTING FOR ITS LIFE AND YOU STILL LOST 💀","5 TRIES. ZERO CLUES. JUST VIBES. 😭","NAH YOU DIDN'T SOLVE IT, YOU JUST SUBMITTED A RESIGNATION 💀","THE WORD SAID 'GUESS ME' AND YOU SAID 'BET'... THEN LOST 😭","I'M NOT SAYING YOU'RE BAD AT THIS BUT THE WORD IS FEELING SAFE 💀","BRO HAD FIVE BUSINESS DAYS AND STILL COULDN'T CRACK IT 😭","THAT WASN'T WORDLE, THAT WAS A FULL-ON INVESTIGATION AND YOU FAILED 💀"];return roasts[Math.floor(Math.random()*roasts.length)]}
function finishCard(data,solved){done=true;const msg=document.getElementById('msg');const used=Math.min(row,MAX);const time=TIMER?formatTime(elapsed):null;let streak=Number(localStorage.getItem('dateStreak')||0);if(solved){streak++;localStorage.setItem('dateStreak',streak)}else{streak=0;localStorage.setItem('dateStreak',0)}let card=document.createElement('div');card.className='result-card';card.innerHTML=solved?'<div>💌 <b>SOLVED!</b></div><div class="small">'+used+'/'+MAX+' tries'+(time?' · '+time:'')+' · streak '+streak+'</div>':'<div class="roast">'+roast()+'</div><div class="small">0/1 braincells cooperating today 😭</div>';if(solved&&(data.message||data.reward)){card.innerHTML+='<div style="margin-top:10px">'+(data.message?'<div>💌 '+escapeHtml(data.message)+'</div>':'')+(data.reward?'<div style="margin-top:7px">🎁 '+escapeHtml(data.reward)+'</div>':'')+'</div>'}if(!solved){card.innerHTML+='<div class="small" style="margin-top:8px">No answer reveal. Protecting the sauce 🫡</div>'}card.innerHTML+='<div class="share" id="shareText"></div><button id="shareCopy" style="margin-top:8px">COPY RESULT</button>'+(REACTIONS?'<div class="small" style="margin-top:9px">reaction:</div><div class="reactions"><button data-r="😭">😭</button><button data-r="🗿">🗿</button><button data-r="🤯">🤯</button><button data-r="❤️">❤️</button></div>':'');document.body.appendChild(card);const shareLines=board.slice(0,used).map(r=>r.map((_,i)=>'🟩').join(''));document.getElementById('shareText').textContent='DATE WORDLE · '+used+'/'+MAX+'\\n'+shareLines.join('\\n')+(time?'\\n⏱ '+time:'');document.getElementById('shareCopy').onclick=()=>navigator.clipboard.writeText(document.getElementById('shareText').textContent);if(REACTIONS)card.querySelectorAll('.reactions button').forEach(b=>b.onclick=async()=>{await fetch('/api/reaction/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reaction:b.dataset.r})});b.textContent='SENT '+b.dataset.r});msg.textContent=solved?'YES. THAT'S THE WORD. 💌':''}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function submit(){if(done||submitting||col<LEN)return;submitting=true;enterB.disabled=true;backB.disabled=true;const guess=board[row].join('');try{const res=await fetch('/api/guess/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guess}),cache:'no-store'});const data=await res.json(),msg=document.getElementById('msg');if(data.error){msg.textContent=data.error;return}data.result.forEach((state,c)=>{const cell=document.getElementById('cell'+row+'-'+c);cell.classList.add(state);const k=keyEls[guess[c]];if(k&&!k.classList.contains('correct'))k.classList.add(state)});row++;col=0;if(data.solved){elapsed=Date.now()-start;finishCard(data,true)}else if(data.exhausted){elapsed=Date.now()-start;finishCard(data,false)}}finally{submitting=false;if(!done){enterB.disabled=false;backB.disabled=false}}}
async function useHint(){const b=document.getElementById('hintBtn');if(!b||done)return;b.disabled=true;const res=await fetch('/api/hint/'+ID,{method:'POST'}),data=await res.json();if(data.error){document.getElementById('msg').textContent=data.error;b.disabled=false;return}document.getElementById('msg').textContent='💡 Hint: position '+(data.index+1)+' is '+data.letter;document.getElementById('cell'+row+'-'+data.index).textContent=data.letter;b.textContent='HINT USED 😭'}
if(HINT)document.getElementById('hintBtn').onclick=useHint;
document.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}else if(e.key==='Backspace'){e.preventDefault();backspace()}else if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();press(e.key.toUpperCase())}});
const lockBtn=document.getElementById('lockBtn'),lockBox=document.getElementById('lockBox');lockBtn.addEventListener('pointerdown',e=>{e.preventDefault();lockBox.classList.toggle('open')},{passive:false});document.getElementById('lockGo').addEventListener('pointerdown',async e=>{e.preventDefault();const key=document.getElementById('lockKey').value,out=document.getElementById('lockOut');const res=await fetch('/api/reveal/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});const data=await res.json();out.textContent=data.error?data.error:'no cap, the word is: '+data.word},{passive:false});
</script></body></html>`}
function notFoundHTML(){return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body><h1>404</h1><div class="tag">that link doesn't exist</div></body></html>`}
app.listen(PORT,()=>console.log(`DATE WORDLE running on port ${PORT}`));