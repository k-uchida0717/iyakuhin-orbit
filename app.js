/* 保険診療オービット — 薬価・検査/画像診断・留意事項の統合検索 */
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const nk=s=>(s||"").normalize("NFKC");
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* =====================================================================
   検索用の正規化
   全角/半角・大文字/小文字・ひらがな/カタカナ・小書き仮名・長音や記号の有無を同一視し、
   ギリシャ文字は読みに、英字だけの入力はローマ字としてカタカナにも展開する。
   ===================================================================== */
const SMALL={"ァ":"ア","ィ":"イ","ゥ":"ウ","ェ":"エ","ォ":"オ","ッ":"ツ","ャ":"ヤ","ュ":"ユ","ョ":"ヨ","ヮ":"ワ","ヵ":"カ","ヶ":"ケ"};
const GREEK={"α":"アルファ","β":"ベータ","γ":"ガンマ","δ":"デルタ","ε":"イプシロン","κ":"カッパ","λ":"ラムダ","μ":"マイクロ","ω":"オメガ","σ":"シグマ","τ":"タウ"};
const DROP=/[\s・･\-‐‑–—―－ー~〜()（）\[\]［］「」『』【】<>＜＞、。,.．'"’”/／:：;；]/;
/* 1文字ずつ畳み込み、元の文字位置を覚えておく（強調表示のため） */
function foldMap(text){
  const src=nk(text);let s="";const idx=[];
  const AN=/[A-Za-z0-9]/;
  for(let i=0;i<src.length;i++){
    let c=src[i];
    /* 英数字どうしの間の空白は単語の区切りとして「|」で残し、単語をまたいだ誤一致（PCR polymerase → CRP）を防ぐ */
    if(/[\s:;/]/.test(c)&&i>0&&AN.test(src[i-1])&&AN.test(src[i+1]||"")){s+="|";idx.push(i);continue}
    if(DROP.test(c))continue;
    c=c.toLowerCase();
    const code=c.charCodeAt(0);
    if(code>=0x3041&&code<=0x3096)c=String.fromCharCode(code+0x60);
    if(SMALL[c])c=SMALL[c];
    if(GREEK[c]){for(const g of GREEK[c]){s+=g;idx.push(i)}continue}
    s+=c;idx.push(i);
  }
  return{s,idx,src};
}
const norm=t=>foldMap(t).s;

/* ローマ字 → カタカナ（ヘボン式・訓令式の主なつづり） */
const RK=(()=>{const t={};
  const rows={"":"アイウエオ",k:"カキクケコ",s:"サシスセソ",t:"タチツテト",n:"ナニヌネノ",h:"ハヒフヘホ",m:"マミムメモ",y:"ヤ-ユ-ヨ",r:"ラリルレロ",w:"ワ-ウ-ヲ",
    g:"ガギグゲゴ",z:"ザジズゼゾ",d:"ダヂヅデド",b:"バビブベボ",p:"パピプペポ",l:"ラリルレロ",v:"ヴァヴィヴヴェヴォ",f:"ファフィフフェフォ",j:"ジャジジュジェジョ"};
  const V="aiueo";
  for(const [c,ks] of Object.entries(rows)){
    if(c==="v"||c==="f"||c==="j"){const a=c==="v"?["ヴァ","ヴィ","ヴ","ヴェ","ヴォ"]:c==="f"?["ファ","フィ","フ","フェ","フォ"]:["ジャ","ジ","ジュ","ジェ","ジョ"];V.split("").forEach((v,i)=>t[c+v]=a[i]);continue}
    V.split("").forEach((v,i)=>{if(ks[i]!=="-")t[c+v]=ks[i]});
  }
  Object.assign(t,{shi:"シ",chi:"チ",tsu:"ツ",fu:"フ",ji:"ジ",si:"シ",ti:"チ",tu:"ツ",hu:"フ",zi:"ジ",di:"ヂ",du:"ヅ",
    sha:"シャ",shu:"シュ",sho:"ショ",she:"シェ",cha:"チャ",chu:"チュ",cho:"チョ",che:"チェ",
    thi:"ティ",dhi:"ディ",tei:"テイ",wi:"ウィ",we:"ウェ",xa:"ァ",xi:"ィ",xu:"ゥ",xe:"ェ",xo:"ォ",nn:"ン","n'":"ン",
    ca:"カ",ci:"シ",cu:"ク",ce:"セ",co:"コ",qu:"ク",x:"クス"});
  for(const [c,k] of Object.entries({k:"キ",s:"シ",t:"チ",n:"ニ",h:"ヒ",m:"ミ",r:"リ",g:"ギ",z:"ジ",d:"ヂ",b:"ビ",p:"ピ",l:"リ"}))
    for(const [v,y] of [["a","ャ"],["u","ュ"],["o","ョ"]])t[c+"y"+v]=k+y;
  return t})();
function romaji(q){
  const s=q.toLowerCase();let out="",i=0;
  while(i<s.length){
    const c=s[i];
    if(c===s[i+1]&&/[bcdfghjklmpqrstvwxyz]/.test(c)&&c!=="n"){out+="ッ";i++;continue}
    if(c==="n"&&(i+1===s.length||!/[aiueoy']/.test(s[i+1]))){out+="ン";i++;continue}
    let hit=false;
    for(const L of [3,2,1]){const k=s.slice(i,i+L);if(RK[k]){out+=RK[k];i+=L;hit=true;break}}
    if(!hit)return null;
  }
  return out;
}
/* 英字の読み（えむあーるあい → mri）。norm 後の表記で照合する */
const LETTERS=Object.entries({a:"エ",b:"ビ",c:"シ",d:"デイ",e:"イ",f:"エフ",g:"ジ",h:"エイチ",i:"アイ",j:"ジエイ",k:"ケ",l:"エル",m:"エム",n:"エヌ",o:"オ",p:"ピ",q:"キユ",r:"アル",s:"エス",t:"テイ",u:"ユ",v:"ブイ",w:"ダブリユ",x:"エツクス",y:"ワイ",z:"ゼツト"})
  .sort((a,b)=>b[1].length-a[1].length);
function kanaLetters(k){
  const memo={};
  const f=i=>{if(i===k.length)return"";if(i in memo)return memo[i];memo[i]=null;
    for(const [l,r] of LETTERS)if(k.startsWith(r,i)){const rest=f(i+r.length);if(rest!=null){memo[i]=l+rest;break}}
    return memo[i]};
  return /^[ァ-ヶ]+$/.test(k)?f(0):null;
}
/* 入力語 → [語ごとの候補の配列] */
function queryTerms(q){
  return nk(q).trim().split(/\s+/).filter(Boolean).map(w=>{
    const v=new Set([norm(w)]);
    if(/^[a-z]+$/i.test(w)&&w.length>=2){const k=romaji(w);if(k)v.add(norm(k))}
    const lt=kanaLetters(norm(w));if(lt&&lt.length>=2)v.add(lt);
    return[...v].filter(Boolean);
  }).filter(a=>a.length);
}
/* 部分一致。ただし数字で始まる語は、直前が数字・小数点なら一致としない（「5mg」が「2.5mg」「25mg」に当たらないように） */
function has(hay,v){
  if(!/^[0-9]/.test(v))return hay.includes(v);
  let at=hay.indexOf(v);
  while(at>=0){if(at===0||!/[0-9.]/.test(hay[at-1]))return true;at=hay.indexOf(v,at+1)}
  return false;
}
const hit=(hay,terms)=>terms.every(vs=>vs.some(v=>has(hay,v)));
function markText(text,terms){
  const src=nk(text);
  if(!terms.length)return esc(src);
  const f=foldMap(src),ranges=[];
  for(const vs of terms)for(const v of vs){let at=f.s.indexOf(v);while(at>=0){ranges.push([f.idx[at],f.idx[at+v.length-1]+1]);at=f.s.indexOf(v,at+v.length)}}
  if(!ranges.length)return esc(src);
  ranges.sort((a,b)=>a[0]-b[0]);let out="",pos=0;
  for(const [s,e] of ranges){if(s<pos)continue;out+=esc(src.slice(pos,s))+"<mark>"+esc(src.slice(s,e))+"</mark>";pos=e}
  return out+esc(src.slice(pos));
}
function snippet(text,terms,width=90){
  const src=nk(text).replace(/\s*\n\s*/g," ");const f=foldMap(src);let at=-1;
  for(const vs of terms)for(const v of vs){const i=f.s.indexOf(v);if(i>=0&&(at<0||f.idx[i]<at))at=f.idx[i]}
  const st=at>24?at-18:0;
  return(st?"…":"")+markText(src.slice(st,st+width+40),terms);
}

/* ===================================================================== 共通 */
const fmt=(v,d=2)=>v==null?"—":v.toLocaleString("ja-JP",{maximumFractionDigits:d});
const pct=(a,b)=>(b-a)/a*100;
function delta(prev,cur){
  if(prev==null||cur==null||prev===0)return"";
  const d=pct(prev,cur);
  if(Math.abs(d)<0.005)return`<span class="delta eq">±0%</span>`;
  return`<span class="delta ${d<0?"dn":"up"}">${d<0?"▼":"▲"}${Math.abs(d).toFixed(1)}%</span>`;
}
const prevOf=(p,i)=>{for(let j=i+1;j<p.length;j++)if(p[j]!=null)return p[j];return null};
function spark(p,color){
  const pts=[...p].reverse().map((v,x)=>[x,v]).filter(a=>a[1]!=null);if(pts.length<2)return"";
  const vs=pts.map(a=>a[1]),mn=Math.min(...vs),mx=Math.max(...vs),W=46,H=18;
  const xy=pts.map(([x,v])=>[3+x*(W-6)/(p.length-1),mx===mn?H/2:H-3-(v-mn)/(mx-mn)*(H-6)]);
  const l=xy[xy.length-1];
  return`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${xy.map(a=>a.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-opacity=".55" stroke-width="1.5"/><circle cx="${l[0]}" cy="${l[1]}" r="2.6" fill="${color}"/></svg>`;
}
function timeline(revs,p,cur,unit){
  const order=revs.map((r,i)=>i).reverse();
  return`<div class="timeline">${order.map(i=>`<div class="tl${i===cur?" on":""}"><div class="dot"></div><div class="y">${revs[i].date.slice(0,7).replace("-",".")}</div><div class="p">${p[i]==null?"—":fmt(p[i])}<span class="note"> ${p[i]==null?"":unit}</span></div><div class="l">${esc(revs[i].label.replace("改定",""))}</div>${delta(prevOf(p,i),p[i])}</div>`).join("")}</div>`;
}
function revSeg(revs,cur,id){
  return`<div class="seg" id="${id}" role="group" aria-label="表示する改定">${revs.map((r,i)=>`<button data-r="${i}" aria-pressed="${i===cur}">${r.date.slice(0,7).replace("-",".")}<small>${esc(r.label.replace("改定",""))}</small></button>`).join("")}</div>`;
}
function loadingHtml(t){return`<div class="loading">${esc(t)}<i></i></div>`}
const COLORS={yakka:"#4fe3ff",kensa:"#b38cff",ryuui:"#ffc46b"};

/* ===================================================================== データ */
const D={yakka:null,kensa:null,ryuui:null,dpc:null,byomei:null,eff:null,man:null};
/* モジュール登録：画面・詳細シート・ホームの惑星と横断検索を、各ファイルからここへ追加する */
const MODS=[];
const PREP={};
const ready={};
function load(){
  const j=u=>VAULT.json(u);
  const keys=["yakka","kensa","ryuui",...Object.keys(PREP)].filter(k=>APP.mods.includes(k));
  const prep={yakka:prepYakka,kensa:prepKensa,ryuui:prepRyuui,...PREP};
  for(const k of keys)ready[k]=j(k+"-data.json").then(prep[k]);
  j("manifest.json").then(m=>{D.man=m;liveChip()}).catch(()=>{});
  for(const k of keys)ready[k].then(()=>{if(route.name==="home")renderHome();else if(route.name===k||(k==="ryuui"&&route.name==="kensa"))render()}).catch(e=>{D[k]={error:e.message};if(route.name===k||route.name==="home")render()});
  ready.all=Promise.allSettled(keys.map(k=>ready[k]));
}
function prepYakka(d){
  const rows=d.rows.map((a,id)=>({id,c:a[0],k:a[1],i:nk(a[2]),s:nk(a[3]),n:nk(a[4]),m:nk(a[5]),f:a[6],x:a[7],p:a[8],e:a[9]?nk(a[9]):null,b:a[10]?nk(a[10]):null,
    h:norm(a[4]+"|"+a[2]+"|"+a[5]+"|"+a[0]),cl:a[0].slice(0,3),ef:-1}));
  D.yakka={revs:d.revs,rows,updated:d.updated||d.built};
  return VAULT.json("kounou.json").catch(()=>null).then(eff=>{
    if(!eff)return;D.eff=eff;eff.normT=eff.t.map(norm);
    /* y: YJコード → [効能・効果の番号, 禁忌の番号]。完全一致 → 上9桁 → 上8桁（同成分・同剤形）の順に当てる */
    const p9={},p8={};for(const yj of Object.keys(eff.y)){if(!(yj.slice(0,9) in p9))p9[yj.slice(0,9)]=yj;if(!(yj.slice(0,8) in p8))p8[yj.slice(0,8)]=yj}
    for(const r of rows){let k=eff.y[r.c]?r.c:null,x="exact";if(!k){k=p9[r.c.slice(0,9)];x="near"}if(!k)k=p8[r.c.slice(0,8)];
      if(k){const v=eff.y[k];r.ef=v[0];r.ct=v[1];r.cb=v[2]??-1;r.efx=x;r.efr=eff.r&&eff.r[k];
        /* 規格（量）によって適応が違う文書：その規格に当てはまる行だけで「この規格の適応」を作る */
        if(v.length>3&&v[3]>=0){r.doc=v[3];r.bi=x==="exact"?v[4]:-1;
          if(r.bi>=0){r.own=ownLines(eff.d[r.doc],r.bi).join("\n");r.ownN=norm(r.own)}}}}
  });
}
/* ---------- 規格別の適応 ---------- */
const applies=(set,bi)=>set==null||set.includes(bi);
/* 添付文書中の「（参考）」の表は適応の一覧に入れない（原文表示には残す） */
const notIndication=s=>/[|｜]/.test(s)||/^[\s　]*※/.test(s)||/^[\s　]*[(（]参考[)）]$/.test(s);
function ownLines(doc,bi){return doc.l.filter(([s,set,h])=>!h&&!notIndication(s)&&applies(set,bi)).map(l=>l[0])}
/* 販売名の共通部分を省いた短い規格名（例：「20mgシリンジ0.2mL」） */
function shortNames(names){
  if(names.length<2)return names;
  let p=0;while(names.every(n=>n[p]===names[0][p])&&p<names[0].length)p++;
  let s=0;while(names.every(n=>n[n.length-1-s]===names[0][names[0].length-1-s])&&s<names[0].length-p)s++;
  while(s>0&&/[A-Za-z0-9.%単位万千]/.test(names[0][names[0].length-s]))s--; /* 単位（mL・%・単位など）は残す */
  while(p>0&&/[0-9.]/.test(names[0][p-1]))p--; /* 数字の途中で切らない */
  const out=names.map(n=>n.slice(p,n.length-s).trim());
  return out.every(Boolean)?out:names;
}
/* 適応 × 規格 の対応表の行：同じ文言の行は対象規格をまとめる */
function matrixRows(doc){
  const rows=new Map();
  for(const [s,set,h] of doc.l){if(h||notIndication(s))continue;const t=s.replace(/^[\s　]*[・]?/,"");
    const all=set==null?doc.b.map((_,i)=>i):set;
    if(!rows.has(t))rows.set(t,new Set());all.forEach(i=>rows.get(t).add(i))}
  return[...rows].map(([t,set])=>[t,set]);
}
function strengthBlock(r,terms){
  const doc=D.eff.d[r.doc],names=shortNames(doc.b),bi=r.bi;
  const rows=matrixRows(doc),n=doc.b.length;
  const own=rows.filter(([,set])=>bi>=0&&set.has(bi)),other=rows.filter(([,set])=>bi>=0&&!set.has(bi));
  const who=set=>[...set].sort((a,b)=>a-b).map(i=>names[i]).join("・");
  return`<div class="warnbox">規格（含量・剤形）によって適応が異なる薬です。${bi>=0?`下の「この規格の適応」がこの品目（${esc(names[bi])}）に当てはまります。`:"この品目がどの規格かを特定できないため、規格ごとの対応表で確認してください。"}</div>
    ${bi>=0?`<div class="subh">この規格の適応 <span class="pill on">${esc(names[bi])}</span></div>
      <div class="txt">${emph(own.map(([t])=>"・"+markText(t,terms)).join("\n"))||"（該当なし）"}</div>
      ${other.length?`<div class="subh">他の規格だけの適応（この規格では適応外）</div>
      <div class="txt dim">${other.map(([t,set])=>"・"+markText(t,terms)+`<span class="only">（${esc(who(set))}のみ）</span>`).join("\n")}</div>`:""}`:""}
    <div class="subh">適応 × 規格の対応表</div>
    <div class="tbl"><table class="mx"><tr><th>効能・効果</th>${names.map((nm,i)=>`<th class="c${i===bi?" me":""}">${esc(nm)}</th>`).join("")}</tr>
      ${rows.map(([t,set])=>`<tr><td class="w">${markText(t,terms)}</td>${names.map((_,i)=>`<td class="c${i===bi?" me":""}">${set.has(i)?'<span class="yes">●</span>':'<span class="no">－</span>'}</td>`).join("")}</tr>`).join("")}
    </table></div>
    <details class="raw"><summary>添付文書の記載どおりに見る</summary><div class="txt">${markText(D.eff.t[r.ef],terms)}</div></details>`;
}
function prepKensa(d){
  const rows=d.rows.map((a,id)=>({id,c:a[0],k:a[1],h:a[2],n:nk(a[3]),u:a[4],p:a[5],y:nk(a[6]||""),
    hs:norm(a[3]+"|"+(a[6]||"")+"|"+a[1]+"|"+a[0])}));
  D.kensa={revs:d.revs,rows};
}
function prepRyuui(d){
  const secs=d.sections.map((s,id)=>({id,c:s.c,n:nk(s.n),ch:s.ch,pt:s.pt,pg:s.pg,t:s.t,hs:norm(s.c+"|"+s.n),ht:norm(s.t)}));
  const byCode={};for(const s of secs)if(s.c&&!byCode[s.c])byCode[s.c]=s;
  D.ryuui={title:d.title,src:d.src,built:d.built,secs,byCode};
}
function liveChip(){
  const m=D.man;if(!m)return;
  const t=m.checked?m.checked.replace("T"," "):"";
  $("#live").innerHTML=`<i></i>SYNC ${esc(t.slice(5,16))}`;
  $("#live").title="最終同期 "+t;
}

/* ===================================================================== ルーティング */
const route={name:"home"};
const S={
  home:{q:""},
  yakka:{q:"",tab:"search",kub:new Set(),gen:"",rev:0,limit:60,cls:null,pair:"1-0",dir:"down",cq:"",climit:60},
  kensa:{q:"",tab:"search",part:"",rev:0,limit:80,pair:"1-0",dir:"down",climit:60},
  ryuui:{q:"",tab:"search",part:"",limit:40,open:null},
};
let pins=store.get("orbit.pins",[]);
/* 画面切替はハッシュ変更イベントに頼らず直接描画する（公開ページの枠内では hashchange が届かないことがあるため）。
   URL の #名前 は、開いたときの初期画面の指定と、戻る操作のためにだけ使う。 */
function go(name,opts){
  if(opts)Object.assign(S[name],opts);
  route.name=S[name]&&(name==="home"||APP.mods.includes(name))?name:"home";closeSheet();render();window.scrollTo(0,0);
  try{if(location.hash.slice(1)!==route.name)history.pushState(null,"","#"+route.name)}catch(e){}
}
function fromHash(){const n=(location.hash.slice(1)||"home").replace(/[^a-z]/g,"");return S[n]?n:"home"}
window.addEventListener("popstate",()=>{const n=fromHash();if(n!==route.name){route.name=n;closeSheet();render();window.scrollTo(0,0)}});
window.addEventListener("hashchange",()=>{const n=fromHash();if(n!==route.name){route.name=n;closeSheet();render();window.scrollTo(0,0)}});
document.querySelectorAll("nav.dock button").forEach(b=>b.onclick=()=>go(b.dataset.go));
$("#go-home").onclick=()=>go("home");

function render(){
  document.body.dataset.mod=route.name==="home"?"":route.name;
  document.querySelectorAll("nav.dock button").forEach(b=>b.setAttribute("aria-selected",b.dataset.go===route.name));
  const v=$("#view");v.classList.remove("view");void v.offsetWidth;v.classList.add("view");
  const extra=Object.fromEntries(MODS.map(m=>[m.key,m.render]));
  ({home:renderHome,yakka:renderYakka,kensa:renderKensa,ryuui:renderRyuui,...extra})[route.name]();
}
/* 検索欄は再描画で消えないよう、モジュールごとに1回だけ作って使い回す */
function searchBox(id,ph,val,onInput){
  return{html:`<div class="search"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg><input id="${id}" type="search" inputmode="search" autocomplete="off" enterkeyhint="search" placeholder="${esc(ph)}" value="${esc(val)}" aria-label="${esc(ph)}"></div>`,
    bind(){let t;const el=$("#"+id);el.addEventListener("input",e=>{clearTimeout(t);t=setTimeout(()=>onInput(e.target.value),140);if(typeof HIST!=="undefined")HIST.note(id,e.target.value)})}};
}

/* ===================================================================== ホーム */
function renderHome(){
  const v=$("#view");const st=S.home;
  const n=k=>{const d=D[k];if(!d||d.error)return null;const m=MODS.find(x=>x.key===k);return m?m.count():k==="ryuui"?d.secs.filter(s=>s.c).length:d.rows.length};
  const box=searchBox("hq",APP.searchPh,st.q,q=>{st.q=q;homeResults()});
  const base=[["yakka","薬価","DRUG PRICE"],["kensa","診療行為・点数","FEE SCHEDULE"],...MODS.map(m=>[m.key,m.label,m.en]),["ryuui","留意事項","NOTICES"]].filter(b=>APP.mods.includes(b[0]));
  const nodes=base.map((b,i)=>[...b,-90+i*360/base.length]);
  v.innerHTML=`<section class="hero">
      <div class="eyebrow" style="--mod:var(--core)">${esc(APP.eyebrow)}</div>
      <h2 class="h">${esc(APP.headline)}</h2>
      <p class="lead">${esc(APP.lead)}ひらがな・カタカナ・英字・ローマ字のどれで入力しても探せます。</p>
      ${box.html}
      <div class="chips recent" id="hrecent"${st.q?" hidden":""}>${typeof HIST!=="undefined"?HIST.chips():""}</div>
    </section>
    <div id="hres"></div>
    <div id="homeviz">
      <div class="orbit-wrap" role="group" aria-label="モジュールを選ぶ">
        <svg class="rings" viewBox="0 0 400 400" aria-hidden="true">
          <defs><radialGradient id="g0"><stop offset="0" stop-color="#7dffcf" stop-opacity=".5"/><stop offset="1" stop-color="#7dffcf" stop-opacity="0"/></radialGradient></defs>
          <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(150,185,255,.18)" stroke-dasharray="2 6"/>
          <circle cx="200" cy="200" r="112" fill="none" stroke="rgba(150,185,255,.1)"/>
          <circle cx="200" cy="200" r="186" fill="none" stroke="rgba(150,185,255,.08)"/>
          <circle class="ring-pulse" cx="200" cy="200" r="60" fill="url(#g0)"/>
          ${[0,60,120,180,240,300].map(a=>`<line x1="${200+118*Math.cos(a*Math.PI/180)}" y1="${200+118*Math.sin(a*Math.PI/180)}" x2="${200+130*Math.cos(a*Math.PI/180)}" y2="${200+130*Math.sin(a*Math.PI/180)}" stroke="rgba(150,185,255,.35)"/>`).join("")}
        </svg>
        <div class="core"><div><small>CORE</small><b>${esc(APP.core)}</b><small>${new Date().getFullYear()}</small></div></div>
        <div class="spin">
          ${nodes.map(([k,label,en,deg])=>{const x=50+37.5*Math.cos(deg*Math.PI/180),y=50+37.5*Math.sin(deg*Math.PI/180);const c=n(k);
            return`<button class="node" data-go="${k}" style="left:${x}%;top:${y}%;--c:var(--${k})" aria-label="${label}を開く"><span class="globe"></span><span class="num">${c==null?"···":c>=10000?(c/10000).toFixed(1)+"万":c.toLocaleString()}</span><span class="lbl">${label}<small>${en}</small></span></button>`}).join("")}
        </div>
      </div>
      <div class="sat-grid">${nodes.map(([k,label])=>satHtml(k,label)).join("")}</div>
      <p class="note" style="margin-top:14px">${APP.sources}毎朝自動で最新版を確認しています。</p>
      <p class="note" style="margin-top:6px">個人が作成した非公式の検索ツールです。${esc(APP.notOfficial)}が作成したものではありません。内容の正確性は保証できないため、診療・請求の判断は必ず告示・通知などの原本で確認してください。営利目的では利用しないでください。</p>
    </div>`;
  box.bind();
  v.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
  if(st.q)homeResults();
}
function satHtml(k,label){
  const d=D[k];const c=`--c:var(--${k})`;
  if(!d)return`<button class="sat" data-go="${k}" style="${c}"><div class="k">${label}</div><div class="v">···</div><div class="s">受信中</div></button>`;
  if(d.error)return`<button class="sat" data-go="${k}" style="${c}"><div class="k">${label}</div><div class="v">ERR</div><div class="s">読み込めませんでした</div></button>`;
  const m=MODS.find(x=>x.key===k);if(m)return m.sat(label);
  if(k==="ryuui"){const n=d.secs.filter(s=>s.c).length;return`<button class="sat" data-go="${k}" style="${c}"><div><div class="k">${label}</div><div class="s">区分番号ごとの通知本文</div></div><div class="v">${n.toLocaleString()}<span class="note"> 項目</span></div></button>`}
  const rows=d.rows;let dn=0,up=0,eq=0;for(const r of rows){if(r.p[0]==null||r.p[1]==null)continue;const x=pct(r.p[1],r.p[0]);if(x<-0.005)dn++;else if(x>0.005)up++;else eq++}
  const t=dn+up+eq||1;
  return`<button class="sat" data-go="${k}" style="${c}"><div><div class="k">${label}</div><div class="s">${esc(d.revs[1].label.replace("改定",""))}→${esc(d.revs[0].label.replace("改定",""))}：引下げ${dn.toLocaleString()}・引上げ${up.toLocaleString()}</div></div>
    <div class="v">${rows.length.toLocaleString()}<span class="note"> ${k==="yakka"?"品目":"項目"}</span></div>
    <div class="mini-bar" aria-hidden="true"><i style="width:${dn/t*100}%;background:var(--down)"></i><i style="width:${eq/t*100}%;background:rgba(255,255,255,.12)"></i><i style="width:${up/t*100}%;background:var(--up)"></i></div></button>`;
}
function homeResults(){
  const box=$("#hres"),viz=$("#homeviz");const q=S.home.q.trim();
  const rc=$("#hrecent");if(rc){rc.hidden=!!q;if(!q)rc.innerHTML=HIST.chips()}
  if(!q){box.innerHTML="";viz.hidden=false;return}
  viz.hidden=true;const terms=queryTerms(q);
  const secs=[];
  if(D.yakka&&!D.yakka.error){const r=searchYakka(terms,{});secs.push(["yakka","薬価",r.length,r.slice(0,5).map(x=>yakkaCard(x,0,terms)).join("")])}
  if(D.kensa&&!D.kensa.error){const r=searchKensa(terms,"");secs.push(["kensa","診療行為・点数",r.length,r.slice(0,5).map(x=>kensaCard(x,0,terms)).join("")])}
  for(const m of MODS)if(D[m.key]&&!D[m.key].error){const r=m.search(terms);secs.push([m.key,m.label,r.length,r.slice(0,5).map(x=>m.card(x,terms)).join("")])}
  if(D.ryuui&&!D.ryuui.error){const r=searchRyuui(terms,"");secs.push(["ryuui","留意事項",r.length,r.slice(0,5).map(x=>ryuuiCard(x,terms)).join("")])}
  box.innerHTML=secs.map(([k,l,n,html])=>`<section class="xsec" style="--c:var(--${k});--mod:var(--${k})"><h3><i></i>${l}<span>${n.toLocaleString()} 件</span>${n>5?`<button data-all="${k}">すべて見る →</button>`:""}</h3>
    ${n?`<div class="list">${html}</div>`:`<div class="empty">該当なし</div>`}</section>`).join("")||loadingHtml("DATA LOADING");
  box.querySelectorAll("[data-all]").forEach(b=>b.onclick=()=>{const k=b.dataset.all;S[k].q=S.home.q;S[k].tab="search";go(k)});
}
document.addEventListener("click",e=>{
  const c=e.target.closest("[data-open]");if(!c)return;
  e.preventDefault();const [k,id]=c.dataset.open.split(":");
  const extra=Object.fromEntries(MODS.map(m=>[m.key,m.open]));
  ({yakka:openYakka,kensa:openKensa,ryuui:openRyuui,...extra})[k](k==="dpc"?id:+id);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")closeSheet();
  if(e.key==="Enter"&&e.target.matches&&e.target.matches(".card[data-open]"))e.target.click();
});

/* ===================================================================== 薬価 */
const KUBUN=["内用薬","注射薬","外用薬","歯科用薬剤"],KS=["内","注","外","歯"];
function searchYakka(terms,o){
  const rev=o.rev||0;
  let rows=D.yakka.rows.filter(r=>{
    if(r.p[rev]==null)return false;
    if(o.kub&&o.kub.size&&!o.kub.has(r.k))return false;
    if(o.gen==="S"&&!r.f.startsWith("S"))return false;
    if(o.gen==="G"&&!r.f.startsWith("G"))return false;
    if(o.cls&&!r.c.startsWith(o.cls))return false;
    if(o.cmb)return r.cb>=0&&(!terms.length||terms.every(vs=>vs.some(v=>has(D.eff.normT[r.cb],v))));
    /* 効能での検索は、規格別の適応がある品目ではその規格の適応だけを見る（20mgで適応外の病名で当たらないように） */
    return !terms.length||terms.every(vs=>vs.some(v=>has(r.h,v)||(r.ef>=0&&has(r.ownN??D.eff.normT[r.ef],v))));
  });
  if(terms.length&&!o.cmb){const w=terms[0];const sc=r=>{const n=norm(r.n);if(w.some(v=>n.startsWith(v)))return 0;if(w.some(v=>norm(r.i).startsWith(v)))return 1;if(w.some(v=>has(n,v)))return 2;if(w.some(v=>has(r.h,v)))return 3;return 4};
    rows=rows.map(r=>[sc(r),r]).sort((a,b)=>a[0]-b[0]||a[1].n.localeCompare(b[1].n,"ja")).map(a=>a[1])}
  return rows;
}
function flagTags(r){
  const t=[];
  if(r.f.startsWith("S"))t.push(`<span class="tag s">先発品</span>`);
  if(r.f.startsWith("G"))t.push(`<span class="tag g">後発品</span>`);
  if(r.f.includes("*"))t.push(`<span class="tag w">後発品あり</span>`);
  if(r.x)t.push(`<span class="tag">${esc(r.x)}</span>`);
  if(r.e)t.push(`<span class="tag w">経過措置 ${esc(r.e)}</span>`);
  if(r.cb>=0)t.push(`<span class="tag" style="border-color:var(--up);color:var(--up)">併用禁忌あり</span>`);
  if(r.doc>=0)t.push(`<span class="tag w">規格で適応が異なる</span>`);
  return t.join("");
}
/* 併用禁忌：行 \x1e、列 \x1f（薬剤名・臨床症状・措置方法・機序・危険因子） */
const comboRows=i=>D.eff.t[i].split("\x1e").map(r=>r.split("\x1f"));
function comboTable(i,terms){
  return`<div class="tbl"><table><tr><th>薬剤名等</th><th>臨床症状・措置方法</th><th>機序・危険因子</th></tr>
    ${comboRows(i).map(([n,s,m])=>`<tr><td class="w" style="font-weight:700;min-width:8em">${markText(n||"",terms)}</td><td class="w" style="min-width:12em">${markText(s||"",terms).replace(/\n/g,"<br>")}</td><td class="w" style="min-width:12em">${markText(m||"",terms).replace(/\n/g,"<br>")}</td></tr>`).join("")}</table></div>`;
}
function yakkaCard(r,ri,terms){
  const cur=r.p[ri];
  return`<div class="card" tabindex="0" role="button" data-open="yakka:${r.id}" style="--c:var(--yakka)">
    <div class="nm">${markText(r.n,terms)}</div>
    <div class="val"><span class="v">${fmt(cur)}</span><span class="u">円</span></div>
    <div class="sub">${markText(r.i,terms)}｜${esc(r.s)}${r.m?"｜"+esc(r.m):""}</div>
    <div class="row2">${delta(prevOf(r.p,ri),cur)}${spark(r.p,COLORS.yakka)}</div>
    <div class="tags"><span class="tag">${KS[r.k]}・${esc(clsName(r.c))}</span>${flagTags(r)}</div>
    ${S.yakka.cmb&&r.cb>=0&&route.name==="yakka"?`<div class="snip" style="--c:var(--up)"><b>併用禁忌</b>${snippet(comboRows(r.cb).map(x=>x[0]).join("／"),terms)}</div>`
      :r.ef>=0?`<div class="snip"><b>${r.own?"この規格の効能":"効能"}</b>${snippet(r.own||D.eff.t[r.ef],terms)}</div>`:""}
  </div>`;
}
function renderYakka(){
  const v=$("#view"),st=S.yakka,d=D.yakka;
  if(!d){v.innerHTML=head("yakka")+loadingHtml("RECEIVING DRUG DATA");return}
  if(d.error){v.innerHTML=head("yakka")+`<div class="empty">薬価データを読み込めませんでした（${esc(d.error)}）</div>`;return}
  const box=searchBox("yq","薬品名・成分名・効能・メーカー・YJコード",st.q,q=>{st.q=q;st.limit=60;yakkaBody()});
  v.innerHTML=head("yakka")+`
    <div class="tabs2" role="tablist">${[["search","検索"],["compare","改定比較"],["class","薬効分類"]].map(([k,l])=>`<button role="tab" data-t="${k}" aria-selected="${st.tab===k}">${l}</button>`).join("")}</div>
    <div id="yctl"${st.tab==="compare"?" hidden":""}>${box.html}
      <div class="chips" id="ykc">${KUBUN.map((k,i)=>`<button class="chip" data-k="${i}" aria-pressed="${st.kub.has(i)}">${k.replace("歯科用薬剤","歯科")}</button>`).join("")}<button class="chip" data-g="S" aria-pressed="${st.gen==="S"}">先発品</button><button class="chip" data-g="G" aria-pressed="${st.gen==="G"}">後発品</button>${D.eff?`<button class="chip" data-cmb="1" aria-pressed="${!!st.cmb}" style="--mod:var(--up)">併用禁忌の相手で探す</button>`:""}</div>
      ${revSeg(d.revs,st.rev,"yrev")}</div>
    <div id="ybody"></div>`;
  box.bind();
  v.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;renderYakka()});
  $("#ykc").onclick=e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.cmb){st.cmb=!st.cmb;$("#yq").placeholder=st.cmb?"併用禁忌の相手（薬剤名・成分名）を入力":"薬品名・成分名・効能・メーカー・YJコード"}
    else if(b.dataset.k!=null){const k=+b.dataset.k;st.kub.has(k)?st.kub.delete(k):st.kub.add(k)}else st.gen=st.gen===b.dataset.g?"":b.dataset.g;
    $("#ykc").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.cmb?!!st.cmb:x.dataset.k!=null?st.kub.has(+x.dataset.k):st.gen===x.dataset.g));st.limit=60;yakkaBody()};
  $("#yrev").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.rev=+b.dataset.r;$("#yrev").querySelectorAll("button").forEach((x,i)=>x.setAttribute("aria-pressed",i===st.rev));yakkaBody()};
  yakkaBody();
}
function head(k){
  const m=MODS.find(x=>x.key===k);
  const t=m?[m.en,m.title]:{yakka:["DRUG PRICE","薬価"],kensa:["FEE SCHEDULE","診療行為・点数（医科）"],ryuui:["NOTICES","保険診療上の留意事項"]}[k];
  let s=m?m.lead():"";
  if(k==="yakka"&&D.yakka&&!D.yakka.error)s=`${esc(D.yakka.revs[0].label)}・${esc(D.yakka.updated)}時点 ${D.yakka.rows.length.toLocaleString()}品目`+(D.eff?`／効能 PMDA ${esc(D.eff.built)}`:"");
  if(k==="kensa"&&D.kensa&&!D.kensa.error)s=`${esc(D.kensa.revs[0].label)}（${esc(D.kensa.revs[0].src)}）・${D.kensa.rows.length.toLocaleString()}項目`;
  if(k==="ryuui"&&D.ryuui&&!D.ryuui.error)s=`令和8年3月5日 保医発0305第6号 別添1（医科）・${D.ryuui.secs.filter(x=>x.c).length.toLocaleString()}項目`;
  return`<div class="eyebrow" style="margin-top:6px">${t[0]}</div><h2 class="h">${t[1]}</h2><p class="lead">${s}</p>`;
}
function yakkaBody(){
  const st=S.yakka,d=D.yakka,b=$("#ybody");if(!b)return;
  if(st.tab==="compare")return yakkaCompare(b);
  if(st.tab==="class")return yakkaClass(b);
  const terms=queryTerms(st.q);
  const filt=st.cls?`<div class="chips"><button class="chip" aria-pressed="true" id="ycls">薬効 ${esc(st.cls)} ${esc(clsName(st.cls))} ✕</button></div>`:"";
  if(!terms.length&&!st.cls&&!st.kub.size&&!st.gen&&!st.cmb){
    b.innerHTML=`<div class="meta"><span>${esc(d.revs[st.rev].label)}（${d.revs[st.rev].date.replace(/-/g,".")}〜）</span></div>
      <div class="panel" style="padding:16px"><p class="lead" style="margin:0 0 10px">品名・成分名のほか、ひらがな・ローマ字でも探せます。${D.eff?"効能の言葉（例：高血圧）でも検索できます。":""}</p>
      <div class="chips">${["アムロジピン 5mg","ろきそにん","rokisonin","キイトルーダ"].concat(D.eff?["高血圧"]:[]).map(x=>`<button class="chip ex">${x}</button>`).join("")}</div>
      <div class="stats">${[0,1,2].map(k=>`<div class="stat"><div class="k">${KUBUN[k]}</div><div class="v" style="color:var(--yakka)">${d.rows.filter(r=>r.k===k&&r.p[st.rev]!=null).length.toLocaleString()}</div></div>`).join("")}</div>
      ${D.eff?"":`<p class="note" style="margin:10px 0 0">効能・効果は PMDA 添付文書データの取り込み後に表示されます。</p>`}</div>`;
    b.querySelectorAll(".ex").forEach(x=>x.onclick=()=>{st.q=x.textContent;$("#yq").value=st.q;yakkaBody()});
    return;
  }
  const rows=searchYakka(terms,st);
  if(st.cls&&!terms.length)rows.sort((a,b)=>a.i.localeCompare(b.i,"ja")||a.p[st.rev]-b.p[st.rev]);
  DL.yakka=()=>({name:`薬価_${st.q||"一覧"}`,header:["区分","YJコード","品名","成分名","規格","メーカー","先発・後発","局・麻・毒等",d.revs[st.rev].label+"の薬価","前回の薬価","増減率(%)","薬効分類","効能・効果"+(D.eff?"（この規格）":""),"併用禁忌","経過措置"],
    rows:rows.map(r=>{const p=r.p[st.rev],q=prevOf(r.p,st.rev);return[KUBUN[r.k],r.c,r.n,r.i,r.s,r.m,r.f.startsWith("S")?"先発":r.f.startsWith("G")?"後発":"",r.x,p,q,p!=null&&q?(pct(q,p)).toFixed(1):"",r.cl+" "+clsName(r.c),r.ef>=0?nk(r.own||D.eff.t[r.ef]).replace(/\s*\n\s*/g," / "):"",r.cb>=0?"あり":"",r.e||""]})});
  b.innerHTML=`${filt}<div class="meta"><span>${rows.length.toLocaleString()} 件${st.cmb?(terms.length?"（入力した薬と併用禁忌の品目）":"（併用禁忌の記載がある品目）"):""}</span><span>${esc(d.revs[st.rev].label)}の薬価／前回比 ${rows.length?dlBtn("yakka"):""}</span></div>
    ${rows.length?`<div class="list">${rows.slice(0,st.limit).map(r=>yakkaCard(r,st.rev,terms)).join("")}</div>`:`<div class="empty">該当する品目がありません。成分名や別の表記でお試しください。</div>`}
    ${rows.length>st.limit?`<button class="more" id="ymore">さらに表示（残り ${(rows.length-st.limit).toLocaleString()} 件）</button>`:""}`;
  const m=$("#ymore");if(m)m.onclick=()=>{st.limit+=100;yakkaBody()};
  const c=$("#ycls");if(c)c.onclick=()=>{st.cls=null;yakkaBody()};
}
function yakkaCompare(b){
  const st=S.yakka,d=D.yakka;const [a,z]=st.pair.split("-").map(Number);
  const both=d.rows.filter(r=>r.p[a]!=null&&r.p[z]!=null);let dn=0,up=0,eq=0;const ch=[];
  for(const r of both){const x=pct(r.p[a],r.p[z]);if(x<-0.005)dn++;else if(x>0.005)up++;else eq++;ch.push([r,x])}
  const terms=queryTerms(st.cq);
  let list=ch.filter(([r,x])=>Math.abs(x)>0.005&&(st.dir==="down"?x<0:x>0)&&(!terms.length||hit(r.h,terms)));
  list.sort((p,q)=>st.dir==="down"?p[1]-q[1]:q[1]-p[1]);
  const pinRows=pins.map(k=>d.rows.find(r=>r.c+"|"+r.n===k)).filter(Boolean);const tot=both.length||1;
  const yr=i=>d.revs[i].date.slice(0,4);
  const box=searchBox("ycq","品名・成分名で絞り込み",st.cq,q=>{st.cq=q;st.climit=60;yakkaCompare(b)});
  b.innerHTML=`<div class="blk"><h3>MY COMPARE LIST</h3>
    ${pinRows.length?`<div class="tbl"><table><tr><th>品名</th>${[2,1,0].map(i=>`<th style="text-align:right">${d.revs[i].date.slice(0,7).replace("-",".")}</th>`).join("")}</tr>
      ${pinRows.map(r=>`<tr class="click" data-open="yakka:${r.id}"><td class="w">${esc(r.n)}</td>${[2,1,0].map(i=>`<td class="n">${fmt(r.p[i])}<br>${delta(prevOf(r.p,i),r.p[i])}</td>`).join("")}</tr>`).join("")}</table></div>`
      :`<div class="empty">品目の詳細で「比較リストに追加」を押すと、3回分の薬価が並びます。</div>`}</div>
    <div class="blk"><h3>REVISION OVERVIEW</h3>
    <div class="seg" id="ypair">${[["2-1",`${yr(2)}→${yr(1)}`],["1-0",`${yr(1)}→${yr(0)}`],["2-0",`${yr(2)}→${yr(0)}`]].map(([k,l])=>`<button data-p="${k}" aria-pressed="${st.pair===k}">${l}</button>`).join("")}</div>
    <div class="stats"><div class="stat dn"><div class="k">引下げ</div><div class="v">${dn.toLocaleString()}</div></div><div class="stat"><div class="k">据置き</div><div class="v">${eq.toLocaleString()}</div></div><div class="stat up"><div class="k">引上げ</div><div class="v">${up.toLocaleString()}</div></div></div>
    <div class="cmpbar"><i style="width:${dn/tot*100}%;background:var(--down)"></i><i style="width:${eq/tot*100}%;background:rgba(255,255,255,.12)"></i><i style="width:${up/tot*100}%;background:var(--up)"></i></div>
    <p class="note">${esc(d.revs[a].label)} → ${esc(d.revs[z].label)}。両方に収載の ${both.length.toLocaleString()} 品目で比較。${d.revs.some(r=>/中間年/.test(r.label))?"中間年改定の対象は一部の品目に限られます。":""}</p></div>
    <div class="blk"><h3>LARGEST MOVES</h3>${box.html}
    <div class="chips"><button class="chip" data-dir="down" aria-pressed="${st.dir==="down"}">引下げ率の大きい順</button><button class="chip" data-dir="up" aria-pressed="${st.dir==="up"}">引上げ率の大きい順</button></div>
    <div class="meta"><span>${list.length.toLocaleString()} 件</span></div>
    <div class="tbl"><table><tr><th>品名</th><th style="text-align:right">${yr(a)}</th><th style="text-align:right">${yr(z)}</th><th style="text-align:right">増減</th></tr>
      ${list.slice(0,st.climit).map(([r])=>`<tr class="click" data-open="yakka:${r.id}"><td class="w">${esc(r.n)}<br><span class="note">${esc(clsName(r.c))}</span></td><td class="n">${fmt(r.p[a])}</td><td class="n">${fmt(r.p[z])}</td><td class="n">${delta(r.p[a],r.p[z])}</td></tr>`).join("")}</table></div>
    ${list.length>st.climit?`<button class="more" id="ycm">さらに表示</button>`:""}</div>`;
  box.bind();
  $("#ypair").onclick=e=>{const x=e.target.closest("button");if(!x)return;st.pair=x.dataset.p;yakkaCompare(b)};
  b.querySelectorAll("[data-dir]").forEach(x=>x.onclick=()=>{st.dir=x.dataset.dir;yakkaCompare(b)});
  const m=$("#ycm");if(m)m.onclick=()=>{st.climit+=100;yakkaCompare(b)};
}
function yakkaClass(b){
  const st=S.yakka,d=D.yakka,cnt={};
  for(const r of d.rows)if(r.p[st.rev]!=null&&(!st.kub.size||st.kub.has(r.k)))cnt[r.cl]=(cnt[r.cl]||0)+1;
  const g={};Object.keys(cnt).sort().forEach(c=>(g[c[0]]=g[c[0]]||[]).push(c));
  b.innerHTML=`<p class="note" style="margin-top:14px">日本標準商品分類（薬効分類番号）ごとの品目数。タップで一覧を開きます。</p>`+
    Object.keys(g).map(k=>`<div class="part"><button aria-expanded="false" data-p="${k}"><span><span class="code" style="font-family:var(--f-tech);color:var(--yakka)">${k}</span>　${esc(CLS1[k]||"")}</span><span class="n">${g[k].reduce((s,c)=>s+cnt[c],0).toLocaleString()}</span></button>
      <div class="body" hidden>${g[k].map(c=>`<button class="sec-link" data-c="${c}"><span class="code" style="color:var(--yakka)">${c}</span><span style="flex:1">${esc(clsName(c))}</span><span class="note">${cnt[c]}</span></button>`).join("")}</div></div>`).join("");
  b.querySelectorAll(".part>button").forEach(x=>x.onclick=()=>{const bd=x.nextElementSibling;bd.hidden=!bd.hidden;x.setAttribute("aria-expanded",!bd.hidden)});
  b.querySelectorAll("[data-c]").forEach(x=>x.onclick=()=>{st.cls=x.dataset.c;st.tab="search";st.q="";st.limit=60;renderYakka()});
}
function openYakka(id){
  const d=D.yakka,r=d.rows[id],st=S.yakka,terms=queryTerms(route.name==="home"?S.home.q:st.q);
  const pinned=pins.includes(r.c+"|"+r.n);
  const sib=d.rows.filter(x=>x.i===r.i&&x.s===r.s&&x.k===r.k&&x.p[st.rev]!=null).sort((a,b)=>a.p[st.rev]-b.p[st.rev]);
  const qn=encodeURIComponent(r.n.replace(/[\d.]+(mg|g|mL|μg|%|単位).*$/,"")||r.n);
  sheet("yakka",`<h2>${esc(r.n)}</h2><div class="tags" style="margin-top:6px">${flagTags(r)}</div>
    <div class="big"><span class="v">${fmt(r.p[st.rev])}</span><span class="u">円／${esc(r.s)}　${esc(d.revs[st.rev].label)}</span>${delta(prevOf(r.p,st.rev),r.p[st.rev])}</div>`,
  `<div class="blk"><h3>INDICATIONS ／ 効能・効果</h3>${r.ef>=0&&r.doc>=0?strengthBlock(r,terms):r.ef>=0?`<div class="txt">${emph(markText(D.eff.t[r.ef],terms))}</div>`
      :`<div class="txt" style="color:var(--dim)">${D.eff?"この品目の添付文書データが見つかりませんでした。":"効能・効果データは未登録です。"}下のリンクから確認できます。</div>`}</div>
  ${r.ct>=0?`<div class="blk" style="--mod:var(--up)"><h3>CONTRAINDICATIONS ／ 禁忌</h3><div class="txt">${emph(markText(D.eff.t[r.ct],terms))}</div></div>`:""}
  ${r.ef>=0?`<div class="blk" style="--mod:var(--up)"><h3>CONTRAINDICATED COMBINATIONS ／ 併用禁忌</h3>${r.cb>=0?comboTable(r.cb,terms):`<div class="txt" style="color:var(--dim)">添付文書に併用禁忌の記載はありません。</div>`}</div>`:""}
  ${r.ef>=0?`<p class="note">出典：PMDA 医療用医薬品 添付文書を加工して作成（${esc(D.eff.built)}取得${r.efr?`・${esc(r.efr)}改訂版`:""}）${r.efx==="near"?"。この品目の添付文書が見つからないため、同じ成分・剤形の添付文書の記載を表示しています。":""}用法・用量や併用注意などは添付文書の原文でご確認ください。</p>`:""}
  <div class="blk"><h3>PRICE TIMELINE ／ 直近3回の改定</h3>${timeline(d.revs,r.p,st.rev,"円")}</div>
  <div class="blk"><h3>PROFILE</h3><dl class="kv">
    <dt>薬効分類</dt><dd><b>${esc(r.cl)} ${esc(clsName(r.c))}</b><br><span class="note">${esc(CLS2[+r.c.slice(0,2)]||"")}／${esc(CLS1[+r.c[0]]||"")}</span></dd>
    <dt>成分名</dt><dd>${esc(r.i)}</dd><dt>規格・単位</dt><dd>${esc(r.s)}</dd><dt>区分</dt><dd>${KUBUN[r.k]}</dd>
    <dt>メーカー</dt><dd>${esc(r.m)||"—"}</dd><dt>YJコード</dt><dd style="font-family:var(--f-tech)">${esc(r.c)}</dd>
    ${r.e?`<dt>経過措置</dt><dd>${esc(r.e)} まで</dd>`:""}${r.b?`<dt>備考</dt><dd>${esc(r.b)}</dd>`:""}</dl></div>
  ${typeof dpcForDrug==="function"?dpcForDrug(r):""}
  ${sib.length>1?`<div class="blk"><h3>SAME INGREDIENT ／ 同成分・同規格 ${sib.length}件</h3><div class="tbl"><table><tr><th>品名</th><th>区分</th><th style="text-align:right">薬価</th></tr>
    ${sib.slice(0,40).map(x=>`<tr class="${x===r?"cur":"click"}" ${x===r?"":`data-open="yakka:${x.id}"`}><td class="w">${esc(x.n)}<br><span class="note">${esc(x.m)}</span></td><td>${x.f.startsWith("S")?"先発":x.f.startsWith("G")?"後発":"—"}</td><td class="n">${fmt(x.p[st.rev])}</td></tr>`).join("")}</table></div></div>`:""}
  <div class="btns"><button class="btn pri" id="pinb">${pinned?"比較リストから外す":"比較リストに追加"}</button>
    <a class="btn" href="https://www.pmda.go.jp/PmdaSearch/iyakuSearch/" target="_blank" rel="noopener">PMDA 添付文書</a>
    <a class="btn" href="https://www.kegg.jp/medicus-bin/search_drug?search_keyword=${qn}" target="_blank" rel="noopener">KEGG</a></div>`);
  $("#pinb").onclick=()=>{const k=r.c+"|"+r.n;pins=pins.includes(k)?pins.filter(x=>x!==k):[...pins,k];store.set("orbit.pins",pins);pinBadge();openYakka(id);if(route.name==="yakka"&&S.yakka.tab==="compare")yakkaBody()};
}
function pinBadge(){const b=$("#pinc");b.hidden=!pins.length;b.textContent=pins.length}

