const express=require('express');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const sharp=require('sharp');

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
function xml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function resultCardSvg(g){
  const W=1080,H=1350,pad=56,inner=W-pad*2;
  const rows=g.guesses||[], max=g.attempts||5, len=g.word.length;
  const gradeRows=rows.map(x=>grade(g.word,x));
  const letters=[...new Set(rows.join('').split(''))].sort().join(' ');
  const status=g.solved?'YOU GOT IT!':'GAME OVER';
  const statusColor=g.solved?'#4ade80':'#ff5d8f';
  const escXml=xml;
  const text=(x,y,t,size=28,fill='#f4f4f5',weight=500,anchor='start')=>'<text x="'+x+'" y="'+y+'" font-family="Arial, sans-serif" font-size="'+size+'px" font-weight="'+weight+'" fill="'+fill+'" text-anchor="'+anchor+'">'+escXml(t)+'</text>';
  let out='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" rx="36" fill="#0d0f17"/>';
  out+='<circle cx="90" cy="86" r="24" fill="#c084fc" opacity=".25"/><circle cx="990" cy="120" r="34" fill="#ff5d8f" opacity=".16"/>';
  out+=text(pad,86,'DATE WORDLE',54,'#ffffff',800);
  out+=text(pad,130,'Same word. Different vibes.',24,'#c084fc',600);
  out+='<rect x="'+pad+'" y="170" width="'+inner+'" height="92" rx="22" fill="#171b27" stroke="#2c3344"/>';
  out+=text(pad+26,210,status,34,statusColor,800);out+=text(W-pad-26,210,'Attempts: '+rows.length+'/'+max,27,'#b8bfd0',700,'end');
  out+=text(pad+26,244,'Player: '+(g.solo?'Solo Player':g.name),22,'#a8adbd',500);
  const gridX=pad,gridY=294,cell=52,gap=8,gridW=len*cell+(len-1)*gap,gridH=max*cell+(max-1)*gap;
  out+='<rect x="'+gridX+'" y="'+(gridY-18)+'" width="'+(gridW+36)+'" height="'+(gridH+36)+'" rx="22" fill="#11151f" stroke="#252c3b"/>';
  for(let r=0;r<max;r++){
    for(let c=0;c<len;c++){
      const x=gridX+18+c*(cell+gap),y=gridY+r*(cell+gap);let fill='#262d3b';
      if(gradeRows[r]?.[c]==='correct')fill='#4ade80';else if(gradeRows[r]?.[c]==='present')fill='#facc15';else if(gradeRows[r]?.[c]==='absent')fill='#3f4655';
      out+='<rect x="'+x+'" y="'+y+'" width="'+cell+'" height="'+cell+'" rx="10" fill="'+fill+'"/>';
      if(rows[r]?.[c])out+=text(x+cell/2,y+36,rows[r][c],25,gradeRows[r][c]==='absent'?'#d9dce5':'#10131a',800,'middle');
    }
  }
  const infoX=pad+gridW+86,infoW=W-infoX-pad;
  out+='<rect x="'+infoX+'" y="'+(gridY-18)+'" width="'+infoW+'" height="'+Math.max(230,gridH+36)+'" rx="22" fill="#171b27" stroke="#2c3344"/>';
  out+=text(infoX+24,gridY+24,'GAME STATS',25,'#c084fc',800);
  out+=text(infoX+24,gridY+70,'Attempts',21,'#a8adbd');out+=text(W-pad-24,gridY+70,rows.length+'/'+max,22,'#fff',700,'end');
  out+=text(infoX+24,gridY+112,'Hint used',21,'#a8adbd');out+=text(W-pad-24,gridY+112,g.hintUsed?'YES':'NO',22,g.hintUsed?'#4ade80':'#fff',700,'end');
  out+=text(infoX+24,gridY+154,'Mode',21,'#a8adbd');out+=text(W-pad-24,gridY+154,(g.attempts===3?'Hard':g.attempts===7?'Chill':'Normal'),22,'#fff',700,'end');
  out+=text(infoX+24,gridY+196,'Letters used',21,'#a8adbd');
  const letterLines=(letters||'None').match(/.{1,13}/g)||['None'];letterLines.slice(0,5).forEach((l,i)=>out+=text(infoX+24,gridY+228+i*27,l,18,'#e5e7eb',600));
  const lowerY=gridY+gridH+48, boxW=(inner-20)/2;
  out+='<rect x="'+pad+'" y="'+lowerY+'" width="'+boxW+'" height="300" rx="22" fill="#171b27" stroke="#2c3344"/>';
  out+=text(pad+24,lowerY+42,'WORDS GUESSED',25,'#c084fc',800);
  rows.slice(0,7).forEach((w,i)=>out+=text(pad+28,lowerY+82+i*29,(i+1)+'. '+w,19,'#e5e7eb',600));
  const rightX=pad+boxW+20;
  out+='<rect x="'+rightX+'" y="'+lowerY+'" width="'+boxW+'" height="300" rx="22" fill="#171b27" stroke="#2c3344"/>';
  out+=text(rightX+24,lowerY+42,'MESSAGE & REWARD',25,'#c084fc',800);
  if(g.message)out+=text(rightX+24,lowerY+82,String(g.message).slice(0,42),18,'#f4f4f5',500);
  if(g.reward)out+=text(rightX+24,lowerY+128,'Reward: '+String(g.reward).slice(0,35),18,'#facc15',700);
  out+=text(rightX+24,lowerY+180,'GAME LINK',20,'#a8adbd',700);out+=text(rightX+24,lowerY+214,(('https://date-wordle.onrender.com/play/'+g.slug)).slice(0,48),16,'#c084fc',600);
  out+=text(W/2,H-74,'Made with ♥ Date Wordle · Same game. Different stories.',22,'#a8adbd',600,'middle');
  return out+'</svg>';
}

