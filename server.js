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
const MAX_ATTEMPTS = 5;
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

app.get("/",(req,res)=>res.send(createPageHTML()));
app.get("/play/:id",(req,res)=>{const db=loadDB(),game=db[req.params.id];if(!game)return res.status(404).send(notFoundHTML());res.send(playPageHTML(req.params.id,game.word.length));});
app.post("/api/create",(req,res)=>{
  const word=String(req.body.word||"").trim().toUpperCase();
  if(!/^[A-Z]{3,12}$/.test(word))return res.status(400).json({error:"Word must be 3-12 letters, A-Z only, no spaces."});
  const id=genId(),db=loadDB();db[id]={word,createdAt:Date.now(),solved:false,solvedAt:null,guesses:[]};saveDB(db);
  res.json({id,link:`${req.protocol}://${req.get("host")}/play/${id}`});
});
app.post("/api/guess/:id",(req,res)=>{
  const db=loadDB(),game=db[req.params.id];
  if(!game)return res.status(404).json({error:"Game not found."});
  if(game.solved)return res.json({result:null,solved:true,attemptsLeft:0});
  if(game.guesses.length>=MAX_ATTEMPTS)return res.json({result:null,solved:false,exhausted:true,attemptsLeft:0});
  const guess=String(req.body.guess||"").trim().toUpperCase();
  if(guess.length!==game.word.length||!/^[A-Z]+$/.test(guess))return res.status(400).json({error:`Guess must be ${game.word.length} letters.`});
  const result=evaluate(guess,game.word),solved=guess===game.word;
  game.guesses.push({guess,result,at:Date.now()});game.solved=solved;if(solved)game.solvedAt=Date.now();saveDB(db);
  const attemptsLeft=MAX_ATTEMPTS-game.guesses.length,exhausted=!solved&&attemptsLeft===0;
  // Never send the secret word to the player.
  res.json({result,solved,exhausted,attemptsLeft});
});
app.post("/api/reveal/:id",(req,res)=>{
  const key=String(req.body.key||"");if(!ADMIN_KEYS.includes(key))return res.status(401).json({error:"Wrong passcode."});
  const db=loadDB(),game=db[req.params.id];if(!game)return res.status(404).json({error:"Game not found."});res.json({word:game.word});
});

