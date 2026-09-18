const express=require('express');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');

const app=express();
app.use(express.json({limit:'30kb'}));

const PORT=process.env.PORT||3000;
const DB=path.join(__dirname,'games.json');
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';

const WORDS={
  easy:['CAT','DOG','SUN','MOON','LOVE','DATE','CAKE','STAR','HOME','BLUE','PINK','BEAR','BOOK','RAIN','FIRE','TREE','FISH','GAME','GIFT','SMILE'],
  medium:['HEART','BEACH','DREAM','PARTY','HONEY','MUSIC','SWEET','LIGHT','MAGIC','MOVIE','CLOUD','CHILL','FLAME','TIGER','RIVER','CANDY','LAUGH','PHONE','NIGHT','SPACE'],
  hard:['JOURNEY','WHISPER','FANTASY','ROMANCE','SUNRISE','MIDNIGHT','CRYSTAL','FOREVER','PASSION','THUNDER','MYSTERY','CHARMER','KINGDOM','RAINBOW','SERIOUS','PUZZLES','TWILIGHT','ADVENTURE','TREASURE','WONDERFUL']
};
const ALMOST=['BRO YOU WERE ONE LETTER AWAY 😭','NAHHH THAT WAS CLOSE 💀','THE WORD IS BEGGING YOU TO GET IT 😭'];

const CSS=`*{box-sizing:border-box}body{margin:0;background:#0e0e12;color:#eee;font-family:monospace;min-height:100vh;padding:18px 8px 30px;display:flex;flex-direction:column;align-items:center}h1{letter-spacing:.15em;margin:0 0 5px}.tag,.small{color:#888;font-size:.76rem;text-align:center}.panel,.result{width:min(100%,390px);background:#17171d;border:1px solid #2a2a33;border-radius:12px;padding:18px}input,select,button{font:inherit}input,select{width:100%;padding:12px;margin:7px 0;min-height:46px;background:#0e0e12;color:#eee;border:1px solid #2a2a33;border-radius:7px}button{border:0;border-radius:7px;padding:11px;background:#ff5d8f;color:#111;font-weight:bold;cursor:pointer;margin-top:7px;touch-action:manipulation}button:disabled{opacity:.55}.extras{margin-top:12px;border:1px solid #2a2a33;border-radius:12px;padding:12px;background:#111116}.extras summary{cursor:pointer;font-weight:bold;list-style:none}.extras summary::-webkit-details-marker{display:none}.extras summary:after{content:'＋';float:right;color:#ff5d8f}.extras[open] summary:after{content:'−'}.optionGrid{display:grid;grid-template-columns:1fr;gap:7px;margin:12px 0}.option{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid #2a2a33;border-radius:9px;background:#17171d;cursor:pointer}.option input{width:18px;height:18px;min-height:0;margin:0;accent-color:#ff5d8f}.option span{display:flex;flex-direction:column;gap:2px}.option small{color:#777;font-size:.68rem}.fieldLabel{display:block;color:#777;font-size:.68rem;margin:10px 0 4px}.grid{width:min(100%,260px);display:grid;gap:4px;margin:14px auto}.row{display:grid;gap:4px}.cell{aspect-ratio:1;border:1.5px solid #2a2a33;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:clamp(.72rem,4vw,.95rem);min-width:0}.correct{background:#4caf6d!important;border-color:#4caf6d!important}.present{background:#c9a227!important;border-color:#c9a227!important}.absent{background:#3b3b42!important;border-color:#3b3b42!important}.keyboard{width:min(100%,440px);display:flex;flex-direction:column;gap:3px}.krow{display:flex;gap:3px}.key{margin:0;background:#292931;color:#eee;height:42px;padding:0;flex:1}.wide{flex:1.5;font-size:.62rem}.tools{width:min(100%,440px);display:flex;gap:6px}.tools button{flex:1;background:#292931;color:#eee}.msg{text-align:center;min-height:22px;margin:8px}.settings{position:fixed;bottom:14px;right:14px;top:auto;width:50px;height:50px;border-radius:50%;padding:0;margin:0;background:#292931;color:#fff;font-size:24px;z-index:5}.modal{position:fixed;inset:0;background:#000c;display:flex;align-items:center;justify-content:center;padding:18px;z-index:20}.modal .panel{max-height:90vh;overflow:auto}.sharecard{width:min(100%,440px);background:#17171d;border:1px solid #34343f;border-radius:18px;padding:18px;margin-top:12px}.sharegrid{display:grid;gap:4px;margin:14px 0}.sharerow{display:grid;gap:4px}.sharecell{aspect-ratio:1;border-radius:4px}.shareplay{margin-top:12px;padding:12px;border-radius:10px;background:#0e0e12;color:#ff5d8f;font-weight:bold;word-break:break-all;text-align:center}a{color:#ff5d8f}`;

