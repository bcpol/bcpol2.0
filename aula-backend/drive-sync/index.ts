// BCPOL Aula Virtual: server-to-server sync for Google Apps Script only.
// Authentication uses a 256-bit key stored as SHA-256 in a private DB table.
// No Drive credentials, service keys, student emails or sync keys are shipped to GitHub Pages.
const SUPABASE_URL=(Deno.env.get("SUPABASE_URL")??"").replace(/\/+$/,"");
const SERVER_KEY=Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ACTIONS=new Set(["snapshot","register_folder","confirm"]);
function reply(payload:unknown,status=200):Response{
 return new Response(JSON.stringify(payload),{status,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
 }});
}
async function sha256(value:string):Promise<string>{
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
async function rpc(p_token_hash:string,p_action:string,p_payload:Record<string,unknown>){
 if(!SUPABASE_URL||!SERVER_KEY)throw Error("Server configuration missing");
 const headers:Record<string,string>={"Content-Type":"application/json","apikey":SERVER_KEY,"Prefer":"return=representation"};
 if(SERVER_KEY.startsWith("eyJ"))headers.Authorization="Bearer "+SERVER_KEY;
 const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/bcpol_aula_sync_api",{
  method:"POST",headers,
  body:JSON.stringify({p_token_hash,p_action,p_payload}),
  signal:AbortSignal.timeout(20000)
 });
 if(!response.ok)throw Error("Storage unavailable");
 return await response.json();
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
 try{
  if(Number(req.headers.get("content-length")||"0")>40000)return reply({ok:false,error:"Request too large"},413);
  const rawKey=req.headers.get("x-bcpol-sync-key")??"";
  if(!/^[a-f0-9]{64}$/.test(rawKey))return reply({ok:false,error:"Unauthorized"},401);
  const bodyText=await req.text();
  if(bodyText.length>40000)return reply({ok:false,error:"Request too large"},413);
  const input=JSON.parse(bodyText);
  if(!input || typeof input!=="object" || Array.isArray(input) || !ACTIONS.has(input.action))
    return reply({ok:false,error:"Bad request"},400);
  const {action,...payload}=input;
  const data=await rpc(await sha256(rawKey),action,payload);
  if(!data?.ok)return reply({ok:false,error:data?.error==="Sincronización no autorizada"?"Unauthorized":"Request rejected"},data?.error==="Sincronización no autorizada"?401:400);
  return reply(data);
 }catch{return reply({ok:false,error:"Service unavailable"},503);}
});
