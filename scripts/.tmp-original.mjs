import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
const BASE='http://localhost:3000', USER_ID='user_3Lmh1qN46xEB1p7P1bc7Tf6823q'
const env=await readFile('.env.local','utf8'); const secret=env.split('\n').find(l=>l.startsWith('CLERK_SECRET_KEY=')).split('=').slice(1).join('=').trim()
const {token}=await (await fetch('https://api.clerk.com/v1/sign_in_tokens',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({user_id:USER_ID,expires_in_seconds:600})})).json()
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:1440,height:1000}})
await ctx.addInitScript(()=>localStorage.setItem('lets-be-friends-theme','dark'))
const p=await ctx.newPage()
await p.goto(BASE); await p.waitForFunction(()=>Boolean(window.Clerk?.loaded)); await p.evaluate(async t=>{const a=await window.Clerk.client.signIn.create({strategy:'ticket',ticket:t}); if(a.createdSessionId) await window.Clerk.setActive({session:a.createdSessionId})},token)
await p.reload({waitUntil:'load'}); await p.waitForTimeout(2200)
console.log(await p.evaluate(()=>document.documentElement.dataset.theme))
await p.goto(BASE+'/app',{waitUntil:'domcontentloaded'})
await p.waitForFunction(()=>!document.body.innerText.includes('Getting things ready'),null,{timeout:20000}).catch(()=>{})
await p.waitForTimeout(1500)
await p.screenshot({path:'.playwright-mcp/review/original-bookings-calendar-1440.png',fullPage:true,scale:'css'})
const cards=p.getByRole('button',{name:/Cards/}).first()
if (await cards.count()) { await cards.click(); await p.waitForTimeout(800) }
await p.screenshot({path:'.playwright-mcp/review/original-bookings-cards-1440.png',fullPage:true,scale:'css'})
console.log('captured')
await b.close()
