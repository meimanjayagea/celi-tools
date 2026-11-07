export type ModelPriceFilter="all"|"free"|"paid"|"unknown";
export type FilterableModel={id:string;name:string;isFree:boolean|null};
export function filterModels<T extends FilterableModel>(models:T[],query:string,filter:ModelPriceFilter):T[];
export function countModelFilters(models:FilterableModel[]):Record<ModelPriceFilter,number>;