function db(){try{return fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):{}}catch{return{}}}
function save(data){fs.writeFileSync(DB,JSON.stringify(data,null,2))}
function id(){return crypto.randomBytes(6).toString('hex')}
function clean(v,n=220){return String(v??'').trim().slice(0,n)}
function tries(mode){return mode==='hard'?3:mode==='chill'?7:5}
function slug(v){return clean(v,24).toLowerCase().replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function getGame(key){const games=db(),k=clean(key,120).replace(/^https?:\/\/[^/]+\/play\//,'').split('/')[0];return games[k]||Object.values(games).find(g=>g.id===k||g.slug===k)}
function grade(word,guess){const out=Array(word.length).fill('absent'),left={};for(let i=0;i<word.length;i++){if(guess[i]===word[i])out[i]='correct';else left[word[i]]=(left[word[i]]||0)+1}for(let i=0;i<word.length;i++)if(out[i]!=='correct'&&left[guess[i]]>0){out[i]='present';left[guess[i]]--}return out}
function auth(password){return !!ADMIN_PASSWORD&&password===ADMIN_PASSWORD}

function home(){
return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME</title><style>${CSS}</style><body>
<h1>DATE ME</h1><div class="tag">// make a word, send the link, watch them struggle 😭</div>
<div class="panel">
<input id="name" placeholder="YOUR NAME" maxlength="32">
<input id="word" placeholder="SECRET WORD · 3-12 LETTERS" maxlength="12" autocomplete="off">
<button id="create" type="button">CREATE LINK</button>
<details class="extras"><summary>✨ OPTIONAL EXTRAS</summary>
<div class="optionGrid">
<label class="option"><input id="hints" type="checkbox"><span><b>💡 Hints</b><small>Costs 1 try</small></span></label>
<label class="option"><input id="timer" type="checkbox"><span><b>⏱ Speed timer</b><small>Shows a clock</small></span></label>
<label class="option"><input id="reactions" type="checkbox"><span><b>😂 Reactions</b><small>Let them react</small></span></label>
</div>
<label class="fieldLabel">DIFFICULTY</label>
<select id="mode"><option value="normal">Normal · 5 tries</option><option value="hard">Hard · 3 tries</option><option value="chill">Chill · 7 tries</option></select>
<label class="fieldLabel">CUSTOM LINK</label>
<input id="slug" placeholder="optional · e.g. date-me-123" maxlength="24">
<label class="fieldLabel">AFTER THEY WIN</label>
<input id="message" placeholder="💌 Secret message · optional" maxlength="220">
<input id="reward" placeholder="🎁 Secret reward · optional" maxlength="220">
</details><div id="out"></div></div>
<div class="small" style="margin-top:12px">or <a href="/solo">PLAY ALONE 🎮</a></div>
<script>
(()=>{const $=x=>document.getElementById(x),out=$('out'),btn=$('create');
$('word').addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase());
btn.addEventListener('click',async()=>{
 const name=$('name').value.trim(),word=$('word').value.trim().toUpperCase();
 if(!name){out.textContent='Enter your name.';return}
 if(!/^[A-Z]{3,12}$/.test(word)){out.textContent='Secret word must be 3-12 letters.';return}
 btn.disabled=true;out.textContent='CREATING...';
 try{
  const r=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   name,word,mode:$('mode').value,hintsEnabled:$('hints').checked,timerEnabled:$('timer').checked,
   reactionsEnabled:$('reactions').checked,slug:$('slug').value,message:$('message').value,reward:$('reward').value
  })});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Could not create link');
  out.innerHTML='<div class="result"><b>💌 LINK CREATED</b><br><br><span id="linkText"></span><button id="copy" type="button">COPY LINK</button><a id="open" style="display:block;text-align:center;margin-top:10px">OPEN GAME 🎮</a></div>';
  $('linkText').textContent=d.link;$('open').href=d.link;
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(d.link);$('copy').textContent='COPIED ✓'}catch{out.querySelector('#copy').textContent='COPY FAILED'}};
 }catch(e){out.textContent='❌ '+e.message}finally{btn.disabled=false}
});
})();
</script></body>`}

function solo(){
return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>PLAY ALONE</title><style>${CSS}</style><body>
<h1>PLAY ALONE</h1><div class="tag">// choose your difficulty 🎮</div><div class="panel">
<a href="/solo/start/easy"><button type="button">🟢 EASY</button></a>
<a href="/solo/start/medium"><button type="button">🟡 MEDIUM</button></a>
<a href="/solo/start/hard"><button type="button">🔴 HARD</button></a>
</div><a href="/">← CREATE A LINK</a></body>`}

