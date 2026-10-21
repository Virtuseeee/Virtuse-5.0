// node render3d.cjs <url> <w> <h> <fps> <durationMs> <outDir> [transparent]
const {chromium}=require('/Users/rasvas/Documents/virtuse-concierge-deploy/bitcoin-concierge/node_modules/playwright-core');
const fs=require('fs'); const [url,w,h,fps,dur,out,transparent]=process.argv.slice(2);
(async()=>{fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:+w,height:+h},deviceScaleFactor:1});
p.on('pageerror',e=>console.error('pageerror',e.message)); p.on('console',m=>{if(m.type()==='error')console.error('console',m.text())});
await p.goto(url); await p.waitForFunction(()=>window.ready,null,{timeout:60000});
const n=Math.round(+dur*+fps/1000);
for(let i=0;i<n;i++){await p.evaluate(t=>window.seek(t),i*1000/+fps); await p.screenshot({path:`${out}/f${String(i).padStart(4,'0')}.png`,omitBackground:transparent==='1'});}
console.log(`rendered ${n} frames -> ${out}`); await b.close();})().catch(e=>{console.error(e);process.exit(1)});
