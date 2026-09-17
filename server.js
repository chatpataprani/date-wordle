// ============================================================
// DATE WORDLE — single-file app by @chatpataprani
// Anyone creates a secret word -> gets a link -> other person
// solves it Wordle-style. A corner lock on the play page lets
// anyone with a passcode reveal that game's word.
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

const ADMIN_KEYS = [
  process.env.ADMIN_KEY_1 || "change-me-1",
  process.env.ADMIN_KEY_2 || "change-me-2",
];

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return {}; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function evaluate(guess, answer) {
  const g = guess.split("");
  const a = answer.split("");
  const result = new Array(g.length).fill("absent");
  const remaining = {};
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) result[i] = "correct";
    else remaining[a[i]] = (remaining[a[i]] || 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === "correct") continue;
    if (remaining[g[i]] > 0) { result[i] = "present"; remaining[g[i]]--; }
  }
  return result;
}
function genId() { return crypto.randomBytes(4).toString("hex"); }

app.get("/", (req, res) => res.send(createPageHTML()));
app.get("/play/:id", (req, res) => {
  const db = loadDB();
  const game = db[req.params.id];
  if (!game) return res.status(404).send(notFoundHTML());
  res.send(playPageHTML(req.params.id, game.word.length));
});

app.post("/api/create", (req, res) => {
  const word = String(req.body.word || "").trim().toUpperCase();
  if (!/^[A-Z]{3,12}$/.test(word)) return res.status(400).json({ error: "Word must be 3-12 letters, A-Z only, no spaces." });
  const id = genId();
  const db = loadDB();
  db[id] = { word, createdAt: Date.now(), solved: false, solvedAt: null, guesses: [] };
  saveDB(db);
  res.json({ id, link: `${req.protocol}://${req.get("host")}/play/${id}` });
});

app.post("/api/guess/:id", (req, res) => {
  const db = loadDB();
  const game = db[req.params.id];
  if (!game) return res.status(404).json({ error: "Game not found." });
  if (game.solved) return res.json({ result: null, solved: true, attemptsLeft: 0 });
  if (game.guesses.length >= MAX_ATTEMPTS) return res.json({ result: null, solved: false, exhausted: true, attemptsLeft: 0 });

  const guess = String(req.body.guess || "").trim().toUpperCase();
  if (guess.length !== game.word.length || !/^[A-Z]+$/.test(guess)) return res.status(400).json({ error: `Guess must be ${game.word.length} letters.` });

  const result = evaluate(guess, game.word);
  const solved = guess === game.word;
  game.guesses.push({ guess, result, at: Date.now() });
  game.solved = solved;
  if (solved) game.solvedAt = Date.now();
  saveDB(db);

  const attemptsLeft = MAX_ATTEMPTS - game.guesses.length;
  const exhausted = !solved && attemptsLeft === 0;

  // Never send the secret word to the player. This prevents cheating after the fifth try.
  res.json({ result, solved, exhausted, attemptsLeft });
});

app.post("/api/reveal/:id", (req, res) => {
  const key = String(req.body.key || "");
  if (!ADMIN_KEYS.includes(key)) return res.status(401).json({ error: "Wrong passcode." });
  const db = loadDB();
  const game = db[req.params.id];
  if (!game) return res.status(404).json({ error: "Game not found." });
  res.json({ word: game.word });
});

