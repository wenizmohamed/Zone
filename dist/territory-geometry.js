/* Dissolve an edge-sharing territory tessellation. Not a general overlapping-polygon union.
   Display geometry only: original block polygons remain the gameplay authority. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZoneTerritoryGeometry=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var EPS=1e-9;
  function key(p){return p[0].toFixed(9)+','+p[1].toFixed(9);}
  function signed(r){var a=r[0],sum=0;for(var i=0;i<r.length-1;i++)sum+=(r[i][0]-a[0])*(r[i+1][1]-a[1])-(r[i+1][0]-a[0])*(r[i][1]-a[1]);return sum/2;}
  function inRing(r,p){var yes=false;for(var i=0,j=r.length-1;i<r.length;j=i++){var a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  function contains(geometry,p){var polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;return polygons.some(function(rings){return inRing(rings[0],p)&&!rings.slice(1).some(function(r){return inRing(r,p);});});}
  function ringOf(feature){
    if(!feature.geometry||feature.geometry.type!=='Polygon'||feature.geometry.coordinates.length!==1)throw new Error('Invalid territory polygon');
    var points=[];feature.geometry.coordinates[0].forEach(function(p){if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))throw new Error('Invalid territory coordinate');var q=[Number(p[0].toFixed(9)),Number(p[1].toFixed(9))];if(!points.length||key(q)!==key(points[points.length-1]))points.push(q);});
    if(points.length&&key(points[0])!==key(points[points.length-1]))points.push(points[0]);
    if(points.length<4||Math.abs(signed(points))<1e-18)throw new Error('Invalid territory area');
    if(signed(points)<0)points.reverse();return points;
  }
  function simplify(ring){var points=ring.slice(0,-1),changed=true;while(changed&&points.length>3){changed=false;for(var i=0;i<points.length;i++){var a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(cross)<EPS*Math.hypot(c[0]-a[0],c[1]-a[1])){points.splice(i,1);changed=true;break;}}}points.push(points[0]);return points;}
  function center(r){var points=r.slice(0,-1);return points.reduce(function(sum,p){return[sum[0]+p[0]/points.length,sum[1]+p[1]/points.length];},[0,0]);}
  function dissolve(collection){
    var input=Array.isArray(collection)?collection:(collection&&collection.features)||[],seen=new Set(),groups=new Map(),vertices=new Map();
    input.slice().sort(function(a,b){return String(a.id).localeCompare(String(b.id),'en');}).forEach(function(feature){
      if(feature.id==null||seen.has(String(feature.id)))throw new Error('Invalid or duplicate territory ID');seen.add(String(feature.id));
      var ring=ringOf(feature),properties=feature.properties||{},owner=properties.neutral?'':String(properties.ownerId||''),item={id:String(feature.id),ring:ring,properties:properties};
      ring.forEach(function(p){vertices.set(key(p),p);});if(!groups.has(owner))groups.set(owner,[]);groups.get(owner).push(item);
    });
    var allPoints=Array.from(vertices.values()),output=[];
    Array.from(groups.keys()).sort().forEach(function(owner){
      var items=groups.get(owner),parents=items.map(function(_,i){return i;}),segments=new Map();
      function find(i){while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;}
      items.forEach(function(item,index){for(var i=0;i<item.ring.length-1;i++){
        var a=item.ring[i],b=item.ring[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),length2=length*length;
        var cuts=[{p:a,t:0},{p:b,t:1}];
        allPoints.forEach(function(p){var t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2;if(t>EPS/length&&t<1-EPS/length&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)<=EPS*length)cuts.push({p:p,t:t});});
        cuts.sort(function(x,y){return x.t-y.t;});
        for(var c=0;c<cuts.length-1;c++){var from=cuts[c].p,to=cuts[c+1].p,ak=key(from),bk=key(to);if(ak===bk)continue;var edgeKey=ak<bk?ak+'|'+bk:bk+'|'+ak,edge={a:from,b:to,ak:ak,bk:bk,index:index};
          if(!segments.has(edgeKey))segments.set(edgeKey,[]);segments.get(edgeKey).push(edge);
        }
      }});
      segments.forEach(function(edges){if(edges.length>2)throw new Error('Invalid overlapping territory edges');if(edges.length===2){if(edges[0].ak!==edges[1].bk)throw new Error('Invalid overlapping territory winding');parents[find(edges[1].index)]=find(edges[0].index);}});
      var components=new Map();items.forEach(function(item,i){var id=find(i);if(!components.has(id))components.set(id,{items:[],edges:[]});components.get(id).items.push(item);});
      segments.forEach(function(edges){if(edges.length===1)components.get(find(edges[0].index)).edges.push(edges[0]);});
      components.forEach(function(component){
        var edges=component.edges.sort(function(a,b){return(a.ak+'|'+a.bk).localeCompare(b.ak+'|'+b.bk,'en');}),outgoing=new Map(),used=new Set(),rings=[];
        edges.forEach(function(edge,i){edge.number=i;if(!outgoing.has(edge.ak))outgoing.set(edge.ak,[]);outgoing.get(edge.ak).push(edge);});
        edges.forEach(function(first){if(used.has(first.number))return;var edge=first,ring=[edge.a];
          for(var guard=0;guard<=edges.length;guard++){
            used.add(edge.number);ring.push(edge.b);if(edge.bk===first.ak)break;
            var choices=(outgoing.get(edge.bk)||[]).filter(function(next){return !used.has(next.number);});if(!choices.length)throw new Error('Invalid open territory boundary');
            var vx=edge.b[0]-edge.a[0],vy=edge.b[1]-edge.a[1];choices.sort(function(a,b){function angle(next){var x=next.b[0]-next.a[0],y=next.b[1]-next.a[1];return Math.atan2(vx*y-vy*x,vx*x+vy*y);}return angle(b)-angle(a);});edge=choices[0];
          }
          if(key(ring[0])!==key(ring[ring.length-1]))throw new Error('Invalid territory boundary cycle');rings.push(simplify(ring));
        });
        var outers=rings.filter(function(r){return signed(r)>0;}).map(function(r){return[r];}),holes=rings.filter(function(r){return signed(r)<0;});
        holes.forEach(function(hole){var shell=outers.find(function(rings){return inRing(rings[0],hole[0]);});if(!shell)throw new Error('Invalid territory hole');shell.push(hole);});
        if(!outers.length)throw new Error('Invalid territory outer ring');
        var geometry={type:outers.length===1?'Polygon':'MultiPolygon',coordinates:outers.length===1?outers[0]:outers},ids=component.items.map(function(item){return item.id;}).sort(),average=component.items.reduce(function(sum,item){var p=center(item.ring);return[sum[0]+p[0]/component.items.length,sum[1]+p[1]/component.items.length];},[0,0]);
        var candidates=component.items.map(function(item){return center(item.ring);}).filter(function(p){return contains(geometry,p);});candidates.sort(function(a,b){return Math.hypot(a[0]-average[0],a[1]-average[1])-Math.hypot(b[0]-average[0],b[1]-average[1]);});
        output.push({type:'Feature',id:(owner||'neutral')+':'+ids[0],properties:Object.assign({},component.items[0].properties,{ownerId:owner,blockIds:ids,blockCount:ids.length,contestedCount:component.items.filter(function(item){return item.properties.contested;}).length,anchor:candidates[0]||center(component.items[0].ring)}),geometry:geometry});
      });
    });
    output.sort(function(a,b){return a.id.localeCompare(b.id,'en');});return{type:'FeatureCollection',features:output};
  }
  return Object.freeze({dissolve:dissolve,contains:contains});
});