/* ===================================================================== 検査・画像診断 */
const KPART={A:"基本診療料",B:"第1部 医学管理等",C:"第2部 在宅医療",D:"第3部 検査",E:"第4部 画像診断",F:"第5部 投薬",G:"第6部 注射",H:"第7部 リハビリテーション",I:"第8部 精神科専門療法",J:"第9部 処置",K:"第10部 手術",L:"第11部 麻酔",M:"第12部 放射線治療",N:"第13部 病理診断",O:"第14部 その他"};
function kbnName(k){const s=D.ryuui&&!D.ryuui.error&&D.ryuui.byCode[k];return s?s.n:""}
function searchKensa(terms,part){
  let rows=D.kensa.rows.filter(r=>r.p[S.kensa.rev]!=null&&(!part||r.k[0]===part)&&(!terms.length||terms.every(vs=>vs.some(v=>has(r.hs,v)||has(norm(kbnName(r.k)),v)))));
  if(terms.length){const w=terms[0];const sc=r=>{const n=norm(r.n);if(w.some(v=>n.startsWith(v)))return 0;if(w.some(v=>has(n,v)))return 1;if(w.some(v=>has(norm(r.y),v)))return 2;return 3};
    rows=rows.map(r=>[sc(r),r]).sort((a,b)=>a[0]-b[0]).map(a=>a[1])}
  return rows;
}
function kensaCard(r,ri,terms){
  return`<div class="card" tabindex="0" role="button" data-open="kensa:${r.id}" style="--c:var(--kensa)">
    <div class="nm"><span class="code">${esc(r.k)}</span>${markText(r.n,terms)}</div>
    <div class="val"><span class="v">${fmt(r.p[ri])}</span><span class="u">${r.u}</span></div>
    <div class="sub">${esc(kbnName(r.k)||KPART[r.k[0]])}${r.y?"｜"+markText(r.y,terms):""}</div>
    <div class="row2">${delta(prevOf(r.p,ri),r.p[ri])}${spark(r.p,COLORS.kensa)}</div>
  </div>`;
}
function renderKensa(){
  const v=$("#view"),st=S.kensa,d=D.kensa;
  if(!d){v.innerHTML=head("kensa")+loadingHtml("RECEIVING FEE DATA");return}
  if(d.error){v.innerHTML=head("kensa")+`<div class="empty">点数データを読み込めませんでした（${esc(d.error)}）</div>`;return}
  const box=searchBox("kq","診療行為名・術式・読み・区分番号（例：K546、PCI、CT、けつえき）",st.q,q=>{st.q=q;st.limit=80;kensaBody()});
  v.innerHTML=head("kensa")+`<div class="tabs2" role="tablist">${[["search","検索"],["compare","改定比較"]].map(([k,l])=>`<button role="tab" data-t="${k}" aria-selected="${st.tab===k}">${l}</button>`).join("")}</div>
    <div${st.tab==="compare"?" hidden":""}>${box.html}
    <div class="chips" id="kpc"><button class="chip" data-p="" aria-pressed="${!st.part}">すべて</button>${Object.entries(KPART).map(([k,l])=>`<button class="chip" data-p="${k}" aria-pressed="${st.part===k}">${k} ${esc(l.replace(/^第\d+部\s*/,""))}</button>`).join("")}</div>
    ${revSeg(d.revs,st.rev,"krev")}</div><div id="kbody"></div>`;
  box.bind();
  v.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;renderKensa()});
  $("#kpc").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.part=b.dataset.p;$("#kpc").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.p===st.part));st.limit=80;kensaBody()};
  $("#krev").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.rev=+b.dataset.r;$("#krev").querySelectorAll("button").forEach((x,i)=>x.setAttribute("aria-pressed",i===st.rev));kensaBody()};
  kensaBody();
}
function kensaBody(){
  const st=S.kensa,d=D.kensa,b=$("#kbody");if(!b)return;
  if(st.tab==="compare")return kensaCompare(b);
  const terms=queryTerms(st.q);const rows=searchKensa(terms,st.part);
  if(!terms.length){ /* 区分番号ごとの目次 */
    const g=new Map();for(const r of rows){if(!g.has(r.k))g.set(r.k,[]);g.get(r.k).push(r)}
    const keys=[...g.keys()];
    b.innerHTML=`<div class="meta"><span>${keys.length.toLocaleString()} 区分・${rows.length.toLocaleString()} 項目</span><span>${esc(d.revs[st.rev].label)}</span></div>`+
      keys.slice(0,st.limit).map(k=>`<div class="part"><button data-k="${k}"><span><span style="font-family:var(--f-tech);color:var(--kensa);margin-right:8px">${esc(k)}</span>${esc(kbnName(k)||g.get(k)[0].n)}</span><span class="n">${g.get(k).length}</span></button><div class="body" hidden></div></div>`).join("")+
      (keys.length>st.limit?`<button class="more" id="kmore">さらに表示</button>`:"");
    b.querySelectorAll(".part>button").forEach(x=>x.onclick=()=>{const bd=x.nextElementSibling;if(bd.hidden&&!bd.innerHTML)bd.innerHTML=`<div class="list" style="padding:8px">${g.get(x.dataset.k).map(r=>kensaCard(r,st.rev,[])).join("")}</div>`;bd.hidden=!bd.hidden});
  }else{
    DL.kensa=()=>({name:`点数_${st.q}`,header:["区分番号","診療行為コード","名称","読み","単位",...d.revs.map(r=>r.label)],rows:rows.map(r=>[r.k,r.c,r.n,r.y,r.u,...r.p])});
    b.innerHTML=`<div class="meta"><span>${rows.length.toLocaleString()} 件</span><span>${esc(d.revs[st.rev].label)}の点数／前回比 ${rows.length?dlBtn("kensa"):""}</span></div>
      ${rows.length?`<div class="list">${rows.slice(0,st.limit).map(r=>kensaCard(r,st.rev,terms)).join("")}</div>`:`<div class="empty">該当する項目がありません。略称（例：CRP、HbA1c）や読みでもお試しください。</div>`}
      ${rows.length>st.limit?`<button class="more" id="kmore">さらに表示（残り ${(rows.length-st.limit).toLocaleString()} 件）</button>`:""}`;
  }
  const m=$("#kmore");if(m)m.onclick=()=>{st.limit+=100;kensaBody()};
}
function kensaCompare(b){
  const st=S.kensa,d=D.kensa;const [a,z]=st.pair.split("-").map(Number);
  const both=d.rows.filter(r=>r.p[a]!=null&&r.p[z]!=null);let dn=0,up=0,eq=0;const ch=[];
  for(const r of both){if(!r.p[a])continue;const x=pct(r.p[a],r.p[z]);if(x<-0.005)dn++;else if(x>0.005)up++;else eq++;ch.push([r,x])}
  const added=d.rows.filter(r=>r.p[a]==null&&r.p[z]!=null);
  const list=ch.filter(([,x])=>Math.abs(x)>0.005&&(st.dir==="down"?x<0:x>0)).sort((p,q)=>st.dir==="down"?p[1]-q[1]:q[1]-p[1]);
  const yr=i=>d.revs[i].date.slice(0,4),tot=dn+up+eq||1;
  b.innerHTML=`<div class="blk"><h3>REVISION OVERVIEW</h3>
    <div class="seg" id="kpair">${[["2-1",`${yr(2)}→${yr(1)}`],["1-0",`${yr(1)}→${yr(0)}`],["2-0",`${yr(2)}→${yr(0)}`]].map(([k,l])=>`<button data-p="${k}" aria-pressed="${st.pair===k}">${l}</button>`).join("")}</div>
    <div class="stats"><div class="stat dn"><div class="k">引下げ</div><div class="v">${dn}</div></div><div class="stat"><div class="k">据置き</div><div class="v">${eq.toLocaleString()}</div></div><div class="stat up"><div class="k">引上げ</div><div class="v">${up}</div></div></div>
    <div class="cmpbar"><i style="width:${dn/tot*100}%;background:var(--down)"></i><i style="width:${eq/tot*100}%;background:rgba(255,255,255,.12)"></i><i style="width:${up/tot*100}%;background:var(--up)"></i></div>
    <p class="note">${esc(d.revs[a].label)} → ${esc(d.revs[z].label)}。新設 ${added.length} 項目。</p></div>
    <div class="blk"><h3>LARGEST MOVES</h3><div class="chips"><button class="chip" data-dir="down" aria-pressed="${st.dir==="down"}">引下げの大きい順</button><button class="chip" data-dir="up" aria-pressed="${st.dir==="up"}">引上げの大きい順</button><button class="chip" data-dir="new" aria-pressed="${st.dir==="new"}">新設</button></div>
    <div class="tbl" style="margin-top:10px"><table><tr><th>項目</th><th style="text-align:right">${yr(a)}</th><th style="text-align:right">${yr(z)}</th><th style="text-align:right">増減</th></tr>
    ${(st.dir==="new"?added.map(r=>[r]):list).slice(0,st.climit).map(([r])=>`<tr class="click" data-open="kensa:${r.id}"><td class="w"><span style="font-family:var(--f-tech);color:var(--kensa)">${esc(r.k)}</span> ${esc(r.n)}</td><td class="n">${fmt(r.p[a])}</td><td class="n">${fmt(r.p[z])}</td><td class="n">${delta(r.p[a],r.p[z])||"新設"}</td></tr>`).join("")}</table></div>
    ${(st.dir==="new"?added.length:list.length)>st.climit?`<button class="more" id="kcm">さらに表示</button>`:""}</div>`;
  $("#kpair").onclick=e=>{const x=e.target.closest("button");if(!x)return;st.pair=x.dataset.p;kensaCompare(b)};
  b.querySelectorAll("[data-dir]").forEach(x=>x.onclick=()=>{st.dir=x.dataset.dir;kensaCompare(b)});
  const m=$("#kcm");if(m)m.onclick=()=>{st.climit+=100;kensaCompare(b)};
}
function openKensa(id){
  const d=D.kensa,r=d.rows[id],st=S.kensa,terms=queryTerms(route.name==="home"?S.home.q:st.q);
  const same=d.rows.filter(x=>x.k===r.k&&x.p[st.rev]!=null);
  const sec=D.ryuui&&!D.ryuui.error?D.ryuui.byCode[r.k]:null;
  sheet("kensa",`<div class="eyebrow">${esc(r.k)} · ${esc(KPART[r.k[0]])}</div><h2>${esc(r.n)}</h2>
    <div class="big"><span class="v">${fmt(r.p[st.rev])}</span><span class="u">${r.u}　${esc(d.revs[st.rev].label)}</span>${delta(prevOf(r.p,st.rev),r.p[st.rev])}</div>`,
  `<div class="blk"><h3>POINT TIMELINE ／ 直近3回の改定</h3>${timeline(d.revs,r.p,st.rev,r.u)}</div>
   <div class="blk"><h3>PROFILE</h3><dl class="kv"><dt>区分番号</dt><dd><b>${esc(r.k)}</b> ${esc(kbnName(r.k))}</dd><dt>診療行為コード</dt><dd style="font-family:var(--f-tech)">${esc(r.c)}</dd>${r.y?`<dt>読み</dt><dd>${esc(r.y)}</dd>`:""}</dl></div>
   ${sec?`<div class="blk" style="--mod:var(--ryuui)"><h3>NOTICE ／ 算定上の留意事項（${esc(r.k)}）</h3><div class="txt">${emph(linkify(markText(sec.t,terms)))}</div>
     <div class="btns"><button class="btn" data-open="ryuui:${sec.id}">留意事項で開く</button></div></div>`:""}
   ${typeof dpcForK==="function"&&r.k[0]==="K"?dpcForK(r.k):""}
   ${same.length>1?`<div class="blk"><h3>SAME SECTION ／ 同じ区分の項目 ${same.length}件</h3><div class="tbl"><table><tr><th>項目</th><th style="text-align:right">点数</th></tr>
     ${same.map(x=>`<tr class="${x===r?"cur":"click"}" ${x===r?"":`data-open="kensa:${x.id}"`}><td class="w">${esc(x.n)}</td><td class="n">${fmt(x.p[st.rev])}</td></tr>`).join("")}</table></div></div>`:""}`);
}

