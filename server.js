const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '20kb' }));

const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'games.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const SOLO = {
  easy: ['CAT','DOG','SUN','MOON','LOVE','DATE','CAKE','STAR','HOME','BLUE','PINK','BEAR','BOOK','RAIN','FIRE','TREE','FISH','GAME','GIFT','SMILE'],
  medium: ['HEART','BEACH','DREAM','PARTY','HONEY','MUSIC','SWEET','LIGHT','MAGIC','MOVIE','CLOUD','CHILL','FLAME','TIGER','RIVER','CANDY','LAUGH','PHONE','NIGHT','SPACE'],
  hard: ['JOURNEY','WHISPER','FANTASY','ROMANCE','SUNRISE','MIDNIGHT','CRYSTAL','FOREVER','PASSION','THUNDER','MYSTERY','CHARMER','KINGDOM','RAINBOW','SERIOUS','PUZZLES','TWILIGHT','ADVENTURE','TREASURE','WONDERFUL']
};

const ALMOST = [
  'BRO YOU WERE ONE LETTER AWAY 😭',
  'NAHHH THAT WAS CLOSE 💀',
  'THE WORD IS BEGGING YOU TO GET IT 😭'
];

function db() {
  if (!fs.existsSync(DB)) return {};
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; }
}
function save(data) { fs.writeFileSync(DB, JSON.stringify(data, null, 2)); }
function makeId() { return crypto.randomBytes(6).toString('hex'); }
function clean(value, max = 220) { return String(value ?? '').trim().slice(0, max); }
function makeSlug(value) { return clean(value, 24).toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attemptsFor(mode) { return mode === 'hard' ? 3 : mode === 'chill' ? 7 : 5; }

function evaluate(word, guess) {
  const result = Array(word.length).fill('absent');
  const left = {};
  for (let i = 0; i < word.length; i++) {
    if (guess[i] === word[i]) result[i] = 'correct';
    else left[word[i]] = (left[word[i]] || 0) + 1;
  }
  for (let i = 0; i < word.length; i++) {
    if (result[i] !== 'correct' && left[guess[i]] > 0) {
      result[i] = 'present';
      left[guess[i]]--;
    }
  }
  return result;
}

function findGame(key) {
  const games = db();
  const raw = clean(key, 120).replace(/^https?:\/\/[^/]+\/play\//, '').split('/')[0];
  return games[raw] || Object.values(games).find(g => g.id === raw || g.slug === raw);
}
function updateGame(game) {
  const games = db();
  games[game.id] = game;
  save(games);
}
function adminAuth(password) { return !!ADMIN_PASSWORD && password === ADMIN_PASSWORD; }

const CSS = `
*{box-sizing:border-box}body{background:#0e0e12;color:#eee;font-family:monospace;margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:18px 8px 28px}h1{letter-spacing:.15em;margin:0 0 5px;text-align:center}.tag,.small{color:#888;font-size:.76rem;text-align:center}.panel,.card,.result{background:#17171d;border:1px solid #2a2a33;border-radius:12px;padding:18px;width:min(100%,390px)}input,select,button{font:inherit}input,select{width:100%;background:#0e0e12;color:#eee;border:1px solid #2a2a33;border-radius:7px;padding:12px;margin:7px 0;min-height:46px}button{width:100%;border:0;border-radius:7px;padding:11px;background:#ff5d8f;color:#111;font-weight:bold;cursor:pointer;margin-top:7px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}button:disabled{opacity:.55}.options{margin-top:10px;border-top:1px solid #2a2a33;padding-top:10px}.option{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#aaa;font-size:.75rem;margin:8px 0}.option input[type=checkbox]{width:auto;min-height:0}.grid{display:grid;gap:2px;width:min(100%,270px);margin:10px auto}.row{display:grid;gap:2px}.cell{aspect-ratio:1;border:1.5px solid #2a2a33;border-radius:3px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:.85rem}.correct{background:#4caf6d!important;border-color:#4caf6d!important}.present{background:#c9a227!important;border-color:#c9a227!important}.absent{background:#3b3b42!important;border-color:#3b3b42!important}.keyboard{width:min(100%,440px);display:flex;flex-direction:column;gap:3px;margin-top:4px}.krow{display:flex;gap:2px}.key{margin:0;background:#2a2a33;color:#eee;height:42px;padding:0;flex:1}.wide{flex:1.5;font-size:.62rem}.tools{display:flex;gap:6px;width:min(100%,440px)}.tools button{background:#2a2a33;color:#eee}.msg{text-align:center;min-height:1.3em;margin:8px}.settings{position:fixed;right:14px;top:18px;width:50px;height:50px;border-radius:50%;padding:0;margin:0;background:#25252d;color:#eee;font-size:25px;z-index:10}.modal{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px;z-index:20}.modal .panel{width:min(100%,360px);max-height:90vh;overflow:auto}.sharecard{width:min(100%,440px);background:#17171d;border:1px solid #34343f;border-radius:18px;padding:18px;margin-top:16px}.sharecard h2{margin:0 0 6px}.sharegrid{display:grid;gap:4px;margin:14px 0}.sharerow{display:grid;gap:4px}.sharecell{aspect-ratio:1;border-radius:4px}.shareplay{margin-top:12px;padding:12px;border-radius:10px;background:#0e0e12;text-align:center;color:#ff5d8f;font-weight:bold;word-break:break-all}a{color:#ff5d8f}
`;

function home() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME</title><style>${CSS}</style></head><body>
<h1>DATE ME</h1><div class="tag">// make a word, send the link, watch them struggle 😭</div>
<div class="panel">
<input id="name" placeholder="YOUR NAME" maxlength="32" autocomplete="off">
<input id="word" placeholder="SECRET WORD · 3-12 LETTERS" maxlength="12" autocomplete="off">
<button type="button" id="createBtn">CREATE LINK</button>
<details class="options"><summary>OPTIONAL EXTRAS ⚙️</summary>
<div class="option">Mode<select id="mode"><option value="normal">Normal · 5 tries</option><option value="hard">Hard · 3 tries</option><option value="chill">Chill · 7 tries</option></select></div>
<div class="option">Theme<select id="theme"><option value="classic">classic</option><option value="rose">rose</option><option value="neon">neon</option><option value="mint">mint</option><option value="amoled">amoled</option></select></div>
<div class="option">Roast<select id="roast"><option value="friendly">friendly</option><option value="savage" selected>savage</option><option value="disrespectful">Absolutely Disrespectful 💀</option></select></div>
<label class="option">Hints · costs 1 try <input id="hints" type="checkbox"></label>
<label class="option">Speed timer <input id="timer" type="checkbox"></label>
<label class="option">Reactions <input id="reactions" type="checkbox"></label>
<input id="slug" placeholder="CUSTOM LINK NAME (optional)" maxlength="24" autocomplete="off">
<input id="message" placeholder="SECRET MESSAGE (optional)" maxlength="220" autocomplete="off">
<input id="reward" placeholder="SECRET REWARD (optional)" maxlength="220" autocomplete="off">
</details><div id="out"></div></div>
<div class="small" style="margin-top:12px">or <a href="/solo">PLAY ALONE 🎮</a></div>
<script>
(() => {
  const $ = id => document.getElementById(id);
  const btn = $('createBtn'), out = $('out');
  $('word').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^a-z]/gi,'').toUpperCase(); });
  btn.addEventListener('click', async () => {
    const name = $('name').value.trim();
    const word = $('word').value.trim().toUpperCase();
    out.textContent = '';
    if (!name) { out.textContent = 'Please enter your name first.'; $('name').focus(); return; }
    if (!/^[A-Z]{3,12}$/.test(word)) { out.textContent = 'Secret word must be 3-12 letters.'; $('word').focus(); return; }
    btn.disabled = true; btn.textContent = 'CREATING...';
    try {
      const payload = {
        name, word, mode:$('mode').value, theme:$('theme').value, roastLevel:$('roast').value,
        hintsEnabled:$('hints').checked, timerEnabled:$('timer').checked, reactionsEnabled:$('reactions').checked,
        slug:$('slug').value, message:$('message').value, reward:$('reward').value
      };
      const response = await fetch('/api/create', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      const data = await response.json().catch(() => ({error:'Server returned an invalid response'}));
      if (!response.ok) throw new Error(data.error || 'Could not create the game');

      out.textContent = '';
      const label = document.createElement('div'); label.className='small'; label.textContent = '💌 ' + data.name + '’s link'; out.appendChild(label);
      const linkBox = document.createElement('div'); linkBox.className='card'; linkBox.style.cssText='margin-top:8px;word-break:break-all'; linkBox.textContent=data.link; out.appendChild(linkBox);
      const copy = document.createElement('button'); copy.type='button'; copy.textContent='COPY LINK';
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(data.link); copy.textContent='COPIED ✓'; } catch { copy.textContent='COPY FAILED'; } }); out.appendChild(copy);
      const open = document.createElement('a'); open.href=data.link; open.textContent='OPEN GAME 🎮'; open.style='display:block;text-align:center;margin-top:10px'; out.appendChild(open);
    } catch (e) { out.textContent = '❌ ' + e.message; }
    finally { btn.disabled=false; btn.textContent='CREATE LINK'; }
  });
})();
</script></body></html>`;
}

function soloPage() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>PLAY ALONE</title><style>${CSS}</style></head><body>
<h1>PLAY ALONE</h1><div class="tag">// choose your difficulty 🎮</div><div class="panel">
<button type="button" data-d="easy">🟢 EASY</button><button type="button" data-d="medium">🟡 MEDIUM</button><button type="button" data-d="hard">🔴 HARD</button><div id="msg" class="msg"></div></div><a href="/">← CREATE A LINK</a>
<script>
document.querySelectorAll('[data-d]').forEach(btn => btn.addEventListener('click', async () => {
  const msg=document.getElementById('msg'); document.querySelectorAll('[data-d]').forEach(b=>b.disabled=true); msg.textContent='picking a word... 👀';
  try { const r=await fetch('/api/solo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({difficulty:btn.dataset.d})}); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Could not start solo mode'); location.href=d.link; }
  catch(e){msg.textContent='❌ '+e.message;document.querySelectorAll('[data-d]').forEach(b=>b.disabled=false);}
}));
</script></body></html>`;
}

