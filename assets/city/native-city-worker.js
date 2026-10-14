// Geometry preparation is off the browser interaction thread. Mapbox then
// tiles this one GeoJSON source in its own workers and culls it natively.
importScripts('atlas.js?v=84','native-city.js?v=84');
self.onmessage=function(event){
  try{self.postMessage(ZoneNativeCity.compile(ZoneCityAtlas.createPlan(event.data.features)));}
  catch(error){self.postMessage({error:String(error.message||error)});}
};
