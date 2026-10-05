/* 検索履歴（ログインしたIDごと）・検索結果のCSVダウンロード・アカウントメニュー */
"use strict";

/* ---------- 検索履歴 ----------
   その端末のブラウザに、アプリ×ログインID（のハッシュ）ごとに保存する（最大200件）。
   検索欄で入力が1.2秒止まったら1件として記録する。同じ画面・同じ語は最新の1件にまとめる。 */
const HIST=(()=>{
  const MAX=200;
  const BOX={hq:["home","横断"],yq:["yakka","薬価"],kq:["kensa","点数"],rq:["ryuui","留意事項"],dq:["dpc","DPC"],ddq:["dpcdrug","DPC薬剤"],bq:["byomei","傷病名"]};
  const key=()=>`orbit.hist.${APP.id}.${VAULT.user}`;
  const load=()=>{try{return JSON.parse(localStorage.getItem(key())||"[]")}catch(e){return[]}};
  const save=a=>{try{localStorage.setItem(key(),JSON.stringify(a.slice(0,MAX)))}catch(e){}};
  let timer=null;
  function note(boxId,q){
    clearTimeout(timer);const b=BOX[boxId];if(!b)return;
    timer=setTimeout(()=>{
      const v=nk(q).trim();if(v.length<2)return;
      const a=load().filter(h=>!(h.m===b[0]&&h.q===v));
      a.unshift({m:b[0],q:v,t:Date.now()});save(a);
      const r=$("#hrecent");if(r&&route.name==="home")r.innerHTML=chips();
    },1200);
  }
  function label(m){return(Object.values(BOX).find(x=>x[0]===m)||[m,m])[1]}
  function color(m){return{home:"core",dpcdrug:"dpc"}[m]||m}
  function run(m,q){
    closeSheet();
    if(m==="home"){S.home.q=q;go("home");return}
    if(m==="dpc"){S.dpc.q=q;S.dpc.tab="search";go("dpc");return}
    if(m==="dpcdrug"){S.dpc.dq=q;S.dpc.tab="drug";go("dpc");return}
    S[m].q=q;if(S[m].tab)S[m].tab="search";go(m);
  }
  function chips(){
    const a=load().filter(h=>h.m==="home"||APP.mods.includes(h.m==="dpcdrug"?"dpc":h.m)).slice(0,8);
    if(!a.length)return"";
    return`<span class="rlabel">最近の検索</span>`+a.map((h,i)=>`<button class="chip rc" data-hi="${i}" style="--c:var(--${color(h.m)})"><i></i>${esc(h.q)}</button>`).join("")+`<button class="linkbtn" data-hall>履歴をすべて見る</button>`;
  }
  function fmtT(t){const d=new Date(t);return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`}
  function open(){
    const a=load();
    sheet("core",`<div class="eyebrow" style="--mod:var(--core)">SEARCH HISTORY</div><h2>検索履歴</h2><p class="note" style="margin:6px 0 0">${VAULT.locked?"ログインしたIDごとに、":""}この端末にだけ保存されています（${a.length}件）。タップで同じ検索をやり直せます。</p>`,
      a.length?`<div class="btns" style="margin-top:12px"><button class="btn" id="hclear">すべて削除</button><button class="btn" id="hcsv">履歴をCSVで保存</button></div>
        <div class="hist">${a.map((h,i)=>`<div class="hrow"><button class="hgo" data-hi="${i}"><span class="hm" style="--c:var(--${color(h.m)})">${esc(label(h.m))}</span><span class="hq">${esc(h.q)}</span><span class="ht">${fmtT(h.t)}</span></button><button class="hdel" data-hd="${i}" aria-label="この履歴を削除">✕</button></div>`).join("")}</div>
        <div class="confirm-del" id="hconfirm" hidden><p>検索履歴をすべて削除します。元に戻せません。</p><div class="btns"><button class="btn pri" id="hyes">削除する</button><button class="btn" id="hno">やめる</button></div></div>`
      :`<div class="empty" style="margin-top:14px">まだ検索履歴はありません。</div>`);
    const root=$("#sheet-root");
    root.querySelectorAll("[data-hi]").forEach(b=>b.onclick=()=>{const h=load()[+b.dataset.hi];if(h)run(h.m,h.q)});
    root.querySelectorAll("[data-hd]").forEach(b=>b.onclick=()=>{const x=load();x.splice(+b.dataset.hd,1);save(x);open()});
    const c=$("#hclear");if(c)c.onclick=()=>{$("#hconfirm").hidden=false};
    const y=$("#hyes");if(y)y.onclick=()=>{save([]);open();const r=$("#hrecent");if(r)r.innerHTML=""};
    const n=$("#hno");if(n)n.onclick=()=>{$("#hconfirm").hidden=true};
    const v=$("#hcsv");if(v)v.onclick=()=>downloadCSV("検索履歴",["日時","画面","検索語"],load().map(h=>[new Date(h.t).toLocaleString("ja-JP"),label(h.m),h.q]));
  }
  document.addEventListener("click",e=>{
    const c=e.target.closest("#hrecent [data-hi]");if(c){const h=load().filter(h=>h.m==="home"||APP.mods.includes(h.m==="dpcdrug"?"dpc":h.m))[+c.dataset.hi];if(h)run(h.m,h.q);return}
    if(e.target.closest("#hrecent [data-hall]"))open();
  });
  return{note,chips,open};
})();

/* ---------- CSV ダウンロード ----------
   各画面の結果の見出し行に「CSV」ボタンを置き、押した時点の検索結果（表示件数の制限なしの全件）を保存する。
   Excel で文字化けしないよう、先頭に BOM を付けた UTF-8。 */
const DL={};
function dlBtn(key){return`<button class="dlbtn" data-dl="${key}" title="この検索結果をCSVで保存"><svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg>CSV</button>`}
function downloadCSV(name,header,rows){
  const cell=v=>{const s=v==null?"":String(v);return/[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
  const text="﻿"+[header,...rows].map(r=>r.map(cell).join(",")).join("\r\n");
  const d=new Date(),stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));
  a.download=`${APP.title}_${name}_${stamp}.csv`.replace(/[\\/:*?"<>|\s]+/g,"_");
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-dl]");if(!b)return;e.stopPropagation();
  const f=DL[b.dataset.dl];if(!f)return;const x=f();downloadCSV(x.name,x.header,x.rows);
},true);

/* ---------- アカウントメニュー（スマホでもヘッダーからはみ出さないよう1つのボタンにまとめる） ---------- */
function accountMenu(){
  const bar=document.querySelector(".bar");
  const wrap=document.createElement("div");wrap.className="acct";
  wrap.innerHTML=`<button class="acct-btn" aria-haspopup="true" aria-expanded="false" aria-label="メニュー"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/></svg></button>
    <div class="acct-menu" hidden>
      <button data-a="hist"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2"/></svg>検索履歴</button>
      ${VAULT.canChange?`<button data-a="pw"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>パスワード変更</button>`:""}
      ${VAULT.locked?`<button data-a="out"><svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>ログアウト</button>`:""}
    </div>`;
  bar.appendChild(wrap);
  const btn=wrap.querySelector(".acct-btn"),menu=wrap.querySelector(".acct-menu");
  const close=()=>{menu.hidden=true;btn.setAttribute("aria-expanded","false")};
  btn.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden;btn.setAttribute("aria-expanded",String(!menu.hidden))};
  document.addEventListener("click",e=>{if(!wrap.contains(e.target))close()});
  menu.onclick=e=>{const a=e.target.closest("[data-a]");if(!a)return;close();
    if(a.dataset.a==="hist")HIST.open();if(a.dataset.a==="pw")VAULT.changePassword();if(a.dataset.a==="out")VAULT.logout()};
}
