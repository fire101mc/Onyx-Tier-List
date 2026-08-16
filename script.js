const CONFIG = window.ACE_CONFIG || {};
const API_URL = CONFIG.ACE_DATABASE_API_URL || "/api/onyx/players";
const PLAYED_API_URL = CONFIG.PLAYED_PLAYERS_API_URL || "/api/players/played";

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

const TIERS = ["LT5","HT5","LT4","HT4","LT3","HT3","LT2","HT2","LT1","HT1"];
const TIER_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
const TIER_LABELS = {
  LT5:"LT5",HT5:"HT5",LT4:"LT4",HT4:"HT4",LT3:"LT3",HT3:"HT3",LT2:"LT2",HT2:"HT2",LT1:"LT1",HT1:"HT1"
};

let players = [];
let activeRegion = "all";

function normalizeApiPayload(payload){
  if(typeof payload === "string"){
    const t = payload.trim();
    if(t.startsWith("{") || t.startsWith("[")){
      try { payload = JSON.parse(t); } catch(_) {}
    }
  }
  if(payload && Array.isArray(payload.players)) return payload.players;
  if(Array.isArray(payload)) return payload;
  const source=[];
  if(payload && Array.isArray(payload.data)) source.push(...payload.data);
  if(payload && Array.isArray(payload.rankings)) source.push(...payload.rankings);
  return source.map((p,i)=>({
    name:p.name || p.username || p.player || p.ign || `Player${i+1}`,
    points:Number(p.points ?? p.totalPoints ?? p.score ?? 0),
    region:p.region || p.reg || "—",
    uuid:p.uuid || "",
    premium:p.premium === true,
    rankings:p.rankings || p.kitRanks || p.kits || {},
    history:p.history || p.rankHistory || []
  }));
}

function rawTier(value){
  if(!value) return "";
  if(typeof value === "object") return String(value.rank ?? value.tier ?? value.name ?? "").toUpperCase();
  return String(value).toUpperCase();
}
function tierScore(value){
  const t=rawTier(value), i=TIER_ORDER.indexOf(t);
  return i===-1 ? -1 : TIER_ORDER.length-i;
}
function highestTier(player){
  const values=Object.values(player?.rankings || {}).map(rawTier).filter(Boolean);
  if(!values.length) return "";
  return values.sort((a,b)=>tierScore(b)-tierScore(a))[0];
}
function tierClass(tier){return rawTier(tier).toLowerCase();}
function escapeHtml(s){return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}
function playerSkinUrl(p){
  if(!p?.uuid) return "";
  return `https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/100`;
}
function playerBodyUrl(p){
  if(!p?.uuid) return "";
  return `https://mc-heads.net/player/${encodeURIComponent(p.uuid)}/300`;
}
const KIT_META={
  vanilla:{label:"Vanilla",short:"VANILLA",image:"assets/kits/vanilla.png"},
  sword:{label:"Sword",short:"SWORD",image:"assets/kits/sword.png"},
  axe:{label:"Axe",short:"AXE",image:"assets/kits/axe.png"},
  pot:{label:"Pot",short:"POT",image:"assets/kits/pot.png"},
  nethop:{label:"NethOP",short:"NETHOP",image:"assets/kits/nethop.png"},
  smp:{label:"SMP",short:"SMP",image:"assets/kits/smp.png"},
  uhc:{label:"UHC",short:"UHC",image:"assets/kits/uhc.png"},
  mace:{label:"Mace",short:"MACE",image:"assets/kits/mace.png"}
};
const KIT_KEYS=Object.keys(KIT_META);

function renderTierCards(){
  const target=document.getElementById("tierCards");
  if(!target) return;
  target.innerHTML=TIERS.map(t=>`
    <article class="tier-card tier-${t.toLowerCase()}" aria-label="${t} tier">
      <img class="tier-icon" src="assets/kits/sword.png" alt="${t} sword icon" loading="lazy">
      <div class="tier-name">${TIER_LABELS[t]}</div>
      <div class="tier-sub"></div>
    </article>
  `).join("");
}

function filteredPlayers(){
  const q=(document.getElementById("searchInput")?.value || document.getElementById("playerSearch")?.value || "").toLowerCase().trim();
  let data=players.filter(p=>activeRegion==="all" || p.region===activeRegion);
  if(q) data=data.filter(p=>String(p.name||"").toLowerCase().includes(q));
  return data.filter(p=>highestTier(p)).sort((a,b)=>tierScore(highestTier(b))-tierScore(highestTier(a)) || String(a.name).localeCompare(String(b.name)));
}

