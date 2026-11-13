/* STEVO Einrichtung – Add-on auf dem neuen Pi.
   Holt sich von der Website einen Code, wartet, bis das Team ihn im Team-Panel einem Kunden zuordnet,
   und richtet dann alles direkt auf dem Pi ein. Spricht nur mit dem Supervisor (lokal) und der Website (nach draußen). */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const WS = require("ws");

const SUP = (process.env.STEVO_SUP || "http://supervisor").replace(/\/$/, "");
const TOKEN = process.env.SUPERVISOR_TOKEN || "";
const DATA = process.env.STEVO_DATA || "/data";
const CFG = process.env.STEVO_CFG || "/homeassistant";
const ADDON_CFG = process.env.STEVO_ADDON_CFG || "/addon_configs";
const PORT = +(process.env.STEVO_PORT || 8099);
const FAST = process.env.STEVO_TEST ? 0.01 : 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * FAST));

const opts = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "options.json"), "utf8")); } catch (e) { return {}; } })();
const SITE = String(process.env.STEVO_SITE || opts.site || "https://stevo-smarthome.de").replace(/\/$/, "");
const API = SITE + "/wp-json/stevo/v1/";

const ADDONS = {
  core_mosquitto: { name: "Mosquitto (MQTT)", start: true },
  "45df7312_zigbee2mqtt": { name: "Zigbee2MQTT", repo: "https://github.com/zigbee2mqtt/hassio-zigbee2mqtt", start: false },
  core_matter_server: { name: "Matter Server", start: true },
  ccab4aaf_frigate: { name: "Frigate (Kameras)", repo: "https://github.com/blakeblackshear/frigate-hass-addons", start: false },
  core_samba: { name: "Samba", start: false },
  core_ssh: { name: "Terminal & SSH", start: false },
  a0d7b954_vscode: { name: "Studio Code Server", repo: "https://github.com/hassio-addons/repository", start: true },
  core_configurator: { name: "File editor", start: true },
  "9074a9fa_cloudflared": { name: "Cloudflared (Fernzugriff)", repo: "https://github.com/brenner-tobias/ha-addons", start: true },
};
const STEPS = [
  ["region", "Region einstellen"],
  ["addons", "Add-ons installieren"],
  ["remote", "Fernzugriff einrichten"],
  ["stevo", "STEVO einspielen"],
  ["restart", "Home Assistant neu starten"],
  ["pair", "Mit dem Kundenkonto koppeln"],
  ["konto", "Konto an den Kunden übergeben"],
  ["check", "Fernzugriff prüfen"],
];

/* ---------- Zustand (überlebt einen Neustart des Add-ons) ---------- */
const SF = path.join(DATA, "stevo-state.json");
let S = (() => { try { return JSON.parse(fs.readFileSync(SF, "utf8")); } catch (e) { return {}; } })();
S = Object.assign({ phase: "start", code: "", device: "", steps: [], log: [], error: "", customer: "", remote: "" }, S);
function save() { try { fs.writeFileSync(SF, JSON.stringify(S)); } catch (e) { console.error("Zustand nicht gespeichert:", e.message); } }

let pendingLog = [];
function log(t) {
  const line = new Date().toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin" }) + "  " + t;
  console.log(t);
  S.log.push(line); S.log = S.log.slice(-200); pendingLog.push(t); save(); report();
}
function step(k, st, x) {
  const s = S.steps.find((y) => y.k === k); if (!s) return;
  s.st = st; s.x = x || ""; save(); report();
}

/* ---------- Website ---------- */
async function site(route, body) {
  const r = await fetch(API + route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000) });
  let j = {}; try { j = await r.json(); } catch (e) { /* leer */ }
  if (!r.ok && !j.status) throw new Error((j && (j.message || j.error)) || "Website antwortet mit HTTP " + r.status);
  return j;
}
let repT = null, repBusy = false;
function report(state) {
  if (state) S.reportState = state;
  if (!S.device) return;
  clearTimeout(repT);
  repT = setTimeout(async () => {
    if (repBusy) return report();
    repBusy = true;
    const lines = pendingLog.splice(0, 30);
    try { await site("einrichtung/status", { device: S.device, steps: S.steps, log: lines, state: S.reportState || "", port: S.port || 0 }); }
    catch (e) { pendingLog = lines.concat(pendingLog); }
    repBusy = false;
    if (pendingLog.length) report();
  }, state ? 50 : 700);
}

