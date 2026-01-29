/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.3.4-Stable (Decoupled)
 * OWNER: teebase-net (MOD DMH)
 * * 📄 PERMANENT FEATURE MANIFEST (INDEPENDENT MODULES):
 * 1. VERSION LOGGING: Console verification on boot.
 * 2. WEBSOCKET SNIFFING: docId extraction (Isolated).
 * 3. THEME ENFORCEMENT: Dark mode force (Isolated).
 * 4. DISPLAY DENSITY: 22px Row / 11px Font (Isolated).
 * 5. DISCRETE TIMER: GitHub-grey bottom-right countdown (Isolated).
 * 6. PERMISSION CLOAKING: SysUsers-based UI hiding (Isolated).
 * 7. HARDENED CSS: 30px Row Numbers & Sticky Column Alignment (Isolated).
 * 8. SESSION WATCHDOG: Large Orange Centered Warning (Isolated).
 * 9. ACTION HIGHLIGHTING: Red 'Delete' commands (Isolated).
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {
  const VERSION = "2.3.4-Stable";
  const LOG_PREFIX = "[Custom Patch]";
  const DEFAULT_TIMEOUT_MINS = 60;
  let capturedDocId = null;

  // --- FEATURE 1: VERSION LOGGING (ENTRY POINT) ---
  try {
    console.log(
      `%c ${LOG_PREFIX} SYSTEM BOOT %c v${VERSION} `,
      "background: #24292e; color: #f97583; font-weight: bold; border-radius: 3px 0 0 3px;",
      "background: #6a737d; color: #fff; font-weight: bold; border-radius: 0 3px 3px 0;"
    );
  } catch (e) { /* Fail Silently */ }

  // --- FEATURE 2: WEBSOCKET SNIFFING (INDEPENDENT) ---
  (function() {
    try {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          const msg = JSON.parse(data);
          if (msg?.method === "openDoc" && msg.args?.length) { capturedDocId = msg.args[0]; }
        } catch (err) { /* Sniffer error - don't break WS */ }
        return originalSend.call(this, data);
      };
    } catch (e) { console.error(`${LOG_PREFIX} WS Sniffer Failed`, e); }
  })();

  // --- FEATURES 3, 4, 7: VISUALS & HARDENED CSS (INDEPENDENT) ---
  function applyVisuals() {
    try {
      document.body.classList.add('theme-dark');
      if (document.getElementById("teebase-visual-overrides")) return;
      const style = document.createElement("style");
      style.id = "teebase-visual-overrides";
      style.textContent = `
        :root { --grid-row-height: 22px !important; --font-size: 11px !important; --grid-row-num-width: 30px !important; --gridview-rownum-width: 30px !important; }
        .gridview_data_row { height: 22px !important; }
        .gridview_data_cell { padding: 0 4px !important; line-height: 22px !important; }
        .gridview_data_row_num, .gridview_row_numbers, .gridview_header_corner, .gridview_corner_spacer, .gridview_data_corner_overlay, .record_selector { 
          width: 30px !important; min-width: 30px !important; max-width: 30px !important; flex: 0 0 30px !important;
        }
        .gridview_header_backdrop_left { width: 31px !important; }
        .scroll_shadow_left, .scroll_shadow_frozen { left: 30px !important; }
        .gridview_stick_left { left: 30px !important; }
        .test-grist-doc, .view_data_pane_container { padding: 0px !important; margin: 0px !important; }
        #teebase-timer-node { position: fixed; bottom: 8px; right: 12px; font-family: sans-serif; font-size: 11px; color: #6a737d; pointer-events: none; z-index: 9999; opacity: 0.8; }
      `;
      document.head.appendChild(style);
    } catch (e) { console.error(`${LOG_PREFIX} Visuals Failed`, e); }
  }

  // --- FEATURES 5, 8: WATCHDOG & TIMER (INDEPENDENT) ---
  function setupWatchdog(mins) {
    try {
      const MS = (mins || DEFAULT_TIMEOUT_MINS) * 60 * 1000;
      const WARN_MS = 120000;
      let lastReset = Date.now();
      let timer, warnTimer, countdownNode;

      const updateDisplay = () => {
        try {
          if (!countdownNode) {
            countdownNode = document.createElement("div");
            countdownNode.id = "teebase-timer-node";
            document.body.appendChild(countdownNode);
          }
          const rem = Math.max(0, Math.floor((MS - (Date.now() - lastReset)) / 1000));
          countdownNode.innerText = `Sess: ${Math.floor(rem/60)}:${(rem%60).toString().padStart(2, '0')}`;
        } catch (e) {}
      };

      const showWarning = () => {
        try {
          let w = document.getElementById("logout-warning") || document.createElement("div");
          w.id = "logout-warning";
          Object.assign(w.style, {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "rgba(255, 152, 0, 0.95)", color: "white", padding: "40px",
            borderRadius: "15px", zIndex: "1000000", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          });
          w.innerHTML = `<div style="font-size:24px;font-weight:bold;">Session Expiring</div><div id="w-count" style="font-size:40px;font-weight:bold;margin-top:10px;">2:00</div>`;
          document.body.appendChild(w);
          let sec = 120;
          const int = setInterval(() => {
            sec--;
            if (document.getElementById("w-count")) document.getElementById("w-count").innerText = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
            if (sec <= 0) { clearInterval(int); window.location.href = "/logout"; }
          }, 1000);
          w.dataset.int = int;
        } catch (e) {}
      };

      const reset = () => {
        try {
          lastReset = Date.now();
          const w = document.getElementById("logout-warning");
          if (w) { w.style.display = "none"; clearInterval(parseInt(w.dataset.int)); }
          clearTimeout(timer); clearTimeout(warnTimer);
          warnTimer = setTimeout(showWarning, MS - WARN_MS);
          timer = setTimeout(() => window.location.href = "/logout", MS);
        } catch (e) {}
      };

      ["mousedown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, reset, { capture: true }));
      setInterval(updateDisplay, 1000);
      reset();
    } catch (e) { console.error(`${LOG_PREFIX} Watchdog Failed`, e); }
  }

  // --- FEATURE 6: PERMISSION CLOAKING (INDEPENDENT) ---
  async function applyPermissions(docId) {
    try {
      const profile = await fetch("/api/profile/user").then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`).then(r => r.json());
      const idx = res.Email?.findIndex(e => e?.toLowerCase() === profile.email?.toLowerCase());
      
      const perms = {
        canAdd: res.Unlock_Structure?.[idx] === true,
        canExport: res.Export_Data?.[idx] === true,
        timeout: res.Timeout_Minutes?.[idx] || DEFAULT_TIMEOUT_MINS
      };

      const observer = new MutationObserver(() => {
        document.querySelectorAll(".mod-add-column").forEach(el => el.style.display = perms.canAdd ? "" : "none");
        document.querySelectorAll(".test-tb-share, .test-download-section").forEach(el => el.style.display = perms.canExport ? "" : "none");
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return perms;
    } catch (e) { 
      console.warn(`${LOG_PREFIX} Permissions Failed - Defaulting to Safe Mode`, e);
      return { canAdd: false, canExport: false, timeout: DEFAULT_TIMEOUT_MINS }; 
    }
  }

  // --- FEATURE 9: ACTION HIGHLIGHTING (INDEPENDENT) ---
  function setupHighlighting() {
    try {
      const observer = new MutationObserver(() => {
        document.querySelectorAll(".test-cmd-name").forEach(s => {
          if (["Delete", "Delete record", "Delete widget"].includes(s.textContent?.trim())) {
            s.style.color = "#f97583"; s.style.fontWeight = "bold";
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* Fail Silently */ }
  }

  // --- BOOT ORCHESTRATOR ---
  window.addEventListener("load", async () => {
    applyVisuals();
    setupHighlighting();
    
    // Polling for docId
    const start = Date.now();
    while (Date.now() - start < 3000 && !capturedDocId && !window.gristDoc?.docId) { 
      await new Promise(r => setTimeout(r, 100)); 
    }
    
    const docId = window.gristDoc?.docId || capturedDocId;
    const config = docId ? await applyPermissions(docId) : { timeout: DEFAULT_TIMEOUT_MINS };
    setupWatchdog(config.timeout);
  });
})();
