import { streamText } from "ai";
import { createProviderModel } from "./providers";
import type { ProviderProfile } from "./types";

export type RuntimeProviderProfile=ProviderProfile & { apiKey:string };

export async function createProviderTextStream(profile:RuntimeProviderProfile,messages:Array<{role:"user"|"assistant";content:string}>,system:string,signal:AbortSignal):Promise<AsyncIterable<string>> {
  const model=await createProviderModel(profile);
  const result=streamText({model,system,messages,maxOutputTokens:800,abortSignal:signal});
  return (async function*(){
    for await(const part of result.stream)if(part.type==="text-delta"&&part.text)yield part.text;
  })();
}
