/* Uses the existing Quiz Explorer map, avatar, controls and feedback UI.
   Only the transport changes; Magic TALK credentials stay in the parent. */
window.MagicTalkExplorer=(()=>{
 const channel='magic-explorer-v1';
 let parentOrigin='',bundle=null,positions=[],sequence=0;
 const pending=new Map();
 const request=(method,payload={})=>new Promise((resolve,reject)=>{
  const id=`${Date.now()}-${++sequence}`;
  const timer=setTimeout(()=>{pending.delete(id);reject(new Error('매직톡 연결 시간이 초과되었습니다. 위의 다시 연결을 눌러 주세요.'));},25000);
  pending.set(id,{resolve,reject,timer});window.parent.postMessage({channel,id,method,payload},parentOrigin);
 });
 function receive(e){
  if(e.source!==window.parent||e.origin!==parentOrigin||e.data?.channel!==channel)return;
  const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);clearTimeout(p.timer);
  e.data.error?p.reject(new Error(e.data.error)):p.resolve(e.data.data);
 }
 const numberOf=id=>[...bundle.players].sort((a,b)=>a.id.localeCompare(b.id)).findIndex(p=>p.id===id)+1;
 const mine=()=>bundle.players.find(p=>p.id===bundle.playerId);
 const done=()=>bundle.answers.length;
 const question=q=>({id:q.id,type:q.question_type==='multiple_choice'?'mc':q.question_type==='ox'?'ox':'short',q:q.prompt,options:q.choices||[],hint:'',explain:'',image:q.image_url||''});
 function state(){
  return {now:Date.now(),status:bundle.session.status==='finished'?'ended':bundle.session.status,players:bundle.players.map(p=>{
   const loc=positions.find(x=>x.player_id===p.id&&Number(x.z)===11);
   return {n:numberOf(p.id),nm:p.name,a:`a${(numberOf(p.id)-1)%6+1}`,s:p.score,o:p.correct_count,c:p.id===bundle.playerId?done():p.current_question,me:p.id===bundle.playerId,on:!!loc,x:loc?loc.x/100*2400:null,y:loc?loc.y/100*1600:null};
  })};
 }
 function joinData(){
  const me=mine();
  return {game:{id:bundle.session.id,title:`매직톡 ${bundle.roomCode} · 퀴즈 탐험대`,mode:'explore',map:'village',seed:parseInt(bundle.session.id.replaceAll('-','').slice(0,8),16),total:bundle.questions.length,questions:bundle.questions.map(question),settings:{timer:0,retry:false,showAnswer:true,intro:'친구들과 깃발을 찾아 문제를 풀어요.'}},state:state(),me:{score:me.score,ok:me.correct_count,done:done()},answered:bundle.answers.map(a=>({q:bundle.questions.findIndex(q=>q.id===a.question_id),att:1,ok:a.correct}))};
 }
 async function transport(fn,args){
  if(fn==='s_join')return joinData();
  if(fn==='s_sync'){
   bundle=await request('read');
   try{positions=await request('position',{x:args.p_x/2400*100,y:args.p_y/1600*100});}catch{positions=[];}
   // Recover committed answers after a dropped response or a frame reload.
   for(const a of bundle.answers){const station=G.stations.find(s=>s.q.id===a.question_id);if(station&&!station.status&&G.cur?.s!==station){station.status=a.correct?'ok':'bad';station.att=1;}}
   return state();
  }
  if(fn==='s_answer'){
   const q=bundle.questions[args.p_q];if(!q)throw new Error('문제를 찾을 수 없습니다.');
   const response=q.question_type==='multiple_choice'?(/^\d+$/.test(String(args.p_given))?(q.choices[Number(args.p_given)]??''):''):String(args.p_given??'');
   const answer=await request('answer',{questionId:q.id,response});bundle=answer.bundle;
   const r=answer.result,me=mine();
   return {correct:r.correct,final:true,attempt:1,points:r.points,score:me.score,ok:me.correct_count,done:done(),answer:q.question_type==='multiple_choice'?q.choices.indexOf(r.answer):r.answer,explain:r.explain||''};
  }
  throw new Error('매직톡 연동 화면에서 지원하지 않는 기능입니다.');
 }
 async function start(){
  const supplied=new URLSearchParams(location.search).get('parentOrigin');
  const allowed=supplied==='https://magicclass-next.vercel.app'||supplied==='https://magicclass-next-git-feature-mag-6f62d4-junsus-projects-b6dcb098.vercel.app'||/^https:\/\/magicclass-next-[a-z0-9-]+-junsus-projects-b6dcb098\.vercel\.app$/.test(supplied||'');
  if(window.parent===window||!allowed){toast('매직톡의 퀴즈 참가 버튼으로 접속해 주세요.',10);return;}
  parentOrigin=supplied;window.addEventListener('message',receive);
  const loading=h('div',{class:'modal-wrap'},h('section',{class:'card',style:'padding:30px'},h('h2',null,'매직톡 퀴즈에 연결 중…'),h('p',null,'이름과 승인 문제를 불러오고 있어요.')));document.body.append(loading);
  try{
   bundle=await request('join');
   if(!bundle.questions.length||bundle.questions.length>15)throw new Error('탐험대는 한 게임에 1~15문제까지 사용할 수 있습니다.');
   const me=mine();if(!me)throw new Error('학생 정보를 찾을 수 없습니다.');
   Auth.s={student:{num:numberOf(me.id),name:me.name,avatar:`a${(numberOf(me.id)-1)%6+1}`},class:{code:bundle.roomCode,name:'매직톡 연결 학급'}};
   Auth.t=null;scall=transport;
   openLobby=()=>{stopSync();showScreen('final');$('#scr-final').replaceChildren(h('section',{class:'card wrap'},h('h2',null,'매직톡 연결 게임'),h('p',null,'위쪽 출제 보드로 돌아가거나 이어서 플레이하세요.'),h('button',{class:'btn primary',onclick:()=>joinGame(bundle.session.id)},'게임 이어서 하기')));};
   const originalPanel=showQPanel,originalShort=showShortPanel;
   const addImage=()=>{const url=G.cur?.q.image;if(!url)return;const box=G.cur.q.type==='short'?$('#spanel'):$('#qpanel');const img=h('img',{src:url,alt:'문제 자료',style:'display:block;max-height:120px;max-width:100%;margin:8px auto;object-fit:contain'});box.prepend(img);};
   showQPanel=()=>{originalPanel();addImage();};showShortPanel=()=>{originalShort();addImage();};
   // Native game startup is reused, including map generation and walking controls.
   await joinGame(bundle.session.id);loading.remove();
  }catch(e){loading.replaceChildren(h('section',{class:'card',style:'padding:30px'},h('h2',null,'연결을 확인해 주세요'),h('p',null,e.message),h('p',null,'매직톡 화면 위의 다시 연결을 눌러 주세요.')));}
 }
 return {start};
})();
