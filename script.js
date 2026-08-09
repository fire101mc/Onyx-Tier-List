const CONFIG = window.ACE_CONFIG || {};
const API_URL = CONFIG.ACE_DATABASE_API_URL || "/api/onyx/players";
const PLAYED_API_URL = CONFIG.PLAYED_PLAYERS_API_URL || "/api/players/played";

const FALLBACK = [];

const MODES = {
  overall:{title:"Onyx Tier List",label:"Overall",desc:"All ranked PvP kits combined.",key:null},
  vanilla:{title:"Vanilla Tier List",label:"Vanilla",desc:"Vanilla PvP rankings.",key:"vanilla"},
  sword:{title:"Sword Tier List",label:"Sword",desc:"Sword PvP rankings.",key:"sword"},
  axe:{title:"Axe Tier List",label:"Axe",desc:"Axe PvP rankings.",key:"axe"},
  pot:{title:"Pot Tier List",label:"Pot",desc:"Pot PvP rankings.",key:"pot"},
  nethop:{title:"NethOP Tier List",label:"NethOP",desc:"Netherite OP PvP rankings.",key:"nethop"},
  smp:{title:"SMP Tier List",label:"SMP",desc:"SMP PvP rankings.",key:"smp"},
  uhc:{title:"UHC Tier List",label:"UHC",desc:"UHC PvP rankings.",key:"uhc"},
  mace:{title:"Mace Tier List",label:"Mace",desc:"Mace PvP rankings.",key:"mace"}
};

let players = [...FALLBACK];
let activeRegion = "all";

function parseMcpvpTiersHtml(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = [...doc.querySelectorAll("tr")];
  const out = [];

  for(const row of rows){
    const avatar = row.querySelector('img[alt*=" avatar"]');
    if(!avatar) continue;

    const alt = avatar.getAttribute("alt") || "";
    const name = alt.replace(/\s+avatar.*$/i, "").trim();
    if(!name) continue;

    const text = row.innerText || "";
    const pointsMatch = text.match(/(\d+)\s*Points/i);
    const points = pointsMatch ? Number(pointsMatch[1]) : 0;

    const regionMatch = text.match(/\b(NA|EU|AS|ME|SA|OC|AF)\b/);
    const region = regionMatch ? regionMatch[1] : "—";

    const tiers = [...text.matchAll(/\b(?:HT|LT)[1-5]\b/g)].map(m => m[0]);

    out.push({
      name,
      points,
      region,
      rankings: {
        vanilla: tiers[0] || null,
        sword: tiers[1] || null,
        axe: tiers[2] || null,
        pot: tiers[3] || null,
        nethop: tiers[4] || null,
        smp: tiers[5] || null,
        uhc: tiers[6] || null,
        mace: tiers[7] || null
      },
      history: []
    });
  }

  return out;
}

function normalizeApiPayload(payload){
  if(typeof payload === "string"){
    const t = payload.trim();
    if(t.startsWith("{") || t.startsWith("[")){
      try { payload = JSON.parse(t); } catch(_) {}
    }
  }

  if(payload && Array.isArray(payload.players)){
    return payload.players;
  }

  if(Array.isArray(payload)) return payload;

  const source = [];
  if(payload && Array.isArray(payload.data)) source.push(...payload.data);
  if(payload && Array.isArray(payload.rankings)) source.push(...payload.rankings);

  return source.map((p,i)=>({
    name:p.name || p.username || p.player || p.ign || `Player${i+1}`,
    points:Number(p.points ?? p.totalPoints ?? p.score ?? 0),
    region:p.region || p.reg || "—",
    rankings:p.rankings || p.kitRanks || p.kits || {},
    history:p.history || p.rankHistory || []
  }));
}

