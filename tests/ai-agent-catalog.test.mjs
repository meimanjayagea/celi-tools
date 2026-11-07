import test from "node:test";
import assert from "node:assert/strict";
import { isSafeModelCatalogError, normalizeProviderModels, readBoundedJson, safeModelCatalogError } from "../apps/web/app/lib/ai-agent/catalog-normalize.mjs";
import { assertNoRedirect, createPinnedLookup, isPublicUnicastAddress, validateHttpsEndpoint } from "../apps/web/app/lib/ai-agent/endpoint-safety.mjs";
import { fetchCatalogPage, providerCatalogHeaders, providerCatalogUrl } from "../apps/web/app/lib/ai-agent/catalog-http.mjs";

test("normalizes chat models from OpenAI-compatible provider payloads", () => {
  assert.deepEqual(normalizeProviderModels("openai", { data:[
    { id:"gpt-4.1-mini", name:"GPT 4.1 Mini" },
    { id:"text-embedding-3-large" },
    { id:"gpt-4.1-mini" },
  ] }), [{ id:"gpt-4.1-mini", name:"GPT 4.1 Mini", isFree:null }]);
});

test("normalizes Gemini names and excludes models without text generation", () => {
  assert.deepEqual(normalizeProviderModels("google", { models:[
    { name:"models/gemini-2.5-flash", displayName:"Gemini Flash", supportedGenerationMethods:["generateContent"] },
    { name:"models/text-embedding-004", supportedGenerationMethods:["embedContent"] },
    { name:"models/gemini-tts", supportedGenerationMethods:["generateContent"] },
  ] }), [{ id:"gemini-2.5-flash", name:"Gemini Flash", isFree:null }]);
});

test("detects free, paid, and unknown model pricing without guessing", () => {
  assert.deepEqual(normalizeProviderModels("openrouter", { data:[
    { id:"provider/free-model:free", name:"Free model" },
    { id:"provider/zero-priced", pricing:{ prompt:"0", completion:"0" } },
    { id:"provider/paid", pricing:{ prompt:"0.0000002", completion:"0.0000008" } },
    { id:"provider/unknown" },
  ] }), [
    { id:"provider/free-model:free", name:"Free model", isFree:true },
    { id:"provider/zero-priced", name:"provider/zero-priced", isFree:true },
    { id:"provider/paid", name:"provider/paid", isFree:false },
    { id:"provider/unknown", name:"provider/unknown", isFree:null },
  ]);
});

test("filters non-text modalities, sanitizes labels, deduplicates, and caps results", () => {
  const models = Array.from({ length:230 }, (_, i) => ({ id:`model-${i}`, name:`Model ${i}\nunsafe` }));
  models[2].architecture = { modality:"image->image" };
  models.push({ id:"model-0", name:"duplicate" });
  const result = normalizeProviderModels("openrouter", { data:models });
  assert.equal(result.length, 200);
  assert.equal(result[0].name, "Model 0unsafe");
  assert.equal(result.some(({ id }) => id === "model-2"), false);
  assert.deepEqual(normalizeProviderModels("xai",{models:[
    {id:"grok-language",input_modalities:["text"],output_modalities:["text"]},
    {id:"grok-image-generator",input_modalities:["text"],output_modalities:["image"]},
  ]}),[{id:"grok-language",name:"grok-language",isFree:null}]);
});

