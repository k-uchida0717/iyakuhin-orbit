/* ログインと暗号化データの読み込み・パスワード変更
   公開サイトにはデータを暗号化して置き（*.bin）、IDとパスワードでログインした人のブラウザ内だけで復号する。
   vault.json が無いとき（手元での確認など）は、暗号化していない *.json をそのまま読む。

   しくみ
   ・データは共通の鍵（マスター鍵）で AES-GCM 暗号化（事前に gzip 圧縮）
   ・マスター鍵は利用者ごとに、その人のパスワードから PBKDF2 で作った鍵（KEK）で包んで vault.json に置く
   ・ID は SHA-256 のハッシュだけを置く（ID そのものは公開しない）
   ・各利用者の欄には KEK の SHA-256（v）も置く。パスワード変更の窓口は、送られてきた旧KEKのハッシュが v と一致するかで本人確認する
     （窓口はマスター鍵もパスワードも知らない。新しい欄はブラウザ内で作って送る） */
"use strict";
const VAULT=(()=>{
  let cfg=null,key=null,app="main";
  const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const tob64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
  const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  const enc=new TextEncoder();
  const SK=()=>"orbit.vk."+app; /* 同じアドレス配下の別アプリと保存場所を分ける */
  const store={get(k){try{return sessionStorage.getItem(k)||localStorage.getItem(k)}catch(e){return null}},
    set(k,v,keep){try{(keep?localStorage:sessionStorage).setItem(k,v)}catch(e){}},
    del(k){try{sessionStorage.removeItem(k);localStorage.removeItem(k)}catch(e){}}};

  async function importMaster(raw){return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt"])}
  async function decrypt(k,buf){const u=new Uint8Array(buf);return crypto.subtle.decrypt({name:"AES-GCM",iv:u.slice(0,12)},k,u.slice(12))}
  async function gunzip(buf){
    const ds=new DecompressionStream("gzip");
    return new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
  }
  async function check(k){ /* 鍵が正しいか、vault.json の確認用の暗号文で確かめる */
    try{return new TextDecoder().decode(await decrypt(k,b64(cfg.check)))==="orbit-ok"}catch(e){return false}
  }
  const idHash=async id=>hex(await crypto.subtle.digest("SHA-256",enc.encode(id.trim().toLowerCase())));
  async function kekBits(pw,salt){
    const base=await crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveBits"]);
    return crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:cfg.iter,hash:"SHA-256"},base,256);
  }
  /* ID・パスワードからマスター鍵（生のバイト列）を取り出す。違えば null */
  async function unwrap(id,pw){
    const h=await idHash(id);const slot=cfg.users[h];if(!slot)return null;
    const bits=await kekBits(pw,b64(slot.s));
    const kek=await crypto.subtle.importKey("raw",bits,"AES-GCM",false,["decrypt"]);
    let raw;try{raw=await decrypt(kek,b64(slot.w))}catch(e){return null}
    const k=await importMaster(raw);if(!(await check(k)))return null;
    return{h,raw,k,bits};
  }
  async function tryLogin(id,pw,keep){
    const u=await unwrap(id,pw);if(!u)return false;
    key=u.k;store.set(SK(),tob64(u.raw),keep);return true;
  }
  const LOGO=`<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="5" fill="#7dffcf"/><ellipse cx="20" cy="20" rx="17" ry="7" fill="none" stroke="#4fe3ff" stroke-width="1.4" transform="rotate(-25 20 20)"/><ellipse cx="20" cy="20" rx="17" ry="7" fill="none" stroke="#b38cff" stroke-width="1.4" transform="rotate(35 20 20)"/><circle cx="34" cy="13" r="2.6" fill="#ffc46b"/></svg>`;
  function loginScreen(title){
    return new Promise(resolve=>{
      const el=document.createElement("div");el.className="login";
      el.innerHTML=`<form class="login-card panel" id="lf" autocomplete="on">${LOGO}
        <div class="eyebrow" style="--mod:var(--core)">MEMBERS ONLY</div>
        <h2 class="h" style="font-size:22px">${title||"保険診療オービット"}</h2>
        <p class="lead">管理者から受け取ったIDとパスワードでログインしてください。</p>
        <label for="lid">ID</label><input id="lid" name="username" autocomplete="username" required>
        <label for="lpw">パスワード</label><input id="lpw" name="password" type="password" autocomplete="current-password" required>
        <label class="keep"><input id="lkeep" type="checkbox" checked> この端末でログインしたままにする</label>
        <p class="err" id="lerr" hidden>IDまたはパスワードが違います。</p>
        <button class="btn pri" id="lbtn" type="submit">ログイン</button>
      </form>`;
      document.body.appendChild(el);
      el.querySelector("#lf").addEventListener("submit",async e=>{
        e.preventDefault();const btn=el.querySelector("#lbtn");btn.disabled=true;btn.textContent="確認中…";
        const ok=await tryLogin(el.querySelector("#lid").value,el.querySelector("#lpw").value,el.querySelector("#lkeep").checked);
        if(ok){el.remove();resolve()}else{el.querySelector("#lerr").hidden=false;btn.disabled=false;btn.textContent="ログイン"}
      });
      setTimeout(()=>el.querySelector("#lid").focus(),50);
    });
  }
  /* パスワード変更：新しい欄（塩・包んだマスター鍵・確認用ハッシュ）をブラウザ内で作り、窓口へ送る */
  async function changePassword(id,oldpw,newpw){
    const u=await unwrap(id,oldpw);if(!u)return{ok:false,msg:"IDまたは現在のパスワードが違います。"};
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const bits=await kekBits(newpw,salt);
    const kek=await crypto.subtle.importKey("raw",bits,"AES-GCM",false,["encrypt"]);
    const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},kek,u.raw);
    const w=new Uint8Array(12+ct.byteLength);w.set(iv);w.set(new Uint8Array(ct),12);
    const slot={s:tob64(salt),w:tob64(w),v:hex(await crypto.subtle.digest("SHA-256",bits))};
    let res;
    try{
      /* Apps Script は単純なリクエスト（text/plain の POST）で受ける */
      const r=await fetch(cfg.pwapi,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({app,id:u.h,old:hex(u.bits),slot})});
      res=await r.json();
    }catch(e){return{ok:false,msg:"変更の窓口に接続できませんでした。時間をおいて試すか、管理者に連絡してください。"}}
    if(!res.ok)return{ok:false,msg:res.msg||"変更できませんでした。"};
    cfg.users[u.h]=slot;return{ok:true};
  }
  function passwordScreen(){
    const el=document.createElement("div");el.className="login";
    el.innerHTML=`<form class="login-card panel" id="pf" autocomplete="on">${LOGO}
      <div class="eyebrow" style="--mod:var(--core)">CHANGE PASSWORD</div>
      <h2 class="h" style="font-size:22px">パスワードの変更</h2>
      <p class="lead">新しいパスワードは10文字以上にしてください。変更は1〜2分ほどで全端末に反映されます。</p>
      <label for="pid">ID</label><input id="pid" name="username" autocomplete="username" required>
      <label for="pold">現在のパスワード</label><input id="pold" type="password" autocomplete="current-password" required>
      <label for="pnew">新しいパスワード</label><input id="pnew" type="password" autocomplete="new-password" minlength="10" required>
      <label for="pnew2">新しいパスワード（確認）</label><input id="pnew2" type="password" autocomplete="new-password" minlength="10" required>
      <p class="err" id="perr" hidden></p><p class="ok" id="pok" hidden>パスワードを変更しました。次回から新しいパスワードでログインしてください。</p>
      <div class="btns" style="margin-top:6px"><button class="btn pri" id="pbtn" type="submit">変更する</button><button class="btn" id="pcancel" type="button">閉じる</button></div>
    </form>`;
    document.body.appendChild(el);
    const err=m=>{const e=el.querySelector("#perr");e.textContent=m;e.hidden=false};
    el.querySelector("#pcancel").onclick=()=>el.remove();
    el.querySelector("#pf").addEventListener("submit",async e=>{
      e.preventDefault();el.querySelector("#perr").hidden=true;
      const id=el.querySelector("#pid").value,o=el.querySelector("#pold").value,n=el.querySelector("#pnew").value,n2=el.querySelector("#pnew2").value;
      if(n!==n2)return err("新しいパスワードが一致しません。");
      if(n.length<10)return err("新しいパスワードは10文字以上にしてください。");
      if(n===o)return err("現在と同じパスワードです。");
      const btn=el.querySelector("#pbtn");btn.disabled=true;btn.textContent="変更中…";
      const r=await changePassword(id,o,n);
      btn.disabled=false;btn.textContent="変更する";
      if(r.ok){el.querySelector("#pok").hidden=false;btn.hidden=true}else err(r.msg);
    });
    setTimeout(()=>el.querySelector("#pid").focus(),50);
  }
  return{
    get locked(){return!!cfg},
    get canChange(){return!!(cfg&&cfg.pwapi)},
    async init(title,appId){
      app=appId||"main";
      try{const r=await fetch("vault.json",{cache:"no-store"});cfg=r.ok?await r.json():null}catch(e){cfg=null}
      if(!cfg)return; /* 暗号化なしの配信（手元での確認用） */
      const saved=store.get(SK());
      if(saved){try{const k=await importMaster(b64(saved));if(await check(k)){key=k;return}}catch(e){}store.del(SK())}
      await loginScreen(title);
    },
    async json(name){
      if(!cfg){const r=await fetch(name);if(!r.ok)throw new Error(name+" "+r.status);return r.json()}
      const r=await fetch(name.replace(/\.json$/,".bin"));if(!r.ok)throw new Error(name+" "+r.status);
      return JSON.parse(await gunzip(await decrypt(key,await r.arrayBuffer())));
    },
    changePassword:passwordScreen,
    logout(){store.del(SK());location.reload()}
  };
})();