function renderHomePlayers(){
  const list=document.getElementById("playerList");
  if(!list) return;
  const data=filteredPlayers().slice(0,12);
  if(!data.length){list.innerHTML=`<div class="empty-onyx">No ONYX-tested players yet.</div>`;return;}
  list.innerHTML=`
    <div class="leaderboard-head"><span>#</span><span>PLAYER</span><span>KIT RANKS</span><span>OVERALL</span></div>
    ${data.map((p,i)=>{
      const skin=playerSkinUrl(p);
      const chips=KIT_KEYS.map(k=>{
        const r=rawTier(p.rankings?.[k]);
        return `<span class="leader-chip"><img src="${KIT_META[k].image}" alt="" loading="lazy"><em>${escapeHtml(KIT_META[k].short)}</em><b>${escapeHtml(r||"—")}</b></span>`;
      }).join("");
      return `<div class="leader-row">
        <div class="leader-rank">${i+1}</div>
        <div class="leader-player">
          <div class="leader-skin">${skin?`<img src="${skin}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:""}</div>
          <div><a class="leader-name" href="player.html?name=${encodeURIComponent(p.name)}">${escapeHtml(p.name)}</a><div class="leader-region"><i></i>${escapeHtml(p.region||"—")}</div></div>
        </div>
        <div class="leader-kits">${chips}</div>
        <div class="leader-overall"><b>${escapeHtml(highestTier(p))}</b><small>overall tier</small></div>
      </div>`;
    }).join("")}`;
}

function renderStats(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v)};
  set("statPlayers",players.length);
  set("statTested",players.filter(p=>highestTier(p)).length);
  set("statRanked",players.filter(p=>highestTier(p)).length);
}

function renderPage(){
  renderTierCards();
  renderStats();
  renderHomePlayers();
}

async function loadMcpvpData(){
  const status=document.getElementById("apiStatus");
  try{
    const res=await fetch(API_URL,{cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json=await res.json();
    players=normalizeApiPayload(json);
    if(status) status.innerHTML=`<i class="ok"></i> ONYX · ${players.filter(p=>highestTier(p)).length} tested players`;
  }catch(e){
    console.error("ONYX database:",e);
    players=[];
    if(status) status.innerHTML=`<i class="warn"></i> ONYX database unavailable`;
  }
  renderPage();
  await renderPlayersPage();
  renderProfile();
  await renderKitsPage();
}

async function renderPlayersPage(){
  const target=document.getElementById("allPlayers");
  if(!target) return;
  const q=(document.getElementById("playerSearch")?.value || "").toLowerCase().trim();
  try{
    const [playedRes,testedRes]=await Promise.all([
      fetch(PLAYED_API_URL,{cache:"no-store"}),fetch(API_URL,{cache:"no-store"})
    ]);
    if(!playedRes.ok || !testedRes.ok) throw new Error("database unavailable");
    const played=await playedRes.json();
    const tested=normalizeApiPayload(await testedRes.json());
    const testedMap=new Map(tested.map(p=>[String(p.name).toLowerCase(),p]));
    const data=played.filter(p=>String(p.name||"").toLowerCase().includes(q)).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    target.innerHTML=data.map((p,i)=>{
      const t=testedMap.get(String(p.name).toLowerCase());
      return `<div class="player-row">
        <div class="rank">${i+1}</div>
        <div class="player"><div class="avatar">${playerSkinUrl(p)?`<img src="${playerSkinUrl(p)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:""}</div><a class="player-link" href="player.html?name=${encodeURIComponent(p.name)}">${escapeHtml(p.name)}</a></div>
        <div>${escapeHtml(p.region||"—")}</div>
        <div class="tier-badge ${tierClass(highestTier(t))}">${escapeHtml(highestTier(t)||"—")}</div>
        <div>${t?"Tier tested":"Played"}</div>
        <div>${t?"ONYX":"—"}</div>
      </div>`;
    }).join("") || `<div class="empty-onyx">No players have played on the server yet.</div>`;
  }catch(e){
    console.error("PLAYED database:",e);
    target.innerHTML=`<div class="empty-onyx">Played-player database unavailable.</div>`;
  }
}