test("rejects oversized or malformed model responses without exposing provider details", async () => {
  const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"data":['));controller.enqueue(new Uint8Array(40));controller.close();}});
  await assert.rejects(readBoundedJson(new Response(body),24),/Daftar model tidak dapat dimuat/);
  assert.equal(safeModelCatalogError().message,"Daftar model tidak dapat dimuat. Periksa API key, endpoint, dan akses provider.");
});

test("classifies Gemini catalog failures safely without exposing upstream messages", async () => {
  const cases=[
    {status:400,message:/API key/i},
    {status:401,message:/API key/i},
    {status:403,message:/akses/i},
    {status:429,message:/kuota/i},
    {status:503,message:/gangguan/i},
  ];
  for(const entry of cases){
    await assert.rejects(fetchCatalogPage({provider:"google",baseUrl:"https://generativelanguage.googleapis.com/v1beta",apiKey:"secret-key",fetchImpl:async()=>Response.json({error:{message:"raw provider detail secret-key"}},{status:entry.status})}),error=>{
      assert.equal(isSafeModelCatalogError(error),true);
      assert.match(error.message,entry.message);
      assert.doesNotMatch(error.message,/raw provider detail|secret-key/);
      return true;
    });
  }
});

test("rejects private provider endpoints, DNS ranges, and redirected provider calls", () => {
  assert.throws(()=>validateHttpsEndpoint("http://127.0.0.1/v1"));
  assert.throws(()=>validateHttpsEndpoint("https://user:pass@example.com/v1"));
  assert.equal(isPublicUnicastAddress("127.0.0.1"),false);
  assert.equal(isPublicUnicastAddress("10.0.0.1"),false);
  assert.equal(isPublicUnicastAddress("8.8.8.8"),true);
  assert.throws(()=>assertNoRedirect(new Response(null,{status:302,headers:{Location:"https://attacker.example"}})),/redirect is not allowed/i);
});

test("pinned DNS lookup supports undici all-address and single-address callback contracts", () => {
  const lookup=createPinnedLookup("api.example.com","203.0.113.9",4);
  const all=[];
  lookup("api.example.com",{all:true},(...args)=>all.push(args));
  assert.deepEqual(all,[[null,[{address:"203.0.113.9",family:4}]]]);
  const single=[];
  lookup("api.example.com",{all:false},(...args)=>single.push(args));
  assert.deepEqual(single,[[null,"203.0.113.9",4]]);
  const rejected=[];
  lookup("attacker.example",{all:true},(...args)=>rejected.push(args));
  assert.equal(rejected[0][0].code,"ENOTFOUND");
});

test("builds provider-specific model endpoints and authentication without leaking headers", async () => {
  assert.equal(providerCatalogUrl("groq","https://api.groq.com/openai/v1","cursor").href,"https://api.groq.com/openai/v1/models?after=cursor");
  assert.equal(providerCatalogUrl("xai","https://api.x.ai/v1").pathname,"/v1/language-models");
  assert.equal(providerCatalogUrl("opencode-zen","https://opencode.ai/zen/v1").pathname,"/zen/v1/models");
  assert.equal(providerCatalogUrl("google","https://generativelanguage.googleapis.com/v1beta").pathname,"/v1beta/models");
  const calls=[];
  const payload=await fetchCatalogPage({provider:"anthropic",baseUrl:"https://api.anthropic.com/v1",apiKey:"secret-value",fetchImpl:async(url,init)=>{
    calls.push({url:new URL(url),headers:new Headers(init.headers)});
    return Response.json({data:[{id:"claude-chat"}],has_more:false});
  }});
  assert.deepEqual(payload,{data:[{id:"claude-chat"}],has_more:false});
  assert.equal(calls[0].url.pathname,"/v1/models");
  assert.equal(calls[0].headers.get("x-api-key"),"secret-value");
  assert.equal(calls[0].headers.get("anthropic-version"),"2023-06-01");
  assert.equal(calls[0].headers.has("authorization"),false);
  assert.equal(providerCatalogUrl("google","https://generativelanguage.googleapis.com/v1beta").searchParams.has("key"),false);
  assert.equal(providerCatalogUrl("openrouter","https://openrouter.ai/api/v1").searchParams.get("output_modalities"),"text");
  for(const provider of ["openai","groq","xai","openrouter","opencode-zen","hermes","openai-compatible"]){
    assert.equal(providerCatalogHeaders(provider,"provider-key").get("authorization"),"Bearer provider-key");
  }
  assert.equal(providerCatalogUrl("anthropic","https://api.anthropic.com/v1","last-model").searchParams.get("after_id"),"last-model");
  assert.equal(providerCatalogUrl("google","https://generativelanguage.googleapis.com/v1beta","next-page").searchParams.get("pageToken"),"next-page");
});

test("mock model-list requests work for all nine provider choices", async () => {
  const cases=[
    {provider:"openai",baseUrl:"https://api.openai.com/v1",path:"/v1/models",auth:"Bearer test-key"},
    {provider:"anthropic",baseUrl:"https://api.anthropic.com/v1",path:"/v1/models",auth:"x-api-key:test-key"},
    {provider:"google",baseUrl:"https://generativelanguage.googleapis.com/v1beta",path:"/v1beta/models",auth:"x-goog-api-key:test-key"},
    {provider:"groq",baseUrl:"https://api.groq.com/openai/v1",path:"/openai/v1/models",auth:"Bearer test-key"},
    {provider:"xai",baseUrl:"https://api.x.ai/v1",path:"/v1/language-models",auth:"Bearer test-key"},
    {provider:"openrouter",baseUrl:"https://openrouter.ai/api/v1",path:"/api/v1/models",auth:"Bearer test-key"},
    {provider:"opencode-zen",baseUrl:"https://opencode.ai/zen/v1",path:"/zen/v1/models",auth:"Bearer test-key"},
    {provider:"hermes",baseUrl:"https://hermes.example/v1",path:"/v1/models",auth:"Bearer test-key"},
    {provider:"openai-compatible",baseUrl:"https://custom.example/api/v1",path:"/api/v1/models",auth:"Bearer test-key"},
  ];
  for(const entry of cases){
    let call;
    const result=await fetchCatalogPage({...entry,apiKey:"test-key",fetchImpl:async(url,init)=>{
      call={url:new URL(url),headers:new Headers(init.headers)};
      return Response.json({data:[{id:"chat-model",name:"Chat model"}]});
    }});
    assert.deepEqual(result,{data:[{id:"chat-model",name:"Chat model"}]},entry.provider);
    assert.equal(call.url.pathname,entry.path,entry.provider);
    const actualAuth=entry.auth.startsWith("x-goog-api-key:")?`x-goog-api-key:${call.headers.get("x-goog-api-key")}`:entry.auth.startsWith("x-api-key:")?`x-api-key:${call.headers.get("x-api-key")}`:call.headers.get("authorization");
    assert.equal(actualAuth,entry.auth,entry.provider);
    if(entry.provider==="anthropic")assert.equal(call.headers.get("anthropic-version"),"2023-06-01");
  }
});
