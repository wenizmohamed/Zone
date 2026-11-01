/* Existing ZONE API adapter. GET refreshes never claim rewards or synthesize progress. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ZoneModulePanel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const endpoints={player:'/api/v1/player',contract:'/api/v1/daily/contract',achievements:'/api/v1/achievements',notifications:'/api/v1/notifications'};
  const copy={
    en:{profile:'Player dossier',daily:'Daily objective',achievements:'Achievements',notifications:'Activity',refresh:'Refresh',claim:'Claim reward',login:'Collect daily reward',claimed:'Collected',loading:'Loading player activity...',failed:'Some player activity could not be loaded. Refresh to try again.',actionFailed:'The reward could not be collected. Refresh before trying again.',refreshFailed:'Reward accepted. Player data could not be refreshed yet.',preview:'Live player activity is unavailable in preview.',busy:'Another reward request is in progress.',disposed:'This player panel is closed.',unknown:'Player update',firstScore:'First score',firstScoreDescription:'Complete your first successful crime.',strength:'Strength',defense:'Defense',speed:'Speed',dexterity:'Dexterity',cash:'Cash',bank:'Bank balance',level:'Level',city:'City',streak:'Login streak'},
    ar:{profile:'ملف اللاعب',daily:'هدف اليوم',achievements:'الإنجازات',notifications:'النشاط',refresh:'تحديث',claim:'استلام المكافأة',login:'استلام مكافأة اليوم',claimed:'تم الاستلام',loading:'جارٍ تحميل نشاط اللاعب...',failed:'تعذر تحميل بعض بيانات اللاعب. حدّث للمحاولة مجدداً.',actionFailed:'تعذر استلام المكافأة. حدّث قبل المحاولة مجدداً.',refreshFailed:'تم قبول المكافأة. لم تُحدّث بيانات اللاعب بعد.',preview:'نشاط اللاعب المباشر غير متاح في المعاينة.',busy:'هناك طلب مكافأة قيد التنفيذ.',disposed:'لوحة اللاعب مغلقة.',unknown:'تحديث اللاعب',firstScore:'الضربة الأولى',firstScoreDescription:'أكمل أول جريمة ناجحة.',strength:'القوة',defense:'الدفاع',speed:'السرعة',dexterity:'البراعة',cash:'النقد',bank:'رصيد البنك',level:'المستوى',city:'المدينة',streak:'أيام الدخول المتتالية'}
  };
  const clone=value=>JSON.parse(JSON.stringify(value));
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const localized=(value,lang,fallback='')=>typeof value==='string'?value:String(value?.[lang]??value?.en??value?.ar??fallback);
  function create(options={}){
    const fetcher=options.fetch||(typeof globalThis.fetch==='function'?globalThis.fetch.bind(globalThis):null);
    const raw={player:null,contract:null,achievements:[],notifications:[]};
    let errors={},loading=false,pending=null,lastReward=null,actionError=null,disposed=false,generation=0,loadPromise=null,actionPromise=null;
    const lang=()=>typeof options.lang==='function'?options.lang():options.lang||'en';
    function view(language=lang()){
      const languageKey=language==='ar'?'ar':'en',labels=copy[languageKey],player=raw.player,source=raw.contract,contract=source?.contract;
      const daily=contract?{
        id:String(contract.id),day:String(contract.day),title:localized({en:contract.name_en,ar:contract.name_ar},languageKey),
        metric:String(contract.metric),screen:({crimes:'crimes',stat_gain:'gym',job_cash:'jobs',attack_wins:'attack'})[contract.metric]||null,
        progress:number(source.progress),target:number(source.target),remaining:Math.max(0,number(source.target)-number(source.progress)),percent:source.target>0?Math.min(100,Math.max(0,number(source.progress)/number(source.target)*100)):0,
        complete:source.complete===true,claimed:source.claimed===true,rewardCash:number(contract.reward_cash),rewardXp:number(contract.reward_xp),
        canClaim:source.complete===true&&source.claimed!==true&&!loading&&!pending&&!errors.contract&&!options.preview
      }:null;
      const statsList=player?['strength','defense','speed','dexterity'].map(id=>({id,label:labels[id],value:number(player[id])})):[];
      const profile=player?{id:String(player.id),name:String(player.username),level:number(player.level),xp:number(player.xp),cash:number(player.cash),bank:number(player.bank_balance),netWorth:number(player.cash)+number(player.bank_balance),totalBattleStats:statsList.reduce((sum,item)=>sum+item.value,0),city:String(player.city),stats:statsList}:null;
      return clone({
        preview:!!options.preview,loading,pending,error:actionError?(actionError.kind==='refresh'?labels.refreshFailed:labels.actionFailed):Object.keys(errors).length?labels.failed:null,
        errorDetail:actionError?.message||null,errors,labels,player,profile,contract:daily,
        achievements:raw.achievements.map(item=>({code:String(item.code),title:item.code==='first-score'?labels.firstScore:String(item.code),description:item.code==='first-score'?labels.firstScoreDescription:'',unlockedAt:item.unlocked_at})),
        notifications:raw.notifications.map(item=>({id:String(item.id),type:String(item.type),message:localized({en:item.payload?.message_en,ar:item.payload?.message_ar},languageKey,labels.unknown),createdAt:item.created_at,bar:item.payload?.bar||null})),
        streak:player?{day:number(player.login_streak),nextRewardCash:Math.min(7,number(player.login_streak)+1)*500,lastLoginDay:player.last_login_day||null,claimed:!!contract?.day&&player.last_login_day===contract.day,canClaim:!!contract?.day&&player.last_login_day!==contract.day&&!loading&&!pending&&!errors.player&&!errors.contract&&!options.preview}:null,
        lastReward
      });
    }
    function notify(){if(!disposed&&typeof options.onChange==='function')options.onChange(view());}
    async function request(path,method='GET'){
      if(!fetcher)throw new Error('Fetch is unavailable.');
      const response=await fetcher(path,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})});
      let payload;try{payload=await response.json();}catch(_){throw new Error('The engine returned an invalid response.');}
      if(!response.ok){const error=new Error(String(payload?.error||'The engine request failed.'));error.status=response.status;throw error;}
      return payload;
    }
    function validate(section,data){
      if(section==='player'){if(!data?.player||typeof data.player.id!=='string'||typeof data.player.username!=='string')throw new Error('Invalid player response.');return data.player;}
      if(section==='contract'){if(!data?.contract||typeof data.contract.id!=='string'||typeof data.contract.day!=='string'||!Number.isFinite(Number(data.target))||Number(data.target)<=0)throw new Error('Invalid daily contract response.');return data;}
      if(!Array.isArray(data?.[section]))throw new Error('Invalid '+section+' response.');
      if(data[section].some(item=>!item||typeof item!=='object'||(section==='achievements'?typeof item.code!=='string':typeof item.id!=='string'||typeof item.type!=='string')))throw new Error('Invalid '+section+' response.');
      return data[section];
    }
    function refresh(playerContext=null){
      if(disposed)return Promise.resolve(view());
      if(options.preview){notify();return Promise.resolve(view());}
      const ticket=++generation;loading=true;errors={};notify();
      const run=Promise.all(Object.entries(endpoints).map(async([section,path])=>{
        try{return{section,value:validate(section,await request(path))};}
        catch(error){return{section,error:{message:String(error.message),status:error.status||0}};}
      })).then(results=>{
        if(disposed||ticket!==generation)return view();
        for(const result of results){if(result.error)errors[result.section]=result.error;else raw[result.section]=result.value;}
        loading=false;
        // A background panel GET must never overwrite a concurrent gameplay mutation.
        // The caller can sequence the explicit claim callback against its own mutations.
        if(playerContext&&!errors.player&&typeof options.onPlayer==='function')options.onPlayer(clone(raw.player),playerContext);
        notify();return view();
      }).finally(()=>{if(loadPromise===run)loadPromise=null;});
      loadPromise=run;return run;
    }
    function load(){
      if(actionPromise)return actionPromise.then(()=>view(),()=>view());
      actionError=null;return loadPromise||refresh();
    }
    function claim(kind){
      if(disposed)return Promise.reject(new Error(copy[lang()==='ar'?'ar':'en'].disposed));
      if(options.preview)return Promise.reject(new Error(copy[lang()==='ar'?'ar':'en'].preview));
      if(actionPromise)return pending===kind?actionPromise:Promise.reject(new Error(copy[lang()==='ar'?'ar':'en'].busy));
      // A claim invalidates every earlier GET so stale balances cannot land after it.
      generation++;pending=kind;loading=false;actionError=null;notify();
      const run=(async()=>{
        let result;
        try{
          result=await request(kind==='daily'?'/api/v1/daily/contract/claim':'/api/v1/daily/login','POST');
          if(disposed)return result;
          const reward=kind==='login'?result.streak:result;
          lastReward={kind,alreadyClaimed:kind==='login'&&reward===null,cash:number(reward?.rewardCash),xp:number(reward?.rewardXp),streakDay:number(reward?.streakDay),nerveRefilled:reward?.nerveRefilled===true,energyRefilled:reward?.energyRefilled===true};
          await refresh({reason:'claim',kind});
          if(Object.keys(errors).length)actionError={kind:'refresh',message:'Refresh player activity to see the accepted reward.'};
          return result;
        }catch(error){
          if(!disposed){actionError={kind:'action',message:String(error.message),status:error.status||0};await refresh();}
          throw error;
        }finally{pending=null;notify();}
      })().finally(()=>{if(actionPromise===run)actionPromise=null;});
      actionPromise=run;return run;
    }
    function diagnostics(){
      return {preview:!!options.preview,loading,pending,disposed,generation,hasPlayer:Boolean(raw.player),hasContract:Boolean(raw.contract),achievementCount:raw.achievements.length,notificationCount:raw.notifications.length,errorCount:Object.keys(errors).length,hasLastReward:Boolean(lastReward)};
    }
    return {load,view,read:view,diagnostics,isDisposed:()=>disposed,isLoading:()=>loading,claimDaily:()=>claim('daily'),claimLogin:()=>claim('login'),dispose(){disposed=true;generation++;}};
  }
  return {create,endpoints:()=>clone(endpoints),sections:()=>Object.keys(endpoints),isSupportedSection:section=>Object.hasOwn(endpoints,String(section??'')),supportedContractMetrics:()=>['crimes','stat_gain','job_cash','attack_wins'],contractScreenForMetric:metric=>({crimes:'crimes',stat_gain:'gym',job_cash:'jobs',attack_wins:'attack'})[String(metric??'')]||null,supportedLanguages:()=>['en','ar'],isSupportedLanguage:lang=>lang==='en'||lang==='ar'};
});