/* ===================================================================== 留意事項 */
function searchRyuui(terms,part){
  const secs=D.ryuui.secs.filter(s=>(!part||s.pt===part)&&(!terms.length||terms.every(vs=>vs.some(v=>has(s.hs,v)||has(s.ht,v)))));
  if(!terms.length)return secs;
  const score=s=>{let t=0,title=0;for(const vs of terms)for(const v of vs){if(has(s.hs,v))title++;let at=s.ht.indexOf(v);while(at>=0&&t<99){t++;at=s.ht.indexOf(v,at+v.length)}}return title*1000+t};
  return secs.map(s=>[score(s),s]).sort((a,b)=>b[0]-a[0]).map(a=>a[1]);
}
function ryuuiCard(s,terms){
  return`<div class="card" tabindex="0" role="button" data-open="ryuui:${s.id}" style="--c:var(--ryuui)">
    <div class="nm">${s.c?`<span class="code">${esc(s.c)}</span>`:""}${markText(s.n,terms)}</div>
    <div class="val"><span class="u">p.${s.pg}</span></div>
    <div class="sub">${esc(s.pt||s.ch)}</div>
    <div class="snip">${snippet(s.t,terms)}</div>
  </div>`;
}
/* 本文中の「D007」などを、その区分の留意事項へのリンクにする */
function linkify(html){
  if(!D.ryuui||D.ryuui.error)return html;
  return html.replace(/「([A-N]\d{3}(?:-\d+)?)」/g,(m,c)=>D.ryuui.byCode[c]?`「<a data-open="ryuui:${D.ryuui.byCode[c].id}">${c}</a>」`:m);
}
function renderRyuui(){
  const v=$("#view"),st=S.ryuui,d=D.ryuui;
  if(!d){v.innerHTML=head("ryuui")+loadingHtml("RECEIVING NOTICES");return}
  if(d.error){v.innerHTML=head("ryuui")+`<div class="empty">留意事項を読み込めませんでした（${esc(d.error)}）</div>`;return}
  const parts=[...new Set(d.secs.map(s=>s.pt).filter(Boolean))];
  const box=searchBox("rq","言葉・区分番号で本文を検索（例：同一日、D007、オンライン）",st.q,q=>{st.q=q;st.limit=40;ryuuiBody()});
  v.innerHTML=head("ryuui")+`<div class="tabs2" role="tablist">${[["search","検索"],["browse","目次から探す"]].map(([k,l])=>`<button role="tab" data-t="${k}" aria-selected="${st.tab===k}">${l}</button>`).join("")}</div>
    <div${st.tab==="browse"?" hidden":""}>${box.html}
    <div class="chips" id="rpc"><button class="chip" data-p="" aria-pressed="${!st.part}">すべての部</button>${parts.map(p=>`<button class="chip" data-p="${esc(p)}" aria-pressed="${st.part===p}">${esc(p.replace(/^第\d+部\s*/,""))}</button>`).join("")}</div></div>
    <div id="rbody"></div>`;
  box.bind();
  v.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{st.tab=b.dataset.t;renderRyuui()});
  $("#rpc").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.part=b.dataset.p;$("#rpc").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.p===st.part));st.limit=40;ryuuiBody()};
  ryuuiBody();
}
function ryuuiBody(){
  const st=S.ryuui,d=D.ryuui,b=$("#rbody");if(!b)return;
  if(st.tab==="browse"){
    const groups=new Map();for(const s of d.secs){const k=s.pt||s.ch||"通則";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s)}
    b.innerHTML=`<p class="note" style="margin-top:14px">通知の章・部の順に並べています。</p>`+[...groups].map(([k,list])=>`<div class="part"><button><span>${esc(k)}</span><span class="n">${list.length}</span></button><div class="body" hidden>${list.map(s=>`<button class="sec-link" data-open="ryuui:${s.id}"><span class="code">${esc(s.c||"通則")}</span><span>${esc(s.n)}</span></button>`).join("")}</div></div>`).join("");
    b.querySelectorAll(".part>button").forEach(x=>x.onclick=()=>{const bd=x.nextElementSibling;bd.hidden=!bd.hidden});
    return;
  }
  const terms=queryTerms(st.q);
  if(!terms.length){
    b.innerHTML=`<div class="panel" style="padding:16px;margin-top:14px"><p class="lead" style="margin:0 0 10px">通知本文の全文を検索します。区分番号（例：D007）や、算定の条件になる言葉で探せます。</p>
      <div class="chips">${["同一日","オンライン","D007","CT","入院中","併算定"].map(x=>`<button class="chip ex">${x}</button>`).join("")}</div>
      <p class="note" style="margin:10px 0 0">出典：${esc(d.title)}</p></div>`;
    b.querySelectorAll(".ex").forEach(x=>x.onclick=()=>{st.q=x.textContent;$("#rq").value=st.q;ryuuiBody()});
    return;
  }
  const secs=searchRyuui(terms,st.part);
  DL.ryuui=()=>({name:`留意事項_${st.q}`,header:["区分番号","見出し","部","通知のページ","本文"],rows:secs.map(s=>[s.c,s.n,s.pt||s.ch,s.pg,s.t])});
  b.innerHTML=`<div class="meta"><span>${secs.length.toLocaleString()} 件</span><span>見出し一致 → 本文の一致数の順 ${secs.length?dlBtn("ryuui"):""}</span></div>
    ${secs.length?`<div class="list">${secs.slice(0,st.limit).map(s=>ryuuiCard(s,terms)).join("")}</div>`:`<div class="empty">該当する記載がありません。</div>`}
    ${secs.length>st.limit?`<button class="more" id="rmore">さらに表示（残り ${(secs.length-st.limit).toLocaleString()} 件）</button>`:""}`;
  const m=$("#rmore");if(m)m.onclick=()=>{st.limit+=40;ryuuiBody()};
}
function openRyuui(id){
  const d=D.ryuui,s=d.secs[id],terms=queryTerms(route.name==="home"?S.home.q:S.ryuui.q);
  const pts=s.c&&D.kensa&&!D.kensa.error?D.kensa.rows.filter(r=>r.k===s.c&&r.p[0]!=null):[];
  const prev=d.secs[id-1],next=d.secs[id+1];
  sheet("ryuui",`<div class="eyebrow">${esc(s.pt||s.ch)} · p.${s.pg}</div><h2>${s.c?`<span style="font-family:var(--f-tech);color:var(--ryuui);margin-right:8px">${esc(s.c)}</span>`:""}${esc(s.n)}</h2>`,
  `<div class="blk"><h3>NOTICE TEXT</h3><div class="txt">${emph(linkify(markText(s.t,terms)))}</div>
     <p class="note">出典：${esc(d.title)}${d.src?`（<a href="${esc(d.src)}" target="_blank" rel="noopener">PDF</a>）`:""}。PDFから自動で文字を取り出しているため、表や図は原文でご確認ください。</p></div>
   ${pts.length?`<div class="blk" style="--mod:var(--kensa)"><h3>POINTS ／ ${esc(s.c)} の点数</h3><div class="tbl"><table><tr><th>項目</th><th style="text-align:right">${esc(D.kensa.revs[0].label.replace("改定",""))}</th></tr>
     ${pts.map(r=>`<tr class="click" data-open="kensa:${r.id}"><td class="w">${esc(r.n)}</td><td class="n">${fmt(r.p[0])} ${r.u}</td></tr>`).join("")}</table></div></div>`:""}
   <div class="navpn">${prev?`<button data-open="ryuui:${prev.id}">← ${esc(prev.c||"")} ${esc(prev.n)}</button>`:"<span></span>"}${next?`<button data-open="ryuui:${next.id}">${esc(next.c||"")} ${esc(next.n)} →</button>`:"<span></span>"}</div>`);
}

