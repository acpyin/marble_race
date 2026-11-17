import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../outputs/azure-yunjian-preview');
const samples=[
  {id:'01-平述',title:'平述',style:'sports_commentary',degree:1,rate:'+0%',text:'好，八颗弹珠已经出发。青岚和紫罗并肩进入木质长坡，后面的选手还挤在一起，第一轮争位就要开始了。'},
  {id:'02-追赶',title:'追赶',style:'sports_commentary',degree:1.15,rate:'+5%',text:'我们看到银河正在追！刚才还落后两个球身，现在已经贴到青岚身边了。前面就是三角导流块，这一段很可能改变顺序。'},
  {id:'03-反超',title:'反超',style:'sports_commentary_excited',degree:1.22,rate:'+8%',text:'漂亮！银河从外侧杀出来，超过青岚，来到第一！两颗球几乎擦着拨杆过去，这一下反超真是干净利落！'},
  {id:'04-漏斗',title:'漏斗',style:'sports_commentary',degree:1.08,rate:'-2%',text:'进圆形漏斗了，先看谁更靠近中心落孔。青岚还在外圈打转，翠羽已经贴近出口；别看入碗时差了半圈，现在反而是翠羽占先。'},
  {id:'05-夺冠',title:'夺冠',style:'sports_commentary_excited',degree:1.28,rate:'+10%',text:'来了，最后的收口！银河顶住追击，率先钻进排次槽！冠军确定了，是银河！后面的球还在争第二，我们继续看！'}
];
const escapeXml=text=>text.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&quot;',"'":'&apos;'}[c]));
const makeSsml=sample=>`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="zh-CN-YunjianNeural"><mstts:express-as style="${sample.style}" styledegree="${sample.degree}"><prosody rate="${sample.rate}">${escapeXml(sample.text)}</prosody></mstts:express-as></voice></speak>`;
await fs.mkdir(output,{recursive:true});
const region=process.env.AZURE_SPEECH_REGION??process.env.SPEECH_REGION;
const key=process.env.AZURE_SPEECH_KEY??process.env.SPEECH_KEY;
if(region&&!/^[a-z0-9]+$/i.test(region))throw new Error('Azure Speech 区域格式无效');
const generated=[];
for(const sample of samples){
  await fs.writeFile(path.join(output,`${sample.id}.ssml`),makeSsml(sample),'utf8');
  if(!region||!key)continue;
  const response=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
    method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-160kbitrate-mono-mp3','User-Agent':'MarbleRaceVoicePreview/1.0'},body:makeSsml(sample)
  });
  if(!response.ok)throw new Error(`${sample.title} 生成失败：HTTP ${response.status}。检查 Azure Speech 区域、密钥及云健音色可用性。`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<500)throw new Error(`${sample.title} 返回音频过短`);
  await fs.writeFile(path.join(output,`${sample.id}.mp3`),bytes);
  generated.push(sample.id);
}
const entries=samples.map(({id,title,style,degree,rate,text})=>`<section><h2>${title}</h2><p>${text}</p><p>试验值：${style} · 强度 ${degree} · 语速 ${rate}</p>${generated.includes(id)?`<audio controls src="${id}.mp3"></audio>`:'<p>音频待生成</p>'}</section>`).join('');
await fs.writeFile(path.join(output,'试听.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>云健赛事解说五段试听</title><style>body{font:16px/1.65 system-ui;max-width:740px;margin:40px auto;padding:0 20px;background:#f4f0e9;color:#302c28}section{padding:16px 24px;margin:16px 0;background:white;border-radius:12px;box-shadow:0 2px 10px #0001}audio{width:100%}</style><h1>云健赛事解说五段试听</h1><p>下列控制值均为试听候选，听过之后再决定正式音色和参数。</p>${entries}</html>`,'utf8');
await fs.writeFile(path.join(output,'试听清单.json'),JSON.stringify({voice:'zh-CN-YunjianNeural',status:generated.length===5?'ready':'awaiting-credentials',samples:samples.map(s=>({id:s.id,title:s.title,text:s.text,style:s.style,degree:s.degree,rate:s.rate,mp3:generated.includes(s.id)?`${s.id}.mp3`:null}))},null,2),'utf8');
console.log(generated.length===5?`五段 Azure 云健音频已生成：${output}`:`已生成五段 SSML 与试听页：${output}\n未发现 AZURE_SPEECH_KEY / AZURE_SPEECH_REGION；本次未生成或伪称 Azure 音频。`);
