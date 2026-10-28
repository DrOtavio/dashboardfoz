const SESSION_DAYS=7;
const LOCK_SECONDS=15*60;
const MAX_FAILURES=5;
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(value,code=200,extras={})=>new Response(JSON.stringify(value),{status:code,headers:{...headers,...extras}});
const bytesToBase64Url=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function hash(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function getCookie(request,name){const cookie=request.headers.get('Cookie')||'';return cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||''}
const cookie=(value,maxAge=SESSION_DAYS*86400)=>`foz_session=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
async function validSession(request,env){const token=getCookie(request,'foz_session');if(!/^[A-Za-z0-9_-]{40,50}$/.test(token))return false;const h=await hash(token);const now=Math.floor(Date.now()/1000);const session=await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(h).first();return Boolean(session&&session.expires_at>now)}
function sameOrigin(request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin}
async function bodyJson(request,limit=1500000){if(Number(request.headers.get('content-length')||0)>limit)throw Error('Requisição muito grande.');const text=await request.text();if(text.length>limit)throw Error('Requisição muito grande.');return JSON.parse(text)}
async function api(request,env){const url=new URL(request.url),path=url.pathname,method=request.method.toUpperCase();const now=Math.floor(Date.now()/1000);
 if(!sameOrigin(request)&&method!=='GET')return json({error:'Origem bloqueada.'},403);
 if(!env.DB)return json({error:'Banco D1 não configurado.'},503);
 if(path==='/api/me'&&method==='GET')return await validSession(request,env)?json({authenticated:true}):json({authenticated:false},401);
 if(path==='/api/login'&&method==='POST'){
  if(!env.APP_PIN)return json({error:'Configure APP_PIN como secret no Cloudflare.'},503);
  const source=request.headers.get('CF-Connecting-IP')||'unknown';const ipHash=await hash(source+'|'+env.APP_PIN);
  const attempt=await env.DB.prepare('SELECT failures,locked_until FROM login_attempts WHERE ip_hash=?').bind(ipHash).first();if(attempt?.locked_until>now)return json({error:'Muitas tentativas. Tente novamente em 15 minutos.'},429);
  let payload;try{payload=await bodyJson(request,2000)}catch{return json({error:'Requisição inválida.'},400)}
  if(typeof payload.pin!=='string'||payload.pin.length>200)return json({error:'Senha inválida.'},400);
  const actual=await hash(payload.pin),expected=await hash(env.APP_PIN);
  if(actual!==expected){const base=attempt?.locked_until>0&&attempt.locked_until<=now?0:(attempt?.failures||0);const fail=base+1;const locked=fail>=MAX_FAILURES?now+LOCK_SECONDS:0;await env.DB.prepare('INSERT INTO login_attempts(ip_hash,failures,locked_until) VALUES(?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET failures=excluded.failures, locked_until=excluded.locked_until').bind(ipHash,fail,locked).run();return json({error:locked?'Muitas tentativas. Acesso bloqueado por 15 minutos.':'Senha incorreta.'},locked?429:401)}
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip_hash=?').bind(ipHash).run();const raw=crypto.getRandomValues(new Uint8Array(32));const token=bytesToBase64Url(raw);const h=await hash(token);await env.DB.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)').bind(h,now+SESSION_DAYS*86400).run();return json({authenticated:true},200,{'set-cookie':cookie(token)});
 }
 if(path==='/api/logout'&&method==='POST'){const token=getCookie(request,'foz_session');if(token){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run()}return json({ok:true},200,{'set-cookie':cookie('',0)})}
 if(!await validSession(request,env))return json({error:'Sessão expirada. Entre novamente.'},401);
 if(path==='/api/state'&&method==='GET'){const row=await env.DB.prepare('SELECT payload,revision FROM app_state WHERE id=1').first();return json({state:row?JSON.parse(row.payload):{schema:1,months:{}},revision:row?.revision||0})}
 if(path==='/api/state'&&method==='PUT'){
  let value;try{value=await bodyJson(request)}catch{return json({error:'Conteúdo inválido ou muito grande.'},400)}
  if(!Number.isInteger(value.revision)||value.revision<0||!value.state||typeof value.state!=='object'||Array.isArray(value.state.months)||typeof value.state.months!=='object')return json({error:'Estrutura inválida.'},400);
  const payload=JSON.stringify(value.state);
  if(payload.length>1100000)return json({error:'Dados acima do tamanho permitido.'},413);
  if(value.revision===0){const result=await env.DB.prepare('INSERT INTO app_state(id,payload,revision) VALUES(1,?,1) ON CONFLICT(id) DO NOTHING').bind(payload).run();if(result.meta.changes!==1)return json({error:'Alterado por outro dispositivo. Atualize a página.'},409);return json({revision:1})}
  const result=await env.DB.prepare('UPDATE app_state SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').bind(payload,value.revision).run();if(result.meta.changes!==1)return json({error:'Alterado por outro dispositivo. Atualize a página.'},409);return json({revision:value.revision+1})
 }
 return json({error:'Rota não encontrada.'},404);
}
export default {async fetch(request,env){const url=new URL(request.url);try{if(url.pathname.startsWith('/api/'))return await api(request,env);if(!env.ASSETS)return new Response('Static assets não configurados.',{status:503});const response=await env.ASSETS.fetch(request);const out=new Response(response.body,response);out.headers.set('x-content-type-options','nosniff');out.headers.set('referrer-policy','no-referrer');out.headers.set('x-frame-options','DENY');out.headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");return out}catch(e){console.error(e);return json({error:'Falha interna do servidor.'},500)}}};
