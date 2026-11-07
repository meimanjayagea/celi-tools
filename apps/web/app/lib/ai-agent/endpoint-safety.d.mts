export function validateHttpsEndpoint(value:string):URL;
export function isPublicUnicastAddress(address:string):boolean;
export function createPinnedLookup(hostname:string,address:string,family:number):(hostname:string,options:{all?:boolean},callback:(error:Error|null,address:string|Array<{address:string;family:number}>,family?:number)=>void)=>void;
export function assertNoRedirect(response:Response):Response;
