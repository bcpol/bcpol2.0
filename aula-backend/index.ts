// BCPOL Aula Virtual 2026/27. Independent endpoint; existing web auth is untouched.
// User sessions are checked in Postgres. Admin writes require an explicit server-side admin flag.
const origins = new Set(["https://bcpol.es","https://www.bcpol.es","https://bcpol.github.io"]);
const url = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/,"") || "";
// New Supabase secret key is preferred; legacy service role remains fallback for this existing project.
const key = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const allowed = new Set(["mine","admin_snapshot","set_email","set_access","save_class","activate_admin"]);
function responseHeaders(origin: string | null): Headers {
 const h=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Vary":"Origin"});
 if(origin && origins.has(origin)){
  h.set("Access-Control-Allow-Origin",origin);h.set("Access-Control-Allow-Methods","POST, OPTIONS");h.set("Access-Control-Allow-Headers","content-type");
 }
 return h;
}
function reply(body:unknown,status:number,origin:string|null){return new Response(JSON.stringify(body),{status,headers:responseHeaders(origin)});}
async function sha256(input:string):Promise<string>{
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)));
 return Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
}
async function api(p_token_hash:string,p_action:string,p_payload:Record<string,unknown>):Promise<Record<string,unknown>>{
 if(!url || !key)throw new Error("API not configured");
 const headers:Record<string,string>={"content-type":"application/json","apikey":key,"Prefer":"return=representation"};
 // Legacy service_role is a JWT. Modern sb_secret_ keys are not JWTs.
 if(key.startsWith("eyJ"))headers.Authorization="Bearer "+key;
 const res=await fetch(url+"/rest/v1/rpc/bcpol_aula_api",{
  method:"POST",headers,body:JSON.stringify({p_token_hash,p_action,p_payload}),signal:AbortSignal.timeout(12000)
 });
 if(!res.ok)throw new Error("API response failed");
 const data=await res.json();if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Unexpected response");
 return data as Record<string,unknown>;
}
Deno.serve(async (req:Request)=>{
 const origin=req.headers.get("Origin");
 if(origin && !origins.has(origin))return reply({ok:false,error:"Forbidden"},403,null);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:responseHeaders(origin)});
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed"},405,origin);
 try{
  if(Number(req.headers.get("content-length")||0)>4096)return reply({ok:false,error:"Solicitud demasiado grande"},413,origin);
  const raw=await req.text();
  if(raw.length>4096)return reply({ok:false,error:"Solicitud demasiado grande"},413,origin);
  const body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body)||!allowed.has(body.action))return reply({ok:false,error:"Acción no válida"},400,origin);
  if(typeof body.token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(body.token))return reply({ok:false,error:"Necesitas iniciar sesión"},401,origin);
  const {token,action,...payload}=body;
  let safePayload:Record<string,unknown>=payload;
  if(action==="activate_admin"){
   const current=payload.current_password, fresh=payload.new_password, code=payload.activation_code;
   if(typeof current!=="string" || current.length<1 || current.length>256 ||
      typeof fresh!=="string" || fresh.length<8 || fresh.length>128 ||
      !/[a-z]/.test(fresh) || !/[A-Z]/.test(fresh) ||
      !/[0-9]/.test(fresh) || !/[^A-Za-z0-9]/.test(fresh) ||
      fresh===current || typeof code!=="string" || !/^[a-f0-9]{48}$/.test(code)){
    return reply({ok:false,error:"Comprueba la contraseña nueva (8 caracteres, mayúscula, minúscula, número y símbolo) y el código"},400,origin);
   }
   safePayload={current_password_sha:await sha256(current),new_password_sha:await sha256(fresh),activation_code:code};
  }
  const data=await api(await sha256(token),action,safePayload);
  if(data.ok!==true){
   const error=typeof data.error==="string"?data.error:"Acceso no autorizado";
   const status=error.includes("Sesión")?401:403;
   return reply({ok:false,error},status,origin);
  }
  return reply(data,200,origin);
 }catch{return reply({ok:false,error:"Servicio temporalmente no disponible"},503,origin);}
});