/* ===================================================================== シート */
function sheet(mod,top,body){
  $("#sheet-root").innerHTML=`<div class="veil" id="veil"></div><div class="sheet" role="dialog" aria-modal="true" style="--mod:var(--${mod})">
    <div class="in"><div class="top"><div class="grab"></div><button class="x" id="sx">閉じる</button>${top}</div>${body}</div></div>`;
  $("#veil").onclick=closeSheet;$("#sx").onclick=closeSheet;
  document.body.style.overflow="hidden";$(".sheet").scrollTop=0;$("#sx").focus({preventScroll:true});
}
function closeSheet(){$("#sheet-root").innerHTML="";document.body.style.overflow=""}

/* ===================================================================== 星空 */
(function sky(){
  const cv=$("#sky"),cx=cv.getContext("2d");let W,H,stars=[];
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(typeof APP!=="undefined"&&APP.theme==="ocean")return ocean();
  /* 医薬品アプリ：右上から夏の太陽が差す大海原。水平線から下に波の線、太陽の下に光の道（きらめき）、上空に光の粒 */
  function ocean(){
    let glints=[],motes=[],t0=0;
    function size(){const dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);
      const hy=H*.36,sx=W*.82;
      glints=Array.from({length:Math.round(W*H/2600)},()=>{const y=hy+Math.pow(Math.random(),1.6)*(H-hy);const spread=40+(y-hy)*.9;
        const near=Math.random()<.65;return{x:near?sx+(Math.random()-.5)*spread*2:Math.random()*W,y,r:Math.random()*1.6+.4+(y-hy)/H*1.6,t:Math.random()*6.28,s:Math.random()*.004+.002,near}});
      motes=Array.from({length:Math.round(W/14)},()=>({x:Math.random()*W,y:Math.random()*H*.36,r:Math.random()*1.4+.3,t:Math.random()*6.28,v:Math.random()*.15+.05}))}
    function draw(ts){
      const dt=Math.min(50,ts-t0)||16;t0=ts;cx.clearRect(0,0,W,H);
      const hy=H*.36,sx=W*.82,tt=ts*.001;
      /* 水平線のかすみ */
      const g=cx.createLinearGradient(0,hy-30,0,hy+40);g.addColorStop(0,"rgba(255,236,170,0)");g.addColorStop(.5,"rgba(255,236,170,.35)");g.addColorStop(1,"rgba(255,236,170,0)");
      cx.fillStyle=g;cx.fillRect(0,hy-30,W,70);
      /* 波：奥ほど細かく、手前ほど大きく */
      for(let i=0;i<26;i++){
        const k=i/25,y=hy+Math.pow(k,1.7)*(H-hy),amp=1+k*9,len=60+k*260,ph=tt*(.6+k*.8)+i*1.7;
        cx.beginPath();for(let x=-20;x<=W+20;x+=12){const yy=y+Math.sin(x/len*6.283+ph)*amp;x<0?cx.moveTo(x,yy):cx.lineTo(x,yy)}
        cx.strokeStyle=`rgba(190,230,255,${.05+k*.08})`;cx.lineWidth=.6+k*1.2;cx.stroke();
      }
      /* 太陽の下の光の道（きらめき） */
      for(const p of glints){
        /* 点滅はゆっくり（数秒周期）・やわらかく：チカチカしないように */
        if(!still)p.t+=dt*p.s*.3;
        const w=Math.sin(p.t),a=w*w*(p.near?.6:.22);if(a<.04)continue;
        const yy=p.y+Math.sin(tt*1.2+p.x*.02)*2;
        cx.beginPath();cx.ellipse(p.x,yy,p.r*2.4,p.r*.7,0,0,6.283);cx.fillStyle=`rgba(255,${p.near?236:250},${p.near?150:255},${a})`;cx.fill();
      }
      /* 上空の光の粒 */
      for(const m of motes){
        if(!still){m.y-=m.v*dt*.02;m.t+=dt*.002;if(m.y<-4){m.y=H*.36;m.x=Math.random()*W}}
        cx.beginPath();cx.arc(m.x+Math.sin(m.t)*4,m.y,m.r,0,6.283);cx.fillStyle=`rgba(255,240,180,${.25+.35*Math.abs(Math.sin(m.t))})`;cx.fill();
      }
      if(!still)requestAnimationFrame(draw);
    }
    size();addEventListener("resize",()=>{size();if(still)draw(0)});requestAnimationFrame(draw);
  }
  function size(){const dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);
    stars=Array.from({length:Math.round(W*H/2600)},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.3+.2,z:Math.random()*.8+.2,t:Math.random()*6.28,h:Math.random()<.12?(Math.random()<.5?"79,227,255":"179,140,255"):"230,238,255"}))}
  let last=0;
  function draw(ts){
    const dt=Math.min(50,ts-last)||16;last=ts;cx.clearRect(0,0,W,H);
    const sy=scrollY*.04;
    for(const s of stars){
      if(!still){s.x-=s.z*dt*.006;if(s.x<-2)s.x=W+2;s.t+=dt*.002}
      const a=.35+.45*Math.abs(Math.sin(s.t))*s.z;const y=((s.y-sy*s.z)%H+H)%H;
      cx.beginPath();cx.arc(s.x,y,s.r,0,6.283);cx.fillStyle=`rgba(${s.h},${a})`;cx.fill();
    }
    if(!still)requestAnimationFrame(draw);
  }
  size();addEventListener("resize",()=>{size();if(still)draw(0)});requestAnimationFrame(draw);
})();

/* ===================================================================== 起動 */
/* 起動は boot.js（すべてのモジュールを読み込んだ後）で行う */
