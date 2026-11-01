/* Same-origin Studio media, catalog and world authoring, staged until publication. */
(() => {
  'use strict';
  const q=s=>document.querySelector(s), tr=(en,ar)=>state.language==='ar'?ar:en;
  const words={title:['Bring your own world','اصنع عالمك بملفاتك'],intro:['Upload, inspect, fit, bind, preview, then publish. Existing preset models remain available.','ارفع وافحص واضبط واربط وعاين ثم انشر. النماذج الجاهزة تبقى متاحة.'],file:['Model or media file','ملف نموذج أو وسائط'],upload:['Upload & inspect','رفع وفحص'],refresh:['Refresh library','تحديث المكتبة'],fit:['Model fit','ضبط النموذج'],scale:['Scale','الحجم'],floor:['Floor offset','ارتفاع الأرضية'],rotation:['Rotation X / Y / Z (degrees)','الدوران X / Y / Z (درجات)'],target:['Camera target X / Y / Z','هدف الكاميرا X / Y / Z'],saveFit:['Save fitted transform','حفظ ضبط النموذج'],binding:['Use this asset in the game','استخدم الملف في اللعبة'],kind:['Content type','نوع المحتوى'],entity:['Content ID','معرّف المحتوى'],bind:['Save binding to draft','حفظ الربط في المسودة'],bindingHint:['Property/item bindings update the catalog draft. Character/map bindings update the release draft. Publish after previewing.','ربط العقارات والعناصر يحدّث مسودة الكتالوج. ربط الشخصيات والخريطة يحدّث مسودة الإصدار. عاين ثم انشر.'],property:['Property / house','عقار / منزل'],item:['Item','عنصر'],weapon:['Weapon','سلاح'],armor:['Armor','درع'],character:['Character outfit','زي الشخصية'],map:['Map service rooftop model','مجسم على سطح مبنى الخدمة'],shop:['Shop inventory','مخزون المتاجر'],shopIntro:['Server-owned shop listings, not player trades. Saving changes the draft only. Removing a row stops stocking it after publication.','عروض المتجر التابعة للخادم وليست سوق اللاعبين. الحفظ يغيّر المسودة فقط. حذف الصف يوقف عرضه بعد النشر.'],add:['Add listing','إضافة عرض'],saveShop:['Save shop draft','حفظ مسودة المتجر'],seller:['Shop name','اسم المتجر'],quantity:['Stock','المخزون'],remove:['Remove','حذف الصف'],world:['Underworld director','مدير أحداث المدينة'],worldIntro:['A persistent server worker creates bounded finds, supply changes and news. Page reads never mint rewards.','عامل مستمر ينشئ اللقى والمخزون والأخبار ضمن حدود واضحة. قراءة الصفحة لا تمنح مكافآت.'],enabled:['Director enabled','تفعيل المدير'],savePolicy:['Save director policy','حفظ سياسة المدير'],crimeRules:['Tools, mastery & consequences','الأدوات والإتقان والعواقب'],requiredTool:['Required item ID (optional)','معرّف العنصر المطلوب (اختياري)'],toolQuantity:['Required quantity','الكمية المطلوبة'],consumeTool:['Consume tool on attempt','استهلاك الأداة عند المحاولة'],mastery:['Mastery per success','الإتقان لكل نجاح'],chainWindow:['Chain window (seconds)','نافذة السلسلة (ثواني)'],chainBonus:['Chain cash bonus (basis points)','مكافأة نقدية للسلسلة (نقاط أساس)'],critical:['Critical chance after a failed attempt (basis points)','احتمال الإخفاق الحرج عند الفشل (نقاط أساس)'],jailSeconds:['Jail consequence (seconds)','عقوبة السجن (ثواني)'],hospitalSeconds:['Hospital consequence (seconds)','عقوبة المستشفى (ثواني)'],rulesHint:['10,000 basis points = 100%. Publish saved rules before players see them.','١٠٬٠٠٠ نقطة أساس = ١٠٠٪. انشر القواعد المحفوظة لتظهر للاعبين.']};
  Object.assign(words,{inspectorTitle:['3D asset fit inspector','فاحص ضبط الأصل ثلاثي الأبعاد'],uploadProgress:['Upload progress','تقدم الرفع'],rotationAxis:['Rotation (degrees)','الدوران (درجات)'],targetAxis:['Camera target','هدف الكاميرا']});
  Object.assign(words,{
    uploadSending:['Uploading...','جارٍ الرفع...'],
    uploadQueued:['Upload stored and queued for inspection.','تم تخزين الملف وإضافته إلى قائمة انتظار الفحص.'],
    uploadInspecting:['Upload stored. Background inspection is running.','تم تخزين الملف. الفحص الخلفي قيد العمل.'],
    uploadReady:['Upload ready. Save a binding, preview it, then publish the draft to use it in the game.','الملف جاهز. احفظ الربط وعاينه ثم انشر المسودة لاستخدامه في اللعبة.'],
    uploadFailed:['Upload inspection failed. Review the error and upload a corrected file.','فشل فحص الملف. راجع الخطأ وارفع ملفاً مصححاً.']
  });
  Object.assign(words,{
    materialIssuance:['Material issuance','إصدار المواد'],
    findValueBudgetPerHour:['City finds: hourly value for the whole game','لقى المدينة: قيمة المواد في الساعة للعبة كلها'],
    searchValueBudgetPerHour:['Search crimes: hourly value for each player','جرائم البحث: قيمة المواد في الساعة لكل لاعب'],
    issuanceHelp:['Leave a budget blank to keep existing behavior. Enter 0 to stop new materials from that source after publishing. A positive whole value sets an hourly limit.','اترك الميزانية فارغة للاحتفاظ بالسلوك الحالي. أدخل 0 لإيقاف إصدار مواد جديدة من هذا المصدر بعد النشر. يحدد العدد الصحيح الموجب سقف القيمة في الساعة.'],
    issuanceValueHelp:['Value uses 90% of published item prices. Issued materials count even when a find expires or goes unclaimed. Each limit resets with the UTC server hour.','تُحسب القيمة بنسبة 90% من أسعار العناصر المنشورة. تُحتسب المواد الصادرة حتى لو انتهت صلاحية اللقية أو لم يطالب بها أحد. يتجدد كل حد مع ساعة الخادم بتوقيت UTC.'],
    allMaterials:['All published materials (existing behavior)','كل المواد المنشورة (السلوك الحالي)'],
    materialItemIds:['Materials allowed for finds and search','المواد المسموح بها في اللقى والبحث'],
    materialSelectionHelp:['Keep all materials, or turn that option off and choose 1 to 32 materials. Save this draft, preview, then publish to apply it. Owned items are unchanged.','احتفظ بكل المواد، أو ألغِ هذا الخيار واختر من مادة واحدة إلى 32 مادة. احفظ المسودة وعاينها ثم انشرها لتطبيقها. تبقى العناصر المملوكة كما هي.'],
    budgetLegacy:['Existing behavior: no new hourly budget.','السلوك الحالي: لا توجد ميزانية جديدة للساعة.'],
    budgetStopped:['No new materials from this source after publication.','لن تصدر مواد جديدة من هذا المصدر بعد النشر.'],
    budgetLimited:['Hourly value limit: ','سقف القيمة في الساعة: '],
    budgetInvalid:['Enter a whole value from 0 to 2,000,000,000, or leave the budget blank for existing behavior.','أدخل عدداً صحيحاً من 0 إلى 2,000,000,000، أو اترك الميزانية فارغة للاحتفاظ بالسلوك الحالي.'],
    materialSelectionInvalid:['Choose 1 to 32 different existing material items. Other item types are not eligible.','اختر من مادة واحدة إلى 32 مادة مختلفة وموجودة. أنواع العناصر الأخرى غير مؤهلة.'],
    policyUnsaved:['Policy edits are not saved yet.','تعديلات السياسة لم تُحفظ بعد.'],
    policySaving:['Saving the policy draft...','جارٍ حفظ مسودة السياسة...'],
    policyNotSaved:['Policy not saved. Resolve the displayed conflict or connection error, then retry.','لم تُحفظ السياسة. عالج تعارض المسودة أو خطأ الاتصال الظاهر، ثم أعد المحاولة.']
  });
  const text=k=>words[k]?tr(...words[k]):k, saved=()=>tr('Draft saved. Preview and publish when ready.','تم حفظ المسودة. عاين ثم انشر عندما تصبح جاهزة.');
  const policy={tickSeconds:[60,30,3600,'Tick interval (seconds)','الفاصل بين النبضات (ثواني)'],findsPerTick:[1,0,3,'Finds per tick','اللقى في كل نبضة'],findQuantity:[1,1,3,'Items per find','الكمية في كل لقية'],findLifetimeSeconds:[900,60,86400,'Find lifetime (seconds)','مدة بقاء اللقية (ثواني)'],maxActiveFinds:[24,1,64,'Maximum active finds','الحد الأقصى للقى'],supplyShift:[2,0,20,'Supply shift per tick','تغير المخزون في كل نبضة'],supplyCap:[100,1,1000,'Maximum shop stock','الحد الأقصى للمخزون'],eventEveryTicks:[5,1,100,'Ticks per news event','عدد النبضات لكل خبر']};
  const issuanceBudgets=['findValueBudgetPerHour','searchValueBudgetPerHour'];
  for(const[key,value]of Object.entries(policy))words[key]=value.slice(3);
  let library=[],selected=null,busy=false,language='',loaded=false,poll=null,shopDirty=false,policyDirty=false;
  let workerHealth,uploadNotice=null;
  let interactionRevision=0,inspectionRevision=0,libraryRevision=0,inspectorRevision=0,shopEditRevision=0,policyEditRevision=0,shopRenderedRevision=null,shopSaving=false,policySaving=false;
  let policyMaterialSelection=[],policyMaterialRenderKey='',policyStatus=null;
  const fitEdits=new Map();
  const hasUnsaved=()=>fitEdits.size>0||shopDirty||shopSaving||policyDirty||policySaving||busy;
  const workshop=document.createElement('section');workshop.className='studio-media-workshop';
  const vector=(prefix,label,min,max)=>`<label><span data-media-copy="${label}"></span><span class="media-vector">${['X','Y','Z'].map(a=>`<input id="${prefix+a}" data-media-aria="${label==='rotation'?'rotationAxis':'targetAxis'}" data-media-axis="${a}" aria-label="${label+' '+a}" type="number" min="${min}" max="${max}" step="any" value="0" required>`).join('')}</span></label>`;
  workshop.innerHTML=`<header><span class="eyebrow">STUDIO / CUSTOM MEDIA</span><h2 data-media-copy="title"></h2><p data-media-copy="intro"></p></header>
  <form id="mediaUploadForm" class="media-upload"><label><span data-media-copy="file"></span><input id="mediaDiskFile" type="file" accept=".glb,.gltf,.fbx,.obj,.zip,.png,.webp,.jpg,.jpeg,.mp3" required><small>GLB · GLTF · FBX · OBJ · ZIP · PNG · WEBP · JPG · MP3 / 128 MiB</small></label><button class="button primary" data-media-copy="upload"></button><button class="button ghost" type="button" id="mediaRefresh" data-media-copy="refresh"></button><progress id="mediaProgress" value="0" max="100" data-media-aria="uploadProgress" aria-label="Upload progress"></progress></form>
  <p id="mediaMessage" role="status" aria-live="polite"></p><p id="mediaWorkerStatus" role="status"></p>
  <div class="media-workbench"><div id="uploadedMediaList" class="media-library-list"></div><div id="mediaInspection" hidden><h3 id="mediaSelectedName"></h3><iframe id="mediaInspector" title="3D asset fit inspector" loading="lazy"></iframe><pre id="mediaMetadata"></pre>
  <form id="mediaFitForm"><h3 data-media-copy="fit"></h3><div class="form-grid"><label><span data-media-copy="scale"></span><input id="mediaScale" type="number" min="0.000001" max="10000" step="any" value="1" required></label><label><span data-media-copy="floor"></span><input id="mediaFloor" type="number" min="-10000" max="10000" step="any" value="0" required></label>${vector('mediaRotation','rotation',-360,360)}${vector('mediaTarget','target',-10000,10000)}</div><button class="button secondary" data-media-copy="saveFit"></button></form>
  <form id="mediaBindingForm"><h3 data-media-copy="binding"></h3><p data-media-copy="bindingHint"></p><div class="form-grid"><label><span data-media-copy="kind"></span><select id="mediaTargetType">${['property','item','weapon','armor','character','map'].map(k=>`<option value="${k}" data-media-copy="${k}"></option>`).join('')}</select></label><label><span data-media-copy="entity"></span><input id="mediaTargetId" list="mediaTargets" maxlength="80" pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,79}" required><datalist id="mediaTargets"></datalist></label></div><button class="button primary" data-media-copy="bind"></button></form></div></div>`;
  q('.view[data-view="assets"]').insertBefore(workshop,q('#assetGrid'));
  const shop=document.createElement('details');shop.className='panel media-shop-workshop';shop.innerHTML=`<summary data-media-copy="shop"></summary><p data-media-copy="shopIntro"></p><form id="shopCatalogForm"><div id="shopListingRows"></div><button type="button" class="button secondary" id="shopAddListing" data-media-copy="add"></button><button class="button primary" data-media-copy="saveShop"></button><span id="shopDraftStatus" role="status"></span></form>`;q('#studioCatalogPanel').after(shop);
  const world=document.createElement('details');world.className='panel media-world-workshop';world.innerHTML=`<summary data-media-copy="world"></summary><p data-media-copy="worldIntro"></p><form id="worldPolicyForm"><label class="toggle-row"><input id="worldPolicyEnabled" type="checkbox" checked><span data-media-copy="enabled"></span></label><div class="form-grid">${Object.entries(policy).map(([key,[value,min,max]])=>`<label><span data-media-copy="${key}"></span><input id="worldPolicy-${key}" type="number" value="${value}" min="${min}" max="${max}" step="1" required></label>`).join('')}</div>
  <fieldset id="worldMaterialPolicy"><legend data-media-copy="materialIssuance"></legend><p id="worldIssuanceHelp" data-media-copy="issuanceHelp"></p><p data-media-copy="issuanceValueHelp"></p>
  <div class="form-grid">${issuanceBudgets.map(key=>`<label><span data-media-copy="${key}"></span><input id="worldPolicy-${key}" type="number" min="0" max="2000000000" step="1" value="" aria-describedby="worldIssuanceHelp worldPolicy-${key}-state"><small id="worldPolicy-${key}-state"></small></label>`).join('')}</div>
  <label class="toggle-row"><input id="worldPolicy-allMaterials" type="checkbox" checked><span data-media-copy="allMaterials"></span></label>
  <label><span data-media-copy="materialItemIds"></span><select id="worldPolicy-materialItemIds" multiple size="6" aria-describedby="worldMaterialSelectionHelp" disabled></select></label><p id="worldMaterialSelectionHelp" data-media-copy="materialSelectionHelp"></p></fieldset>
  <button class="button primary" data-media-copy="savePolicy"></button><span id="worldDraftStatus" role="status"></span></form>`;q('.view[data-view="territories"]').insertBefore(world,q('#territorySummary'));
  function message(value,error=false,owner=null){
    if(owner&&owner!==uploadNotice)return;
    if(!owner)uploadNotice=null;
    const target=q('#mediaMessage'),className=error?'media-error':'';
    if(target.textContent!==value)target.textContent=value;
    if(target.className!==className)target.className=className;
  }
  function renderUploadNotice(){
    const notice=uploadNotice;if(!notice)return;
    const key={uploading:'uploadSending',queued:'uploadQueued',processing:'uploadInspecting',inspecting:'uploadInspecting',ready:'uploadReady',failed:'uploadFailed'}[notice.status]??'uploadQueued';
    const failed=notice.status==='failed';
    message((notice.name?notice.name+': ':'')+text(key)+(failed&&notice.error?' '+notice.error:''),failed,notice);
  }
  function updateUploadNotice(asset){
    const notice=uploadNotice;if(!notice?.id||asset?.id!==notice.id)return;
    notice.status=asset.status??notice.status;notice.name=asset.name??notice.name;notice.error=asset.error??null;renderUploadNotice();
  }
  function buttons(){const blocked=busy||!state.bootReady||Boolean(state.controlBusy)||state.catalogBusy;workshop.querySelectorAll('button').forEach(el=>{el.disabled=blocked;});}
  function renderList(){q('#uploadedMediaList').innerHTML=library.length?library.map(asset=>`<button type="button" class="media-library-entry ${asset.id===selected?'selected':''}" data-inspect-asset="${esc(asset.id)}"><strong>${esc(asset.name)}</strong><span>${esc(asset.format??'')} · ${esc(asset.status)}</span><code>${esc(asset.id)}</code></button>`).join(''):`<p>${tr('No uploaded assets yet.','لا توجد ملفات مرفوعة بعد.')}</p>`;q('#uploadedMediaList').querySelectorAll('[data-inspect-asset]').forEach(el=>el.onclick=()=>inspect(el.dataset.inspectAsset).catch(e=>message(e.message,true)));buttons();}
  function renderWorkerStatus(){if(workerHealth===undefined)return;q('#mediaWorkerStatus').textContent=tr('Worker health: ','حالة العامل: ')+(workerHealth?(workerHealth.workers??[]).map(worker=>worker.id+' '+(worker.healthy?tr('running','يعمل'):tr('not responding','لا يستجيب'))).join(' · '):tr('Unavailable','غير متاحة'));}
  async function reloadLibrary(){
    if(!adminCanMutate())return;
    const request=++libraryRevision;clearTimeout(poll);poll=null;
    let data;try{data=await api('/api/v1/admin/assets');}catch(error){if(request===libraryRevision)throw error;return;}if(request!==libraryRevision)return;
    library=data.assets??[];loaded=true;renderList();updateUploadNotice(library.find(asset=>asset.id===uploadNotice?.id));
    const health=await api('/api/v1/admin/workers').catch(()=>null);if(request!==libraryRevision)return;
    workerHealth=health??null;renderWorkerStatus();
    if(library.some(a=>!['ready','failed'].includes(a.status)))poll=setTimeout(()=>{poll=null;if(state.view==='assets')return reloadLibrary().catch(e=>message(e.message,true));},2000);
    if(library.find(a=>a.id===selected)?.status==='ready'&&q('#mediaInspector').dataset.asset!==selected)await inspect(selected,false);
  }
  async function upload(event){
    event.preventDefault();if(busy||!adminCanMutate())return;const file=q('#mediaDiskFile').files?.[0];if(!file)return;
    if(!/\.(glb|gltf|fbx|obj|zip|png|webp|jpe?g|mp3)$/i.test(file.name)||file.size<1||file.size>134217728){message(tr('Choose a supported file of up to 128 MiB.','اختر ملفاً مدعوماً بحجم لا يتجاوز ١٢٨ ميبيبايت.'),true);return;}
    const interaction=interactionRevision,notice={id:null,name:file.name,status:'uploading',error:null};uploadNotice=notice;busy=true;buttons();renderUploadNotice();
    try{
      const start=await api('/api/v1/admin/assets/uploads',{method:'POST',body:JSON.stringify({name:file.name,size:file.size})});let offset=0;
      while(offset<file.size){const bytes=new Uint8Array(await file.slice(offset,offset+524288).arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=16384)raw+=String.fromCharCode(...bytes.subarray(i,i+16384));await api(`/api/v1/admin/assets/uploads/${start.uploadId}/chunks`,{method:'POST',body:JSON.stringify({offset,base64:btoa(raw)})});offset+=bytes.length;q('#mediaProgress').value=Math.round(offset/file.size*100);}
      const result=await api(`/api/v1/admin/assets/uploads/${start.uploadId}/complete`,{method:'POST',body:'{}'}),uploaded=result.id??result.asset?.id;
      if(uploadNotice===notice){notice.id=uploaded;updateUploadNotice({...result.asset??result,id:uploaded,status:result.asset?.status??result.status??'queued',name:result.asset?.name??result.name??file.name});}
      await reloadLibrary();
      if(uploaded&&interaction===interactionRevision)await inspect(uploaded,false);
    }catch(error){message(error.message,true);}finally{busy=false;buttons();}
  }
  function transform(){return{scale:Number(q('#mediaScale').value),rotation:['X','Y','Z'].map(a=>Number(q('#mediaRotation'+a).value)),floorOffset:Number(q('#mediaFloor').value),cameraTarget:['X','Y','Z'].map(a=>Number(q('#mediaTarget'+a).value))};}
  function fillTransform(value={}){q('#mediaScale').value=value.scale??1;q('#mediaFloor').value=value.floorOffset??0;['X','Y','Z'].forEach((a,i)=>{q('#mediaRotation'+a).value=(value.rotation?.[i]??0).toFixed(4);q('#mediaTarget'+a).value=value.cameraTarget?.[i]??0;});}
  function pushTransform(){if(selected)q('#mediaInspector').contentWindow?.postMessage({type:'zone:asset-transform',assetId:selected,transform:transform()},location.origin);}
  function mountInspector(id){
    // A fresh browsing context fences queued reports from an older visit or
    // locale. An iframe's WindowProxy survives ordinary src changes.
    const oldFrame=q('#mediaInspector'),frame=document.createElement('iframe');frame.id='mediaInspector';frame.setAttribute('title',text('inspectorTitle'));frame.setAttribute('loading','lazy');
    frame.dataset.asset=id??'';frame.dataset.language=state.language;
    if(id)frame.src=`/dist/asset-inspector.html?asset=${id}&lang=${state.language}`;
    oldFrame.replaceWith(frame);inspectorRevision=0;
  }
  function refreshInspector(){
    const frame=q('#mediaInspector');frame.setAttribute('title',text('inspectorTitle'));
    if(state.view!=='assets'||!selected||frame.dataset.asset!==selected)return;
    const src=`/dist/asset-inspector.html?asset=${selected}&lang=${state.language}`;
    if(frame.dataset.language!==state.language||frame.getAttribute('src')!==src)mountInspector(selected);
  }
  async function inspect(id,explicit=true){
    if(explicit)interactionRevision++;
    if(selected!==id)q('#mediaInspection').hidden=true;
    selected=id;const request=++inspectionRevision;renderList();let asset;
    try{asset=await api('/api/v1/admin/assets/'+id);}catch(error){if(request===inspectionRevision&&selected===id)throw error;return;}
    if(selected!==id||request!==inspectionRevision)return;
    updateUploadNotice(asset);
    q('#mediaInspection').hidden=false;q('#mediaSelectedName').textContent=asset.name;q('#mediaMetadata').textContent=JSON.stringify({status:asset.status,format:asset.format,metadata:{...asset.metadata,thumbnail:undefined},error:asset.error},null,2);
    fillTransform(fitEdits.get(id)??asset.transform);
    mountInspector(asset.status==='ready'?id:null);
    q('#mediaFitForm').hidden=asset.status!=='ready'||asset.kind!=='model';q('#mediaBindingForm').hidden=asset.status!=='ready';targets();
  }
  function acceptCatalog(snapshot){if(Number(snapshot?.revision)>=Number(state.gameplayCatalog?.revision??-1)){state.gameplayCatalog=snapshot;return true;}return false;}
  function targets(){const type=q('#mediaTargetType').value,catalogs=state.gameplayCatalog?.catalogs??{};const rows=type==='property'?(catalogs.properties??[]).map(e=>[e.id,e]):['item','weapon','armor'].includes(type)?Object.entries(catalogs.items??{}).filter(([,e])=>type==='item'||e.type===type):type==='character'?[['suit',{}],['street',{}],['tactical',{}]]:['bank','gym','alley','hospital','jail','market','shop','home','hq','jobs','school','casino','missions','arena','news','hof','pier'].map(id=>[id,{}]);q('#mediaTargets').innerHTML=rows.map(([id,e])=>`<option value="${esc(id)}">${esc(e.name?.[state.language]??id)}</option>`).join('');}
  async function bind(event){event.preventDefault();if(busy||!adminCanMutate()||!selected)return;const type=q('#mediaTargetType').value,id=q('#mediaTargetId').value.trim(),assetId=selected,catalogBinding=['property','item','weapon','armor'].includes(type);busy=true;if(catalogBinding)state.catalogBusy=true;buttons();try{if(catalogBinding){const category=type==='property'?'properties':'items';acceptCatalog(await api(`/api/v1/admin/gameplay-catalog/${category}/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({expectedRevision:state.gameplayCatalog.revision,changes:{mediaAsset:assetId}})}));await refreshDraftAfterMutation();renderGameplayCatalog();markDirty();}else{const manifest=state.draft.manifest;manifest.mediaBindings=(manifest.mediaBindings??[]).filter(row=>row.targetType!==type||row.targetId!==id);manifest.mediaBindings.push({targetType:type,targetId:id,assetId});markDirty();if(!await saveDraft())throw new Error('Release draft not saved. Resolve the displayed conflict.');}message(saved());targets();}catch(error){message(error.message,true);}finally{if(catalogBinding){state.catalogBusy=false;renderGameplayCatalog();}busy=false;buttons();}}
  function shopItemName(id,entry){return entry?.name?.[state.language]||catalogDefaultLabels.items?.[id]?.[state.language]||id;}
  function shopRow(listing={item:Object.keys(state.gameplayCatalog?.catalogs.items??{})[0]??'',qty:10,seller:'ZONE Supply'}){const row=document.createElement('div');row.className='media-shop-row';row.innerHTML=`<label><span data-media-copy="item">${esc(text('item'))}</span><select class="shop-item">${Object.entries(state.gameplayCatalog?.catalogs.items??{}).map(([id,e])=>`<option value="${esc(id)}">${esc(shopItemName(id,e))}</option>`).join('')}</select></label><label><span data-media-copy="quantity">${esc(text('quantity'))}</span><input class="shop-qty" type="number" min="0" max="100000" step="1" required></label><label><span data-media-copy="seller">${esc(text('seller'))}</span><input class="shop-seller" maxlength="160" required></label><button class="button ghost" type="button" data-media-copy="remove">${esc(text('remove'))}</button>`;row.querySelector('.shop-item').value=listing.item;row.querySelector('.shop-qty').value=listing.qty;row.querySelector('.shop-seller').value=listing.seller;row.querySelector('button').onclick=()=>{row.remove();shopDirty=true;shopEditRevision++;};row.oninput=()=>{shopDirty=true;shopEditRevision++;};return row;}
  function localizeShopOptions(){const items=state.gameplayCatalog?.catalogs.items??{};q('#shopListingRows').querySelectorAll('.shop-item').forEach(select=>{select.querySelectorAll('option').forEach(option=>{option.textContent=shopItemName(option.value,items[option.value]);});});}
  function renderPolicyStatus(){if(policyStatus)q('#worldDraftStatus').textContent=policyStatus.key==='saved'?saved():(policyStatus.field?text(policyStatus.field)+': ':'')+text(policyStatus.key);}
  function setPolicyStatus(key,field=null){policyStatus={key,field};renderPolicyStatus();}
  function policyValidationError(key,field=null){const error=new Error((field?text(field)+': ':'')+text(key));error.policyStatus={key,field};return error;}
  function policyFailure(error){if(error.policyStatus){policyStatus=error.policyStatus;renderPolicyStatus();}else{policyStatus=null;q('#worldDraftStatus').textContent=error.message;}}
  function readPolicyBudget(key){const raw=q('#worldPolicy-'+key).value.trim(),value=Number(raw);if(raw&&(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<0||value>2000000000))throw policyValidationError('budgetInvalid',key);return raw?value:null;}
  function renderPolicyMaterials(){
    const select=q('#worldPolicy-materialItemIds'),rows=Object.entries(state.gameplayCatalog?.catalogs.items??{}).filter(([,entry])=>entry.type==='material'),key=JSON.stringify([state.language,rows.map(([id,entry])=>[id,shopItemName(id,entry)])]);
    if(key!==policyMaterialRenderKey){select.innerHTML=rows.map(([id,entry])=>`<option value="${esc(id)}">${esc(shopItemName(id,entry))} (${esc(id)})</option>`).join('');policyMaterialRenderKey=key;}
    select.querySelectorAll('option').forEach(option=>{option.selected=policyMaterialSelection.includes(option.value);});select.disabled=q('#worldPolicy-allMaterials').checked;
    for(const budget of issuanceBudgets){const hint=q('#worldPolicy-'+budget+'-state');try{const value=readPolicyBudget(budget);hint.textContent=value===null?text('budgetLegacy'):value===0?text('budgetStopped'):text('budgetLimited')+value;}catch(_){hint.textContent=text('budgetInvalid');}}
  }
  function readPolicyIssuance(){
    const extension={};
    for(const key of issuanceBudgets)extension[key]=readPolicyBudget(key);
    const ids=q('#worldPolicy-allMaterials').checked?null:[...policyMaterialSelection],items=state.gameplayCatalog?.catalogs.items??{};
    if(ids&&(ids.length<1||ids.length>32||new Set(ids).size!==ids.length||ids.some(id=>items[id]?.type!=='material')))throw policyValidationError('materialSelectionInvalid');
    extension.materialItemIds=ids;return extension;
  }
  function refresh(){
    if(language!==state.language){
      document.querySelectorAll('[data-media-copy]').forEach(el=>{el.textContent=text(el.dataset.mediaCopy);});
      document.querySelectorAll('[data-media-aria]').forEach(el=>{el.setAttribute('aria-label',text(el.dataset.mediaAria)+(el.dataset.mediaAxis?' '+el.dataset.mediaAxis:''));});
      language=state.language;renderList();targets();localizeShopOptions();renderWorkerStatus();renderUploadNotice();renderPolicyStatus();
    }
    if(state.bootReady&&!shopDirty&&shopRenderedRevision!==state.gameplayCatalog?.revision){q('#shopListingRows').innerHTML='';(state.gameplayCatalog?.catalogs.market??[]).forEach(row=>q('#shopListingRows').append(shopRow(row)));shopRenderedRevision=state.gameplayCatalog?.revision;}
    if(state.bootReady&&!policyDirty&&!policySaving){const value=state.draft.manifest.worldPolicy??{};q('#worldPolicyEnabled').checked=value.enabled??true;for(const[key,[fallback]]of Object.entries(policy))q('#worldPolicy-'+key).value=value[key]??fallback;for(const key of issuanceBudgets)q('#worldPolicy-'+key).value=value[key]??'';q('#worldPolicy-allMaterials').checked=value.materialItemIds==null;policyMaterialSelection=Array.isArray(value.materialItemIds)?[...value.materialItemIds]:[];}
    renderPolicyMaterials();
    if(state.bootReady&&state.view==='assets'&&!loaded)reloadLibrary().catch(e=>message(e.message,true));
    refreshInspector();buttons();
  }
  q('#mediaUploadForm').onsubmit=upload;q('#mediaRefresh').onclick=()=>reloadLibrary().catch(e=>message(e.message,true));q('#mediaTargetType').onchange=targets;q('#mediaBindingForm').onsubmit=bind;q('#mediaFitForm').oninput=()=>{if(selected){fitEdits.set(selected,transform());interactionRevision++;pushTransform();}};
  q('#mediaFitForm').onsubmit=async event=>{
    event.preventDefault();if(!selected||busy||!adminCanMutate())return;
    const assetId=selected,edit=fitEdits.get(assetId),value=transform();++inspectionRevision;busy=true;buttons();
    try{await api('/api/v1/admin/assets/'+assetId+'/transform',{method:'PUT',body:JSON.stringify(value)});if(fitEdits.get(assetId)===edit)fitEdits.delete(assetId);message(saved());await reloadLibrary();}catch(error){message(error.message,true);}finally{busy=false;buttons();}
  };
  q('#shopAddListing').onclick=()=>{if(adminCanMutate()){q('#shopListingRows').append(shopRow());shopDirty=true;shopEditRevision++;}};
  q('#shopCatalogForm').onsubmit=async event=>{
    event.preventDefault();if(!adminCanMutate()||state.catalogBusy)return;const edit=shopEditRevision;state.catalogBusy=true;shopSaving=true;
    try{const listings=[...q('#shopListingRows').children].map(row=>({item:row.querySelector('.shop-item').value,qty:Number(row.querySelector('.shop-qty').value),seller:row.querySelector('.shop-seller').value.trim()}));acceptCatalog(await api('/api/v1/admin/shop-catalog',{method:'PUT',body:JSON.stringify({expectedRevision:state.gameplayCatalog.revision,listings})}));shopDirty=shopEditRevision!==edit;q('#shopDraftStatus').textContent=saved();markDirty();await refreshDraftAfterMutation();}catch(error){q('#shopDraftStatus').textContent=error.message;}finally{state.catalogBusy=false;shopSaving=false;renderGameplayCatalog();refresh();}
  };
  q('#worldPolicyForm').oninput=event=>{policyDirty=true;policyEditRevision++;if(event.target.id==='worldPolicy-materialItemIds')policyMaterialSelection=[...event.target.selectedOptions].map(option=>option.value);renderPolicyMaterials();setPolicyStatus('policyUnsaved');};
  q('#worldPolicyForm').onsubmit=async event=>{
    event.preventDefault();if(policySaving||!adminCanMutate())return;let extension;
    try{extension=readPolicyIssuance();}catch(error){policyDirty=true;policyFailure(error);return;}
    const edit=policyEditRevision;policySaving=true;policyDirty=true;setPolicyStatus('policySaving');
    state.draft.manifest.worldPolicy={...state.draft.manifest.worldPolicy,enabled:q('#worldPolicyEnabled').checked,...Object.fromEntries(Object.keys(policy).map(key=>[key,Number(q('#worldPolicy-'+key).value)])),...extension};markDirty();
    try{if(await saveDraft()){policyDirty=policyEditRevision!==edit;setPolicyStatus(policyDirty?'policyUnsaved':'saved');}else setPolicyStatus('policyNotSaved');}catch(error){policyFailure(error);}finally{policySaving=false;}
  };
  window.addEventListener('message',event=>{
    const frame=q('#mediaInspector');if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    const data=event.data;if(data?.type!=='zone:asset-inspected'||data.assetId!==selected||frame.dataset.asset!==selected||!data.transform)return;
    if(data.revision!==undefined){if(!Number.isSafeInteger(data.revision)||data.revision<=inspectorRevision)return;inspectorRevision=data.revision;}
    if(data.applied===true){fillTransform(data.transform);fitEdits.set(selected,transform());interactionRevision++;}
    else if(data.revision===1)pushTransform();
  });
  window.addEventListener('beforeunload',event=>{if(hasUnsaved()){event.preventDefault();event.returnValue='';}});
  if(typeof MutationObserver==='function')new MutationObserver(()=>{if(state.view==='assets')refresh();}).observe(q('.view[data-view="assets"]'),{attributes:true,attributeFilter:['class']});
  const supportedUploadExtensions=()=>['glb','gltf','fbx','obj','zip','png','webp','jpg','jpeg','mp3'];
  const isSupportedUploadFile=(name,size=1)=>/\.(glb|gltf|fbx|obj|zip|png|webp|jpe?g|mp3)$/i.test(String(name??''))&&Number.isFinite(Number(size))&&Number(size)>=1&&Number(size)<=134217728;
  const supportedBindingKinds=()=>['property','item','weapon','armor','character','map'];
  const diagnostics=()=>({loaded,libraryCount:library.length,readyCount:library.filter(a=>a?.status==='ready').length,selected,busy,fitEditCount:fitEdits.size,shopDirty,policyDirty,shopSaving,policySaving,policyMaterialCount:policyMaterialSelection.length,hasUnsaved:hasUnsaved(),language});
  window.ZoneMedia={refresh,hasUnsaved,diagnostics,supportedUploadExtensions,isSupportedUploadFile,supportedBindingKinds};refresh();
})();