function play(g){
const name=g.solo?'Solo Mode':g.name;
const client=`const ID=${JSON.stringify(g.id)},LEN=${g.word.length},MAX=${g.attempts},HINTS=${!!g.hintsEnabled},TIMER=${!!g.timerEnabled},REACTIONS=${!!g.reactionsEnabled},NAME=${JSON.stringify(name)},MESSAGE=${JSON.stringify(g.message||'')},REWARD=${JSON.stringify(g.reward||'')};
let row=0,col=0,done=false,start=Date.now(),hintUsed=false,hintIndex=null,results=[],guessHistory=[],lettersUsed=new Set();
const board=Array.from({length:MAX},()=>Array(LEN).fill(''));
const grid=document.getElementById('grid'),kb=document.getElementById('keyboard'),msg=document.getElementById('msg'),keys={};
function makeGrid(){grid.innerHTML='';row=0;col=0;for(let r=0;r<MAX;r++){const rr=document.createElement('div');rr.className='row';rr.style.gridTemplateColumns='repeat('+LEN+',1fr)';for(let c=0;c<LEN;c++){const x=document.createElement('div');x.className='cell';x.id='cell-'+r+'-'+c;rr.appendChild(x)}grid.appendChild(rr)}}
function addKey(parent,label,fn,wide){const b=document.createElement('button');b.type='button';b.className='key'+(wide?' wide':'');b.textContent=label;b.onclick=fn;parent.appendChild(b);if(label.length===1)keys[label]=b}
function makeKeyboard(){for(const letters of ['QWERTYUIOP','ASDFGHJKL']){const r=document.createElement('div');r.className='krow';kb.appendChild(r);for(const x of letters)addKey(r,x,()=>press(x))}const r=document.createElement('div');r.className='krow';kb.appendChild(r);addKey(r,'ENTER',submit,true);for(const x of 'ZXCVBNM')addKey(r,x,()=>press(x));addKey(r,'DEL',back,true)}
function press(ch){if(done||col>=LEN)return;board[row][col]=ch;document.getElementById('cell-'+row+'-'+col).textContent=ch;col++}
function back(){if(done||col<=0)return;col--;board[row][col]='';document.getElementById('cell-'+row+'-'+col).textContent=''}
function lock(v){document.querySelectorAll('.key').forEach(k=>k.disabled=v)}
function paint(guess,result){results[row]=result;result.forEach((state,i)=>{const cell=document.getElementById('cell-'+row+'-'+i);cell.classList.remove('correct','present','absent');cell.classList.add(state);const k=keys[guess[i]];if(k){if(state==='correct'){k.classList.remove('present','absent');k.classList.add('correct')}else if(state==='present'&&!k.classList.contains('correct')){k.classList.remove('absent');k.classList.add('present')}else if(state==='absent'&&!k.classList.contains('correct')&&!k.classList.contains('present'))k.classList.add('absent')}})}
async function submit(){if(done||col!==LEN)return;const guess=board[row].join('');lock(true);try{const r=await fetch('/api/guess/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guess})});const d=await r.json();if(!r.ok)throw Error(d.error||'Guess failed');paint(guess,d.result);guessHistory.push(guess);guess.split('').forEach(ch=>lettersUsed.add(ch));msg.textContent=d.feedback||'';if(d.solved||d.exhausted){finish(d,d.solved);return}row++;col=0;lock(false)}catch(e){msg.textContent='❌ '+e.message;lock(false)}}
function shareText(){const lines=results.filter(Boolean).map(a=>a.map(s=>s==='correct'?'🟩':s==='present'?'🟨':'⬛').join(''));return NAME+' — DATE ME\\n'+lines.join('\\n')+'\\n\\n💡 Hint used: '+(hintUsed?'YES':'NO')+'\\n🎮 '+location.href}
function canvaData(win){const guesses=guessHistory.map((g,i)=>(i+1)+'. '+g).join('\\n')||'None';const letters=[...lettersUsed].sort().join(' ')||'None';const grid=results.filter(Boolean).map(a=>a.map(s=>s==='correct'?'🟩':s==='present'?'🟨':'⬛').join('\\n')).join('\\n');return 'DATE WORDLE RESULT CARD\\nPlayer: '+NAME+'\\nResult: '+(win?'WON':'LOST')+'\\nAttempts: '+(win?Math.min(guessHistory.length,MAX):guessHistory.length)+'/'+MAX+'\\nHint used: '+(hintUsed?'YES':'NO')+(hintIndex!==null?' (position '+(hintIndex+1)+')':'')+'\\n\\nWords guessed:\\n'+guesses+'\\n\\nLetters used:\\n'+letters+'\\n\\nResult grid:\\n'+grid+'\\n\\nGame link: '+location.href}
async function shareGame(){const text='Play my DATE ME game 🎮 '+location.href;try{if(navigator.share){await navigator.share({title:'DATE ME',text,url:location.href});return}await navigator.clipboard.writeText(text);msg.textContent='📋 Game link copied!'}catch(e){if(e.name!=='AbortError')msg.textContent='❌ Share failed'}}
function finish(d,win){done=true;const used=guessHistory.length,box=document.createElement('div');box.className='result';box.innerHTML=win?'<b>💌 SOLVED!</b><div class="small">'+used+'/'+MAX+' tries</div>':'<b>💀 GAME OVER</b><div class="small">All '+MAX+' chances used</div>';if(win&&d.message)box.innerHTML+='<div style="margin-top:8px">💌 '+d.message+'</div>';if(win&&d.reward)box.innerHTML+='<div style="margin-top:8px">🎁 '+d.reward+'</div>';box.innerHTML+='<div class="small" style="margin-top:10px">💡 Hint used: '+(hintUsed?'YES':'NO')+'</div><div class="small" style="margin-top:6px">📝 Words guessed: '+(guessHistory.join(', ')||'None')+'</div><div class="small" style="margin-top:6px">🔤 Letters used: '+([...lettersUsed].sort().join(' ')||'None')+'</div>';document.body.appendChild(box);const copy=document.createElement('button');copy.textContent='📋 COPY RESULT';copy.onclick=()=>navigator.clipboard?.writeText(shareText());box.appendChild(copy);const canva=document.createElement('button');canva.textContent='🎨 COPY CANVA CARD DATA';canva.onclick=async()=>{try{await navigator.clipboard.writeText(canvaData(win));canva.textContent='COPIED ✓';}catch{canva.textContent='COPY FAILED'}};box.appendChild(canva)}
async function hint(){if(done||!HINTS||hintUsed)return;try{const p=prompt('Which letter position? (1-'+LEN+')');if(p===null)return;const index=Number(p)-1;if(!Number.isInteger(index)||index<0||index>=LEN)throw Error('Invalid position');const r=await fetch('/api/hint/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index})});const d=await r.json();if(!r.ok)throw Error(d.error);hintUsed=true;hintIndex=index;msg.textContent='💡 Position '+(index+1)+' is '+d.letter+' · 1 try used';if(row<MAX-1){const hintRow=grid.children[row];if(hintRow)hintRow.querySelectorAll('.cell').forEach(x=>x.classList.add('absent'));row++;col=0}}catch(e){msg.textContent='❌ '+e.message}}
async function react(v){try{const r=await fetch('/api/reaction/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reaction:v})});msg.textContent=r.ok?'Reaction sent '+v:'❌ Reaction failed'}catch{msg.textContent='❌ Reaction failed'}}
function openSettings(){const m=document.createElement('div');m.className='modal';m.innerHTML='<div class="panel"><h2>⚙️ SETTINGS</h2><div class="small">Private creator controls</div><input id="ap" type="password" placeholder="ADMIN PASSWORD" autocomplete="off"><button id="unlock" type="button">UNLOCK</button><button id="close" type="button" style="background:#292931;color:#eee">CLOSE</button><div id="ao" class="msg"></div></div>';document.body.appendChild(m);m.querySelector('#close').onclick=()=>m.remove();m.querySelector('#unlock').onclick=async()=>{const out=m.querySelector('#ao');try{const r=await fetch('/api/admin/reveal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:m.querySelector('#ap').value,key:ID})});const d=await r.json();if(!r.ok)throw Error(d.error);out.innerHTML='🔑 SECRET WORD: <b>'+d.word+'</b><br>Guesses: '+d.guesses+' / '+d.attempts+'<br>Finished: '+(d.solved||d.exhausted?'Yes':'No');const reset=document.createElement('button');reset.textContent='🔄 RESET & TRY AGAIN';reset.onclick=async()=>{const rr=await fetch('/api/admin/reset/'+encodeURIComponent(ID),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:m.querySelector('#ap').value})});const x=await rr.json();out.textContent=rr.ok?'Reset ✓ Reloading...':'❌ '+x.error;if(rr.ok)setTimeout(()=>location.reload(),350)};out.appendChild(reset)}catch(e){out.textContent='❌ '+e.message}}}
makeGrid();makeKeyboard();
document.getElementById('shareGame').onclick=shareGame;document.getElementById('settings').onclick=openSettings;document.getElementById('hint')?.addEventListener('click',hint);document.querySelectorAll('[data-react]').forEach(b=>b.onclick=()=>react(b.dataset.react));
document.addEventListener('keydown',e=>{if(done||e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,textarea'))return;if(e.key==='Enter'){e.preventDefault();submit()}else if(e.key==='Backspace'){e.preventDefault();back()}else if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();press(e.key.toUpperCase())}});
if(TIMER)setInterval(()=>{if(!done){const s=Math.floor((Date.now()-start)/1000);document.getElementById('clock').textContent='⏱ '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}},250);
`;
return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>DATE ME — PLAY</title><style>${CSS}</style><body>
<button class="settings" id="settings" type="button" aria-label="Settings">⚙️</button>
<h1>DATE ME</h1><div class="tag">${esc(name)} · ${g.word.length} letters · ${g.attempts} tries</div>
<div id="clock" class="tag"></div><div id="grid" class="grid"></div><div id="msg" class="msg">Type your guess below 👇</div><div id="keyboard" class="keyboard"></div>
<div class="tools">${g.hintsEnabled?'<button id="hint" type="button">💡 HINT · 1 TRY</button>':''}<button id="shareGame" type="button">📤 SHARE GAME</button></div>
${g.reactionsEnabled?'<div class="tools"><button data-react="😭" type="button">😭</button><button data-react="🗿" type="button">🗿</button><button data-react="🤯" type="button">🤯</button><button data-react="❤️" type="button">❤️</button></div>':''}
<script>${client}</script></body>`}

app.get('/',(req,res)=>res.send(home()));
app.get('/solo',(req,res)=>res.send(solo()));
app.get('/solo/start/:difficulty',(req,res)=>{const d=['easy','medium','hard'].includes(req.params.difficulty)?req.params.difficulty:'easy';const word=WORDS[d][Math.floor(Math.random()*WORDS[d].length)];const game={id:id(),slug:'solo-'+id(),name:'Solo Player',word,attempts:d==='hard'?3:d==='medium'?5:7,solo:true,hintsEnabled:false,timerEnabled:false,reactionsEnabled:true,guesses:[],solved:false,exhausted:false,message:'',reward:''};const games=db();games[game.id]=game;save(games);res.redirect('/play/'+game.slug)});
app.get('/play/:key',(req,res)=>{const g=getGame(req.params.key);if(!g)return res.status(404).send('<h2>Game not found</h2><a href="/">Home</a>');res.send(play(g))});

app.post('/api/create',(req,res)=>{try{const name=clean(req.body?.name,32),word=clean(req.body?.word,12).toUpperCase();if(!name)return res.status(400).json({error:'Name is required'});if(!/^[A-Z]{3,12}$/.test(word))return res.status(400).json({error:'Secret word must be 3-12 letters'});const custom=slug(req.body?.slug);const games=db();if(custom&&Object.values(games).some(g=>g.slug===custom))return res.status(409).json({error:'That link name is already taken'});const game={id:id(),slug:custom||id(),name,word,attempts:tries(req.body?.mode),solo:false,hintsEnabled:!!req.body?.hintsEnabled,timerEnabled:!!req.body?.timerEnabled,reactionsEnabled:!!req.body?.reactionsEnabled,guesses:[],solved:false,exhausted:false,hintUsed:false,hintIndex:null,reaction:'',message:clean(req.body?.message),reward:clean(req.body?.reward),createdAt:new Date().toISOString()};games[game.id]=game;save(games);res.json({ok:true,name,link:req.protocol+'://'+req.get('host')+'/play/'+game.slug})}catch(e){res.status(500).json({error:'Could not save the game. Please try again.'})}});

app.post('/api/guess/:id',(req,res)=>{const games=db(),g=getGame(req.params.id);if(!g)return res.status(404).json({error:'Game not found'});if(g.solved||g.exhausted)return res.status(400).json({error:'Game already finished'});const guess=clean(req.body?.guess,20).toUpperCase();if(!new RegExp('^[A-Z]{'+g.word.length+'}$').test(guess))return res.status(400).json({error:'Enter exactly '+g.word.length+' letters'});const result=grade(g.word,guess);g.guesses.push(guess);g.solved=guess===g.word;g.exhausted=!g.solved&&g.guesses.length>=g.attempts;games[g.id]=g;save(games);res.json({ok:true,result,solved:g.solved,exhausted:g.exhausted,feedback:g.solved?'YOOOO YOU GOT IT 😭🔥':result.filter(x=>x==='correct').length>=g.word.length-1?ALMOST[Math.floor(Math.random()*ALMOST.length)]:'',message:g.solved?g.message:'',reward:g.solved?g.reward:''})});

app.post('/api/hint/:id',(req,res)=>{const games=db(),g=getGame(req.params.id);if(!g||!g.hintsEnabled)return res.status(400).json({error:'Hints are disabled'});if(g.hintUsed)return res.status(400).json({error:'Hint already used'});const index=Number(req.body?.index);if(!Number.isInteger(index)||index<0||index>=g.word.length)return res.status(400).json({error:'Invalid position'});g.hintUsed=true;g.hintIndex=index;games[g.id]=g;save(games);res.json({ok:true,letter:g.word[index],index})});
app.post('/api/reaction/:id',(req,res)=>{const games=db(),g=getGame(req.params.id);if(!g||!g.reactionsEnabled)return res.status(400).json({error:'Reactions disabled'});if(!['😭','🗿','🤯','❤️'].includes(req.body?.reaction))return res.status(400).json({error:'Invalid reaction'});g.reaction=req.body.reaction;games[g.id]=g;save(games);res.json({ok:true})});

app.post('/api/admin/reveal',(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({error:'Admin password is not configured in Render'});if(!auth(req.body?.password))return res.status(401).json({error:'Wrong admin password'});const g=getGame(req.body?.key);if(!g)return res.status(404).json({error:'Game not found'});res.json({ok:true,word:g.word,guesses:g.guesses.length,guessHistory:g.guesses,attempts:g.attempts,solved:g.solved,exhausted:g.exhausted,hintUsed:!!g.hintUsed,hintIndex:g.hintIndex??null,message:g.message,reward:g.reward})});
app.post('/api/admin/reset/:id',(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({error:'Admin password is not configured in Render'});if(!auth(req.body?.password))return res.status(401).json({error:'Wrong admin password'});const games=db(),g=getGame(req.params.id);if(!g)return res.status(404).json({error:'Game not found'});g.guesses=[];g.solved=false;g.exhausted=false;g.hintUsed=false;g.hintIndex=null;g.reaction='';games[g.id]=g;save(games);res.json({ok:true})});
app.get('/health',(req,res)=>res.json({ok:true}));
app.listen(PORT,()=>console.log('Date Wordle running on '+PORT));