function playPage(g) {
  const name = g.solo ? 'Solo Mode' : g.name;
  const theme = g.theme || 'classic';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME — PLAY</title><style>${CSS}</style></head><body data-theme="${esc(theme)}">
<button type="button" class="settings" id="settings" aria-label="Settings">⚙️</button>
<h1>DATE ME</h1><div class="tag">${esc(name)} · ${g.word.length} letters · ${g.attempts} tries</div><div id="clock" class="tag"></div>
<div id="grid" class="grid"></div><div id="msg" class="msg">Type your guess below 👇</div><div id="keyboard" class="keyboard"></div>
<div class="tools"><button type="button" id="hint" ${g.hintsEnabled?'':'style="display:none"'}>💡 HINT · 1 TRY</button><button type="button" id="share">📤 SHARE GAME</button></div>
<div class="tools" id="reactionTools" ${g.reactionsEnabled?'':'style="display:none""><button type="button" data-react="😭">😭</button><button type="button" data-react="🗿">🗿</button><button type="button" data-react="🤯">🤯</button><button type="button" data-react="❤️">❤️</button></div><div id="reactionMsg" class="small"></div>
<script>
const ID=${JSON.stringify(g.id)}, LEN=${g.word.length}, MAX=${g.attempts}, HINT_ENABLED=${!!g.hintsEnabled}, TIMER=${!!g.timerEnabled}, NAME=${JSON.stringify(name)}, MESSAGE=${JSON.stringify(g.message||'')}, REWARD=${JSON.stringify(g.reward||'')};
let row=0,col=0,done=false,hintUsed=false,started=Date.now(),results=[];
const board=Array.from({length:MAX},()=>Array(LEN).fill('')), grid=document.getElementById('grid'), keyboard=document.getElementById('keyboard'), keys={};
for(let r=0;r<MAX;r++){const rr=document.createElement('div');rr.className='row';rr.style.gridTemplateColumns='repeat('+LEN+',1fr)';for(let c=0;c<LEN;c++){const cell=document.createElement('div');cell.className='cell';cell.id='cell-'+r+'-'+c;rr.appendChild(cell)}grid.appendChild(rr)}
function keyboardRow(){const r=document.createElement('div');r.className='krow';keyboard.appendChild(r);return r}
function key(parent,label,fn,wide){const b=document.createElement('button');b.type='button';b.className='key'+(wide?' wide':'');b.textContent=label;b.addEventListener('click',fn);parent.appendChild(b);if(label.length===1)keys[label]=b}
const k1=keyboardRow(),k2=keyboardRow(),k3=keyboardRow();
for(const c of 'QWERTYUIOP')key(k1,c,()=>press(c)); for(const c of 'ASDFGHJKL')key(k2,c,()=>press(c)); key(k3,'ENTER',submit,true); for(const c of 'ZXCVBNM')key(k3,c,()=>press(c)); key(k3,'DEL',back,true);
function press(c){if(done||col>=LEN)return;board[row][col]=c;document.getElementById('cell-'+row+'-'+col).textContent=c;col++}
function back(){if(done||col<=0)return;col--;board[row][col]='';document.getElementById('cell-'+row+'-'+col).textContent=''}
function setKeys(disabled){document.querySelectorAll('.key').forEach(b=>b.disabled=disabled)}
function feedback(result){const correct=result.filter(x=>x==='correct').length,present=result.filter(x=>x==='present').length;if(correct===LEN)return 'YOOOO YOU GOT IT 😭🔥';if(correct===LEN-1)return ALMOST[Math.floor(Math.random()*ALMOST.length)];if(present>=Math.max(1,Math.ceil(LEN/2)))return 'BRO YOU GOT THE LETTERS, JUST NOT THE ORDER 💀';return ''}
const ALMOST=${JSON.stringify(ALMOST)};
async function submit(){
 if(done||col!==LEN)return; const guess=board[row].join(''); setKeys(true);
 try{const r=await fetch('/api/guess/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guess})});const d=await r.json().catch(()=>({error:'Invalid server response'}));if(!r.ok)throw new Error(d.error||'Guess failed');
 results[row]=d.result; d.result.forEach((state,i)=>{document.getElementById('cell-'+row+'-'+i).classList.add(state);const k=keys[guess[i]];if(k){if(state==='correct')k.className='key correct';else if(state==='present'&&!k.classList.contains('correct'))k.className='key present';else if(state==='absent'&&!k.classList.contains('correct')&&!k.classList.contains('present'))k.className='key absent'}});
 document.getElementById('msg').textContent=d.feedback||feedback(d.result); if(d.solved||d.exhausted){finish(d,d.solved);return} row++;col=0;setKeys(false);
 }catch(e){document.getElementById('msg').textContent='❌ '+e.message;setKeys(false)}
}
function shareText(){return NAME+"'S DATE WORDLE\\nPlay: "+location.href}
async function shareGame(){const text=shareText();if(navigator.share){try{await navigator.share({title:'Date Wordle',text,url:location.href});return}catch(e){if(e.name==='AbortError')return}}try{await navigator.clipboard.writeText(text);document.getElementById('msg').textContent='📋 Share text copied!'}catch{prompt('Copy this:',text)}}
function makeCard(win,used,streak,word){const card=document.createElement('div');card.className='sharecard';let rows='';for(const r of results.slice(0,used)){if(!r)continue;rows+='<div class="sharerow" style="grid-template-columns:repeat('+LEN+',1fr)">'+r.map(s=>'<div class="sharecell" style="background:'+(s==='correct'?'#4caf6d':s==='present'?'#c9a227':'#3b3b42')+'"></div>').join('')+'</div>'}card.innerHTML='<h2>'+(win?'💌 '+esc(NAME)+' SOLVED DATE WORDLE':'💀 '+esc(NAME)+' GOT COOKED')+'</h2><div class="small">'+(win?used+'/'+MAX+' tries · 🔥 '+streak+' streak':'X/'+MAX+' tries')+'</div><div class="sharegrid">'+rows+'</div>'+(!win?'<div>🔑 The word was <b>'+esc(word)+'</b></div>':'')+(win&&MESSAGE?'<div>💌 '+esc(MESSAGE)+'</div>':'')+(win&&REWARD?'<div style="margin-top:6px">🎁 '+esc(REWARD)+'</div>':'')+'<div class="shareplay">🎮 PLAY THIS GAME<br><small>'+esc(location.href)+'</small></div>';document.body.appendChild(card);return card}
async function shareCard(card){if(!window.html2canvas)return shareGame();try{const canvas=await html2canvas(card,{backgroundColor:'#0e0e12',scale:2});const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image creation failed');const file=new File([blob],'date-wordle-result.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({title:'Date Wordle Result',text:shareText(),files:[file]});return}catch(e){if(e.name==='AbortError')return}}const a=document.createElement('a');a.download='date-wordle-result.png';a.href=URL.createObjectURL(blob);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){document.getElementById('msg').textContent='❌ '+e.message}}
function finish(d,win){
 done=true;setKeys(true);const old=Number(localStorage.getItem('dateStreak')||0),streak=win?old+1:0;localStorage.setItem('dateStreak',streak);const used=Math.min(row+1,MAX),box=document.createElement('div');box.className='result';
 box.innerHTML=win?'<b>💌 SOLVED!</b><div class="small">'+used+'/'+MAX+' tries · 🔥 '+streak+' streak</div>':'<b>💀 GAME OVER</b><div class="small">All '+MAX+' chances used 😭</div><div style="margin-top:8px">🔑 SECRET WORD: <b>'+esc(d.word||'')+'</b></div>';
 if(win&&d.message)box.innerHTML+='<div style="margin-top:8px">💌 '+esc(d.message)+'</div>';if(win&&d.reward)box.innerHTML+='<div style="margin-top:8px">🎁 '+esc(d.reward)+'</div>';document.body.appendChild(box);
 const card=makeCard(win,used,streak,d.word||'');const shareBtn=document.createElement('button');shareBtn.type='button';shareBtn.textContent='🖼️ SHARE RESULT CARD';shareBtn.onclick=()=>shareCard(card);const copyBtn=document.createElement('button');copyBtn.type='button';copyBtn.textContent='📋 COPY RESULT';copyBtn.onclick=async()=>{const text=NAME+' · '+(win?used+'/'+MAX:'X/'+MAX)+'\\n'+results.slice(0,used).filter(Boolean).map(a=>a.map(s=>s==='correct'?'🟩':s==='present'?'🟨':'⬛').join('')).join('\\n')+'\\n'+(!win?'🔑 WORD: '+(d.word||'')+'\\n':'')+'🎮 PLAY: '+location.href;try{await navigator.clipboard.writeText(text);copyBtn.textContent='COPIED ✓'}catch{prompt('Copy this:',text)}};box.appendChild(shareBtn);box.appendChild(copyBtn);card.scrollIntoView({behavior:'smooth',block:'center'})
}
async function hint(){if(done||hintUsed||!HINT_ENABLED)return;const p=prompt('Which letter position? (1-'+LEN+')');if(p===null)return;const index=Number(p)-1;if(!Number.isInteger(index)||index<0||index>=LEN)return;try{const r=await fetch('/api/hint/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Hint failed');hintUsed=true;document.getElementById('msg').textContent='💡 Position '+(index+1)+' is '+d.letter+' · 1 try used';row++;col=0;if(row>=MAX){done=true;finish({exhausted:true,word:d.word||''},false)}}catch(e){document.getElementById('msg').textContent='❌ '+e.message}}
async function react(v){try{const r=await fetch('/api/reaction/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reaction:v})});document.getElementById('reactionMsg').textContent=r.ok?'Reaction sent '+v:'❌ Reaction failed'}catch{document.getElementById('reactionMsg').textContent='❌ Reaction failed'}}
function openSettings(){const modal=document.createElement('div');modal.className='modal';modal.innerHTML='<div class="panel"><h2>⚙️ SETTINGS</h2><div class="small">Creator controls</div><input id="adminPassword" type="password" placeholder="ADMIN PASSWORD" autocomplete="off"><button type="button" id="unlock">UNLOCK</button><button type="button" id="closeSettings" style="background:#2a2a33;color:#eee">CLOSE</button><div id="adminResult" class="msg"></div></div>';document.body.appendChild(modal);modal.querySelector('#closeSettings').onclick=()=>modal.remove();modal.querySelector('#unlock').onclick=async()=>{const out=modal.querySelector('#adminResult'),password=modal.querySelector('#adminPassword').value;if(!password){out.textContent='Enter your admin password.';return}try{const r=await fetch('/api/admin/reveal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,key:ID})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unlock failed');out.innerHTML='🔑 SECRET WORD: <b>'+esc(d.word)+'</b><br><br>'+d.guesses+'/'+d.attempts+' tries used';const reset=document.createElement('button');reset.type='button';reset.textContent='🔄 RESET & TRY AGAIN';reset.onclick=async()=>{const rr=await fetch('/api/admin/reset/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const x=await rr.json();if(!rr.ok){out.textContent='❌ '+(x.error||'Reset failed');return}out.textContent='Reset ✓ Reloading...';setTimeout(()=>location.reload(),300)};out.appendChild(reset)}catch(e){out.textContent='❌ '+e.message}}}
document.getElementById('settings').addEventListener('click',openSettings);document.getElementById('share').addEventListener('click',shareGame);document.getElementById('hint').addEventListener('click',hint);document.querySelectorAll('[data-react]').forEach(b=>b.addEventListener('click',()=>react(b.dataset.react)));window.addEventListener('keydown',e=>{if(done||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Enter'){e.preventDefault();submit()}else if(e.key==='Backspace'){e.preventDefault();back()}else if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();press(e.key.toUpperCase())}});if(TIMER)setInterval(()=>{if(!done){const s=Math.floor((Date.now()-started)/1000);document.getElementById('clock').textContent='⏱ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}},250);
</script><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script></body></html>`;
}

app.get('/', (req,res) => res.send(home()));
app.get('/solo', (req,res) => res.send(soloPage()));
app.get('/play/:key', (req,res) => { const g=findGame(req.params.key); if(!g)return res.status(404).send('Game not found'); res.send(playPage(g)); });

app.post('/api/create', (req,res) => {
  const word=clean(req.body?.word,12).toUpperCase(), name=clean(req.body?.name,32);
  if(!name)return res.status(400).json({error:'Name is required'});
  if(!/^[A-Z]{3,12}$/.test(word))return res.status(400).json({error:'Secret word must be 3-12 letters'});
  const games=db(), custom=makeSlug(req.body?.slug);
  if(custom&&Object.values(games).some(g=>g.slug===custom))return res.status(409).json({error:'That custom link is already taken'});
  const gameId=makeId(), mode=['normal','hard','chill'].includes(req.body?.mode)?req.body.mode:'normal';
  const game={id:gameId,slug:custom||gameId,name,word,attempts:attemptsFor(mode),mode,theme:['classic','rose','neon','mint','amoled'].includes(req.body?.theme)?req.body.theme:'classic',roastLevel:['friendly','savage','disrespectful'].includes(req.body?.roastLevel)?req.body.roastLevel:'savage',hintsEnabled:!!req.body?.hintsEnabled,timerEnabled:!!req.body?.timerEnabled,reactionsEnabled:!!req.body?.reactionsEnabled,hintUsed:false,guesses:[],solved:false,exhausted:false,reaction:'',message:clean(req.body?.message),reward:clean(req.body?.reward),createdAt:new Date().toISOString()};
  games[gameId]=game;
  try{save(games)}catch(e){return res.status(500).json({error:'Could not save the game. Please try again.'})}
  const host=req.protocol+'://'+req.get('host');
  res.json({ok:true,name:game.name,link:host+'/play/'+game.slug,dashboard:host+'/dashboard/'+game.id});
});

app.post('/api/solo', (req,res) => {
  const difficulty=['easy','medium','hard'].includes(req.body?.difficulty)?req.body.difficulty:'easy';
  const words=SOLO[difficulty],word=words[Math.floor(Math.random()*words.length)],gameId=makeId(),games=db();
  const game={id:gameId,slug:'solo-'+gameId,name:'Solo Player',word,attempts:difficulty==='hard'?3:difficulty==='medium'?5:7,mode:difficulty,theme:'classic',roastLevel:'savage',hintsEnabled:false,timerEnabled:false,reactionsEnabled:true,hintUsed:false,guesses:[],solved:false,exhausted:false,reaction:'',message:'',reward:'',solo:true,createdAt:new Date().toISOString()};
  games[gameId]=game;try{save(games)}catch(e){return res.status(500).json({error:'Could not start solo mode'})}
  res.json({ok:true,link:req.protocol+'://'+req.get('host')+'/play/'+game.slug});
});

app.post('/api/guess/:id', (req,res) => {
  const g=findGame(req.params.id);if(!g)return res.status(404).json({error:'Game not found'});
  if(g.solved||g.exhausted)return res.status(400).json({error:'This game is already finished',word:g.word});
  const guess=clean(req.body?.guess,20).toUpperCase();
  if(!new RegExp('^[A-Z]{'+g.word.length+'}$').test(guess))return res.status(400).json({error:'Enter exactly '+g.word.length+' letters'});
  const result=evaluate(g.word,guess);g.guesses.push({guess,result,at:new Date().toISOString()});g.solved=guess===g.word;g.exhausted=!g.solved&&g.guesses.length>=g.attempts;
  try{updateGame(g)}catch(e){return res.status(500).json({error:'Could not save your guess'})}
  res.json({ok:true,result,solved:g.solved,exhausted:g.exhausted,feedback:g.solved?'YOOOO YOU GOT IT 😭🔥':result.filter(x=>x==='correct').length>=g.word.length-1?ALMOST[Math.floor(Math.random()*ALMOST.length)]:'',message:g.solved?g.message:'',reward:g.solved?g.reward:'',word:g.exhausted?g.word:undefined});
});

app.post('/api/hint/:id', (req,res) => {
  const g=findGame(req.params.id);if(!g||!g.hintsEnabled||g.hintUsed)return res.status(400).json({error:'Hint unavailable'});
  if(g.solved||g.exhausted)return res.status(400).json({error:'This game is already finished',word:g.word});
  const index=Number(req.body?.index);if(!Number.isInteger(index)||index<0||index>=g.word.length)return res.status(400).json({error:'Invalid position'});
  g.hintUsed=true;try{updateGame(g)}catch(e){return res.status(500).json({error:'Could not save hint'})}res.json({ok:true,letter:g.word[index],word:g.guesses.length+1>=g.attempts?g.word:undefined});
});

app.post('/api/reaction/:id', (req,res) => {
  const g=findGame(req.params.id);if(!g||!g.reactionsEnabled)return res.status(400).json({error:'Reactions disabled'});
  if(!['😭','🗿','🤯','❤️'].includes(req.body?.reaction))return res.status(400).json({error:'Invalid reaction'});
  g.reaction=req.body.reaction;try{updateGame(g)}catch(e){return res.status(500).json({error:'Could not save reaction'})}res.json({ok:true});
});

app.post('/api/admin/reveal',(req,res)=>{if(!adminAuth(req.body?.password))return res.status(401).json({error:'Wrong admin password'});const g=findGame(req.body?.key);if(!g)return res.status(404).json({error:'Game not found'});res.json({ok:true,id:g.id,name:g.name,word:g.word,guesses:g.guesses?.length||0,attempts:g.attempts,solved:g.solved,exhausted:g.exhausted,message:g.message,reward:g.reward})});
app.post('/api/admin/reset/:id',(req,res)=>{if(!adminAuth(req.body?.password))return res.status(401).json({error:'Wrong admin password'});const g=findGame(req.params.id);if(!g)return res.status(404).json({error:'Game not found'});g.guesses=[];g.solved=false;g.exhausted=false;g.hintUsed=false;g.reaction='';try{updateGame(g)}catch(e){return res.status(500).json({error:'Could not reset game'})}res.json({ok:true})});
app.get('/dashboard/:id',(req,res)=>res.send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+CSS+'</style><body><div class="panel"><h2>Creator dashboard</h2><p>Game ID: '+esc(req.params.id)+'</p><a href="/">← Home</a></div></body>'));
app.get('/health',(req,res)=>res.json({ok:true}));

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Internal server error'});});
app.listen(PORT,()=>console.log('Date Wordle running on '+PORT));
