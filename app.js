let pagesGuide;
async function askGuide(question,previous){
  if(location.hostname.endsWith('.github.io')){
    if(!pagesGuide){
      pagesGuide=Promise.all(['slides.json','cards.json','guide-images.json'].map(async file=>{
        const response=await fetch(file);
        if(!response.ok)throw Error('Guide download failed');
        return response.json();
      })).then(([slides,cards,files])=>createGuideEngine({slides,cards,images:new Set(files),modules,guideReply}))
        .catch(error=>{pagesGuide=null;throw error});
    }
    return (await pagesGuide).answer(question,previous);
  }
  const response=await fetch('api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,previous})});
  if(!response.ok)throw Error('Guide search failed');
  return response.json();
}
const $=s=>document.querySelector(s);
const MENU='I can help with:\n1 = ICM Learning Modules\n2 = My next visit\n3 = Reminders\n4 = Test results\n5 = Talk to my care team';
const MQ=[['1 I Can Manage','1'],['2 My next visit','2'],['3 Reminders','3'],['4 Test results','4'],['5 Care team','5']];
const MENUQ=[['MENU','MENU']];
let S,audioCtx;
function stamp(){return new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
function syncClock(){const c=$('#clock');if(c)c.textContent=stamp().replace(/\s*[AP]M$/i,'')}
function unlockAudio(){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;audioCtx=audioCtx||new Ctx();if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});return audioCtx}catch{return null}}
function pingSound(){try{const ctx=unlockAudio();if(!ctx)return;const play=()=>{const t=ctx.currentTime;[[659.25,0,0.028,0.16],[987.77,0.055,0.022,0.22]].forEach(([freq,offset,peak,dur])=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,t+offset);gain.gain.setValueAtTime(0.0001,t+offset);gain.gain.exponentialRampToValueAtTime(peak,t+offset+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,t+offset+dur);osc.connect(gain);gain.connect(ctx.destination);osc.start(t+offset);osc.stop(t+offset+dur+0.01)})};if(ctx.state==='suspended')ctx.resume().then(play).catch(()=>{});else play()}catch{}}
function reset(){S={on:false,ctx:null,msgs:[],q:[],mc:null,signed:false};const i=$('#ti');if(i)i.value='';$('#prefs').reset();$('#settings').open=true;$('.scr').classList.remove('large');$('.dev')?.classList.remove('ping');sync();render()}
function say(t,o){if(!S.startedAt)S.startedAt=stamp();S.msgs.push(Object.assign({a:1,t,ts:stamp()},o||{}));S.ping=true}
function syncSend(){const b=$('.snd'),i=$('#ti');if(!b||!i)return;const has=!!(S?.on&&i.value.trim());b.classList.toggle('hide',!has);b.hidden=!has;b.disabled=!has||!!S.busy}
let scrollTimer;
function syncScrollBar(show){
  const th=$('#th'),thw=$('#thw'),bar=$('#th-bar'),thumb=bar?.firstElementChild;
  if(!th||!bar||!thumb||!thumb.style)return;
  const ch=th.clientHeight||0,sh=th.scrollHeight||0,track=bar.clientHeight||Math.max(0,ch-8);
  if(sh<=ch+1||track<=0){bar.classList.remove('on');thumb.style.height='0px';return}
  const h=Math.max(24,Math.round(track*(ch/sh)));
  const maxScroll=Math.max(1,sh-ch);
  const top=Math.min(Math.max(0,track-h),Math.round((th.scrollTop/maxScroll)*Math.max(0,track-h)));
  thumb.style.height=h+'px';
  thumb.style.transform=`translateY(${top}px)`;
  bar.classList.add('on');
  if(show&&thw){
    thw.classList.add('scrolling');
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>thw.classList.remove('scrolling'),900);
  }
}
function sync(){$('#on').disabled=S.on;$('#off').classList.toggle('hide',!S.on);$('#on').classList.toggle('hide',S.on);$('#sRem').disabled=$('#sRes').disabled=!S.on||S.busy;const st=$('#stat');if(st){st.textContent=S.on?'On':'Off';st.classList.toggle('on',S.on)}}
function reminders(){const r=[...document.querySelectorAll('.rem')].filter(c=>c.checked).map(c=>c.value);return r.length?r.join(', '):'managed in your MyChart account'}
const savedKey='utsw-icm.saved-modules.v1';
let savedItems=[];
try{
 const entries=JSON.parse(localStorage.getItem(savedKey));
 if(Array.isArray(entries))savedItems=entries.filter(item=>item && typeof item.text==='string' && typeof item.image==='string');
}catch{}
function sameItem(a,b){return a.text===b.text && a.image===b.image}
function storeItems(items){
 try{localStorage.setItem(savedKey,JSON.stringify(items));savedItems=items;return true}
 catch{return false}
}
function isSaveableSlide(m){
 return !!(m?.a && m.slide && ((m.slide.id && m.slide.id!=='mod-menu' && !m.slide.id.startsWith('topics:')) || m.slide.image));
}
function downloadPicture(src,caption){
 const link=mk('a','ios-dl');
 link.href=src;link.download='';
 link.title='Save image';link.setAttribute('aria-label','Save '+(caption||'module image'));
 const badge=document.createElement('span');
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('width','15');svg.setAttribute('height','15');svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2');
 svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
 svg.setAttribute('aria-hidden','true');
 ['M12 3v12','M7.5 10.5L12 15l4.5-4.5','M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4'].forEach(d=>{
  const p=document.createElementNS(ns,'path');p.setAttribute('d',d);svg.append(p);
 });
 badge.append(svg);link.append(badge);
 return link;
}
function openSaved(){
 const list=$('#saved-list');
 list.replaceChildren();
 if(!savedItems.length)list.append(mk('p','','Reply SAVE after a module message to keep its information and pictures here.'));
 for(const item of savedItems){
   const card=mk('article');
   if(item.caption)card.append(mk('h3','',item.caption));
   card.append(mk('p','',item.text));
   if(item.image){
     const row=mk('div','saved-img-row');
     const pic=mk('img');pic.src=item.image;pic.alt=item.caption||'Module picture';
     row.append(pic,downloadPicture(item.image,item.caption));
     card.append(row);
   }
   const remove=mk('button','save-action','Remove');
   remove.onclick=()=>{
     if(storeItems(savedItems.filter(entry=>!sameItem(entry,item)))){
       openSaved();
       $('#saved-items button').focus();
     }
   };
   card.append(remove);list.append(card);
 }
 if(!$('#saved-items').open)$('#saved-items').showModal();
}
function saveLatestSlide(){
 const target=S.msgs.slice().reverse().find(isSaveableSlide);
 if(!target){
   say('There isn’t a module message to save yet. Open a learning module or ask a question first.');
   S.q=withResume([['ICM Learning Modules','GUIDES'],['Menu','MENU']]);
   return;
 }
 const item={text:target.t,image:target.slide.image||'',caption:target.slide.caption||''};
 const already=savedItems.some(entry=>sameItem(entry,item));
 if(!already && !storeItems([item,...savedItems])){
   say('Your browser could not update saved items on this device.');
   S.q=target.slide.q||withResume(MENUQ);
   return;
 }
 const prefix=already?'This information is already saved in your ICM assistant.':'Saved to your ICM assistant.';
 if(S.slide==='trach-ready'){
   say(prefix+' Reply READY when you have everything, or reply SAVED to view saved items.');
   S.q=[['Ready','Ready'],['Saved items','SAVED'],['Menu','MENU']];
 }else if(S.slide==='trach-check'){
   say(prefix+' Reply YES, NO, or NOT SURE to continue, or reply SAVED to view saved items.');
   S.q=[['Yes','Yes'],['No','No'],['Not sure','Not sure'],['Saved items','SAVED']];
 }else if(target.slide.q?.some(([,val])=>val==='Next')){
   say(prefix+' Reply NEXT to continue, or reply SAVED to view saved items.');
   S.q=[['Next','Next'],['Saved items','SAVED'],['Menu','MENU']];
 }else{
   say(prefix+' Reply SAVED to view saved items, or ask another question.');
   S.q=[['Saved items','SAVED'],['Modules','Modules'],['Menu','MENU']];
 }
}
function render(){
const th=$('#th');th.innerHTML='';
if(!S.msgs.length)th.innerHTML='<div class="off">UTSW ICM is off.<br>Turn it on in MyChart settings to start.</div>';
else{const t=document.createElement('div');t.className='ts';t.textContent='Text Message\nToday '+(S.startedAt||S.msgs[0].ts||stamp());th.append(t)}
S.msgs.forEach(m=>{const d=document.createElement('div');d.className='m'+(m.a?'':' me');for(const part of m.t.split(/(https:\/\/[^\s]+)/g)){if(m.a && part.startsWith('https://')){const link=document.createElement('a');link.href=part;link.textContent='Open source material';link.target='_blank';link.rel='noopener';d.append(link)}else d.append(document.createTextNode(part))}
if(m.lk||m.slide?.lk){const lk=m.lk||m.slide.lk;if(LK[lk]){const b=document.createElement('button');b.className='lk';b.textContent=LK[lk];b.onclick=()=>openMC(lk);d.append(b)}}
th.append(d);
if(m.ts){const tm=mk('div','mt'+(m.a?'':' me'),m.ts);th.append(tm)}
if(m.slide?.image){const src=m.slide.photo||m.slide.image;const row=mk('div','pic-row');const frame=mk('div','pic');const img=mk('img');img.src=src;img.alt=m.slide.caption||'Module picture';img.onload=()=>{th.scrollTop=th.scrollHeight;syncScrollBar(false)};img.onerror=()=>{row.remove();syncScrollBar(false)};frame.append(img);row.append(frame,downloadPicture(src,m.slide.caption));th.append(row)}
});
const last=S.msgs[S.msgs.length-1];
if(last&&!last.a){const dl=document.createElement('div');dl.className='dl';dl.textContent='Delivered';th.append(dl)}
if(S.busy){const dots=mk('div','typing','•••');dots.setAttribute('role','status');dots.setAttribute('aria-label','UTSW ICM is typing');th.append(dots)}
th.scrollTop=th.scrollHeight;
syncScrollBar(false);
if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>syncScrollBar(false));
const q=$('#qr');q.innerHTML='';
if(S.on&&!S.busy)S.q.forEach(([l,v])=>{const b=document.createElement('button');b.textContent=l;b.onclick=()=>{unlockAudio();go(v)};q.append(b)});
q.classList.toggle('hide',!S.on||!S.q.length);
$('#ti').disabled=!S.on;syncSend();
$('#tp').classList.toggle('hide',!!S.mc);$('#mp').classList.toggle('hide',!S.mc);
if(S.mc)renderMC();
if(S.ping){S.ping=false;pingSound();const dev=$('.dev');if(dev){dev.classList.remove('ping');void dev.offsetWidth;dev.classList.add('ping')}}
}
const LK={results:'mychart.utsw.example/r/8Kq2',appt:'mychart.utsw.example/v/3Fm9',set:'mychart.utsw.example/s/7Hp1',learn:'mychart.utsw.example/g/2Vn6'};
const MCT={learn:['Learn › I Can Manage','[Guide title, videos, and steps]'],results:['Test results','[Your test results appear here]'],appt:['Visits','[Next visit: date, time, location, directions]'],set:['Settings › Text messaging','[Reminder and text preferences]']};
function openMC(k){S.mc=k;S.signed=false;render()}
function mk(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}
function renderMC(){
const el=$('#mc');el.innerHTML='';
el.append(mk('div','mlogo','MyChart'));
const t=MCT[S.mc];
if(!S.signed){
el.append(mk('h2','','Sign in'),mk('p','mut2','For your privacy, please sign in to see '+t[0].toLowerCase()+'.'));
const l1=mk('label','','Username'),i1=mk('input','mi');i1.placeholder='Username';
const l2=mk('label','','Password'),i2=mk('input','mi');i2.type='password';i2.placeholder='Password';
const b=mk('button','mb','Sign in');b.onclick=()=>{S.signed=true;renderMC()};
el.append(l1,i1,l2,i2,b)}
else{el.append(mk('h2','',t[0]),mk('p','mut2',t[1]));for(let i=0;i<4;i++){const l=mk('div','ln');l.style.width=(90-i*12)+'%';el.append(l)}}
}
async function go(text){
 const v=text.trim();if(!v||!S.on||S.busy)return;
 const command=v.toUpperCase();
 const homePick=S.ctx==='home' && /^\d+$/.test(v) && withResume(homeChoices())[Number(v)-1];
 if(command==='SAVED'||command==='SAVED INFO AND PICTURES'||homePick?.[1]==='SAVED'){openSaved();return}
 const session=S;session.busy=true;session.msgs.push({a:0,t:v,ts:stamp()});session.q=[];render();sync();
 await new Promise(resolve=>setTimeout(resolve,650));
 if(session!==S||!S.on)return;
 try{await respond(v.toUpperCase())}finally{if(session===S){session.busy=false;sync();render()}}
}
function homeChoices(){
 const t=$('#topic');
 return [...(t&&t.value?[[t.selectedOptions[0].text,'GUIDE '+t.value]]:[]),['ICM Learning Modules','GUIDES'],['Request a visit','REQUEST VISIT'],['My visits','NEXT VISIT'],['Reminders','REMINDERS'],['Test results','RESULTS'],['Care team','CARE'],['Saved info and pictures','SAVED']];
}
function withResume(options){return (S.slide && S.slide!=='mod-menu')?[['Resume guide','RESUME GUIDE'],...options]:options}
function opener(returning){
 if(returning){
  const back=['Of course, take your time. Here are your options whenever you’re ready:','Right here with you. What would you like to look at next?','Whenever you’re ready, here’s what I can look at next:'];
  return back[Math.floor(Math.random()*back.length)];
 }
 const h=new Date().getHours();
 const timed=h>=5&&h<12?[
  'Good morning from UTSW ICM. I’m here to help you take things one step at a time. Here’s how I can help today:',
  'Good morning from UTSW ICM. Whenever you feel ready, I’m here to help make today a little easier. What would be helpful right now?'
 ]:h>=12&&h<17?[
  'Good afternoon from UTSW ICM. Here’s what I can help with:',
  'Good afternoon from UTSW ICM. Take your time, I’m right here if you need information or support today. Where would you like to start?'
 ]:h>=17&&h<22?[
  'Good evening, it’s okay to take things one question at a time. Here’s how I can support you:',
  'Good evening from UTSW ICM. You don’t have to figure everything out at once, what would help most right now?'
 ]:[
  'Hi there, if you’re up thinking through things tonight, I’m here whenever you need a hand. Here’s what I can help with:',
  'Hello from UTSW ICM. Let’s take things one step at a time. Where would you like to start?'
 ];
 const anytime=[
  'Hi, UTSW ICM is glad you’re here. Going through treatment and recovery takes a lot, I can help you take it one step at a time. Here’s how I can help:',
  'Welcome to UTSW ICM. There’s no rush at all, feel free to explore this feature at your own pace or ask whatever’s on your mind:',
  'Hi there, I’m here to help make things a little easier. What would be most useful?'
 ];
 const pool=[...timed,...anytime];
 return pool[Math.floor(Math.random()*pool.length)];
}
function menu(){
 const returning=S.msgs.length>0;
 S.ctx='home';
 const opts=withResume(homeChoices());
 S.q=opts;
 const list=opts.map(([label],i)=>(i+1)+' = '+label).join('\n');
 say(opener(returning)+'\n\n'+list+'\n\nReply with a number or type a question.');
}
function visitRequest(){
 S.ctx='visit-time';say('What time of day works best for your visit? Reply Morning, Afternoon, No preference, or Cancel.');S.q=[['Morning','Morning'],['Afternoon','Afternoon'],['No preference','No preference'],['Cancel','Cancel']];
}
function results(){S.ctx=null;say('Your results aren’t sent by text to protect your privacy. You can view them securely in MyChart (simulated demo):',{lk:'results'});S.q=withResume(MENUQ)}
function appt(){S.ctx=null;say(S.request?'Your appointment request is pending. Preferred time: '+S.request+'. A visit time has yet to be officially booked. View details in MyChart (simulated demo):':'You have no scheduled visits in this demo. View details in MyChart (simulated demo):',{lk:'appt'});S.q=withResume(S.request?MENUQ:[['Request a visit','REQUEST VISIT'],...MENUQ])}
function rem(){S.ctx=null;say('Your visit reminders are '+reminders()+' (simulated demo).',{lk:'set'});S.q=withResume(MENUQ)}
function care(){S.ctx=null;say('This demo inbox is unmonitored. Contact your care team directly through your usual channel. If you’re looking for information about who is on your treatment team, tap Treatment Team Guide below.');S.q=withResume([['Treatment Team Guide','GUIDE 3'],...MENUQ])}
function mods(){S.ctx='mod';S.slide='mod-menu';say(guideReply('menu'));S.q=modules.map(m=>[String(m.number),'GUIDE '+m.number])}
async function respond(T){
if(T==='STOP'){say('Texts are off.');S.on=false;S.q=[];$('#settings').open=true;sync();return}
if(T==='MENU')return menu();
if(S.ctx==='home' && /^\d+$/.test(T)){const pick=withResume(homeChoices())[Number(T)-1];if(pick)T=pick[1]}
if(/^(SAVED|SAVED INFO AND PICTURES)$/.test(T))return openSaved();
const clean=T.replace(/[’']/g,'').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
if(/^(?:SAVE|SAVE THIS|SAVE INFO)$/.test(clean))return saveLatestSlide();
if(S.ctx==='mod' && (S.slide==='mod-menu' || !S.slide) && /^(?:[1-9]|10)$/.test(T.trim())){T='GUIDE '+T.trim()}
const draft=S.ctx==='visit-time'||S.ctx==='visit-review';
const resume=S.slide && S.slide!=='mod-menu' && /^(?:RESUME(?: (?:MY |THE )?(?:GUIDE|STEPS))?|BACK TO (?:THE )?(?:GUIDE|STEPS)|CONTINUE(?: THE GUIDE)?)$/.test(clean);
if(resume){
 S.ctx='mod';
 const previous=S.msgs.slice().reverse().find(m=>m.slide?.id===S.slide);
 if(previous){say(previous.t,{slide:previous.slide});S.q=previous.slide.q||[];return}
 T='NEXT';
}
const visit=/\b(?:VISITS?|APPOINTMENTS?|APPTS?)\b/.test(clean);
const scheduling=visit && /\b(?:REQUEST|MAKE|BOOK|SCHEDULE|ARRANGE|SET UP)\b/.test(clean);
if(scheduling)return S.request?appt():visitRequest();
if(visit && (/\b(?:WHEN|WHAT TIME|WHAT DAY|WHAT DATE|SCHEDULED|UPCOMING|NEXT|STATUS)\b/.test(clean)||/^(MY )?(VISITS?|APPOINTMENTS?|APPTS?)$/.test(clean)))return appt();
if(draft && !resume){
 const polite=clean.replace(/^(?:PLEASE |YES PLEASE )/,'').replace(/ (?:PLEASE|THANKS|THANK YOU)$/,'');
 const decline=/^(?:NO|NOPE|CANCEL(?: IT| THE REQUEST)?|NEVER MIND|NEVERMIND|DONT SEND(?: IT)?|DO NOT SEND(?: IT)?)$/.test(polite);
 if(decline){S.ctx=null;say('Okay, I’ve canceled this draft.');S.q=withResume(MENUQ);return}
 const times=['MORNING','AFTERNOON'].filter(time=>clean.split(' ').includes(time));
 const either=/\b(?:NO PREFERENCE|EITHER|ANYTIME|ANY TIME)\b/.test(clean);
 if((times.length===1||either)&& !/\b(?:NOT|EXCEPT|CANT|CANNOT|DONT|NO MORNING|NO AFTERNOON)\b/.test(clean)){
  S.time=either?'no preference':times[0].toLowerCase();S.ctx='visit-review';say('Preferred time: '+S.time+'. Send this simulated appointment request?');S.q=[['Send request','SEND REQUEST'],['Change time','CHANGE TIME'],['Cancel','CANCEL']];return
 }
 if(S.ctx==='visit-review'){
  if(/^(?:CHANGE(?: THE)? TIME|EDIT|PICK ANOTHER TIME)$/.test(polite))return visitRequest();
  if(/^(?:YES|YEAH|YEP|SURE|OK|OKAY|GO AHEAD|CONFIRM|SEND(?: IT| REQUEST| THE REQUEST)?|YES SEND(?: IT)?)$/.test(polite)){
   S.request=S.time;S.ctx=null;say('Request saved in this demo. Status: pending. Preferred time: '+S.request+'. View in MyChart (simulated demo):',{lk:'appt'});S.q=withResume([['My visits','NEXT VISIT'],...MENUQ]);return
  }
  say('Should I send the request? Reply yes, change the time, or cancel.');S.q=[['Send request','SEND REQUEST'],['Change time','CHANGE TIME'],['Cancel','CANCEL']];return
 }
 say('Would morning or afternoon work, or do you have no preference?');S.q=[['Morning','MORNING'],['Afternoon','AFTERNOON'],['No preference','NO PREFERENCE'],['Cancel','CANCEL']];return
}
if(S.request && !S.ctx && /^(?:SEND|SEND IT|SEND REQUEST)$/.test(clean))return appt();
if(T==='REMINDERS')return rem();
if(/^(MODULES?|GUIDES?|HELP)$/.test(T))return mods();
if(/^(CARE|CARE TEAM)$/.test(T))return care();
if(/^(LAB RESULTS?|TEST RESULTS?|RESULTS)$/.test(T))return results();
const c=S.ctx;
if(c==='rem'){
if(/^(?:C|CONFIRM)$/.test(T)){S.ctx=null;say('Thanks, you’re confirmed. See you then.');S.q=MENUQ;return}
if(/^(?:R|RESCHEDULE)$/.test(T))return S.request?appt():visitRequest();}
if(c!=='mod'){
if(T==='1')return mods();
if(T==='2')return S.request?appt():visitRequest();
if(T==='3'||/^(APPOINTMENT|NEXT VISIT|MY VISITS)$/.test(T))return appt();
if(T==='4'||/^REMINDERS?$/.test(T))return rem();
if(T==='5')return results();
if(T==='6')return care();
}
const session=S;
try{
 const reply=await askGuide(T,S.slide);
 if(S!==session||!S.on)return;
 say(reply.text,{slide:reply,lk:reply.lk});
 if(reply.id){S.ctx='mod';S.slide=reply.id;}
 else{S.ctx=null;if(reply.text?.includes('finished this topic'))S.slide=null;}
 S.q=reply.q||withResume(MENUQ);
}catch{if(S===session&&S.on){S.ctx=null;say('The guide is unavailable. Please try again.');S.ping=false;S.q=MENUQ}}

}
$('#on').onclick=()=>{unlockAudio();S={on:true,ctx:null,msgs:[],q:[],request:S.request};$('#settings').open=false;menu();sync();render();$('#ti').focus()};
$('#off').onclick=()=>{S={...S,on:false,busy:false,q:[]};$('#settings').open=true;sync();render()};
if($('#topic'))$('#topic').onchange=()=>{if(S.on&&(!S.ctx||S.ctx==='home')&&!S.busy){S.q=withResume(homeChoices());render()}};
$('#sRem').onclick=()=>{unlockAudio();S.ctx='rem';say('Visit reminder (simulated demo): Thursday at 10 AM. Reply C to confirm or R to reschedule. Details:',{lk:'appt'});S.q=[['C','C'],['R','R']];render()};
$('#sRes').onclick=()=>{unlockAudio();S.ctx=null;say('You have a new result in MyChart (simulated demo). For your privacy, results aren’t sent by text. View it securely:',{lk:'results'});S.q=MENUQ;render()};
$('#rst').onclick=reset;
$('#f').onsubmit=e=>{e.preventDefault();unlockAudio();const i=$('#ti');go(i.value);i.value='';syncSend()};
const tiEl=$('#ti');
if(tiEl?.addEventListener){['input','change','keyup','compositionend','focus'].forEach(ev=>tiEl.addEventListener(ev,syncSend));tiEl.addEventListener('paste',()=>setTimeout(syncSend,0))}
$('#bk').onclick=()=>{S.mc=null;render()};
$('.dev')?.addEventListener('animationend',e=>{if(e.animationName==='dev-flash')e.currentTarget.classList.remove('ping')});
const thEl=$('#th');
thEl?.addEventListener('scroll',()=>syncScrollBar(true),{passive:true});
if(typeof window!=='undefined')window.addEventListener?.('resize',()=>syncScrollBar(false));
syncClock();setInterval(syncClock,15000);
reset();