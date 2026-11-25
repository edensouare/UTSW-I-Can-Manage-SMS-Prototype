function createGuideEngine({slides,cards,images,modules,guideReply,choose,phraseReply=async()=>null}){
const groups = Map.groupBy ? Map.groupBy(slides, s => s.id.slice(0,5)) : slides.reduce((map,s)=>{
  const key=s.id.slice(0,5);
  if(!map.has(key)) map.set(key,[]);
  map.get(key).push(s);
  return map;
}, new Map());

const select=choose || ((prompt,options,question,previous)=>localChoose(options,question,previous));
const STOPWORDS=new Set(['a','an','and','are','as','at','be','before','between','both','but','by','can','could','did','do','does','during','for','from','get','had','has','have','help','how','i','if','in','into','is','it','its','me','my','of','on','or','our','should','so','tell','that','the','their','them','then','there','these','they','this','to','was','we','what','when','where','which','who','why','will','with','would','you','your']);
const SYNONYMS={
  trach:['tracheostomy','cannula'],
  tracheostomy:['trach','cannula'],
  cannula:['trach','tracheostomy'],
  gtube:['gastrostomy'],
  ngtube:['nasogastric'],
  feeding:['tube','nutrition'],
  pack:['hospitalization','hospital','bring','stay'],
  packing:['hospitalization','hospital','bring','stay'],
  bring:['hospitalization','hospital','pack','stay'],
  hospital:['hospitalization','stay','icu'],
  chemo:['chemotherapy'],
  chemotherapy:['chemo'],
  radiation:['radiotherapy','rt'],
  radiotherapy:['radiation'],
  xerostomia:['dry','mouth','salivary'],
  mouthwash:['mouth','rinse','oral','salivary','dry'],
  voice:['laryngeal','larynx','speaking','speech'],
  throat:['oropharyngeal','pharynx','swallow','swallowing'],
  swallow:['swallowing','barium','dysphagia'],
  shower:['bath','bathing','wet','water'],
  bath:['shower','bathing','wet','water'],
  drain:['drains','seroma','fluid'],
  graft:['skin','donor','harvest'],
  jaw:['mandible','maxilla','trismus'],
  teeth:['dental','tooth','dentist','fluoride'],
  dental:['teeth','tooth','dentist','fluoride'],
  smoke:['smoking','tobacco','cigarette'],
  smoking:['smoke','tobacco','cigarette'],
  tobacco:['smoke','smoking','cigarette'],
  pain:['painful','sore','soreness','discomfort'],
  clot:['clotting']
};
function stemWord(w){
  return w.replace(/(?:ing|ations?|tion|ment|ness|ities|ity|ies|ed|es|s)$/,'');
}
function tokenizeQuery(text){
  const raw=String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
  const terms=new Set();
  for(const w of raw){
    if(w.length<2||STOPWORDS.has(w))continue;
    terms.add(w);
    const st=stemWord(w);
    if(st.length>=3)terms.add(st);
    if(SYNONYMS[w])for(const syn of SYNONYMS[w])terms.add(syn);
    if(SYNONYMS[st])for(const syn of SYNONYMS[st])terms.add(syn);
  }
  return [...terms];
}
function queryBigrams(text){
  const words=String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(w=>w.length>=2&&!STOPWORDS.has(w));
  const out=[];
  for(let i=0;i<words.length-1;i++)out.push(words[i]+' '+words[i+1]);
  return out;
}
function scoreText(text,terms,phrase,bigrams){
  const hay=String(text||'').toLowerCase();
  if(!hay)return 0;
  let score=0;
  if(phrase&&phrase.length>=4&&hay.includes(phrase))score+=8;
  for(const bg of bigrams){if(hay.includes(bg))score+=4}
  for(const t of terms){
    const re=new RegExp('\\b'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
    if(re.test(hay))score+=2;
    else if(hay.includes(t))score+=0.75;
  }
  return score;
}
function localChoose(options,question,previous){
  if(!Array.isArray(options)||!options.length)return 'NONE';
  const terms=tokenizeQuery(question);
  const phrase=String(question||'').toLowerCase().replace(/[^a-z0-9\s]+/g,' ').replace(/\s+/g,' ').trim();
  const bigrams=queryBigrams(question);
  if(!terms.length)return 'NONE';
  let bestId='NONE',bestScore=0;
  const isDeckCatalog=options[0].length>=3;
  for(const opt of options){
    const id=opt[0];
    let s=0;
    if(isDeckCatalog){
      s+=scoreText(opt[1],terms,phrase,bigrams)*4;
      s+=scoreText(opt[2],terms,phrase,bigrams)*2;
      const deckSlides=groups.get(id);
      if(deckSlides){
        const body=deckSlides.filter(isSubstantive).map(x=>normText(x.text)).join(' ');
        s+=Math.min(8,scoreText(body,terms,phrase,bigrams)*0.5);
      }
      if(previous&&s>0&&String(previous).toLowerCase().includes(String(opt[1]).toLowerCase())){
        s+=1.5;
      }
    }else{
      const card=cards[id];
      const heading=card?cleanHeading(card.heading):'';
      s+=scoreText(heading,terms,phrase,bigrams)*3;
      s+=scoreText(opt[1],terms,phrase,bigrams);
    }
    if(s>bestScore){bestScore=s;bestId=id}
  }
  return bestScore>=1.5?bestId:'NONE';
}

const PHOTO_IDS=new Set([
  '05-03-2',
  '06-01-02','06-01-03','06-01-04','06-01-08','06-01-10','06-01-11','06-01-12','06-01-13','06-01-14','06-01-15',
  '06-02-03','06-02-05','06-02-06','06-02-07',
  '06-02-12','06-02-13','06-02-14','06-02-15','06-02-16',
  '06-03-03','06-03-04','06-03-05','06-03-06','06-03-07','06-03-08',
  '07-01-5','07-01-6','07-02-09',
  '08-06-06','08-06-07','08-06-08','08-06-09','08-06-10','08-06-11'
]);

function normText(s){
  return String(s||'')
    .replace(/\uFB01/g,'fi').replace(/\uFB02/g,'fl')
    .replace(/●/g,'•').replace(/○/g,'◦')
    .replace(/I Can Manage Cancer\s*/gi,'')
    .replace(/I Can Manage\s*/gi,'')
    .trim();
}
function cleanHeading(h){
  return normText(h).replace(/\s*(?:\(cont\.?\)|\(continued\)|continued)\s*$/i,'').trim();
}
function isSubstantive(s){
  const c=cards[s.id];
  if(!c)return false;
  if(PHOTO_IDS.has(s.id))return true;
  const full=normText(c.chunks.join('\n'));
  if(/sections in this module|click on (the )?box|jump to each section|table of contents|title of section/i.test(full))return false;
  const lines=full.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length<=2 && full.length<130 && !/[.!?•]|^\s*[-•]|step \d/im.test(full))return false;
  if(/^(common causes of head and neck cancer|curative head and neck cancer treatments: overview|quitting smoking at least \d+ weeks)/i.test(lines[0]) && lines.length<=2 && full.length<140)return false;
  return true;
}

const content=slides.filter(isSubstantive);
const choices=(...labels)=>labels.map(label=>[label,label]);
const clarify={text:'What would you like help with? Tell me the name of the procedure, the equipment you have, or what you’re trying to do.'};
function cardPhoto(slide,card){
  const candidates=['.jpg','.jpeg','.png','.webp'].map(ext=>'sms-images/'+slide.id+ext);
  if(card?.photo){
    const name=card.photo.split('/').pop();
    candidates.push('sms-images/'+name,'media (from initial demo)/'+name);
  }
  const cleaningPhotos={'06-01-08':'sup','06-01-10':'s3','06-01-11':'s4','06-01-12':'s5','06-01-13':'s6','06-01-14':'s7','06-01-15':'s8'};
  if(cleaningPhotos[slide.id])candidates.push('media (from initial demo)/trach-'+cleaningPhotos[slide.id]+'.jpg');
  return candidates.find(file=>images.has(file)) || null;
}
function formatCardText(slide,card,part){
  const raw=normText(card.chunks[part]);
  const heading=cleanHeading(card.heading);
  const lines=raw.split('\n');
  const first=normText(lines[0]).replace(/\s*(?:\(cont\.?\)|\(continued\)|continued)\s*$/i,'').trim();
  const rest=lines.slice(1).join('\n').trim();
  let body=raw;
  if(part===0 && rest && heading && (first.toLowerCase()===heading.toLowerCase() || normText(card.heading).toLowerCase()===first.toLowerCase())){
    const startsAsList=/^(?:•|◦|-|\d+[.)]|\*)/.test(rest);
    if(!startsAsList && (/[.!?]/.test(rest.split('\n')[0]) || /^step \d/i.test(rest))){
      body=rest;
    }else if(startsAsList){
      const label=heading.endsWith(':')||heading.endsWith('?')?heading:heading+':';
      body=label+'\n'+rest;
    }
  }
  if(slide.id==='06-03-03' && part===0 && !/comes out/i.test(body)){
    body='If your tracheostomy tube accidentally comes out, gather these supplies first:\n'+rest;
  }
  return body;
}
function trachStart(){
  const cannula='sms-images/cannula.jpg';
  return {text:'Let’s walk through cleaning your trach tube. Do you have a reusable inner cannula, like the one pictured? Reply YES, NO, or NOT SURE, or reply SAVE to save information to your ICM assistant.',image:cannula,caption:'Reusable inner cannula',id:'trach-check',q:choices('Yes','No','Not sure','Save')};
}
function supplies(){
  const supImg='media (from initial demo)/trach-sup.jpg';
  return {text:'First, gather these supplies:\n• Clean washcloth\n• Distilled or sterile water\n• Cotton-tipped swabs\n• Cleaning brush\n• Tap water\n• Two clean bowls or cups\n\nReply READY when you have everything, or reply SAVE to save information to your ICM assistant.',image:supImg,caption:'Cleaning supplies',id:'trach-ready',q:choices('Ready','Save')};
}
function present(slide,part=0,customText=null){
  const card=cards[slide.id];
  const next=card.chunks[part+1] || content.some(s=>s.url===slide.url && s.page>slide.page);
  const prompt=next?'Reply NEXT to continue, or reply SAVE to save information to your ICM assistant.':'Was this helpful? Reply YES, reply SAVE to save information to your ICM assistant, or ask another question.';
  const body=customText||formatCardText(slide,card,part);
  return {text:body+'\n\n'+prompt,image:part===0?cardPhoto(slide,card):null,caption:cleanHeading(card.heading),id:slide.id+':'+part,q:choices(next?'Next':'Yes','Save')};
}
function topics(module){
  const decks=[...groups.values()].filter(rows=>rows[0].module===module && rows.some(isSubstantive));
  if(!decks.length)return clarify;
  if(decks.length===1)return present(decks[0].find(isSubstantive));
  return {text:'Which topic would you like to start with?\n'+decks.map((rows,i)=>(i+1)+'. '+rows[0].deck).join('\n')+'\n\nReply with a number.',id:'topics:'+module,q:decks.map((rows,i)=>[String(i+1),String(i+1)])};
}
async function answer(question, previous){
  const q=question.trim().toUpperCase();
  if(/^(MENU|GUIDES?|MODULES?|HELP|START)$/.test(q))return {text:guideReply('menu'),id:'mod-menu',q:modules.map(m=>[String(m.number),'GUIDE '+m.number])};
  if((previous==='mod-menu'||previous==='menu'||previous==='guides') && /^([1-9]|10)$/.test(q)){
    return topics(Number(q));
  }
  if(previous==='trach-check'){
    if(/^(YES|1)$/.test(q))return supplies();
    if(/^(NO|NOT SURE|2)$/.test(q))return {text:'These cleaning steps are for a reusable inner cannula. Ask your care team which instructions apply to your tube. Is there another topic you’d like to explore?'};
  }
  if(previous==='trach-ready' && /^(READY|NEXT)$/.test(q))return present(content.find(s=>s.id.startsWith('06-01-') && s.page===9));
  if(previous?.startsWith('topics:')){
    const modNum=Number(previous.split(':')[1]);
    const decks=[...groups.values()].filter(rows=>rows[0].module===modNum && rows.some(isSubstantive));
    let pickIndex=null;
    const partMatch=q.match(/^(?:PART\s*|RECONSTRUCTIVE\s*(?:SURGERY\s*)?\(?\s*PART\s*)(\d+)\)?$/);
    if(partMatch && modNum===4){
      const partNum=Number(partMatch[1]);
      if(partNum>=1 && partNum<=9) pickIndex=4+partNum;
    } else if(/^\d+$/.test(q)){
      pickIndex=Number(q)-1;
    }
    if(pickIndex!==null && decks[pickIndex]){
      const rows=decks[pickIndex];
      return rows[0].id.startsWith('06-01-')?trachStart():present(rows.find(isSubstantive));
    }
    if(/^\d+$/.test(q) || partMatch) return topics(modNum);
  }
  const [id,part]=String(previous||'').split(':');const last=content.find(s=>s.id===id);
  if(last && q==='NEXT'){
    if(cards[id].chunks[Number(part)+1])return present(last,Number(part)+1);
    const next=content.find(s=>s.url===last.url && s.page>last.page);
    if(next)return present(next);
    return {text:'You’ve finished this topic. What else would you like to ask?',q:choices('Modules','Menu')};
  }
  if(last && q==='YES')return {text:'Thanks for letting me know. You can ask another question whenever you’re ready.',q:choices('Modules','Menu')};
  const bareNum=q.match(/^([1-6])$/);
  if(bareNum && !previous){
    const n=Number(bareNum[1]);
    if(n===1)return {text:guideReply('menu'),id:'mod-menu',q:modules.map(m=>[String(m.number),'GUIDE '+m.number])};
    if(n===2)return {text:'To request a visit, type "request a visit" or choose Request a visit from the menu.',q:choices('Request a visit','Menu')};
    if(n===3)return {text:'You have no scheduled visits. View details in MyChart (simulated demo):',lk:'appt',q:choices('Menu')};
    if(n===4)return {text:'Your visit reminders are managed in your MyChart account (simulated demo).',lk:'set',q:choices('Menu')};
    if(n===5)return {
      text: 'Your results aren’t sent by text to protect your privacy. You can view them securely in MyChart (simulated demo):',
      lk: 'results',
      q: choices('Menu')
    };
    if(n===6)return {
      text: 'This demo inbox is unmonitored. Contact your care team directly through your usual channel. If you’re looking for information about who is on your treatment team, tap Treatment Team Guide below.',
      q: [['Treatment Team Guide','GUIDE 3'],['Menu','Menu']]
    };
  }
  const guideNum=q.match(/^(?:GUIDE\s*|MODULE\s*)(\d+)$/);
  if(guideNum){
    const num=Number(guideNum[1]);
    if(num>=1 && num<=10) return topics(num);
    return {text:guideReply('menu'),id:'mod-menu',q:modules.map(m=>[String(m.number),'GUIDE '+m.number])};
  }
  if(/TRACH|CANNULA/.test(q) && /CLEAN|SUPPLIES/.test(q))return trachStart();
  if(/\b(?:LABS?|TEST RESULTS?|RESULTS?)\b/.test(q)){
    return {
      text: 'Your results aren’t sent by text to protect your privacy. You can view them securely in MyChart (simulated demo):',
      lk: 'results',
      q: choices('Menu')
    };
  }
  if(/\b(?:MY |NEXT |UPCOMING |SCHEDULED )(?:VISITS?|APPOINTMENTS?|APPTS?)\b/.test(q) || /\b(?:REQUEST|MAKE|BOOK|SCHEDULE|ARRANGE|SET UP)\b.*\b(?:VISITS?|APPOINTMENTS?|APPTS?)\b/.test(q) || /^(?:VISITS?|APPOINTMENTS?|APPTS?)$/.test(q)){
    return {
      text: 'You can view your scheduled visits and appointment details securely in MyChart (simulated demo):',
      lk: 'appt',
      q: choices('Menu')
    };
  }
  if(/\bREMINDERS?\b/.test(q)){
    return {
      text: 'Your visit reminders are managed in your MyChart account (simulated demo).',
      lk: 'set',
      q: choices('Menu')
    };
  }
  if(/\b(?:CONTACT|TALK|CALL|MESSAGE|REACH|EMAIL|TEXT)\b.*\b(?:CARE TEAM|DOCTOR|NURSE|CLINIC|PROVIDER)\b/.test(q) || /^(?:MY )?(?:CARE TEAM|DOCTOR|NURSE|CLINIC)$/.test(q)){
    return {
      text: 'This demo inbox is unmonitored. Contact your care team directly through your usual channel. If you’re looking for information about who is on your treatment team, tap Treatment Team Guide below.',
      q: [['Treatment Team Guide','GUIDE 3'],['Menu','Menu']]
    };
  }
  const context=last?last.deck+' '+cleanHeading(cards[id].heading):'';
  const catalog=[...groups].map(([key,rows])=>[key,rows[0].deck,[...new Set(rows.filter(isSubstantive).map(s=>cleanHeading(cards[s.id]?.heading)).filter(Boolean))].join(' | ').slice(0,650)]);
  const deck=await select('Select a relevant topic or NONE for unclear, unsupported or individual clinical decisions.',catalog,question,context);
  const pages=groups.get(deck)?.filter(isSubstantive);
  if(!pages?.length)return clarify;
  const selected=await select('Select the passage that answers the question. For a general how-to select the beginning of the instructions. Use NONE if unsupported.',pages.map(s=>[s.id,normText(s.text).slice(0,2000)]),question,context);
  const slide=pages.find(s=>s.id===selected);
  if(!slide)return clarify;
  if(deck==='06-01' && slide.page>=7)return trachStart();
  const card=cards[slide.id];
  const conversational=await phraseReply(question,slide,card);
  if(conversational){
    const lastPart=card.chunks.length-1;
    const hasNext=content.some(s=>s.url===slide.url && s.page>slide.page);
    const prompt=hasNext?'Reply NEXT to continue, or reply SAVE to save information to your ICM assistant.':'Was this helpful? Reply YES, reply SAVE to save information to your ICM assistant, or ask another question.';
    return {text:conversational+'\n\n'+prompt,image:cardPhoto(slide,card),caption:cleanHeading(card.heading),id:slide.id+':'+lastPart,q:choices(hasNext?'Next':'Yes','Save')};
  }
  return present(slide);
}
return {answer,localChoose,normText};
}
if(typeof module!=="undefined")module.exports=createGuideEngine;
