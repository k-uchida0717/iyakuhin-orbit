/* 起動：アプリの種類（APP）に合わせて名前とメニューを整える → ログイン（必要な場合）→ データ読み込み → 最初の画面 */
"use strict";
(async()=>{
  document.title=APP.title;
  const logo=document.querySelector(".logo span");
  if(logo)logo.innerHTML=`<b>${esc(APP.title)}</b><small>${esc(APP.sub).replace(/ /g,"&nbsp;")}</small>`;
  const dockBtns=[...document.querySelectorAll("nav.dock button")];
  dockBtns.forEach(b=>{b.hidden=b.dataset.go!=="home"&&!APP.mods.includes(b.dataset.go)});
  document.querySelector("nav.dock .in").style.gridTemplateColumns=`repeat(${dockBtns.filter(b=>!b.hidden).length},1fr)`;
  await VAULT.init(APP.title,APP.id);
  if(VAULT.locked){
    const bar=document.querySelector(".bar");
    if(VAULT.canChange){const p=document.createElement("button");p.className="chip-live out";p.textContent="パスワード変更";p.onclick=()=>VAULT.changePassword();bar.appendChild(p)}
    const b=document.createElement("button");b.className="chip-live out";b.textContent="ログアウト";b.onclick=()=>VAULT.logout();bar.appendChild(b);
  }
  const h=(location.hash.slice(1)||"").replace(/[^a-z]/g,"");
  route.name=h&&S[h]&&(h==="home"||APP.mods.includes(h))?h:APP.start;
  pinBadge();load();render();
})();
