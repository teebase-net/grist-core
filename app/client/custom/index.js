/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.3.4-Stable
 * OWNER: teebase-net (MOD DMH)
 * * 📄 PERMANENT FEATURE MANIFEST:
 * 1. VERSION LOGGING: Displays version of index.js in console on load for patch verification.
 * 2. WEBSOCKET SNIFFING: Intercepts docId before Grist UI initialization.
 * 3. THEME ENFORCEMENT: Forces 'dark' theme body class.
 * 4. DISPLAY DENSITY: Compact UI (22px rows, 11px font).
 * 5. DISCRETE TIMER: Muted GitHub-grey (#6a737d) countdown in bottom-right.
 * 6. PERMISSION CLOAKING: Hides Add/Share/Export based on SysUsers table.
 * 7. SURGICAL CSS: 30px row-number fix and 0px layout padding.
 * 8. SESSION WATCHDOG: Large Orange Warning UI (Centered) 2 mins before logout.
 * 9. ACTION HIGHLIGHTING: Bold red (#f97583) for 'Delete' commands.
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {
  const VERSION = "2.3.4-Stable";
  const LOG_PREFIX = "[Custom Patch]";
  const DEFAULT_TIMEOUT_MINS = 60;
  let capturedDocId = null;

  console.log(
    `%c ${LOG_PREFIX} SYSTEM BOOT %c v${VERSION} `,
    "background: #24292e; color: #f97583; font-weight: bold; border-radius: 3px 0 0 3px;",
    "background: #6a737d; color: #fff; font-weight: bold; border-radius: 0 3px 3px 0;"
  );

  function applyVisuals() {
    document.body.classList.add('theme-dark');
    if (document.getElementById("teebase-visual-overrides")) return;
    const style = document.createElement("style");
    style.id = "teebase-visual-overrides";
    style.textContent = `
      :root { --grid-row-height: 22px !important; --font-size: 11px !important; --gridview-rownum-width: 30px !important; }
      .gridview_data_row { height: 22px !important; }
      .gridview_data_cell { padding: 0 4px !important; line-height: 22px !important; }
      .gridview_corner_spacer, .gridview_data_row_num, .gridview_row_numbers, .gridview_header_corner { 
        width: 30px !important; min-width: 30px !important; max-width: 30px !important; 
      }
      .scroll_shadow_left, .scroll_shadow_frozen { left: 30px !important; }
      .test-grist-doc { padding: 0px !important; }
      #teebase-timer-node {
        position: fixed; bottom: 8px; right: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 11px; color: #6a737d; pointer-events: none; z-index: 9999; opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  function setupWatchdog(mins) {
    const MS = mins * 60 * 1000;
    const WARN_MS = 120000;
    let lastReset = Date.now();
    let timer, warnTimer, countdownNode;

    const updateDisplay = () => {
      if (!countdownNode) {
        countdownNode = document.createElement("div");
        countdownNode.id = "teebase-timer-node";
        document.body.appendChild(countdownNode);
      }
      const rem = Math.max(0, Math.floor((MS - (Date.now() - lastReset)) / 1000));
      const m = Math.floor(rem/60), s = rem%60;
      countdownNode.innerText = `Sess: ${m}:${s.toString().padStart(2, '0')}`;
    };

    const logout = () => window.location.href = "/logout";

    const showWarning = () => {
      let w = document.getElementById("logout-warning") || document.createElement("div");
      w.id = "logout-warning";
      // RESTORED: Large, comfortable orange warning
      Object.assign(w.style, {
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "rgba(255, 152, 0, 0.95)", color: "white", padding: "40px",
        borderRadius: "15px", zIndex: "1000000", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      });
      w.innerHTML = `<div style="font-size:24px;font-weight:bold;">Session Expiring</div>
                     <div style="margin:10px 0;">Logout in:</div>
                     <div id="w-count" style="font-size:40px;font-weight:bold;font-family:monospace;">2:00</div>`;
      document.body.appendChild(w);
      w.style.display = "block";
      
      let sec = 120;
      const int = setInterval(() => {
        sec--;
        if (document.getElementById("w-count")) document.getElementById("w-count").innerText = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
        if (sec <= 0) { clearInterval(int); logout(); }
      }, 1000);
      w.dataset.int = int;
    };

    const reset = () => {
      lastReset = Date.now();
      const w = document.getElementById("logout-warning");
      if (w) { w.style.display = "none"; clearInterval(w.dataset.int); }
      clearTimeout(timer); clearTimeout(warnTimer);
      warnTimer = setTimeout(showWarning, MS - WARN_MS);
      timer = setTimeout(logout, MS);
    };

    ["mousedown", "keydown", "touchstart"].forEach(e => document.addEventListener(e, reset, { capture: true }));
    setInterval(updateDisplay, 1000);
    reset();
  }

  // WebSocket Sniffer
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) { capturedDocId = msg.args[0]; }
    } catch (err) {}
    return originalSend.call(this, data);
  };

  async function applyPermissions(docId) {
    try {
      const profile = await fetch("/api/profile/user", { credentials: "include" }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: "include" });
      const data = await res.json();
      const idx = data.Email?.findIndex(e => e?.toLowerCase() === profile.email?.toLowerCase());
      const perms = {
        canAdd: data.Unlock_Structure?.[idx] === true,
        canExport: data.Export_Data?.[idx] === true,
        timeout: data.Timeout_Minutes?.[idx] || DEFAULT_TIMEOUT_MINS
      };
      const hide = (sel, vis) => {
        const a = () => document.querySelectorAll(sel).forEach(el => el.style.display = vis ? "" : "none");
        a(); new MutationObserver(a).observe(document.body, { childList: true, subtree: true });
      };
      hide(".mod-add-column", perms.canAdd);
      hide(".test-tb-share", perms.canExport);
      hide(".test-download-section", perms.canExport);
      return perms;
    } catch (e) { return { canAdd: false, canExport: false, timeout: DEFAULT_TIMEOUT_MINS }; }
  }

  const boot = async () => {
    applyVisuals();
    const start = Date.now();
    while (Date.now() - start < 3000 && !capturedDocId && !window.gristDoc?.docId) { await new Promise(r => setTimeout(r, 100)); }
    const docId = window.gristDoc?.docId || capturedDocId;
    if (docId) {
      const config = await applyPermissions(docId);
      setupWatchdog(config.timeout);
      const highlight = () => {
        document.querySelectorAll(".test-cmd-name").forEach(s => {
          if (["Delete", "Delete record", "Delete widget"].includes(s.textContent?.trim())) {
            s.style.color = "#f97583"; s.style.fontWeight = "bold"; s.classList.add("custom-highlight");
          }
        });
      };
      new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
    } else { setupWatchdog(DEFAULT_TIMEOUT_MINS); }
  };
  window.addEventListener("load", boot);
})();