/* ---------- Supervisor und Home Assistant ---------- */
async function sup(p, method = "GET", body, timeoutMs = 60000) {
  const r = await fetch(SUP + p, { method, headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  let j = {}; try { j = await r.json(); } catch (e) { /* leer */ }
  if (!r.ok || j.result === "error") throw new Error((j && j.message) || "Supervisor " + p + " → HTTP " + r.status);
  return j.data !== undefined ? j.data : j;
}
async function core(p, { method = "GET", json, timeout = 30000 } = {}) {
  const r = await fetch(SUP + "/core/api" + p, { method, headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: json === undefined ? undefined : JSON.stringify(json), signal: AbortSignal.timeout(timeout) });
  const t = await r.text(); let data = t; try { data = JSON.parse(t); } catch (e) { /* Text */ }
  return { status: r.status, data };
}
function wsCall(msg) {
  return new Promise((resolve, reject) => {
    const s = new WS(SUP.replace(/^http/, "ws") + "/core/websocket", { handshakeTimeout: 15000 });
    const t = setTimeout(() => { s.terminate(); reject(new Error("Zeitüberschreitung bei " + msg.type)); }, 60000);
    const end = (f, v) => { clearTimeout(t); try { s.close(); } catch (e) { /* egal */ } f(v); };
    s.on("error", (e) => end(reject, new Error("Verbindung zu Home Assistant: " + e.message)));
    s.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "auth_required") s.send(JSON.stringify({ type: "auth", access_token: TOKEN }));
      else if (m.type === "auth_ok") s.send(JSON.stringify(Object.assign({ id: 1 }, msg)));
      else if (m.type === "auth_invalid") end(reject, new Error("Home Assistant lehnt das Add-on ab."));
      else if (m.type === "result" && m.id === 1) m.success ? end(resolve, m.result) : end(reject, new Error((m.error && m.error.message) || "Fehler"));
    });
  });
}
async function coreReady(maxMin = 10) {
  const end = Date.now() + maxMin * 60000 * FAST;
  while (Date.now() < end) {
    try { const r = await core("/", { timeout: 6000 }); if (r.status === 200) return; } catch (e) { /* noch weg */ }
    await sleep(5000);
  }
  throw new Error("Home Assistant ist nach " + maxMin + " Minuten nicht wieder da.");
}

/* ---------- Add-ons ---------- */
async function addonInfo(slug) { try { const i = await sup("/addons/" + slug + "/info"); return i && i.version ? i : null; } catch (e) { return null; } }
async function installAddon(slug) {
  const a = ADDONS[slug] || { name: slug };
  if (await addonInfo(slug)) { log(a.name + " ist schon installiert."); return; }
  if (a.repo) {
    try { await sup("/store/repositories", "POST", { repository: a.repo }, 180000); log("Add-on-Quelle für " + a.name + " hinzugefügt."); }
    catch (e) { if (!/already|exist|bereits/i.test(e.message)) throw e; }
  }
  log(a.name + " wird installiert (dauert ein paar Minuten) …");
  try { await sup("/store/addons/" + slug + "/install", "POST", undefined, 30 * 60000); }
  catch (e) { await sup("/addons/" + slug + "/install", "POST", undefined, 30 * 60000); }
  if (!(await addonInfo(slug))) throw new Error(a.name + " ließ sich nicht installieren.");
}
async function startAddon(slug) {
  try { await sup("/addons/" + slug + "/options", "POST", { boot: "auto", watchdog: true }); } catch (e) { /* nicht jedes Add-on kennt watchdog */ }
  await sup("/addons/" + slug + "/start", "POST", undefined, 5 * 60000);
}
function merge(a, b) {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b;
  const o = Object.assign({}, a && typeof a === "object" && !Array.isArray(a) ? a : {});
  for (const k of Object.keys(b)) o[k] = merge(o[k], b[k]);
  return o;
}
async function applyVorlage(slug, v) {
  if (!v || !v.options || !Object.keys(v.options).length) return;
  const info = (await addonInfo(slug)) || {};
  try { await sup("/addons/" + slug + "/options", "POST", { options: merge(info.options || {}, v.options) }); log((ADDONS[slug] || { name: slug }).name + ": Einstellungen aus der Vorlage übernommen."); }
  catch (e) { log((ADDONS[slug] || { name: slug }).name + ": Vorlage passt nicht (" + e.message + "), Standard bleibt."); }
}

