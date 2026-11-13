import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
const BASE='http://localhost:3000', USER_ID='user_3Lmh1qN46xEB1p7P1bc7Tf6823q'
const env=await readFile('.env.local','utf8'); const secret=env.split('\n').find(l=>l.startsWith('CLERK_SECRET_KEY=')).split('=').slice(1).join('=').trim()
const {token}=await (await fetch('https://api.clerk.com/v1/sign_in_tokens',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({user_id:USER_ID,expires_in_seconds:600})})).json()
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:320,height:900}})
await p.goto(BASE); await p.waitForFunction(()=>Boolean(window.Clerk?.loaded)); await p.evaluate(async t=>{const a=await window.Clerk.client.signIn.create({strategy:'ticket',ticket:t}); if(a.createdSessionId) await window.Clerk.setActive({session:a.createdSessionId})},token)
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1800)
await p.goto(BASE+'/messages?conversationId=md7cxrav52ygcgn8xxrkkrwznn8hr1f4',{waitUntil:'domcontentloaded'})
await p.waitForFunction(()=>!document.body.innerText.includes('Getting things ready'),null,{timeout:20000}).catch(()=>{})
await p.waitForTimeout(1500)
console.log(JSON.stringify(await p.evaluate(()=>{
  const pick=(s)=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)}}
  return {chat:pick('.messages-chat'),thread:pick('.direct-thread'),list:pick('.direct-message-list'),composer:pick('.direct-composer-shell'),nav:pick('.mobile-primary-nav'),vh:innerHeight,rows:getComputedStyle(document.querySelector('.direct-thread')).gridTemplateRows}
}),null,1))
await b.close()
