/* 起動：アプリの種類（APP）に合わせて名前とメニューを整える → ログイン（必要な場合）→ データ読み込み → 最初の画面 */
"use strict";
(async()=>{
  document.title=APP.title;
  if(APP.theme)document.body.classList.add("theme-"+APP.theme);
  if(APP.theme==="ocean"){const lg=document.querySelector(".logo svg");if(lg)lg.outerHTML=`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="27" cy="14" r="7" fill="#ffd23f"/><g stroke="#ffe58a" stroke-width="1.6" stroke-linecap="round"><path d="M27 2v3M27 23v3M15 14h3M36 14h3M18.5 5.5l2 2M33.5 20.5l2 2M35.5 5.5l-2 2"/></g><path d="M3 27c4-3 7-3 11 0s7 3 11 0 7-3 11 0" fill="none" stroke="#5fe3ff" stroke-width="2.2" stroke-linecap="round"/><path d="M3 33c4-3 7-3 11 0s7 3 11 0 7-3 11 0" fill="none" stroke="#1592d6" stroke-width="2.2" stroke-linecap="round"/></svg>`}
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