/* ---------- Dateien ---------- */
function safeJoin(root, rel) {
  const p = path.resolve(root, rel);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error("Ungültiger Pfad im Paket: " + rel);
  return p;
}
function installStevo(buf) {
  const zip = new AdmZip(buf);
  const files = zip.getEntries().filter((e) => !e.isDirectory && /^(custom_components\/stevo\/|www\/stevo\/|themes\/stevo\.yaml$)/.test(e.entryName));
  if (!files.find((f) => f.entryName === "custom_components/stevo/manifest.json")) throw new Error("Das STEVO-Paket von der Website ist unvollständig.");
  const root = path.resolve(CFG);
  for (const f of files) {
    const dest = safeJoin(root, f.entryName);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.getData());
  }
  return files.length;
}
function trustTunnel() {
  const f = path.join(CFG, "configuration.yaml");
  let cfg = ""; try { cfg = fs.readFileSync(f, "utf8"); } catch (e) { /* neu */ }
  if (/172\.30\.33\.0\/24/.test(cfg)) return "schon eingetragen";
  if (/^http:/m.test(cfg)) {
    if (/^\s+trusted_proxies:\s*$/m.test(cfg)) cfg = cfg.replace(/^(\s+)trusted_proxies:\s*$/m, "$1trusted_proxies:\n$1  - 172.30.33.0/24");
    else cfg = cfg.replace(/^http:\s*$/m, "http:\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - 172.30.33.0/24");
  } else cfg = cfg.replace(/\s*$/, "\n") + "\n# STEVO Fernzugriff (Cloudflare Tunnel)\nhttp:\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - 172.30.33.0/24\n";
  fs.writeFileSync(f, cfg);
  return "eingetragen";
}