async function loadMcpvpData(){
  const status=document.getElementById("apiStatus");
  try{
    const res=await fetch(API_URL,{cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    players=await res.json();
    if(!Array.isArray(players))players=[];
    if(status)status.innerHTML=`<span class="ok"></span> ONYX · ${players.length} tested players`;
  }catch(e){
    console.error("ONYX database:",e);
    players=[];
    if(status)status.innerHTML=`<span class="warn"></span> ONYX database unavailable`;
  }
  renderPage();renderPlayersPage();renderProfile();
}
function currentMode(){
  return new URLSearchParams(location.search).get("mode") || "overall";
}

function tierClass(tier){
  return tier ? tier.toLowerCase().replace("lt","lt").replace("ht","ht") : "";
}

function filteredPlayers(){
  const mode = MODES[currentMode()] || MODES.overall;
  let data = players.filter(p => activeRegion === "all" || p.region === activeRegion);
  const q = (document.getElementById("searchInput")?.value || document.getElementById("playerSearch")?.value || "").toLowerCase().trim();
  if(q) data = data.filter(p => p.name.toLowerCase().includes(q));
  if(mode.key) data = data.filter(p => p.rankings?.[mode.key]);
  const tierOrder = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
  const tierValue = t => {
    if(!t) return -1;
    const v = typeof t === "object" ? (t.rank ?? t.tier ?? t.name ?? "") : t;
    const i = tierOrder.indexOf(String(v).toUpperCase());
    return i === -1 ? -1 : tierOrder.length - i;
  };

  if(mode.key){
    // Kit pages rank strictly by that kit's tier.
    data.sort((a,b)=>
      tierValue(b.rankings?.[mode.key]) - tierValue(a.rankings?.[mode.key]) ||
      b.points-a.points
    );
  }else{
    // Overall is an aggregate tier ranking, NOT raw ONYX points.
    // Give every ranked kit its tier value and total them, so a LT3
    // is correctly above an HT4 when they are otherwise comparable.
    const overallScore = p => Object.values(p.rankings || {})
      .reduce((sum, t) => sum + Math.max(0, tierValue(t)), 0);

    data.sort((a,b)=>
      overallScore(b) - overallScore(a) ||
      Math.max(...Object.values(b.rankings || {}).map(tierValue), -1) -
      Math.max(...Object.values(a.rankings || {}).map(tierValue), -1) ||
      b.points-a.points
    );
  }
  return data;
}

function renderPage(){
  const mode=MODES[currentMode()]||MODES.overall;
  const title=document.getElementById("pageTitle");
  const subtitle=document.getElementById("pageSubtitle");
  if(title)title.textContent=mode.label;
  if(subtitle)subtitle.textContent=`${mode.label} rankings · only ONYX server-tested players`;

  const list=document.getElementById("playerList");
  if(!list)return;

  const data=filteredPlayers();
  list.innerHTML=data.slice(0,100).map((p,i)=>{
    const result=mode.key
      ? (p.rankings?.[mode.key]?.rank || p.rankings?.[mode.key] || "")
      : (() => {
          const order=["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
          const vals=Object.values(p.rankings||{}).map(r=>typeof r==="object" ? (r.rank||r.tier||r.name||"") : r);
          return vals.sort((a,b)=>order.indexOf(a)-order.indexOf(b))[0] || "";
        })();
    const allKits=["vanilla","sword","axe","pot","nethop","smp","uhc","mace"];
    const chips=allKits.map(k=>{
      const r=p.rankings?.[k];
      const val=typeof r==="object" ? r.rank : r;
      return `<span class="kit-chip ${val? "has":""}">${MODES[k].label.slice(0,3)} <b>${val||"—"}</b></span>`;
    }).join("");
    return `<article class="rank-card">
      <div class="rank-num ${i<3?"podium":""}">${i+1}</div>
      <div class="rank-player">
        <div class="skin-frame">${playerSkinUrl(p) ? `<img src="${playerSkinUrl(p)}" alt="${escapeHtml(p.name)} Minecraft skin" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=playerSkinFallback(t||p);">` : `<span class="skin-placeholder"></span>`}</div>
        <div><a class="rank-name" href="player.html?name=${encodeURIComponent(p.name)}">${escapeHtml(p.name)}</a>
        <div class="rank-sub"><span class="region-dot"></span>${escapeHtml(p.region||"—")}</div></div>
      </div>
      <div class="kit-chips">${chips}</div>
      <div class="rank-points"><b>${p.points||0}</b><small>points</small></div>
      <div class="rank-result">${result ? `<strong>${escapeHtml(result)}</strong><small>ONYX rank</small>` : `<strong>—</strong><small>not tested</small>`}</div>
    </article>`;
  }).join("") || `<div class="empty-onyx">No ONYX-tested players yet.</div>`;
}
async function renderPlayersPage(){
  const target = document.getElementById("allPlayers");
  if(!target) return;
  const q = (document.getElementById("playerSearch")?.value || "").toLowerCase().trim();

  try{
    const [playedRes, testedRes] = await Promise.all([
      fetch(PLAYED_API_URL,{cache:"no-store"}),
      fetch(API_URL,{cache:"no-store"})
    ]);
    if(!playedRes.ok || !testedRes.ok) throw new Error("database unavailable");
    const played = await playedRes.json();
    const tested = await testedRes.json();
    const testedMap = new Map(tested.map(p=>[p.name.toLowerCase(),p]));

    const data = played
      .filter(p=>p.name.toLowerCase().includes(q))
      .sort((a,b)=>a.name.localeCompare(b.name));

    target.innerHTML = data.map((p,i)=>{
      const t=testedMap.get(p.name.toLowerCase());
      const status = t
        ? `<span class="live-dot"></span> Tier tested`
        : `<span class="played-dot"></span> Played`;
      return `<div class="player-row">
        <div class="rank">${i+1}</div>
        <div class="player"><div class="avatar ${(t||p)?.premium === true ? "has-skin" : ""}">${(t||p)?.premium === true ? `<img src="${playerSkinUrl(t||p)}" alt="${escapeHtml(p.name)} Minecraft skin" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-skin');this.remove()">` : ""}</div><a class="player-link" href="player.html?name=${encodeURIComponent(p.name)}">${escapeHtml(p.name)}</a></div>
        <div class="points">${t?.points||0}</div>
        <div class="region-badge ${p.region==="EU"?"eu":""}">${escapeHtml(p.region||"—")}</div>
        <div class="tier-badge ht1">${t?.rankings?.vanilla || "—"}</div>
        <div class="previous">${status}</div>
      </div>`;
    }).join("") || `<div class="empty-onyx">No players have played on the server yet.</div>`;
  }catch(e){
    console.error("PLAYED database:",e);
    target.innerHTML = `<div class="empty-onyx">Played-player database unavailable.</div>`;
  }
}

async function loadExternalDatabase(){
  const input = document.getElementById("dbUrl");
  const status = document.getElementById("dbStatus");
  const url = input?.value.trim();
  if(!url){ if(status) status.textContent="Enter your API endpoint first."; return; }
  localStorage.setItem("ACE_EXTERNAL_DB_URL", url);
  if(status) status.textContent="Endpoint saved. Loading…";
  try{
    const res = await fetch(url, {
      headers:{"Accept":"application/json"},
      credentials: CONFIG.INCLUDE_CREDENTIALS ? "include" : "same-origin"
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const parsed = normalizeApiPayload(json);
    if(parsed.length){
      players = parsed;
      renderPage();
      renderPlayersPage();
      status.textContent=`Connected — ${parsed.length} player records loaded.`;
    }else{
      status.textContent="Connected, but no recognized player records were returned.";
    }
  }catch(err){
    console.error(err);
    status.textContent="Could not load endpoint. Check CORS, URL, and JSON shape.";
  }
}

function playerSkinUrl(p){
  if(!p || p.premium !== true || !p.uuid) return "";
  // Full Minecraft player body render.
  return `https://mc-heads.net/player/${encodeURIComponent(p.uuid)}`;
}

function playerSkinFallback(p){
  if(!p || !p.uuid) return "";
  return `https://crafatar.com/renders/body/${encodeURIComponent(p.uuid)}?scale=2&overlay=true`;
}

function playerSkinFallback(p){
  if(!p || !p.uuid) return "";
  // Fallback renderer if the primary image service is unavailable.
  return `https://crafatar.com/renders/head/${encodeURIComponent(p.uuid)}?size=64&overlay=true`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

document.addEventListener("DOMContentLoaded",()=>{
  const saved = localStorage.getItem("ACE_EXTERNAL_DB_URL");
  const dbUrl = document.getElementById("dbUrl");
  if(dbUrl && saved) dbUrl.value = saved;

  document.querySelectorAll(".mode").forEach(a=>{
    a.classList.toggle("active", a.dataset.mode === currentMode());
  });

  document.querySelectorAll(".region").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".region").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      activeRegion = btn.dataset.region;
      renderPage();
    });
  });

  document.getElementById("searchInput")?.addEventListener("input",renderPage);
  document.getElementById("playerSearch")?.addEventListener("input",renderPlayersPage);
  document.getElementById("saveDb")?.addEventListener("click",()=>{
    const v=document.getElementById("dbUrl").value.trim();
    localStorage.setItem("ACE_EXTERNAL_DB_URL",v);
    document.getElementById("dbStatus").textContent=v ? "Endpoint saved." : "Endpoint cleared.";
  });
  document.getElementById("loadDb")?.addEventListener("click",loadExternalDatabase);

  document.getElementById("themeBtn")?.addEventListener("click",()=>{
    document.body.classList.toggle("light");
    document.getElementById("themeBtn").textContent=document.body.classList.contains("light")?"☀":"☾";
  });

  if(document.getElementById("playerList")){
    renderPage();
    loadMcpvpData();
  }
  if(document.getElementById("allPlayers")){
    renderPlayersPage();
    loadMcpvpData().then(renderPlayersPage);
  }
  if(document.getElementById("profileRoot")){
    const savedDb = localStorage.getItem("ACE_EXTERNAL_DB_URL");
    if(savedDb) CONFIG.EXTERNAL_DATABASE_API_URL = savedDb;
    loadMcpvpData().then(async ()=>{
      if(CONFIG.EXTERNAL_DATABASE_API_URL){
        try{
          const r = await fetch(CONFIG.EXTERNAL_DATABASE_API_URL, {headers:{"Accept":"application/json"}});
          if(r.ok){
            const ext = await r.json();
            const extPlayers = normalizeApiPayload(ext);
            const currentName = new URLSearchParams(location.search).get("name") || "";
            const match = extPlayers.find(x=>x.name.toLowerCase()===currentName.toLowerCase());
            if(match){
              const basePlayer = getPlayerByName(currentName);
              if(basePlayer) basePlayer.history = match.history || basePlayer.history;
            }
          }
        }catch(e){ console.warn("External database profile sync failed", e); }
      }
      renderProfile();
    });
  }
});

function getPlayerByName(name){
  return players.find(p => p.name.toLowerCase() === String(name).toLowerCase());
}
function renderProfile(){
  const root = document.getElementById("profileRoot");
  if(!root) return;
  const name = new URLSearchParams(location.search).get("name") || "";
  const p = getPlayerByName(name);
  if(!p){
    root.innerHTML = '<div class="profile-card"><h1>Player not found</h1><p>Search for a player from the leaderboard.</p></div>';
    return;
  }
  const kits = ["vanilla","sword","axe","pot","nethop","smp","uhc","mace"];
  root.innerHTML = `<section class="profile-card">
    <div class="profile-head">
      <div class="profile-avatar avatar ${p.premium === true ? "has-skin" : ""}">${p.premium === true && p.uuid ? `<img src="${playerSkinUrl(p)}" alt="${escapeHtml(p.name)} Minecraft skin" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=playerSkinFallback(t||p);">` : ""}</div>
      <div>
        <div class="eyebrow">ONYX PLAYER PROFILE</div>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="profile-meta"><span class="region-badge ${p.region==="EU"?"eu":""}">${escapeHtml(p.region)}</span><span class="points">${p.points}</span></div>
      </div>
    </div>
    <div class="profile-stats">
      <div><span>Points</span><b>${p.points}</b></div>
      <div><span>Region</span><b>${escapeHtml(p.region)}</b></div>
      <div><span>Overall</span><b>${p.rankings?.vanilla || "—"}</b></div>
      <div><span>Minecraft</span><b>${p.premium === true ? "Premium · Skin found" : "No Mojang skin found"}</b></div>
    </div>
    <div class="profile-section">
      <h2>Kit Ranks</h2>
      <div class="kit-grid">${kits.map(k=>`<div class="kit-rank">
        <div class="kit-icon-wrap"><img class="kit-icon" alt="${k} kit"></div>
        <span>${MODES[k].label}</span>
        <b class="tier-badge ${tierClass(p.rankings?.[k])}">${p.rankings?.[k] || "—"}</b>
      </div>`).join("")}</div>
    </div>
    <div class="profile-section">
      <h2>Rank History</h2>
      <div class="history-list">${(Array.isArray(p.history) && p.history.length ? p.history : [
        {date:"—",overall:p.rankings?.vanilla || "—",note:"Current API record"}
      ]).map(h=>`<div class="history-row"><span>${escapeHtml(h.date || h.timestamp || "—")}</span><b>${escapeHtml(h.overall || h.tier || "—")}</b><small>${escapeHtml(h.note || h.kit || "Rank update")}</small></div>`).join("")}</div>
    </div>
    <div class="profile-section">
      <h2>External Database</h2>
      <p>This profile is loaded from the same API/database adapter as the leaderboard. Add a <code>history</code> array for each player in your database and the page can display full rank history.</p>
      <pre>{
  "name": "${p.name}",
  "region": "${p.region}",
  "points": ${p.points},
  "rankings": { ... },
  "history": [
    {"date":"2026-05-23","overall":"${p.rankings?.vanilla || "—"}"},
    {"date":"2026-05-16","overall":"..."}
  ]
}</pre>
    </div>
  </section>`;
}