const BASE_CSS = `
  :root{--bg:#0e0e12;--panel:#17171d;--border:#2a2a33;--fg:#eee;--muted:#8a8a95;--correct:#4caf6d;--present:#c9a227;--absent:#c0392b;--accent:#ff5d8f;}
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--fg);font-family:'Courier New',monospace;margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px;}
  h1{letter-spacing:.15em;font-size:1.6rem;margin-bottom:4px}
  .tag{color:var(--muted);font-size:.85rem;margin-bottom:24px}
  .panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:28px;max-width:500px;width:100%;}
  input[type=text],input[type=password]{width:100%;background:#0e0e12;border:1px solid var(--border);color:var(--fg);padding:18px 14px;border-radius:8px;font-family:inherit;font-size:1.15rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;min-height:58px;}
  button{width:100%;background:var(--accent);color:#111;border:none;padding:12px;border-radius:6px;font-weight:bold;font-family:inherit;font-size:1rem;cursor:pointer;}
  button:disabled{opacity:.5;cursor:default}
  .link-box{margin-top:16px;background:#0e0e12;border:1px dashed var(--border);padding:10px;border-radius:6px;word-break:break-all;font-size:.85rem;}
  .copy-btn{margin-top:8px;background:var(--border);color:var(--fg)}
  .grid{display:grid;gap:6px;margin:20px 0;}
  .row{display:grid;gap:6px;}
  .cell{aspect-ratio:1;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.3rem;border-radius:4px;text-transform:uppercase;}
  .cell.correct{background:var(--correct);border-color:var(--correct)}
  .cell.present{background:var(--present);border-color:var(--present)}
  .cell.absent{background:var(--absent);border-color:var(--absent)}
  .keyboard{margin-top:20px;display:flex;flex-direction:column;gap:6px;width:100%;max-width:420px}
  .krow{display:flex;gap:5px;justify-content:center}
  .key{background:var(--border);color:var(--fg);border:none;border-radius:4px;padding:12px 0;flex:1;font-weight:bold;font-family:inherit;cursor:pointer;font-size:.85rem;}
  .key.wide{flex:1.6;font-size:.7rem}
  .key.correct{background:var(--correct)}
  .key.present{background:var(--present)}
  .key.absent{background:var(--absent);color:#fff}
  .msg{text-align:center;margin-top:16px;font-size:.95rem;min-height:1.2em}
  a{color:var(--accent)}
  .small{font-size:.75rem;color:var(--muted)}
  .lock{position:fixed;bottom:14px;right:14px;width:38px;height:38px;border-radius:50%;background:var(--panel);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.1rem;cursor:pointer;user-select:none;}
  .lock-box{position:fixed;bottom:60px;right:14px;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px;width:200px;display:none;}
  .lock-box.open{display:block}
  .lock-box input{margin-bottom:8px}
  .lock-box button{padding:8px}
  .lock-reveal{font-size:.85rem;margin-top:8px;color:var(--fg);word-break:break-all}
`;

function createPageHTML() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DATE ME — make one</title><style>${BASE_CSS}</style></head><body>
  <h1>DATE ME</h1><div class="tag">// pick a word, send the link, watch them solve it</div>
  <div class="panel"><input id="word" type="text" maxlength="12" placeholder="SECRET WORD"><button id="createBtn">CREATE LINK</button><div id="out"></div></div>
  <div class="small" style="margin-top:16px">built by @chatpataprani</div>