/* ---------- Einrichtung ---------- */
let running = false;
async function run(plan) {
  if (running) return; running = true;
  S.phase = "run"; S.error = ""; S.customer = plan.customer.name; S.remote = plan.remote ? plan.remote.url : "";
  S.steps = STEPS.map(([k, n]) => ({ k, n, st: "wait", x: "" }));
  save(); report("laeuft");
  log("Los geht’s: Pi für " + plan.customer.name + ".");
  let cur = "region";
  try {
    step("region", "run");
    await wsCall({ type: "config/core/update", country: "DE", language: "de", time_zone: "Europe/Berlin", currency: "EUR", unit_system: "metric" });
    step("region", "ok", "Deutschland, Europe/Berlin, Euro");

    cur = "addons"; step("addons", "run");
    const vor = plan.vorlage;
    if (vor) log("Vorlage vom " + vor.when + (vor.from ? " (" + vor.from + ")" : "") + " wird verwendet.");
    for (const slug of plan.addons || []) {
      step("addons", "run", (ADDONS[slug] || { name: slug }).name);
      await installAddon(slug);
      if (vor && vor.addons && vor.addons[slug]) await applyVorlage(slug, vor.addons[slug]);
      if (/frigate/.test(slug) && vor && vor.frigate) {
        try {
          const dir = path.join(ADDON_CFG, slug); fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, "config.yml"), vor.frigate);
          log("Frigate: Grundeinstellungen aus der Vorlage gespeichert (Kameras kommen pro Kunde dazu).");
        } catch (e) { log("Frigate-Vorlage: " + e.message); }
      }
      if ((ADDONS[slug] || {}).start) {
        try { await startAddon(slug); log((ADDONS[slug] || { name: slug }).name + " läuft."); } catch (e) { log((ADDONS[slug] || { name: slug }).name + " startet nicht: " + e.message); }
      }
    }
    step("addons", "ok", (plan.addons || []).length ? (plan.addons.length + " installiert") + (vor ? ", mit Vorlage" : "") : "keine gewählt");

    cur = "remote";
    if (plan.remote && plan.remote.token) {
      step("remote", "run");
      /* Port von Home Assistant: ab 2026.8 bei Neuinstallationen 80, sonst 8123. Die Website stellt den Tunnel darauf ein. */
      try { const ci = await sup("/core/info"); S.port = +ci.port || 8123; } catch (e) { S.port = 8123; }
      log("Home Assistant läuft auf Port " + S.port + ".");
      save(); report();
      const cf = "9074a9fa_cloudflared";
      await installAddon(cf);
      const info = (await addonInfo(cf)) || {};
      await sup("/addons/" + cf + "/options", "POST", { options: Object.assign({}, info.options || {}, { tunnel_token: plan.remote.token }), boot: "auto", watchdog: true });
      log("configuration.yaml: Tunnel als Proxy " + trustTunnel() + ".");
      await wsCall({ type: "config/core/update", external_url: plan.remote.url });
      log("Externe Adresse: " + plan.remote.url);
      await startAddon(cf);
      step("remote", "ok", plan.remote.host);
    } else step("remote", "skip", "nicht gewählt");

    cur = "stevo"; step("stevo", "run");
    if (!plan.release || !plan.release.url) throw new Error("Auf der Website ist kein STEVO-Paket veröffentlicht (Team-Panel → Versionen).");
    log("STEVO " + plan.release.version + " wird geladen …");
    const zr = await fetch(plan.release.url, { signal: AbortSignal.timeout(120000) });
    if (!zr.ok) throw new Error("STEVO-Paket konnte nicht geladen werden (HTTP " + zr.status + ").");
    const n = installStevo(Buffer.from(await zr.arrayBuffer()));
    log(n + " Dateien eingespielt.");
    step("stevo", "ok", "Version " + plan.release.version);

    cur = "restart"; step("restart", "run", "dauert 1 bis 3 Minuten");
    try { await sup("/core/restart", "POST", undefined, 10 * 60000); } catch (e) { log("Neustart: " + e.message + " – ich warte trotzdem."); }
    await sleep(10000);
    await coreReady();
    step("restart", "ok");

    cur = "pair"; step("pair", "run");
    const ents = await core("/config/config_entries/entry");
    if (Array.isArray(ents.data) && ents.data.some((e) => e.domain === "stevo")) log("STEVO ist schon gekoppelt.");
    else {
      let f = null;
      for (let i = 0; i < 12; i++) { f = await core("/config/config_entries/flow", { method: "POST", json: { handler: "stevo", show_advanced_options: false } }); if (f.status === 200) break; await sleep(5000); }
      if (!f || f.status !== 200) throw new Error("Home Assistant findet die STEVO-Integration nicht (HTTP " + (f && f.status) + ").");
      if (f.data.type === "menu") {
        const m = await core("/config/config_entries/flow/" + f.data.flow_id, { method: "POST", json: { next_step_id: "manuell" } });
        if (m.status !== 200 || m.data.type !== "form") throw new Error("Kopplung: Eingabe für den Code fehlt.");
      }
      if (f.data.type !== "abort") {
        const s = await core("/config/config_entries/flow/" + f.data.flow_id, { method: "POST", json: { code: plan.pair, url: plan.site } });
        if (s.data.type !== "create_entry") {
          const e = (s.data.errors && s.data.errors.base) || "";
          throw new Error(e === "invalid_auth" ? "Die Website hat den Kopplungscode nicht angenommen. Im Team-Panel den Pi entfernen und neu zuordnen."
            : e === "cannot_connect" ? "Der Pi erreicht die Website nicht." : "Kopplung abgelehnt: " + JSON.stringify(s.data.errors || s.data).slice(0, 200));
        }
      }
      log("Mit dem Konto von " + plan.customer.name + " gekoppelt.");
    }
    step("pair", "ok", plan.customer.name);

    /* Das beim Einrichten angelegte Besitzerkonto gehört ab jetzt dem Kunden: neuer Name, Benutzername und Passwort.
       Das macht die STEVO-Integration; das Passwort geht von dort direkt an die Website, das Add-on und das Team sehen es nie. */
    cur = "konto"; step("konto", "run");
    let k = null;
    for (let i = 0; i < 12; i++) {
      k = await core("/services/stevo/konto_uebergeben?return_response", { method: "POST", json: { name: plan.customer.name, login: plan.customer.login || "" }, timeout: 60000 });
      if (k.status === 200) break;
      await sleep(5000);
    }
    if (!k || k.status !== 200) throw new Error("Konto-Übergabe fehlgeschlagen (HTTP " + (k && k.status) + "): " + String(k && (k.data && k.data.message || k.data)).slice(0, 200));
    const user = k.data && k.data.service_response && k.data.service_response.user;
    log("Konto gehört jetzt " + plan.customer.name + (user ? " (Benutzername " + user + ")" : "") + ". Das Passwort sieht nur der Kunde in seinem Konto auf der Website. Alle bisherigen Anmeldungen sind beendet.");
    step("konto", "ok", user ? "Benutzername " + user : "");

    cur = "check";
    if (plan.remote && plan.remote.url) {
      step("check", "run", plan.remote.url);
      let ok = false;
      for (let i = 0; i < 18 && !ok; i++) {
        try { const r = await fetch(plan.remote.url + "/manifest.json", { signal: AbortSignal.timeout(8000) }); ok = r.status === 200; if (!ok) log("Fernzugriff antwortet noch mit HTTP " + r.status + " …"); }
        catch (e) { if (i % 3 === 0) log("Fernzugriff noch nicht erreichbar …"); }
        if (!ok) await sleep(10000);
      }
      step("check", ok ? "ok" : "err", ok ? plan.remote.url : "Noch nicht erreichbar. DNS braucht manchmal ein paar Minuten, später im Browser prüfen.");
    } else step("check", "skip", "kein Fernzugriff");

    S.phase = "fertig"; save();
    log("Fertig. Das Add-on stoppt sich in 10 Minuten selbst und kann danach deinstalliert werden.");
    report("fertig");
    setTimeout(() => { sup("/addons/self/stop", "POST").catch(() => {}); }, 10 * 60000);
  } catch (e) {
    step(cur, "err", e.message);
    S.phase = "fehler"; S.error = e.message; save();
    log("Fehler: " + e.message);
    report("fehler");
  } finally { running = false; }
}

