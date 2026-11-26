const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const dom=new JSDOM(html,{url:'https://quiz-explorer-class.vercel.app/?magicTalkBridge=1&parentOrigin=https%3A%2F%2Fmagicclass-next.vercel.app',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,context=dom.getInternalVMContext();
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.requestAnimationFrame=()=>0;
Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve(),load:()=>Promise.resolve([])}});
const gradient={addColorStop(){}};
const ctx=new Proxy({measureText:s=>({width:String(s).length*10}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,createPattern:()=>({})},{get:(o,k)=>k in o?o[k]:()=>{}});
w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.HTMLCanvasElement.prototype.toDataURL=()=>'';
const id='00000000-0000-0000-0000-000000000001';
const bundle={session:{id,status:'playing',renderer:'quiz-explorer'},roomCode:'TEST01',playerId:'p1',players:[{id:'p1',name:'테스트학생',score:0,correct_count:0,current_question:0}],questions:[{id:'q1',prompt:'2+2는?',question_type:'multiple_choice',choices:['3','4']},{id:'q2',prompt:'대한민국 수도?',question_type:'short_answer',choices:[]}],answers:[]};
const calls=[];
const parent={postMessage(message,target){calls.push({message,target});let data;if(message.method==='join'||message.method==='read')data=structuredClone(bundle);else if(message.method==='position')data=[];else if(message.method==='answer'){const q=message.payload.questionId,correct=message.payload.response===(q==='q1'?'4':'서울');bundle.answers.push({question_id:q,correct});bundle.players[0].score+=correct?100:0;bundle.players[0].correct_count+=correct?1:0;data={result:{correct,points:correct?100:0,answer:q==='q1'?'4':'서울'},bundle:structuredClone(bundle)};}
 setTimeout(()=>w.dispatchEvent(new w.MessageEvent('message',{origin:target,source:parent,data:{channel:message.channel,id:message.id,data}})),0);
}};
Object.defineProperty(w,'parent',{value:parent});
const run=s=>new vm.Script(s).runInContext(context);
run([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]);run(fs.readFileSync('magic-talk-bridge.js','utf8'));
(async()=>{
 await run('boot()');
 assert.equal(run('SCREEN'),'play');assert.equal(run('G.map.id'),'village');assert.equal(run('G.stations.length'),2);assert.equal(run('Auth.s.student.name'),'테스트학생');
 run('startQuestion(G.stations[0])');await run('judgeNet(1,false)');assert.equal(run('G.round.score'),100);assert.equal(run('G.stations[0].status'),'ok');assert.equal(calls.find(c=>c.message.method==='answer').message.payload.response,'4');
 run('continueExplore();startQuestion(G.stations[1])');await run("judgeNet('부산',false)");assert.equal(run('G.stations[1].status'),'bad');assert.match(w.document.querySelector('#fbpanel').textContent,/서울/);
 assert.equal(run('G.round.done'),2);assert(calls.every(c=>c.target==='https://magicclass-next.vercel.app'));assert(!JSON.stringify(calls).includes('p_token'));
 run('stopSync()');dom.window.close();console.log('PASS: original map boot, student identity, MC answer mapping, short-answer feedback, totals, exact-origin messages, no credentials transferred');
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
