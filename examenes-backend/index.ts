// BCPOL — catálogo de exámenes oficiales. Acceso mediante sesión web BCPOL.
// No se publican los datos del inventario en ficheros estáticos.
const ORIGINS = new Set(["https://bcpol.es","https://www.bcpol.es","https://bcpol.github.io"]);
const BASE = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
function headers(origin: string | null): Headers {
  const h = new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","X-Content-Type-Options":"nosniff"});
  if(origin && ORIGINS.has(origin)){
    h.set("Access-Control-Allow-Origin",origin);
    h.set("Access-Control-Allow-Methods","POST, OPTIONS");
    h.set("Access-Control-Allow-Headers","content-type");
  }
  return h;
}
function respond(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body),{status,headers:headers(origin)});
}
function dbHeaders(): Record<string,string> {
  const h:Record<string,string> = {"apikey":KEY,"Content-Type":"application/json"};
  if(KEY.startsWith("eyJ")) h.Authorization="Bearer "+KEY;
  return h;
}
async function tokenHash(token:string): Promise<string> {
  const data = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));
  return Array.from(data,b=>b.toString(16).padStart(2,"0")).join("");
}
async function verify(token:string): Promise<string|null> {
  const res = await fetch(BASE+"/rest/v1/rpc/bcpol_web_auth_verify",{
    method:"POST",headers:{...dbHeaders(),Prefer:"return=representation"},
    body:JSON.stringify({p_token_hash:await tokenHash(token)}),signal:AbortSignal.timeout(12000)
  });
  if(!res.ok) throw new Error("verify unavailable");
  const user=await res.json();
  return typeof user==="string" && user.length>0 ? user : null;
}
Deno.serve(async (req:Request)=>{
  const origin=req.headers.get("Origin");
  if(origin && !ORIGINS.has(origin))return respond({ok:false,error:"Origen no autorizado"},403,null);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
  if(req.method!=="POST")return respond({ok:false,error:"Método no permitido"},405,origin);
  if(!BASE || !KEY)return respond({ok:false,error:"Servicio no disponible"},503,origin);
  try{
    if(Number(req.headers.get("Content-Length")||0)>4096)return respond({ok:false,error:"Solicitud demasiado grande"},413,origin);
    const raw=await req.text();
    if(raw.length>4096)return respond({ok:false,error:"Solicitud demasiado grande"},413,origin);
    const body=JSON.parse(raw);
    if(!body || typeof body!=="object" || body.action!=="list")return respond({ok:false,error:"Solicitud incorrecta"},400,origin);
    if(typeof body.token!=="string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token))return respond({ok:false,error:"Sesión no válida"},401,origin);
    const user=await verify(body.token);
    if(!user)return respond({ok:false,error:"La sesión ha caducado"},401,origin);
    const query="bcpol_examenes_catalogo?select=id,titulo,municipio,anio,modalidad,materias,drive_url,clasificacion&order=anio.desc,municipio.asc,id.asc&limit=500";
    const res=await fetch(BASE+"/rest/v1/"+query,{headers:dbHeaders(),signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw new Error("catalog unavailable");
    const items=await res.json();
    if(!Array.isArray(items))throw new Error("invalid catalog");
    return respond({ok:true,total:items.length,examenes:items},200,origin);
  }catch(_){
    return respond({ok:false,error:"No se pudo cargar el catálogo de exámenes"},503,origin);
  }
});