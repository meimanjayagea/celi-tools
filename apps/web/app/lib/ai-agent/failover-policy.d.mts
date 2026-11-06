export type ProviderFailure = { retryable:boolean; category:string };
export function classifyProviderFailure(error:unknown):ProviderFailure;
export function streamWithFallback(input:{profiles:Array<{id:string}>;signal?:AbortSignal;maxAttempts?:number;createStream:(profile:{id:string},signal?:AbortSignal)=>AsyncIterable<string>|Promise<AsyncIterable<string>>;classify?:(error:unknown)=>ProviderFailure}):AsyncGenerator<string>;
