(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ZoneMapFrameSample=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // Opt-in diagnostics: browser animation opportunities, not GPU presentation.
  // Never asks Mapbox to render an extra frame.
  function create(options){
    var frame=null,previous=null,deltas=[],sequence=0,label='';
    var limit=Math.max(2,Math.min(240,options.frames||120));
    function cancel(){if(frame!==null)options.cancel(frame);frame=null;previous=null;deltas=[];}
    function tick(timestamp){
      frame=null;if(!options.visible()){cancel();return;}
      if(previous!==null)deltas.push(timestamp-previous);previous=timestamp;
      if(deltas.length<limit){frame=options.request(tick);return;}
      var sorted=deltas.slice().sort(function(a,b){return a-b;});
      options.publish({sequence:++sequence,label:label,frames:deltas.length,
        mean:deltas.reduce(function(sum,n){return sum+n;},0)/deltas.length,
        p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted[sorted.length-1],
        over33ms:deltas.filter(function(n){return n>33;}).length});
      previous=null;deltas=[];
    }
    return {start:function(name){if(frame!==null||!options.visible())return;label=name||'camera';frame=options.request(tick);},cancel:cancel};
  }
  function watch(map,options){
    var started=null,last=null,first=null,intervals=[],renders=0,sequence=0,action='';
    function cancel(){started=null;last=null;first=null;intervals=[];renders=0;}
    function start(event){cancel();action=event&&event.zoneCameraAction||'';if(options.visible())started=options.now();}
    function render(){if(started===null)return;if(!options.visible()){cancel();return;}var time=options.now();if(first===null)first=time-started;if(last!==null)intervals.push(time-last);last=time;renders++;}
    function finish(){if(started===null)return;var duration=options.now()-started;
      var result={sequence:++sequence,action:action,durationMs:duration,firstFrameMs:first,renderFrames:renders,maxIntervalMs:intervals.length?Math.max.apply(null,intervals):0,over33ms:intervals.filter(function(n){return n>33;}).length,visible:options.visible()};cancel();options.publish(result);}
    map.on('movestart',start);map.on('render',render);map.on('moveend',finish);
    return {cancel:cancel,dispose:function(){cancel();map.off('movestart',start);map.off('render',render);map.off('moveend',finish);}};
  }
  return {create:create,watch:watch};
});