function renderProfile(){
  const root=document.getElementById("profileRoot");
  if(!root) return;
  const name=new URLSearchParams(location.search).get("name")||"";
  const p=players.find(x=>String(x.name).toLowerCase()===name.toLowerCase());
  if(!p){root.innerHTML=`<div class="empty-onyx">Player not found in the ONYX tier database.</div>`;return;}
  const body=playerBodyUrl(p);
  const tested=KIT_KEYS.filter(k=>rawTier(p.rankings?.[k]));
  root.innerHTML=`
    <div class="profile-hero-card">
      <div class="profile-skin-panel">${body?`<img class="profile-full-skin" src="${body}" alt="${escapeHtml(p.name)} full Minecraft skin" loading="eager" referrerpolicy="no-referrer">`:`<div class="skin-placeholder">SKIN<br><small>UUID unavailable</small></div>`}</div>
      <div class="profile-info">
        <div class="eyebrow">ONYX PLAYER PROFILE</div>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="profile-meta"><span>${escapeHtml(p.region||"—")}</span><span>${tested.length} KIT${tested.length===1?"":"S"} TESTED</span></div>
        <div class="profile-overall"><small>HIGHEST TESTED TIER</small><b>${escapeHtml(highestTier(p)||"—")}</b></div>
      </div>
    </div>
    <section class="profile-kits-section">
      <div class="section-label left">TESTED KITS</div>
      <h2>${tested.length ? "Kit results" : "No kit tests yet"}</h2>
      <p class="profile-muted">Only official ONYX tier tests recorded for this player are shown.</p>
      <div class="profile-kit-grid">${KIT_KEYS.map(k=>{
        const r=rawTier(p.rankings?.[k]); const test=p.rankings?.[k]||{};
        return `<article class="profile-kit-card ${r?"tested":"untested"}">
          <div class="profile-kit-art"><img src="${KIT_META[k].image}" alt="${escapeHtml(KIT_META[k].label)}" loading="lazy"></div>
          <div class="profile-kit-name">${escapeHtml(KIT_META[k].label)}</div>
          <div class="profile-kit-tier ${tierClass(r)}">${escapeHtml(r||"NOT TESTED")}</div>
          ${r?`<div class="profile-kit-detail">Tested by ${escapeHtml(test.tester||"ONYX")}</div>`:`<div class="profile-kit-detail">No result recorded</div>`}
        </article>`;
      }).join("")}</div>
    </section>`;
}

async function renderKitsPage(){
  const root=document.getElementById("kitsRoot");
  if(!root) return;
  const tested=players;
  root.innerHTML=KIT_KEYS.map(k=>{
    const rows=tested.filter(p=>rawTier(p.rankings?.[k])).sort((a,b)=>tierScore(rawTier(b.rankings?.[k]))-tierScore(rawTier(a.rankings?.[k]))||String(a.name).localeCompare(String(b.name)));
    return `<section class="kit-directory-card">
      <div class="kit-directory-header"><div class="kit-directory-icon"><img src="${KIT_META[k].image}" alt="" loading="lazy"></div><div><div class="eyebrow">KIT</div><h2>${escapeHtml(KIT_META[k].label)}</h2><p>${rows.length} tested player${rows.length===1?"":"s"}</p></div></div>
      <div class="kit-player-list">${rows.length?rows.map((p,i)=>`<a class="kit-player-row" href="player.html?name=${encodeURIComponent(p.name)}"><span class="kit-place">${String(i+1).padStart(2,"0")}</span><span class="kit-player-avatar">${playerSkinUrl(p)?`<img src="${playerSkinUrl(p)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:""}</span><span class="kit-player-name">${escapeHtml(p.name)}<small>${escapeHtml(p.region||"—")}</small></span><b class="tier-badge ${tierClass(rawTier(p.rankings?.[k]))}">${escapeHtml(rawTier(p.rankings?.[k]))}</b></a>`).join(""):`<div class="empty-kit">No players tested in this kit yet.</div>`}</div>
    </section>`;
  }).join("");
}

async function loadExternalDatabase(){
  const input=document.getElementById("dbUrl"),status=document.getElementById("dbStatus"),url=input?.value.trim();
  if(!url){if(status)status.textContent="Enter your API endpoint first.";return;}
  localStorage.setItem("ACE_EXTERNAL_DB_URL",url);
  if(status)status.textContent="Endpoint saved. Loading…";
  try{
    const res=await fetch(url,{headers:{Accept:"application/json"}});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const parsed=normalizeApiPayload(await res.json());
    players=parsed;renderPage();if(status)status.textContent=`Connected — ${parsed.length} player records loaded.`;
  }catch(err){console.error(err);if(status)status.textContent="Could not load endpoint. Check CORS, URL, and JSON shape.";}
}

document.addEventListener("DOMContentLoaded",()=>{
  renderPage();
  const saved=localStorage.getItem("ACE_EXTERNAL_DB_URL"),dbUrl=document.getElementById("dbUrl");
  if(dbUrl&&saved)dbUrl.value=saved;
  document.getElementById("searchInput")?.addEventListener("input",renderHomePlayers);
  document.getElementById("playerSearch")?.addEventListener("input",renderPlayersPage);
  document.getElementById("saveDb")?.addEventListener("click",()=>{
    const v=document.getElementById("dbUrl").value.trim();localStorage.setItem("ACE_EXTERNAL_DB_URL",v);
    document.getElementById("dbStatus").textContent=v?"Endpoint saved.":"Endpoint cleared.";
  });
  document.getElementById("loadDb")?.addEventListener("click",loadExternalDatabase);
  if(document.getElementById("playerList") || document.getElementById("tierCards")) loadMcpvpData();
  if(document.getElementById("allPlayers")) loadMcpvpData();
  if(document.getElementById("profileRoot")) loadMcpvpData();
});