const BASE_CSS=`
:root{--bg:#0e0e12;--panel:#17171d;--border:#2a2a33;--fg:#eee;--muted:#8a8a95;--correct:#4caf6d;--present:#c9a227;--absent:#c0392b;--accent:#ff5d8f}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{touch-action:manipulation}
body{background:var(--bg);color:var(--fg);font-family:'Courier New',monospace;margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 12px;overflow-x:hidden}
h1{letter-spacing:.15em;font-size:1.55rem;margin:0 0 5px;text-align:center}
.tag{color:var(--muted);font-size:.78rem;margin-bottom:18px;text-align:center}
/* The create box stays compact; the play keyboard is intentionally wider. */
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:350px;width:100%}
input[type=text],input[type=password]{width:100%;background:#0e0e12;border:1px solid var(--border);color:var(--fg);padding:13px 12px;border-radius:7px;font-family:inherit;font-size:1rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;min-height:50px;outline:none}
input[type=text]:focus,input[type=password]:focus{border-color:var(--accent)}
button{width:100%;background:var(--accent);color:#111;border:none;padding:11px;border-radius:6px;font-weight:bold;font-family:inherit;font-size:.92rem;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
button:disabled{opacity:.5;cursor:default}
.link-box{margin-top:12px;background:#0e0e12;border:1px dashed var(--border);padding:9px;border-radius:6px;word-break:break-all;font-size:.78rem}
.copy-btn{margin-top:7px;background:var(--border);color:var(--fg)}
.grid{width:min(100%,360px);display:grid;gap:5px;margin:14px auto 10px}
.row{display:grid;gap:5px}
.cell{aspect-ratio:1;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.12rem;border-radius:4px;text-transform:uppercase}
.cell.correct{background:var(--correct);border-color:var(--correct)}
.cell.present{background:var(--present);border-color:var(--present)}
.cell.absent{background:var(--absent);border-color:var(--absent)}
.keyboard{margin:10px auto 0;display:flex;flex-direction:column;gap:5px;width:100%;max-width:500px}
.krow{display:flex;gap:4px;justify-content:center;width:100%}
.key{background:var(--border);color:var(--fg);border:none;border-radius:5px;padding:0;flex:1;min-width:0;height:48px;font-weight:bold;font-family:inherit;cursor:pointer;font-size:.78rem;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.key.wide{flex:1.55;font-size:.65rem}
.key.correct{background:var(--correct)}
.key.present{background:var(--present)}
.key.absent{background:var(--absent);color:#fff}
.msg{text-align:center;margin-top:9px;font-size:.88rem;min-height:1.2em}
a{color:var(--accent)}
.small{font-size:.7rem;color:var(--muted)}
.lock{position:fixed;bottom:10px;right:10px;width:36px;height:36px;border-radius:50%;background:var(--panel);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;cursor:pointer;user-select:none}
.lock-box{position:fixed;bottom:56px;right:10px;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px;width:190px;display:none;z-index:5}
.lock-box.open{display:block}.lock-box input{margin-bottom:7px}.lock-box button{padding:8px}.lock-reveal{font-size:.8rem;margin-top:7px;color:var(--fg);word-break:break-all}
@media(max-width:520px){body{padding:18px 9px}.panel{max-width:350px;padding:18px}.grid{width:min(100%,340px);gap:4px;margin-top:12px}.row{gap:4px}.cell{font-size:1rem}.keyboard{width:100%;gap:4px;margin-top:8px}.krow{gap:3px}.key{height:45px;font-size:.72rem;border-radius:6px}.key.wide{font-size:.6rem}.tag{margin-bottom:14px}}
@media(max-width:360px){.grid{width:min(100%,310px)}.key{height:42px;font-size:.66rem}.key.wide{font-size:.55rem}.panel{padding:16px}}
`;

