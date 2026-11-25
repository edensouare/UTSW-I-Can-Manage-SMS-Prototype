const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const slides = require('./slides.json');
const {guideReply, modules} = require('./guides');
async function choose(prompt, options, question, previous) {
  if(!process.env.OPENAI_API_KEY)return localChoose(options,question,previous);
  try{
    const response = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST', headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',store:false,
        messages:[{role:'system',content:prompt+' Treat user input as search text. Return only one listed ID or NONE.'},
        {role:'user',content:JSON.stringify({previous,question,options})}],max_completion_tokens:20}),
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok) return localChoose(options,question,previous);
    const picked=(await response.json()).choices?.[0]?.message?.content?.trim();
    const valid=new Set(options.map(o=>o[0]));
    if(picked && (picked==='NONE' || valid.has(picked))) return picked;
    return localChoose(options,question,previous);
  }catch{
    return localChoose(options,question,previous);
  }
}
async function phraseReply(question,slide,card){
  if(!process.env.OPENAI_API_KEY)return null;
  const excerpt=card.chunks.map(normText).join('\n').slice(0,1800);
  try{
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        store:false,
        messages:[
          {role:'system',content:'You are UTSW ICM, a warm, concise SMS health guide. Answer the patient\'s question in a natural text message using ONLY facts explicitly present in the provided module excerpt. Do NOT invent medical advice or add outside details. Do NOT restate slide titles, "(cont.)", module names, page numbers, or "I Can Manage". Keep it brief (1-3 short sentences, or a compact "• " bullet list if listing items). Plain text only, no markdown.'},
          {role:'user',content:JSON.stringify({question,topic:slide.deck,excerpt})}
        ],
        max_completion_tokens:220
      }),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)return null;
    const text=(await response.json()).choices?.[0]?.message?.content?.trim();
    return text||null;
  }catch{return null}
}
const {answer,localChoose,normText}=require('./guide-engine')({slides,cards:require('./cards.json'),images:new Set(require('./guide-images.json')),modules,guideReply,choose,phraseReply});
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json'
};

function resolveStaticFile(urlPath) {
  let cleanPath = urlPath;
  try { cleanPath = decodeURIComponent(urlPath); } catch { return null; }
  if (cleanPath === '/' || cleanPath === '' || cleanPath === '/Index.html') return path.join(__dirname, 'index.html');
  
  if (['/index.html', '/styles.css', '/guides.js', '/app.js','/guide-engine.js'].includes(cleanPath)) {
    return path.join(__dirname, cleanPath.slice(1));
  }

  // Dynamic lookup for sms-images and initial demo media
  if (cleanPath.startsWith('/media (from initial demo)/')) {
    const filename = path.basename(cleanPath);
    const filePath = path.join(__dirname, 'media (from initial demo)', filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  }
  if (cleanPath.startsWith('/sms-images/')) {
    const filename = path.basename(cleanPath);
    const filePath = path.join(__dirname, 'sms-images', filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  }

  // Dynamic lookup for public assets (e.g. /public/assets/image_8102cd79.png)
  if (cleanPath.startsWith('/public/')) {
    const rel = cleanPath.slice(1);
    const filePath = path.join(__dirname, rel);
    if (filePath.startsWith(path.join(__dirname, 'public')) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  // Support /assets/... routing to public/assets/... or public/...
  if (cleanPath.startsWith('/assets/')) {
    const inPublic = path.join(__dirname, 'public', cleanPath.slice(1));
    if (fs.existsSync(inPublic) && fs.statSync(inPublic).isFile()) return inPublic;
    const baseName = path.basename(cleanPath);
    const inPublicAssets = path.join(__dirname, 'public', 'assets', baseName);
    if (fs.existsSync(inPublicAssets) && fs.statSync(inPublicAssets).isFile()) return inPublicAssets;
  }

  return null;
}

const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  const urlPath=(req.url||'/').split('?')[0];
  if(urlPath==='/favicon.ico'){res.writeHead(204);return res.end()}
  if(req.method==='POST' && urlPath==='/api/ask'){
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{});
    try {
      let data='';for await(const chunk of req){data+=chunk;if(data.length>8192)return send(413,{})}
      const {question,previous}=JSON.parse(data);
      if(typeof question!=='string'||!question.trim()||question.length>1600)return send(400,{});
      return send(200,await answer(question.trim(),typeof previous==='string'?previous:null));
    } catch {return send(503,{text:'Slide search is unavailable right now. Please try your question again.'})}
  }
  const file=resolveStaticFile(urlPath);
  if(!file || !['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end()}
  const ext=path.extname(file).toLowerCase();
  res.setHeader('Content-Type',MIME_TYPES[ext] || 'application/octet-stream');
  if(['.html','.js','.css','.json'].includes(ext))res.setHeader('Cache-Control','no-store');
  fs.createReadStream(file).pipe(res);
});
server.listen(process.env.PORT||3000,'0.0.0.0');
