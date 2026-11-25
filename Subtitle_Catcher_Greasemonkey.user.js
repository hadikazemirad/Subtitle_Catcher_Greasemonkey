// ==UserScript==
// @name         Subtitle Catcher — Greasemonkey
// @namespace    https://github.com/hadikazemirad/Subtitle-Catcher
// @version      2.1.17-gm4
// @description  Find direct media, convert WebVTT subtitles and WOFF1 fonts.
// @match        *://*/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-start
// ==/UserScript==

(() => {
'use strict';

const ID = 'subtitle-catcher-gm';
const VIDEO_EXT = /\.(?:mp4|mkv|webm|avi|mov|m4v|mpeg|mpg|wmv|flv|3gp|ts|ogv|m2ts)(?:$|[?#])/i;
const SUB_EXT = /\.(?:vtt|srt|ass|ssa|sub|idx|sup|smi|sami|sbv|ttml|dfxp|mpl2|stl|usf|ytt|lrc|cap|psb|pjs|rt|aqt|jacosub|mpsub|scc|itt|cin|asc|sbt)(?:$|[?#])/i;
const FONT_EXT = /\.(?:woff2?|ttf|otf|eot|ttc|otc|pfb|pfm|pfa|afm|bdf|pcf|psf)(?:$|[?#])/i;
const AUDIO_EXT = /\.(?:mp3|m4a|aac|ogg|opus|wav|flac|wma|aiff)(?:$|[?#])/i;
const TXT = {
  fa: {button:'🎬 شکارچی زیرنویس', title:'شکارچی زیرنویس و منابع صفحه', scan:'در حال بررسی…', again:'بررسی دوباره', close:'بستن', subtitles:'زیرنویس‌ها', videos:'فایل‌های ویدئویی مستقیم', fonts:'فونت‌ها', audio:'صوت', posters:'تصاویر / پوسترها', download:'دانلود', copy:'کپی نشانی', convertSrt:'تبدیل به SRT', convertAss:'تبدیل با حفظ استایل (ASS)', convertFont:'تبدیل WOFF به TTF/OTF', styleInfo:'بررسی رنگ و جایگاه', none:'موردی پیدا نشد. ویدئو را پخش کنید و دوباره بررسی کنید.', note:'HLS/M3U8 عمداً نمایش داده نمی‌شود. WOFF1 قابل تبدیل است؛ WOFF2 در این نسخه تبدیل نمی‌شود.', menu:'باز کردن Subtitle Catcher'},
  en: {button:'🎬 Subtitle Catcher', title:'Subtitle Catcher & Page Resources', scan:'Scanning…', again:'Rescan', close:'Close', subtitles:'Subtitles', videos:'Direct video files', fonts:'Fonts', audio:'Audio', posters:'Images / posters', download:'Download', copy:'Copy URL', convertSrt:'Convert to SRT', convertAss:'Convert with styling (ASS)', convertFont:'Convert WOFF to TTF/OTF', styleInfo:'Inspect color and position', none:'Nothing found. Play the video and scan again.', note:'HLS/M3U8 is intentionally excluded. WOFF1 conversion is supported; WOFF2 is not converted in this version.', menu:'Open Subtitle Catcher'}
};
let lang = 'fa';
try { lang = GM_getValue('sc_lang', 'fa') || 'fa'; } catch (_) {}
const tr = k => (TXT[lang] || TXT.fa)[k] || TXT.fa[k] || k;
const state = { panel:null, button:null, busy:false, observer:null, started:false };
const found = {subtitles:new Map(), videos:new Map(), fonts:new Map(), audio:new Map(), posters:new Map()};
const abs = value => { try { return new URL(value, location.href).href; } catch (_) { return ''; } };
const isHLS = u => /\.m3u8(?:$|[?#])/i.test(u) || /(?:mpegurl|application\/vnd\.apple\.mpegurl)/i.test(u);
const cleanURL = u => { try { const x=new URL(u); x.hash=''; return x.href; } catch (_) { return u; } };

function classify(url, mime='') {
  const u = abs(url);
  if (!u || isHLS(u)) return null;
  const s = `${u} ${mime}`.toLowerCase();
  if (SUB_EXT.test(u) || /(?:text\/vtt|subrip|subtitle|ttml)/i.test(mime)) return 'subtitles';
  if (FONT_EXT.test(u) || /font\/|woff|truetype|opentype/i.test(mime)) return 'fonts';
  if (VIDEO_EXT.test(u) || /^video\/(?!mp2t)/i.test(mime)) return 'videos';
  if (AUDIO_EXT.test(u) || /^audio\//i.test(mime)) return 'audio';
  return null;
}
function add(kind, url, label='') {
  const u=abs(url);
  if (!u || !found[kind]) return;
  if (isHLS(u)) return;
  const key=cleanURL(u);
  if (!found[kind].has(key)) found[kind].set(key,{url:u,label:label || u.split('/').pop() || kind});
}
function scanDOM() {
  // Explicit media and track elements
  document.querySelectorAll('track[src]').forEach(e=>add('subtitles',e.src,e.label||e.srclang||'subtitle'));
  document.querySelectorAll('video, audio, source').forEach(e=>{
    const u=e.currentSrc||e.src||e.getAttribute('src');
    if (!u) return;
    const type=e.getAttribute('type')||'';
    const kind=e.tagName.toLowerCase()==='audio' || /^audio\//i.test(type) ? 'audio' : classify(u,type);
    if (kind) add(kind,u,e.getAttribute('label')||e.getAttribute('title')||'');
  });
  document.querySelectorAll('video[poster]').forEach(e=>add('posters',e.poster,'Video poster'));
  document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]').forEach(e=>add('posters',e.content,'Page image'));
  // Links, preload links and source attributes
  document.querySelectorAll('[src],[href]').forEach(e=>{
    const u=e.getAttribute('src')||e.getAttribute('href');
    if (!u) return;
    const rel=(e.getAttribute('rel')||'').toLowerCase();
    const as=(e.getAttribute('as')||'').toLowerCase();
    const type=e.getAttribute('type')||'';
    let kind=classify(u,type);
    if (!kind && (as==='font' || rel.includes('preload') && FONT_EXT.test(u))) kind='fonts';
    if (kind) add(kind,u,e.getAttribute('label')||e.getAttribute('title')||'');
  });
  // CSS text and accessible CSSOM @font-face declarations
  document.querySelectorAll('style').forEach(e=>scanCSS(e.textContent||'',location.href));
  document.querySelectorAll('link[rel~="stylesheet"][href]').forEach(e=>{
    try {
      const sheet=e.sheet;
      if (sheet && sheet.cssRules) scanRules(sheet.cssRules);
    } catch (_) {}
  });
  try {
    for (const entry of performance.getEntriesByType('resource')) {
      const kind=classify(entry.name,entry.initiatorType==='css'?'font':'');
      if (kind) add(kind,entry.name,entry.initiatorType||'network resource');
    }
  } catch (_) {}
  // FontFaceSet includes loaded faces even when URL is not obvious in DOM.
  try {
    if (document.fonts && document.fonts.forEach) {
      document.fonts.forEach(face=>{
        const m=String(face.family||'').replace(/["']/g,'');
        if (m) add('fonts',`font-family:${encodeURIComponent(m)}`,`Loaded font: ${m}`);
      });
    }
  } catch (_) {}
}
function scanRules(rules) {
  try {
    for (const rule of rules) {
      if (rule.cssRules) scanRules(rule.cssRules);
      if (rule.type===CSSRule.FONT_FACE_RULE || /@font-face/i.test(rule.cssText||'')) scanCSS(rule.cssText,location.href);
    }
  } catch (_) {}
}
function scanCSS(css, base) {
  const re=/url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let m;
  while ((m=re.exec(css))) {
    const raw=m[2].trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
    const u=abs(new URL(raw,base).href);
    if (FONT_EXT.test(u)) add('fonts',u,'CSS font');
  }
}
function scanPerformance() {
  try {
    performance.getEntriesByType('resource').forEach(e=>{
      const kind=classify(e.name);
      if (kind) add(kind,e.name,e.initiatorType||'resource');
    });
  } catch (_) {}
}
function make(tag, attrs={}, text='') {
  const e=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{ if(k==='style')e.style.cssText=v; else if(k.startsWith('on')){} else e.setAttribute(k,v); });
  if (text) e.textContent=text;
  return e;
}
function download(item) {
  const filename=(item.label||'download').replace(/[\\/:*?"<>|]+/g,'_').slice(0,120);
  try {
    GM_download({url:item.url,name:filename,saveAs:true,onerror:e=>alert('Download failed: '+(e.error||'unknown error'))});
  } catch (e) {
    window.open(item.url,'_blank','noopener');
  }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (_) {
    const t=make('textarea',{style:'position:fixed;opacity:0;'});
    t.value=text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
}
function gmFetch(url, responseType='text') {
  // Greasemonkey 4+ exposes GM.xmlHttpRequest; older managers use GM_xmlhttpRequest.
  const request = typeof GM_xmlhttpRequest === 'function'
    ? GM_xmlhttpRequest
    : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function'
        ? GM.xmlHttpRequest.bind(GM) : null);
  if (!request) return Promise.reject(new Error('Greasemonkey request API unavailable. Check @grant GM.xmlHttpRequest.'));
  return new Promise((resolve, reject) => {
    try {
      request({ method:'GET', url, responseType,
        onload:r => r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error('HTTP ' + r.status)),
        onerror:() => reject(new Error('Network error')),
        ontimeout:() => reject(new Error('Timeout'))
      });
    } catch (error) { reject(error); }
  });
}
function saveBlob(blob, filename) {
  const a=document.createElement('a'), u=URL.createObjectURL(blob); a.href=u; a.download=filename; a.style.display='none'; document.documentElement.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),30000);
}
function fileBase(url) { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()||'subtitle').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'_'); } catch (_) { return 'subtitle'; } }
function parseVtt(src) {
  const lines=String(src||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  const cues=[], styles=[]; let i=0;
  while(i<lines.length && !/^WEBVTT(?:\s|$)/i.test(lines[i].trim())) i++;
  if(i<lines.length)i++;
  while(i<lines.length) {
    while(i<lines.length&&!lines[i].trim())i++;
    if(i>=lines.length)break;
    if(/^STYLE\s*$/i.test(lines[i].trim())) { i++; const b=[]; while(i<lines.length&&lines[i].trim())b.push(lines[i++]); styles.push(b.join('\n')); continue; }
    if(/^(NOTE|REGION)(?:\s|$)/i.test(lines[i].trim())) { i++; while(i<lines.length&&lines[i].trim())i++; continue; }
    let id=''; if(!lines[i].includes('-->')) id=lines[i++].trim();
    if(i>=lines.length)break;
    const m=lines[i].trim().match(/^(\S+)\s+-->\s+(\S+)(.*)$/); if(!m){i++;continue;}
    const start=toSrtTime(m[1]), end=toSrtTime(m[2]), settings=m[3].trim(); i++;
    const body=[]; while(i<lines.length&&lines[i].trim())body.push(lines[i++]);
    if(start&&end&&body.length)cues.push({id,start,end,settings,text:body.join('\n')});
  }
  return {cues,styles};
}
function toSrtTime(t) { const m=String(t).match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})$/); if(!m)return null; return `${String(m[1]||0).padStart(2,'0')}:${String(m[2]).padStart(2,'0')}:${m[3]},${m[4]}`; }
function vttToSrt(src) { const {cues}=parseVtt(src); return cues.map((c,i)=>`${i+1}\n${c.start} --> ${c.end}\n${c.text.replace(/<\/?(?:c(?:\.[^>]*)?|v(?:\s+[^>]*)?|lang(?:\s+[^>]*)?|ruby|rt)>/gi,'')}`).join('\n\n')+'\n'; }
function cssValue(styles, prop, fallback='') { const re=new RegExp(prop+'\\s*:\\s*([^;}]+)','i'); for(const st of styles){const m=st.match(re);if(m)return m[1].trim();} return fallback; }
function assColor(value, fallback='&H00FFFFFF') {
  const v=String(value||'').trim().toLowerCase(); let r,g,b;
  const h=v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if(h){let x=h[1];if(x.length===3)x=x.split('').map(c=>c+c).join('');r=parseInt(x.slice(0,2),16);g=parseInt(x.slice(2,4),16);b=parseInt(x.slice(4,6),16);return `&H00${[b,g,r].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()}`;}
  const rgb=v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); if(rgb){r=+rgb[1];g=+rgb[2];b=+rgb[3];return `&H00${[b,g,r].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()}`;}
  const names={white:'#ffffff',yellow:'#ffff00',red:'#ff0000',lime:'#00ff00',blue:'#0000ff',cyan:'#00ffff',magenta:'#ff00ff',black:'#000000'}; return names[v]?assColor(names[v],fallback):fallback;
}
function vttToAss(src) {
  const {cues,styles}=parseVtt(src); const color=assColor(cssValue(styles,'color','#ffffff'));
  const back=assColor(cssValue(styles,'background-color','#000000'));
  const font=cssValue(styles,'font-family','Arial').replace(/[{},]/g,'');
  const size=parseFloat(cssValue(styles,'font-size','40'))||40;
  const bold=/bold|700|800|900/i.test(cssValue(styles,'font-weight',''))?-1:0;
  const italic=/italic/i.test(cssValue(styles,'font-style',''))?-1:0;
  const lines=['[Script Info]','ScriptType: v4.00+','PlayResX: 1920','PlayResY: 1080','WrapStyle: 2','ScaledBorderAndShadow: yes','','[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',`Style: Default,${font},${size},${color},${color},&H00000000,${back},${bold},${italic},0,0,100,100,0,0,1,2,1,2,40,40,40,1`,'','[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
  const assTime=t=>{const m=t.match(/^(\d+):(\d+):(\d+),(\d+)$/);return m?`${+m[1]}:${m[2]}:${m[3]}.${m[4].slice(0,2)}`:'0:00:00.00';};
  for(const c of cues){let align=2;const a=(c.settings.match(/align:(start|center|end)/)||[])[1];if(a==='start')align=1;else if(a==='center')align=2;else if(a==='end')align=3;const ln=(c.settings.match(/line:(-?\d+(?:\.\d+)?)%/)||[])[1];const pn=(c.settings.match(/position:(\d+(?:\.\d+)?)%/)||[])[1];let tags=`{\\an${align}}`;if(ln!==undefined||pn!==undefined){const y=ln===undefined?1020:Math.round(1080*Math.max(0,Math.min(100,parseFloat(ln)))/100);const x=pn===undefined?960:Math.round(1920*Math.max(0,Math.min(100,parseFloat(pn)))/100);tags+=`{\\pos(${x},${y})}`;}
    const txt=c.text.replace(/<b>/gi,'{\\b1}').replace(/<\/b>/gi,'{\\b0}').replace(/<i>/gi,'{\\i1}').replace(/<\/i>/gi,'{\\i0}').replace(/<u>/gi,'{\\u1}').replace(/<\/u>/gi,'{\\u0}').replace(/<[^>]+>/g,'').replace(/\n/g,'\\N');
    lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${tags}${txt}`);
  }
  return lines.join('\n')+'\n';
}
async function convertSubtitle(item, format) {
  const r=await gmFetch(item.url,'text'); const src=r.responseText||''; if(!src.trim())throw new Error('Empty subtitle');
  const base=fileBase(item.url);
  if(format==='srt'){const out=vttToSrt(src);if(!out.trim())throw new Error('No WebVTT cues found');saveBlob(new Blob(['\uFEFF',out],{type:'application/x-subrip;charset=utf-8'}),base+'.srt');}
  else {const out=vttToAss(src);if(!out.includes('Dialogue:'))throw new Error('No WebVTT cues found');saveBlob(new Blob([out],{type:'text/x-ssa;charset=utf-8'}),base+'.ass');}
}
async function woffToSfnt(buffer) {
  const src=new DataView(buffer); if(src.byteLength<44||src.getUint32(0)!==0x774F4646)throw new Error('Not a WOFF1 file');
  const flavor=src.getUint32(4), count=src.getUint16(12), total=src.getUint32(16); if(!count||count>4096||total>64*1024*1024)throw new Error('Invalid WOFF header');
  const tables=[]; let pos=44, outOffset=12+count*16; outOffset=(outOffset+3)&~3;
  for(let i=0;i<count;i++){const tag=src.getUint32(pos),off=src.getUint32(pos+4),comp=src.getUint32(pos+8),orig=src.getUint32(pos+12),sum=src.getUint32(pos+16);pos+=20;if(off+comp>buffer.byteLength||orig>32*1024*1024)throw new Error('Invalid WOFF table');let bytes=new Uint8Array(buffer,off,comp);if(comp<orig){if(typeof DecompressionStream==='undefined')throw new Error('Browser lacks DecompressionStream');const ds=new DecompressionStream('deflate');const stream=new Blob([bytes]).stream().pipeThrough(ds);bytes=new Uint8Array(await new Response(stream).arrayBuffer());}if(bytes.length!==orig)throw new Error('WOFF table size mismatch');tables.push({tag,bytes,sum,offset:outOffset});outOffset=(outOffset+orig+3)&~3;}
  const out=new Uint8Array(outOffset), dv=new DataView(out.buffer);dv.setUint32(0,flavor);dv.setUint16(4,count);let pow=1,entry=0;while(pow*2<=count){pow*=2;entry++;}dv.setUint16(6,pow*16);dv.setUint16(8,entry);dv.setUint16(10,count*16-pow*16);
  let dir=12;for(const t of tables){dv.setUint32(dir,t.tag);dv.setUint32(dir+4,t.sum);dv.setUint32(dir+8,t.offset);dv.setUint32(dir+12,t.bytes.length);dir+=16;out.set(t.bytes,t.offset);}
  const head=tables.find(t=>t.tag===0x68656164);if(head&&head.bytes.length>=12){const off=head.offset+8;new DataView(out.buffer).setUint32(off,0);}
  const sum32=bytes=>{let sum=0;for(let i=0;i<bytes.length;i+=4){const n=((bytes[i]||0)<<24)|((bytes[i+1]||0)<<16)|((bytes[i+2]||0)<<8)|(bytes[i+3]||0);sum=(sum+(n>>>0))>>>0;}return sum;};
  if(head&&head.bytes.length>=12){const adjust=(0xB1B0AFBA-sum32(out))>>>0;dv.setUint32(head.offset+8,adjust);}
  return {buffer:out.buffer,flavor};
}
async function convertFont(item) {
  const r=await gmFetch(item.url,'arraybuffer');const result=await woffToSfnt(r.response);const ext=result.flavor===0x4F54544F?'otf':'ttf';saveBlob(new Blob([result.buffer],{type:ext==='otf'?'font/otf':'font/ttf'}),fileBase(item.url)+'.'+ext);
}
function inspectVttStyle(item) {
  gmFetch(item.url,'text').then(r=>{const {cues,styles}=parseVtt(r.responseText||'');const color=cssValue(styles,'color','مشخص نشده'),bg=cssValue(styles,'background-color','مشخص نشده'),font=cssValue(styles,'font-family','مشخص نشده'),size=cssValue(styles,'font-size','مشخص نشده');const positions=[...new Set(cues.map(c=>(c.settings.match(/(?:line|position|align):[^ ]+/g)||[]).join(' ')).filter(Boolean))];alert(`تعداد خطوط: ${cues.length}\nرنگ متن: ${color}\nرنگ پس‌زمینه: ${bg}\nفونت: ${font}\nاندازه: ${size}\nتنظیم جایگاه: ${positions.join(' | ')||'در فایل مشخص نشده'}`);}).catch(e=>alert('خواندن استایل ممکن نشد: '+e.message));
}
function section(root, key, title) {
  const entries=[...found[key].values()];
  if (!entries.length) return;
  const wrap=make('div',{style:'margin-top:12px;border-top:1px solid #334155;padding-top:8px;'});
  wrap.append(make('div',{style:'font-weight:bold;color:#fbbf24;margin-bottom:6px;'},`${title} (${entries.length})`));
  entries.forEach(item=>{
    const row=make('div',{style:'background:#1e293b;border-radius:7px;padding:7px;margin:5px 0;'});
    row.append(make('div',{style:'font-size:11px;direction:ltr;word-break:break-all;color:#bfdbfe;'},item.label||item.url));
    const actions=make('div',{style:'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;'});
    const dl=make('button',{type:'button'},tr('download')); dl.onclick=()=>download(item); actions.append(dl);
    const cp=make('button',{type:'button'},tr('copy')); cp.style.background='#475569'; cp.onclick=()=>copy(item.url); actions.append(cp);
    if(key==='subtitles' && /\.vtt(?:$|[?#])/i.test(item.url)){
      const srt=make('button',{type:'button'},tr('convertSrt'));srt.style.background='#0f766e';srt.onclick=async()=>{srt.disabled=true;try{await convertSubtitle(item,'srt');}catch(e){alert('SRT: '+e.message);}finally{srt.disabled=false;}};actions.append(srt);
      const ass=make('button',{type:'button'},tr('convertAss'));ass.style.background='#7c3aed';ass.onclick=async()=>{ass.disabled=true;try{await convertSubtitle(item,'ass');}catch(e){alert('ASS: '+e.message);}finally{ass.disabled=false;}};actions.append(ass);
      const info=make('button',{type:'button'},tr('styleInfo'));info.style.background='#475569';info.onclick=()=>inspectVttStyle(item);actions.append(info);
    }
    if(key==='fonts' && /\.woff(?:$|[?#])/i.test(item.url)){
      const cv=make('button',{type:'button'},tr('convertFont'));cv.style.background='#0f766e';cv.onclick=async()=>{cv.disabled=true;try{await convertFont(item);}catch(e){alert('Font conversion: '+e.message);}finally{cv.disabled=false;}};actions.append(cv);
    }
    row.append(actions); wrap.append(row);
  });
  root.append(wrap);
}
function render() {
  if (!state.panel) return;
  const root=state.panel.querySelector('.sc-results');
  root.replaceChildren();
  section(root,'subtitles',tr('subtitles'));
  section(root,'videos',tr('videos'));
  section(root,'fonts',tr('fonts'));
  section(root,'audio',tr('audio'));
  section(root,'posters',tr('posters'));
  if (!root.childElementCount) root.append(make('div',{style:'padding:12px;color:#cbd5e1;'},tr('none')));
}
function showPanel() {
  if (!document.documentElement) return false;
  if (state.panel && state.panel.isConnected) { state.panel.style.display='block'; return true; }
  const panel=make('section',{id:ID+'-panel',style:'position:fixed!important;z-index:2147483647!important;top:70px!important;right:16px!important;width:min(570px,calc(100vw - 32px))!important;max-height:78vh!important;overflow:auto!important;background:#0f172a!important;color:#f8fafc!important;border:2px solid #2563eb!important;border-radius:12px!important;box-shadow:0 12px 40px #000b!important;padding:12px!important;font:13px Tahoma,Arial,sans-serif!important;direction:rtl!important;text-align:right!important;'});
  const top=make('div',{style:'display:flex;align-items:center;justify-content:space-between;gap:8px;'});
  top.append(make('strong',{},tr('title')));
  const controls=make('div',{style:'display:flex;gap:6px;'});
  const langBtn=make('button',{type:'button'},lang==='fa'?'EN':'فا');
  langBtn.onclick=()=>{lang=lang==='fa'?'en':'fa';try{GM_setValue('sc_lang',lang)}catch(_){};panel.remove();state.panel=null;showPanel();};
  const scanBtn=make('button',{type:'button'},tr('again')); scanBtn.onclick=()=>runScan();
  const close=make('button',{type:'button'},'×'); close.onclick=()=>panel.remove();
  controls.append(langBtn,scanBtn,close);top.append(controls);panel.append(top);
  panel.append(make('div',{style:'color:#94a3b8;font-size:11px;margin:8px 0;'},tr('note')));
  panel.append(make('div',{class:'sc-results'}));
  const style=make('style'); style.textContent=`#${ID}-panel button{border:0;border-radius:6px;background:#2563eb;color:white;padding:6px 9px;cursor:pointer;font:12px Tahoma,Arial}#${ID}-panel button:hover{filter:brightness(1.15)}`;
  panel.append(style);
  document.documentElement.append(panel);
  state.panel=panel; render(); return true;
}
function ensureButton() {
  if (!document.documentElement) return false;
  let b=document.getElementById(ID+'-button');
  if (b) { state.button=b; return true; }
  b=make('button',{id:ID+'-button',type:'button',style:'position:fixed!important;z-index:2147483646!important;right:18px!important;bottom:18px!important;background:#2563eb!important;color:white!important;border:0!important;border-radius:8px!important;padding:10px 13px!important;box-shadow:0 3px 14px #0009!important;cursor:pointer!important;font:13px Tahoma,Arial!important;'});
  b.textContent=tr('button');
  b.addEventListener('click',()=>{showPanel();runScan();});
  document.documentElement.append(b); state.button=b; return true;
}
function runScan() {
  if (state.busy) return;
  state.busy=true;
  showPanel();
  if (state.panel) {
    const status=make('div',{style:'color:#93c5fd;margin:8px 0;'},tr('scan'));
    const old=state.panel.querySelector('.sc-status'); if(old)old.remove();
    status.className='sc-status'; state.panel.querySelector('.sc-results').before(status);
  }
  try { scanDOM(); scanPerformance(); render(); }
  finally {
    state.busy=false;
    const s=state.panel&&state.panel.querySelector('.sc-status'); if(s)s.textContent='✓ '+tr('again');
  }
}
function boot() {
  if (!document.documentElement) { setTimeout(boot,100); return; }
  ensureButton();
  // Watch SPAs and sites that replace their document body/root after initial load.
  if (!state.observer) {
    state.observer=new MutationObserver(()=>{
      if (!document.getElementById(ID+'-button')) ensureButton();
      if (state.panel && !state.panel.isConnected) state.panel=null;
    });
    try { state.observer.observe(document.documentElement,{childList:true,subtree:true}); } catch (_) {}
  }
}
function registerMenu() {
  try {
    if (typeof GM_registerMenuCommand==='function') GM_registerMenuCommand(tr('menu'),()=>{showPanel();runScan();});
  } catch (_) {}
}
registerMenu();
boot();
document.addEventListener('DOMContentLoaded',boot,{once:true});
window.addEventListener('load',boot,{once:true});
setTimeout(boot,300);
setTimeout(boot,1200);
})();
