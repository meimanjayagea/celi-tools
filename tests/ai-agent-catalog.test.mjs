import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderModels, readBoundedJson, safeModelCatalogError } from "../apps/web/app/lib/ai-agent/catalog-normalize.mjs";
import { assertNoRedirect, isPublicUnicastAddress, validateHttpsEndpoint } from "../apps/web/app/lib/ai-agent/endpoint-safety.mjs";
import { fetchCatalogPage, providerCatalogHeaders, providerCatalogUrl } from "../apps/web/app/lib/ai-agent/catalog-http.mjs";

test("normalizes chat models from OpenAI-compatible provider payloads", () => {
  assert.deepEqual(normalizeProviderModels("openai", { data:[
    { id:"gpt-4.1-mini", name:"GPT 4.1 Mini" },
    { id:"text-embedding-3-large" },
    { id:"gpt-4.1-mini" },
  ] }), [{ id:"gpt-4.1-mini", name:"GPT 4.1 Mini" }]);
});

test("normalizes Gemini names and excludes models without text generation", () => {
  assert.deepEqual(normalizeProviderModels("google", { models:[
    { name:"models/gemini-2.5-flash", displayName:"Gemini Flash", supportedGenerationMethods:["generateContent"] },
    { name:"models/text-embedding-004", supportedGenerationMethods:["embedContent"] },
    { name:"models/gemini-tts", supportedGenerationMethods:["generateContent"] },
  ] }), [{ id:"gemini-2.5-flash", name:"Gemini Flash" }]);
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
  ]}),[{id:"grok-language",name:"grok-language"}]);
});

test("rejects oversized or malformed model responses without exposing provider details", async () => {
  const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"data":['));controller.enqueue(new Uint8Array(40));controller.close();}});
  await assert.rejects(readBoundedJson(new Response(body),24),/Daftar model tidak dapat dimuat/);
  assert.equal(safeModelCatalogError().message,"Daftar model tidak dapat dimuat. Periksa API key, endpoint, dan akses provider.");
});

test("rejects private provider endpoints, DNS ranges, and redirected provider calls", () => {
  assert.throws(()=>validateHttpsEndpoint("http://127.0.0.1/v1"));
  assert.throws(()=>validateHttpsEndpoint("https://user:pass@example.com/v1"));
  assert.equal(isPublicUnicastAddress("127.0.0.1"),false);
  assert.equal(isPublicUnicastAddress("10.0.0.1"),false);
  assert.equal(isPublicUnicastAddress("8.8.8.8"),true);
  assert.throws(()=>assertNoRedirect(new Response(null,{status:302,headers:{Location:"https://attacker.example"}})),/redirect is not allowed/i);
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
  assert.equal(providerCatalogUrl("google","https://generativelanguage.googleapis.com/v1beta",undefined,"google-secret").searchParams.get("key"),"google-secret");
  assert.equal(providerCatalogUrl("openrouter","https://openrouter.ai/api/v1").searchParams.get("output_modalities"),"text");
  for(const provider of ["openai","groq","xai","openrouter","opencode-zen","hermes","openai-compatible"]){
    assert.equal(providerCatalogHeaders(provider,"provider-key").get("authorization"),"Bearer provider-key");
  }
  assert.equal(providerCatalogUrl("anthropic","https://api.anthropic.com/v1","last-model").searchParams.get("after_id"),"last-model");
  assert.equal(providerCatalogUrl("google","https://generativelanguage.googleapis.com/v1beta","next-page","google-secret").searchParams.get("pageToken"),"next-page");
});