/* ---------- Code holen und auf die Zuordnung warten ---------- */
async function newCode() {
  let name = os.hostname(), ver = "";
  try { const h = await sup("/host/info"); name = h.hostname || name; } catch (e) { /* egal */ }
  try { const c = await sup("/core/info"); ver = c.version || ""; } catch (e) { /* egal */ }
  const j = await site("einrichtung/start", { name, ha: ver });
  if (!j.ok) throw new Error(j.message || j.error || "Kein Code von der Website.");
  Object.assign(S, { code: j.code, device: j.device, phase: "code", steps: [], error: "", customer: "", remote: "" });
  S.log = []; save();
  log("Code " + j.code + " – bitte im Team-Panel unter „Neuer Pi“ eingeben.");
}
async function loop() {
  for (;;) {
    try {
      if (S.phase === "fertig" || running || S.phase === "fehler") { await sleep(5000); continue; }
      if (!S.device) await newCode();
      const j = await site("einrichtung/abholen", { device: S.device });
      S.online = true;
      if (j.status === "abgelaufen") { log("Der Code ist abgelaufen, ich hole einen neuen."); S.device = ""; save(); continue; }
      if (j.status === "plan" && j.plan) { run(j.plan); continue; }
    } catch (e) {
      S.online = false;
      if (S.lastErr !== e.message) { S.lastErr = e.message; log("Website nicht erreichbar: " + e.message); }
    }
    await sleep(4000);
  }
}

/* ---------- Oberfläche (Ingress) ---------- */
const UI = fs.readFileSync(path.join(__dirname, "ui.html"), "utf8").replace("__SITE__", SITE.replace(/^https?:\/\//, ""));
http.createServer((req, res) => {
  const u = (req.url || "/").split("?")[0];
  if (u.endsWith("/state")) {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ phase: S.phase, code: S.code, steps: S.steps, log: S.log.slice(-60), error: S.error, customer: S.customer, remote: S.remote, online: S.online !== false }));
  }
  if (u.endsWith("/retry") && req.method === "POST") {
    /* Nochmal: gleicher Plan, wenn er noch da ist; sonst neuer Code */
    S.phase = "code"; S.error = ""; save();
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true}');
  }
  if (u.endsWith("/neu") && req.method === "POST") {
    S.device = ""; S.code = ""; S.phase = "start"; S.steps = []; S.error = ""; save();
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true}');
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(UI);
}).listen(PORT, () => console.log("STEVO Einrichtung läuft auf Port " + PORT + ", Website " + SITE));

if (!process.env.STEVO_NO_LOOP) loop();
module.exports = { installStevo, trustTunnel, merge, run, S };