function home(){
return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0b10"><title>DATE WORDLE</title><style>
${CSS}
:root{--pink:#ff5d8f;--purple:#a78bfa;--bg:#0b0b10;--panel:#13131a;--panel2:#181821;--line:#292936;--muted:#858594}
body{background:radial-gradient(circle at 50% -10%,#241522 0,#0b0b10 38%),var(--bg);padding:0 14px 40px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.home{width:min(100%,760px);margin:0 auto;padding-top:34px}
.hero{text-align:center;padding:18px 8px 24px}
.logo{display:inline-flex;align-items:center;gap:9px;padding:7px 11px;border:1px solid #353541;border-radius:999px;background:#111118;color:#aaa;font-size:.68rem;letter-spacing:.16em}
.hero h1{font-family:system-ui,sans-serif;font-size:clamp(2.2rem,10vw,4.4rem);line-height:.95;letter-spacing:-.07em;margin:18px 0 10px;background:linear-gradient(100deg,#fff 35%,#ff7ca4 65%,#b69cff);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:0 auto;color:#92929f;font-family:system-ui,sans-serif;font-size:.95rem;max-width:500px;line-height:1.5}
.shell{background:rgba(19,19,26,.92);border:1px solid #292936;border-radius:24px;box-shadow:0 24px 80px #0008;overflow:hidden}
.tabs{display:grid;grid-template-columns:1fr 1fr;padding:7px;background:#0f0f15;border-bottom:1px solid #292936}
.tabs button{margin:0;padding:13px 8px;border-radius:15px;background:transparent;color:#777;font-size:.76rem}
.tabs button.active{background:#fff;color:#111;box-shadow:0 4px 18px #0006}
.panelInner{padding:24px}
.gamePanel{display:none}.gamePanel.active{display:block}
.kicker{color:#6f6f7d;font-size:.67rem;letter-spacing:.12em;margin-bottom:17px}
.sectionTitle{font-family:system-ui,sans-serif;font-size:1.45rem;font-weight:800;letter-spacing:-.03em;margin-bottom:5px}
.sectionSub{font-family:system-ui,sans-serif;color:#858594;font-size:.84rem;margin-bottom:20px}
.field{margin:12px 0}.field label{display:block;color:#8c8c99;font-size:.65rem;font-weight:bold;letter-spacing:.1em;margin:0 0 7px}
.field input,.field select{margin:0;background:#0d0d13;border-color:#30303c;border-radius:12px;height:50px}
.primary{width:100%;height:50px;border-radius:12px;margin-top:8px;background:linear-gradient(135deg,#ff5d8f,#ff769f);box-shadow:0 10px 28px #ff5d8f24}
.primary:hover{filter:brightness(1.05)}
.extras{margin-top:15px;background:#0e0e14;border:1px solid #292936;border-radius:15px;padding:0 14px}
.extras summary{padding:14px 0;color:#d8d8df;font-size:.72rem;letter-spacing:.04em}
.extras summary:after{content:'+'}.extras[open] summary:after{content:'−'}
.optionGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 14px}
.option{min-width:0;display:flex;align-items:flex-start;gap:8px;padding:12px;border:1px solid #292936;border-radius:11px;background:#16161e}
.option input{width:17px;height:17px;min-height:0;margin:1px 0 0;accent-color:var(--pink)}
.option b{font-size:.69rem}.option small{display:block;color:#70707d;font-size:.59rem;margin-top:3px;line-height:1.3}
.fieldLabel{display:block;color:#777;font-size:.63rem;letter-spacing:.08em;margin:10px 0 5px}
.codeInput{text-align:center;text-transform:uppercase;letter-spacing:.2em;font-weight:800}
.rankHero{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px;border:1px solid #302d42;background:linear-gradient(135deg,#181521,#12121a);border-radius:16px;margin-bottom:16px}
.rankIcon{font-size:1.7rem}.rankHero b{font-family:system-ui,sans-serif;font-size:1rem}.rankHero span{display:block;color:#858594;font-size:.68rem;margin-top:3px}
.divider{display:flex;align-items:center;gap:10px;color:#666;font-size:.62rem;margin:17px 0}.divider:before,.divider:after{content:'';height:1px;background:#292936;flex:1}
.result{margin-top:15px;padding:16px;border-radius:15px;background:#101018;border-color:#353543}
.resultTitle{font-family:system-ui,sans-serif;font-size:1rem}
.resultLink{display:block;margin:10px 0;padding:11px;border-radius:10px;background:#0a0a0f;color:#ff8aad;font-size:.68rem;word-break:break-all}
.resultActions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.resultActions button{margin:0;background:#292934;color:#fff}.resultActions a{display:flex;align-items:center;justify-content:center;border-radius:8px;background:#ff5d8f;color:#111;font-weight:bold;font-size:.72rem;text-decoration:none}
.notice{font-size:.7rem;color:#888;text-align:center;min-height:18px;margin-top:10px}
.footer{display:flex;justify-content:center;gap:15px;margin-top:17px;font-size:.68rem;color:#686875}.footer a{color:#a8a8b4}.footer a:hover{color:#ff7ca4}
@media(max-width:560px){.home{padding-top:20px}.panelInner{padding:18px}.hero{padding-bottom:20px}.optionGrid{grid-template-columns:1fr}.tabs button{font-size:.68rem}.shell{border-radius:19px}}
</style></head><body>
<main class="home">
<section class="hero"><div class="logo">✦ CHAT WITH A LITTLE CHAOS</div><h1>DATE WORDLE</h1><p>Make a secret word. Send the game. Let them prove they know you. 😭</p></section>
<section class="shell">
<nav class="tabs"><button id="dateTab" class="active" type="button">🎯 DATE WORDLE</button><button id="rankedTab" type="button">👫 US, RANKED</button></nav>
<div class="panelInner">
<div id="datePanel" class="gamePanel active">
<div class="kicker">// CREATE A PRIVATE PUZZLE</div><div class="sectionTitle">Give them a word to guess.</div><div class="sectionSub">You choose the word. They get the challenge.</div>
<div class="field"><label>YOUR NAME</label><input id="name" placeholder="e.g. Alex" maxlength="32" autocomplete="name"></div>
<div class="field"><label>SECRET WORD</label><input id="word" placeholder="3–12 LETTERS" maxlength="12" autocomplete="off"></div>
<button id="create" class="primary" type="button">CREATE GAME ↗</button>
<details class="extras"><summary>OPTIONAL EXTRAS</summary>
<div class="optionGrid">
<label class="option"><input id="hints" type="checkbox"><span><b>💡 Hints</b><small>One position revealed · costs 1 try</small></span></label>
<label class="option"><input id="timer" type="checkbox"><span><b>⏱ Timer</b><small>Show how fast they solve it</small></span></label>
<label class="option"><input id="reactions" type="checkbox"><span><b>😂 Reactions</b><small>Let them react mid-game</small></span></label>
</div>
<label class="fieldLabel">DIFFICULTY</label><select id="mode"><option value="normal">Normal · 5 tries</option><option value="hard">Hard · 3 tries</option><option value="chill">Chill · 7 tries</option></select>
<label class="fieldLabel">CUSTOM LINK</label><input id="slug" placeholder="optional · date-with-me" maxlength="24">
<label class="fieldLabel">AFTER THEY WIN</label><input id="message" placeholder="💌 Secret message · optional" maxlength="220"><input id="reward" placeholder="🎁 Secret reward · optional" maxlength="220">
</details><div id="out"></div>
</div>
<div id="rankedPanel" class="gamePanel">
<div class="kicker">// TWO PEOPLE · ONE VERDICT</div>
<div class="rankHero"><div><b>US, RANKED</b><span>Pick each other. See if you're actually in sync.</span></div><div class="rankIcon">⚡</div></div>
<div class="field"><label>YOUR NAME</label><input id="rankedName" placeholder="e.g. Alex" maxlength="32" autocomplete="name"></div>
<button id="rankedCreate" class="primary" type="button">CREATE ROOM ↗</button>
<div class="divider">OR JOIN A ROOM</div>
<div class="field"><label>ROOM CODE</label><input id="rankedCode" class="codeInput" placeholder="ABC123" maxlength="12" autocomplete="off"></div>
<button id="rankedJoin" class="primary" type="button">JOIN ROOM →</button><div id="rankedOut" class="notice"></div>
</div>
</div></section>
<div class="footer"><a href="/solo">PLAY SOLO 🎮</a><span>·</span><span>DATE WORDLE</span></div>
</main>
<script>
(()=>{const $=x=>document.getElementById(x),out=$('out'),btn=$('create'),rankedOut=$('rankedOut');
function tab(which){const date=which==='date';$('datePanel').classList.toggle('active',date);$('rankedPanel').classList.toggle('active',!date);$('dateTab').classList.toggle('active',date);$('rankedTab').classList.toggle('active',!date)}
$('dateTab').onclick=()=>tab('date');$('rankedTab').onclick=()=>tab('ranked');
$('word').addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-z]/gi,'').toUpperCase());
$('rankedCode').addEventListener('input',e=>e.target.value=e.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase());
btn.addEventListener('click',async()=>{const name=$('name').value.trim(),word=$('word').value.trim().toUpperCase();if(!name){out.innerHTML='<div class="notice">Enter your name first.</div>';return}if(!/^[A-Z]{3,12}$/.test(word)){out.innerHTML='<div class="notice">Your secret word needs 3–12 letters.</div>';return}btn.disabled=true;out.innerHTML='<div class="notice">BUILDING YOUR GAME…</div>';try{const r=await fetch('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,word,mode:$('mode').value,hintsEnabled:$('hints').checked,timerEnabled:$('timer').checked,reactionsEnabled:$('reactions').checked,slug:$('slug').value,message:$('message').value,reward:$('reward').value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not create game');out.innerHTML='<div class="result"><div class="resultTitle">💌 Your game is ready.</div><div class="resultLink" id="linkText"></div><div class="resultActions"><button id="copy" type="button">COPY LINK</button><a id="open" target="_blank" rel="noopener">PLAY ↗</a></div></div>';$('linkText').textContent=d.link;$('open').href=d.link;$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(d.link);$('copy').textContent='COPIED ✓'}catch{$('copy').textContent='COPY FAILED'}}}catch(e){out.innerHTML='<div class="notice">❌ '+e.message+'</div>'}finally{btn.disabled=false}});
async function rankedJoin(code,name){const r=await fetch('/api/ranked/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not join room');return d}
$('rankedCreate').onclick=async()=>{const name=$('rankedName').value.trim();if(!name){rankedOut.textContent='Enter your name first.';return}$('rankedCreate').disabled=true;rankedOut.textContent='CREATING ROOM…';try{const r=await fetch('/api/ranked/room',{method:'POST'});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not create room');const j=await rankedJoin(d.code,name);location.href='/ranked?room='+encodeURIComponent(d.code)+'&pid='+encodeURIComponent(j.pid)+'&name='+encodeURIComponent(name)}catch(e){rankedOut.textContent='❌ '+e.message}finally{$('rankedCreate').disabled=false}};
$('rankedJoin').onclick=async()=>{const name=$('rankedName').value.trim(),code=$('rankedCode').value.trim().toUpperCase();if(!name){rankedOut.textContent='Enter your name first.';return}if(!/^[A-Z0-9]{6,12}$/.test(code)){rankedOut.textContent='Enter a valid room code.';return}$('rankedJoin').disabled=true;rankedOut.textContent='JOINING…';try{const j=await rankedJoin(code,name);location.href='/ranked?room='+encodeURIComponent(code)+'&pid='+encodeURIComponent(j.pid)+'&name='+encodeURIComponent(name)}catch(e){rankedOut.textContent='❌ '+e.message}finally{$('rankedJoin').disabled=false}};
})();
</script></body></html>`}
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
async function shareGame(){
 const text=NAME+' — DATE ME\\n'+results.filter(Boolean).map(a=>a.map(s=>s==='correct'?'🟩':s==='present'?'🟨':'⬛').join('')).join('\\n')+'\\n\\n💡 Hint used: '+(hintUsed?'YES':'NO')+'\\n🎮 Play: '+location.href;
 const pngUrl='/api/result-card/'+encodeURIComponent(ID)+'.png';
 try{
  if(navigator.share){
   try{
    const response=await fetch(pngUrl);
    if(response.ok){
     const blob=await response.blob();
     const file=new File([blob],'date-wordle-result.png',{type:'image/png'});
     if(!navigator.canShare || navigator.canShare({files:[file]})){await navigator.share({title:'DATE ME — Result',text,url:location.href,files:[file]});return}
    }
   }catch(e){if(e.name==='AbortError')return}
   await navigator.share({title:'DATE ME — Result',text,url:location.href});return
  }
  const link=document.createElement('a');link.href=pngUrl;link.download='date-wordle-result.png';document.body.appendChild(link);link.click();link.remove();
  try{await navigator.clipboard.writeText(text)}catch(e){}
  msg.textContent='🖼️ Result PNG downloaded · result text copied';
 }catch(e){if(e.name!=='AbortError')msg.textContent='❌ Share failed'}
}
function finish(d,win){done=true;const used=guessHistory.length,box=document.createElement('div');box.className='result';box.innerHTML=win?'<b>💌 SOLVED!</b><div class="small">'+used+'/'+MAX+' tries</div>':'<b>💀 GAME OVER</b><div class="small">All '+MAX+' chances used</div>';if(win&&d.message)box.innerHTML+='<div style="margin-top:8px">💌 '+d.message+'</div>';if(win&&d.reward)box.innerHTML+='<div style="margin-top:8px">🎁 '+d.reward+'</div>';box.innerHTML+='<div class="small" style="margin-top:10px">💡 Hint used: '+(hintUsed?'YES':'NO')+'</div><div class="small" style="margin-top:6px">📝 Words guessed: '+(guessHistory.join(', ')||'None')+'</div><div class="small" style="margin-top:6px">🔤 Letters used: '+([...lettersUsed].sort().join(' ')||'None')+'</div>';document.body.appendChild(box);const share=document.createElement('button');share.textContent='📤 SHARE RESULT';share.onclick=shareGame;box.appendChild(share)}
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
app.get('/api/result-card/:id.png',async(req,res)=>{try{const g=getGame(req.params.id);if(!g)return res.status(404).json({error:'Game not found'});if(!g.solved&&!g.exhausted)return res.status(400).json({error:'Finish the game before creating a result card'});const png=await sharp(Buffer.from(resultCardSvg(g))).png().toBuffer();res.set('Content-Type','image/png');res.set('Content-Disposition','inline; filename="date-wordle-result.png"');res.send(png)}catch(e){console.error('result-card',e);res.status(500).json({error:'Could not generate result image'})}});
app.get('/health',(req,res)=>res.json({ok:true}));

// ===== US, RANKED — added as a separate game, does not touch anything above =====
const RANKED_PROMPTS=[
 "Who's more likely to cry at a movie",
 "Who'd survive longer in a zombie apocalypse",
 "Who takes longer to get ready",
 "Who's more likely to forget an anniversary",
 "Who'd win in a cooking battle",
 "Who's the better liar",
 "Who's more likely to cry over a pet video",
 "Who'd last longer without their phone",
 "Who's more stubborn",
 "Who's more likely to start a business on a whim",
 "Who's the better driver",
 "Who'd panic first in an emergency",
 "Who's more likely to fall asleep during a movie",
 "Who's the bigger overthinker",
 "Who'd win an argument with a stranger",
 "Who's more likely to cry laughing",
 "Who's the messier one",
 "Who'd adapt better to living abroad",
 "Who's more likely to ghost a group chat",
 "Who gives better advice"
];
const rankedRooms={};
function pickRankedPrompt(room){
 const used=room.history.map(h=>h.prompt);
 const pool=RANKED_PROMPTS.filter(p=>!used.includes(p));
 const list=pool.length?pool:RANKED_PROMPTS;
 return list[Math.floor(Math.random()*list.length)];
}

app.post('/api/ranked/room',(req,res)=>{
 let code;
 do{code=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase()}while(rankedRooms[code]);
 rankedRooms[code]={players:{},order:[],history:[],current:null};
 res.json({code});
});

app.post('/api/ranked/join',(req,res)=>{
 const code=String(req.body?.code||'').trim().toUpperCase();
 const name=clean(req.body?.name,32);
 const room=rankedRooms[code];
 if(!room) return res.status(404).json({error:'room not found'});
 if(!name) return res.status(400).json({error:'name is required'});
 if(room.order.length>=2) return res.status(403).json({error:'room full'});
 if(room.order.some(pid=>room.players[pid]===name)) return res.status(409).json({error:'that name is already in the room'});
 const pid=id();
 room.players[pid]=name;
 room.order.push(pid);
 if(!room.current) room.current={prompt:pickRankedPrompt(room),picks:{}};
 res.json({pid,names:room.order.map(o=>room.players[o])});
});

app.get('/api/ranked/state/:code',(req,res)=>{
 const room=rankedRooms[req.params.code];
 if(!room) return res.status(404).json({error:'room not found'});
 const names=room.order.map(o=>room.players[o]);
 const bothPicked=room.current && room.order.length===2 && room.order.every(o=>room.current.picks[o]);
 res.json({
  names,
  roster:room.order.map(o=>({pid:o,name:room.players[o]})),
  ready:room.order.length===2,
  current:room.current?{prompt:room.current.prompt,revealed:bothPicked,
   picks: bothPicked ? room.order.map(o=>({name:room.players[o],chose:room.players[room.current.picks[o]]})) : {mine:null}
  }:null,
  history:room.history.map(h=>({
   prompt:h.prompt,
   picks:room.order.map(o=>({name:room.players[o],chose:room.players[h.picks[o]]})),
   match:room.order.every(o=>h.picks[o]===h.picks[room.order[0]])
  }))
 });
});

app.post('/api/ranked/pick',(req,res)=>{
 const {code,pid,choicePid}=req.body;
 const room=rankedRooms[String(code||'').trim().toUpperCase()];
 if(!room||!room.current) return res.status(404).json({error:'no room/round'});
 if(!room.players[pid]) return res.status(403).json({error:'invalid player'});
 if(!room.players[choicePid]) return res.status(400).json({error:'invalid choice'});
 if(room.order.length!==2) return res.status(400).json({error:'waiting for partner'});
 if(room.current.picks[pid]) return res.status(400).json({error:'you already picked'});
 room.current.picks[pid]=choicePid;
 if(room.order.every(o=>room.current.picks[o]) && !room.current.recorded){
  room.history.unshift({prompt:room.current.prompt,picks:{...room.current.picks}});
  room.current.recorded=true;
 }
 res.json({ok:true});
});

app.post('/api/ranked/next',(req,res)=>{
 const code=String(req.body?.code||'').trim().toUpperCase();
 const room=rankedRooms[code];
 if(!room) return res.status(404).json({error:'room not found'});
 if(room.order.length!==2 || !room.current || !room.order.every(o=>room.current.picks[o])) return res.status(400).json({error:'both players must pick first'});
 if(room.current.nextStarted) return res.status(400).json({error:'next round already started'});
 room.current.nextStarted=true;
 room.current={prompt:pickRankedPrompt(room),picks:{}};
 res.json({ok:true});
});

app.get('/ranked',(req,res)=>{
 res.send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>US, RANKED</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0e0e12;color:#eee;font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:24px 12px}
.wrap{width:100%;max-width:420px}
h1{font-size:1.3rem;letter-spacing:1px;margin:0 0 4px}
.sub{color:#888;font-size:.85rem;margin-bottom:20px}
.card{background:#17171d;border:1px solid #34343f;border-radius:14px;padding:18px;margin-bottom:14px}
button{background:#ff5d8f;color:#0e0e12;border:0;border-radius:10px;padding:12px 16px;font-weight:bold;font-size:.95rem;cursor:pointer;width:100%}
button.secondary{background:#26262f;color:#eee}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #34343f;background:#0e0e12;color:#eee;margin-bottom:10px;font-size:.95rem}
.prompt{font-size:1.1rem;margin-bottom:16px;font-weight:bold}
.choices{display:flex;gap:10px}
.choices button{flex:1}
.picked{opacity:.5}
.result{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #26262f;font-size:.9rem}
.match{color:#4caf6d;font-weight:bold}
.nomatch{color:#c9a227}
.hist-item{padding:10px 0;border-bottom:1px solid #26262f}
.hist-prompt{font-size:.85rem;color:#bbb;margin-bottom:4px}
.hist-picks{font-size:.8rem;color:#888}
.linkbox{word-break:break-all;background:#0e0e12;padding:10px;border-radius:8px;font-size:.8rem;color:#ff5d8f;margin-bottom:10px}
#waiting{color:#888;font-size:.85rem;text-align:center;padding:20px 0}
</style></head><body><div class="wrap">
<h1>US, RANKED</h1>
<div class="sub">no score, no losers, just verdicts</div>
<div id="app"></div>
</div>
<script>
const app=document.getElementById('app');
const params=new URLSearchParams(location.search);
let code=params.get('room');
let pid=params.get('pid')||localStorage.getItem('pid_'+code)||null;
let myName=params.get('name')||localStorage.getItem('name_'+code)||null;

function screenJoin(){
 app.innerHTML='<div class="card"><input id="name" placeholder="your name"/>'+
  (code?'<button id="joinBtn">join room</button>':'<button id="createBtn">start a room</button>')+
  '</div>';
 if(code) document.getElementById('joinBtn').onclick=doJoin;
 else document.getElementById('createBtn').onclick=doCreate;
}

async function doCreate(){
 const r=await fetch('/api/ranked/room',{method:'POST'}).then(r=>r.json());
 code=r.code;
 history.replaceState(null,'',location.pathname+'?room='+code);
 doJoin();
}

async function doJoin(){
 const name=document.getElementById('name').value.trim();
 if(!name){alert('enter a name');return}
 myName=name;
 const r=await fetch('/api/ranked/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name})}).then(r=>r.json());
 if(r.error){alert(r.error);return}
 pid=r.pid;
 localStorage.setItem('pid_'+code,pid);
 localStorage.setItem('name_'+code,myName);
 poll();
}

async function poll(){
 const s=await fetch('/api/ranked/state/'+code).then(r=>r.json());
 render(s);
 setTimeout(poll,1800);
}

function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(s){
 if(!s.ready){
  app.innerHTML='<div class="card"><div class="linkbox"><b>ROOM CODE: '+safe(code)+'</b><br>Give this code to your partner.<br><small>'+safe(s.names.length)+'/2 players joined</small></div>'+
   '<div id="waiting">waiting for your partner to join…</div></div>';
  return;
 }
 let html='<div class="card">';
 if(s.current && !s.current.revealed){
  html+='<div class="prompt">'+safe(s.current.prompt)+'</div><div class="choices">'+
   s.roster.map(r=>'<button data-pid="'+r.pid+'" class="pickBtn">'+safe(r.name)+'</button>').join('')+
   '</div>';
 } else if(s.current && s.current.revealed){
  html+='<div class="prompt">'+safe(s.current.prompt)+'</div>';
  s.current.picks.forEach(p=>{
   html+='<div class="result"><span>'+safe(p.name)+' picked</span><b>'+safe(p.chose)+'</b></div>';
  });
  const match=s.current.picks[0].chose===s.current.picks[1].chose;
  html+='<div style="margin:10px 0" class="'+(match?'match':'nomatch')+'">'+(match?'match! you\\'re in sync':'no match — talk about it')+'</div>';
  html+='<button id="nextBtn">next question</button>';
 }
 html+='</div>';
 if(s.history.length){
  html+='<div class="card"><div class="sub" style="margin-bottom:10px">history</div>';
  s.history.forEach(h=>{
   html+='<div class="hist-item"><div class="hist-prompt">'+safe(h.prompt)+'</div><div class="hist-picks">'+
    h.picks.map(p=>safe(p.name)+' → '+safe(p.chose)).join(' · ')+' '+(h.match?'<span class="match">match</span>':'')+
    '</div></div>';
  });
  html+='</div>';
 }
 app.innerHTML=html;
 document.querySelectorAll('.pickBtn').forEach(b=>b.onclick=async()=>{
  document.querySelectorAll('.pickBtn').forEach(x=>x.disabled=true);
  const r=await fetch('/api/ranked/pick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,pid,choicePid:b.dataset.pid})});
  if(!r.ok){const d=await r.json().catch(()=>({}));alert(d.error||'Pick failed')}
 });
 const nb=document.getElementById('nextBtn');
 if(nb) nb.onclick=async()=>{await fetch('/api/ranked/next',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})})};
}

if(code && pid) poll();
else screenJoin();
</script></body></html>`);
});
// ===== end US, RANKED =====

app.listen(PORT,()=>console.log('Date Wordle running on '+PORT));