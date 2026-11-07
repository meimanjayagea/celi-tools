export function providerCatalogUrl(provider:string,baseUrl:string,pageToken?:string):URL;
export function providerCatalogHeaders(provider:string,apiKey:string):Headers;
export function fetchCatalogPage(input:{provider:string;baseUrl:string;apiKey:string;pageToken?:string;fetchImpl?:typeof fetch;signal?:AbortSignal}):Promise<unknown>;
