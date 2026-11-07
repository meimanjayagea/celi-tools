export function filterModels(models, query, filter) {
  const search=String(query??"").trim().toLowerCase();
  return models
    .filter(model=>!search||`${model.name} ${model.id}`.toLowerCase().includes(search))
    .filter(model=>filter==="all"
      ||(filter==="free"&&model.isFree===true)
      ||(filter==="paid"&&model.isFree===false)
      ||(filter==="unknown"&&(model.isFree===null||model.isFree===undefined)));
}

export function countModelFilters(models) {
  return {
    all:models.length,
    free:models.filter(model=>model.isFree===true).length,
    paid:models.filter(model=>model.isFree===false).length,
    unknown:models.filter(model=>model.isFree===null||model.isFree===undefined).length,
  };
}
