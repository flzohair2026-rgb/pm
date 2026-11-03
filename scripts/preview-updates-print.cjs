const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const path = require('node:path');
const compile = source => ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020 } }).outputText;
const context = { exports:{},require };
vm.runInNewContext(compile(fs.readFileSync('src/components/reports/UpdatesReportPrintFrame.tsx','utf8')),context);
const frame=context.exports;
function renderFixture(count,longNames=false) {
 const kinds=['booked','future','temporary','available','maintenance','cleaning','overdue'];
 const today=new Date().toISOString().slice(0,10);
 const rows=Array.from({length:count},(_,i)=>({unit_id:`unit-${i}`,unit_number:`U-${String(i+1).padStart(4,'0')}`,unit_type_name:longNames?'جناح عائلي فاخر بغرفتي نوم وصالة ومطبخ مستقل':`نموذج ${i%7+1}`,unit_type_price:150,unit_monthly_price:3500,unit_status_kind:kinds[i%7],unit_status_text:'حالة الوحدة',check_in:today,check_out:'2026-12-03',has_future_booking:i%7===1,future_check_in:'2026-12-05',future_check_out:'2027-01-05',future_nights:31,booking_status:'confirmed',hotel_id:'h1',hotel_name:'فندق تجريبي'}));
 let state=0;
 const fakeReact={...React,useState(initial){return [state++===1?rows:(typeof initial==='function'?initial():initial),()=>{}];},useEffect(){},useMemo(fn){return fn();}};
 const pageContext={exports:{},console,require(name){if(name==='react')return fakeReact;if(name==='next/link')return 'a';if(name==='@/components/auth/RoleGate')return ({children})=>children;if(name==='@/lib/supabase')return {};if(name==='@/hooks/useActiveHotel')return {useActiveHotel:()=>({activeHotelId:'all'})};if(name==='@/components/reports/UpdatesReportPrintFrame')return frame;return require(name);}};
 vm.runInNewContext(compile(fs.readFileSync('src/app/(app)/(main)/reports/updates/page.tsx','utf8')),pageContext);
 const tree=pageContext.exports.default();
 let target;
 function find(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(find);return;}if(node.type===frame.default)target=node;else find(node.props?.children);}
 find(tree);if(!target)throw new Error('Print frame missing');
 return '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>Updates print fixture</title><style>html,body{margin:0;padding:0;background:white}</style><body>'+renderToStaticMarkup(target)+'<script>window.fitReport=()=>('+frame.fitUpdatesPrint.toString()+')(document.querySelector(".updates-sheet"),document.querySelector(".updates-content"));window.addEventListener("beforeprint",window.fitReport);</script></body></html>';
}
module.exports={frame,renderFixture};
if(require.main===module) (async()=>{
 const {chromium}=require('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1026-487-0_26.1026.487.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright');
 const output=path.resolve(process.env.UPDATES_PRINT_QA_DIR||'tmp/updates-print-qa');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1123,height:794},deviceScaleFactor:1});
  await page.emulateMedia({media:'print'});
  for(const [count,longNames] of [[0,false],[54,false],[107,false],[107,true],[160,true]]){
   await page.setContent(renderFixture(count,longNames),{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
   const metrics=await page.evaluate(()=>{window.fitReport();const sheet=document.querySelector('.updates-sheet');const content=document.querySelector('.updates-content');const rect=sheet.getBoundingClientRect();const contentRect=content.getBoundingClientRect();return {cards:document.querySelectorAll('.p-card').length,scale:Number(sheet.dataset.printScale),sheetHeight:rect.height,contentHeight:contentRect.height,withinFrame:contentRect.bottom<=rect.bottom+1};});
   if(metrics.cards!==count||!metrics.withinFrame)throw new Error(JSON.stringify(metrics));
   const name=`updates-${count}${longNames?'-long':''}`;
   await page.pdf({path:path.join(output,name+'.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
   if(count===107&&!longNames)await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
   console.log(JSON.stringify({name,...metrics}));
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