<script>
document.getElementById('createBtn').onclick = async () => {
  const word=document.getElementById('word').value, out=document.getElementById('out'); out.innerHTML='';
  const res=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word})});
  const data=await res.json();
  if(data.error){out.innerHTML='<div class="msg">'+data.error+'</div>';return;}
  out.innerHTML='<div class="link-box" id="link">'+data.link+'</div><button class="copy-btn" id="copyBtn">COPY LINK</button>';
  document.getElementById('copyBtn').onclick=()=>{navigator.clipboard.writeText(data.link);document.getElementById('copyBtn').textContent='COPIED!';};
};
</script></body></html>`;
}

function playPageHTML(id, len) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DATE ME</title><style>${BASE_CSS}</style></head><body>
  <h1>DATE ME</h1><div class="tag">// solve the word · ${len} letters · 5 tries</div>
  <div class="grid" id="grid"></div><div class="msg" id="msg"></div><div class="keyboard" id="keyboard"></div>
  <div class="lock" id="lockBtn">⚙️</div><div class="lock-box" id="lockBox"><input id="lockKey" type="password" placeholder="PASSCODE"><button id="lockGo">SPILL IT 🫢</button><div class="lock-reveal" id="lockOut"></div></div>
<script>
const ID=${JSON.stringify(id)}, LEN=${len}, MAX=5;
let row=0,col=0,board=Array.from({length:MAX},()=>Array(LEN).fill('')),done=false;
const grid=document.getElementById('grid'); grid.style.gridTemplateRows='repeat('+MAX+',1fr)';
for(let r=0;r<MAX;r++){const rowEl=document.createElement('div');rowEl.className='row';rowEl.id='row'+r;rowEl.style.gridTemplateColumns='repeat('+LEN+',1fr)';for(let c=0;c<LEN;c++){const cell=document.createElement('div');cell.className='cell';cell.id='cell'+r+'-'+c;rowEl.appendChild(cell);}grid.appendChild(rowEl);}
const kb=document.getElementById('keyboard'),keyEls={};
['QWERTYUIOP','ASDFGHJKL'].forEach(r=>{const krow=document.createElement('div');krow.className='krow';r.split('').forEach(ch=>{const b=document.createElement('button');b.className='key';b.textContent=ch;b.onclick=()=>press(ch);krow.appendChild(b);keyEls[ch]=b;});kb.appendChild(krow);});
const lastRow=document.createElement('div');lastRow.className='krow';const enterB=document.createElement('button');enterB.className='key wide';enterB.textContent='ENTER';enterB.onclick=submit;lastRow.appendChild(enterB);
'ZXCVBNM'.split('').forEach(ch=>{const b=document.createElement('button');b.className='key';b.textContent=ch;b.onclick=()=>press(ch);lastRow.appendChild(b);keyEls[ch]=b;});
const backB=document.createElement('button');backB.className='key wide';backB.textContent='DEL';backB.onclick=backspace;lastRow.appendChild(backB);kb.appendChild(lastRow);
function press(ch){if(done||col>=LEN)return;board[row][col]=ch;document.getElementById('cell'+row+'-'+col).textContent=ch;col++;}
function backspace(){if(done||col<=0)return;col--;board[row][col]='';document.getElementById('cell'+row+'-'+col).textContent='';}
async function submit(){
  if(done||col<LEN)return;
  const guess=board[row].join('');
  const res=await fetch('/api/guess/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guess})});
  const data=await res.json(),msg=document.getElementById('msg');
  if(data.error){msg.textContent=data.error;return;}
  data.result.forEach((r,c)=>{const cell=document.getElementById('cell'+row+'-'+c);cell.classList.add(r);const k=keyEls[guess[c]];if(k&&!k.classList.contains('correct'))k.classList.add(r);});
  row++;col=0;
  if(data.solved){done=true;msg.innerHTML="YES. THAT'S THE WORD. 💌";}
  else if(data.exhausted){done=true;msg.innerHTML="YOU LOSE 💔 — no more tries.";}
}
document.addEventListener('keydown',e=>{if(e.key==='Enter')submit();else if(e.key==='Backspace')backspace();else if(/^[a-zA-Z]$/.test(e.key))press(e.key.toUpperCase());});
const lockBtn=document.getElementById('lockBtn'),lockBox=document.getElementById('lockBox');lockBtn.onclick=()=>lockBox.classList.toggle('open');
document.getElementById('lockGo').onclick=async()=>{const key=document.getElementById('lockKey').value,out=document.getElementById('lockOut');const res=await fetch('/api/reveal/'+ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});const data=await res.json();out.textContent=data.error?data.error:('no cap, the word is: '+data.word);};
</script></body></html>`;
}

function notFoundHTML(){return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body><h1>404</h1><div class="tag">that link doesn't exist</div></body></html>`;}

app.listen(PORT,()=>console.log(`DATE WORDLE running on port ${PORT}`));