// node render.cjs <url> <w> <h> <fps> <durationMs> <outDir> [transparent=0|1] [scale=1]
const {chromium}=require('/Users/rasvas/Documents/virtuse-concierge-deploy/bitcoin-concierge/node_modules/playwright-core');
const fs=require('fs');
const [url,w,h,fps,dur,out,transparent,scale]=process.argv.slice(2);
(async()=>{
  fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch({headless:true});
  const p=await b.newPage({viewport:{width:+w,height:+h},deviceScaleFactor:+(scale||1)});
  await p.goto(url); await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=0;}));
  const n=Math.round(+dur*+fps/1000);
  for(let i=0;i<n;i++){
    const t=i*1000/+fps;
    await p.evaluate(t=>document.getAnimations().forEach(a=>{a.currentTime=t;}),t);
    await p.screenshot({path:`${out}/f${String(i).padStart(4,'0')}.png`,omitBackground:transparent==='1',animations:'allow'});
  }
  const na=await p.evaluate(()=>document.getAnimations().length);
  console.log(`rendered ${n} frames -> ${out} (animations: ${na})`);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