function createPageHTML(){return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME — make one</title><style>${BASE_CSS}</style></head><body>
<h1>DATE ME</h1><div class="tag">// pick a word, send the link, watch them solve it</div>
<div class="panel"><input id="word" type="text" maxlength="12" placeholder="SECRET WORD" autocomplete="off" autocapitalize="characters" spellcheck="false"><button id="createBtn">CREATE LINK</button><div id="out"></div></div>
<div class="small" style="margin-top:12px">built by @chatpataprani</div>
<script>
const wordInput=document.getElementById('word'),createBtn=document.getElementById('createBtn');let creating=false;
async function createGame(){if(creating)return;creating=true;createBtn.disabled=true;const out=document.getElementById('out');out.innerHTML='';try{const res=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:wordInput.value})});const data=await res.json();if(data.error){out.innerHTML='<div class="msg">'+data.error+'</div>';return}out.innerHTML='<div class="link-box">'+data.link+'</div><button class="copy-btn" id="copyBtn">COPY LINK</button>';document.getElementById('copyBtn').onclick=()=>{navigator.clipboard.writeText(data.link);document.getElementById('copyBtn').textContent='COPIED!'}}finally{creating=false;createBtn.disabled=false}}
createBtn.onclick=createGame;wordInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createGame()}});
</script></body></html>`}

function playPageHTML(id,len){return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME</title><style>${BASE_CSS}</style></head><body>
<h1>DATE ME</h1><div class="tag">// solve the word · ${len} letters · 5 tries</div>
<div class="grid" id="grid"></div><div class="msg" id="msg"></div><div class="keyboard" id="keyboard"></div>
<div class="lock" id="lockBtn">⚙️</div><div class="lock-box" id="lockBox"><input id="lockKey" type="password" placeholder="PASSCODE"><button id="lockGo">SPILL IT 🫢</button><div class="lock-reveal" id="lockOut"></div></div>
<script>
const ID=${JSON.stringify(id)},LEN=${len},MAX=5;let row=0,col=0,board=Array.from({length:MAX},()=>Array(LEN).fill('')),done=false,submitting=false;
const grid=document.getElementById('grid');grid.style.gridTemplateRows='repeat('+MAX+',1fr)';
for(let r=0;r<MAX;r++){const rowEl=document.createElement('div');rowEl.className='row';rowEl.style.gridTemplateColumns='repeat('+LEN+',1fr)';for(let c=0;c<LEN;c++){const cell=document.createElement('div');cell.className='cell';cell.id='cell'+r+'-'+c;rowEl.appendChild(cell)}grid.appendChild(rowEl)}
const kb=document.getElementById('keyboard'),keyEls={};
function addKey(parent,label,action,wide=false){const b=document.createElement('button');b.type='button';b.className='key'+(wide?' wide':'');b.textContent=label;b.addEventListener('pointerdown',e=>{e.preventDefault();if(!b.disabled)action()},{passive:false});b.addEventListener('click',e=>e.preventDefault());parent.appendChild(b);if(label.length===1)keyEls[label]=b;return b}
['QWERTYUIOP','ASDFGHJKL'].forEach(chars=>{const krow=document.createElement('div');krow.className='krow';for(const ch of chars)addKey(krow,ch,()=>press(ch));kb.appendChild(krow)});
const last=document.createElement('div');last.className='krow';const enterB=addKey(last,'ENTER',submit,true);for(const ch of 'ZXCVBNM')addKey(last,ch,()=>press(ch));const backB=addKey(last,'DEL',backspace,true);kb.appendChild(last);
function press(ch){if(done||submitting||col>=LEN)return;board[row][col]=ch;document.getElementById('cell'+row+'-'+col).textContent=ch;col++}
function backspace(){if(done||submitting||col<=0)return;col--;board[row][col]='';document.getElementById('cell'+row+'-'+col).textContent=''}
async function submit(){if(done||submitting||col<LEN)return;submitting=true;enterB.disabled=true;backB.disabled=true;const guess=board[row].join('');try{const res=await fetch('/api/guess/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guess}),cache:'no-store'});const data=await res.json(),msg=document.getElementById('msg');if(data.error){msg.textContent=data.error;return}data.result.forEach((state,c)=>{const cell=document.getElementById('cell'+row+'-'+c);cell.classList.add(state);const k=keyEls[guess[c]];if(k&&!k.classList.contains('correct'))k.classList.add(state)});row++;col=0;if(data.solved){done=true;msg.textContent="YES. THAT'S THE WORD. 💌"}else if(data.exhausted){done=true;msg.textContent='YOU LOSE 💔 — no more tries.'}}finally{submitting=false;if(!done){enterB.disabled=false;backB.disabled=false}}}
document.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}else if(e.key==='Backspace'){e.preventDefault();backspace()}else if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();press(e.key.toUpperCase())}});
const lockBtn=document.getElementById('lockBtn'),lockBox=document.getElementById('lockBox');lockBtn.addEventListener('pointerdown',e=>{e.preventDefault();lockBox.classList.toggle('open')},{passive:false});document.getElementById('lockGo').addEventListener('pointerdown',async e=>{e.preventDefault();const key=document.getElementById('lockKey').value,out=document.getElementById('lockOut');const res=await fetch('/api/reveal/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});const data=await res.json();out.textContent=data.error?data.error:'no cap, the word is: '+data.word},{passive:false});
</script></body></html>`}
function notFoundHTML(){return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body><h1>404</h1><div class="tag">that link doesn't exist</div></body></html>`}
app.listen(PORT,()=>console.log(`DATE WORDLE running on port ${PORT}`));