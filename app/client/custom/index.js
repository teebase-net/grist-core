/* eslint-env browser */
"use strict";

/**
 * ==============================================================================
 * GRIST ENTERPRISE HYBRID PATCH v1.7.12
 * ==============================================================================
 * * FEATURES INCLUDED:
 * 1.  [Layout] Row Number Width: Fixed at 30px (via GridView/GridView.ts patches).
 * 2.  [Layout] Document Padding: Set to 0px for edge-to-edge feel.
 * 3.  [UI] Highlight Deletions: Red/Bold styling for "Delete" menu items.
 * 4.  [UI] Palatable Dark Mode: Custom HEX overrides for canvases and grid backgrounds.
 * 5.  [UI] Display Density: 'Minimal' (23px) and 'Cozy' (28px) via SysUsers table.
 * 6.  [Security] SysUsers Integration: Dynamic Theme, Density, and Permissions.
 * 7.  [Security] Permissions: Hides Add-Column and Export icons based on user role.
 * 8.  [Session] Idle Timer: Visual countdown in footer with visibility fix (#929299).
 * 9.  [Dev] Banner: Detects "- DEV" in doc title and injects pink warning bar.
 * 10. [Render] Mermaid.js: Native support for diagrams in Markdown code blocks.
 * 11. [Render] Markdown+: Support for ☐/☑ checkboxes and [!INFO] style callouts.
 * * CORE ARCHITECTURE:
 * Uses a "Static-First, Data-Second" approach. Static CSS loads immediately on 
 * window.load, while User-Specific preferences are fetched via the Grist API 
 * once the docId is resolved.
 * ==============================================================================
 */

console.log("[Custom Patch] index.js v1.7.12 initialized ✅");

(function () {
  let capturedDocId = null;

  /**
   * INTERCEPTORS & DISCOVERY
   */
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) {
        capturedDocId = msg.args[0];
      }
    } catch (err) {}
    return originalSend.call(this, data);
  };

  async function resolveDocId(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const fromUrl = window.location.pathname.match(/\/doc\/([^/]+)/);
      const id = window.gristDoc?.docId || capturedDocId || (fromUrl ? fromUrl[1] : null);
      if (id) return id;
      await new Promise(r => setTimeout(r, 100));
    }
    return null;
  }

  /**
   * STYLE INJECTION (Static Layout)
   */
  function injectStaticStyles() {
    if (document.getElementById("grist-enterprise-static")) return;
    const style = document.createElement("style");
    style.id = "grist-enterprise-static";
    style.textContent = `
      /* --- 1. Layout Fixes (30px Row Numbers & 0px Padding) --- */
      :root { --gridview-rownum-width: 30px !important; --timer-text-color: #929299; }
      .test-grist-doc { padding: 0px !important; }
      .gridview_corner_spacer, .gridview_data_row_num, .gridview_data_corner_overlay, .gridview_header_corner, .gridview_row_numbers {
        width: 30px !important; min-width: 30px !important; max-width: 30px !important;
      }
      .scroll_shadow_left, .scroll_shadow_frozen { left: 30px !important; }
      .gridview_row .record .field.frozen { left: calc(30px + (var(--frozen-width-prefix, 0) * 1px)) !important; }
      .layout_box.layout_fill_window.layout_hbox, .flexvbox.view_data_pane_container { padding: 0 !important; margin: 0 !important; }

      /* --- 2. UI Polish (Delete Highlights) --- */
      .custom-delete-highlight { color: red !important; font-weight: bold !important; }
      li:focus .custom-delete-highlight, li:focus-within .custom-delete-highlight { color: #fff !important; }

      /* --- 3. Palatable Dark Mode (High Specificity Overrides) --- */
      [data-theme='dark'] body, [data-theme='dark'] .theme-light, [data-theme='dark'] .test-grist-doc {
        --bg-canvas: #1e1e1e !important; --gridview-bg: #1e1e1e !important;
        --bg-light: #252525 !important; --color-primary: #5dade2 !important;
        --timer-text-color: #e8e8e8 !important;
        background-color: #1e1e1e !important; color: #e8e8e8 !important;
      }

      /* --- 4. Session Timer Overlay --- */
      #idle-debug-overlay {
        position: fixed; bottom: 2px; right: 5px; color: var(--timer-text-color) !important;
        font-family: monospace; font-size: 10px; z-index: 999999; pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * FEATURE ENGINES (Markdown & Mermaid)
   */
  function runFeatureEngines() {
    // Mermaid.js
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js";
    script.onload = () => {
      mermaid.initialize({ startOnLoad: false });
      new MutationObserver(() => {
        document.querySelectorAll('pre code.language-mermaid').forEach(code => {
          const div = document.createElement('div');
          div.className = 'mermaid'; div.textContent = code.textContent;
          code.parentElement.replaceWith(div);
          mermaid.run();
        });
      }).observe(document.body, { childList: true, subtree: true });
    };
    document.head.appendChild(script);

    // Markdown Checkboxes & Callouts
    new MutationObserver(() => {
      document.querySelectorAll('.markdown-render').forEach(el => {
        if (el.innerHTML.includes('[ ]') || el.innerHTML.includes('[x]')) {
          el.innerHTML = el.innerHTML.replace(/\[ \]/g, '☐').replace(/\[x\]/g, '☑');
        }
        el.querySelectorAll('blockquote').forEach(bq => {
          if (bq.textContent.includes('[!')) {
            const type = bq.textContent.match(/\[!(\w+)\]/)?.[1] || "INFO";
            bq.style = "border-left: 4px solid #3498db; background: rgba(52,152,219,0.1); padding: 8px; margin: 4px 0;";
            bq.innerHTML = `<strong>${type.toUpperCase()}</strong><br>` + bq.innerHTML.replace(/\[!\w+\]/, '');
          }
        });
      });
      // Delete Highlighting
      document.querySelectorAll(".test-cmd-name").forEach(span => {
        if (["Delete record", "Delete", "Delete widget"].includes(span.textContent?.trim())) {
          span.classList.add("custom-delete-highlight");
        }
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /**
   * DYNAMIC LOGIC (SysUsers Integration)
   */
  async function applyEnterpriseConfig() {
    const docId = await resolveDocId();
    if (!docId) return setupTimer(60);

    try {
      const profile = await fetch("/api/profile/user").then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`);
      const data = await res.json();
      const email = profile?.email?.toLowerCase();
      const idx = data.Email?.findIndex(e => e?.toLowerCase() === email);

      if (idx !== -1 && idx !== undefined) {
        // 1. Session & Theme
        setupTimer(Number(data.Timeout_Minutes?.[idx]));
        document.documentElement.setAttribute('data-theme', (data.Theme?.[idx] || 'light').toLowerCase());
        
        // 2. Display Density
        const density = data.Display_Density?.[idx];
        if (density === 'Minimal') document.documentElement.style.setProperty('--gridview-data-row-height', '23px', 'important');
        else if (density === 'Cozy') document.documentElement.style.setProperty('--gridview-data-row-height', '28px', 'important');

        // 3. Permissions (Structural Lockdown)
        const canAdd = data.Unlock_Structure?.[idx] === true;
        const canExport = data.Export_Data?.[idx] === true;
        
        const applyPerms = () => {
          document.querySelectorAll(".mod-add-column").forEach(el => el.style.display = canAdd ? "" : "none");
          document.querySelectorAll(".test-tb-share, .test-download-section").forEach(el => el.style.display = canExport ? "" : "none");
        };
        applyPerms();
        new MutationObserver(applyPerms).observe(document.body, { childList: true, subtree: true });
      }

      // 4. Dev Banner Check
      const docMeta = await fetch(`/api/docs/${docId}`).then(r => r.json());
      if (docMeta.name?.includes("- DEV")) {
        const b = document.createElement("div"); b.innerText = "DEV ENVIRONMENT – TEST DOCUMENT";
        Object.assign(b.style, { position: "fixed", top: 0, width: "100%", height: "10px", background: "#f48fb1", fontSize: "10px", textAlign: "center", zIndex: 9999, lineHeight: "10px" });
        document.body.prepend(b); document.body.style.marginTop = "10px";
      }
    } catch (e) { setupTimer(60); }
  }

  function setupTimer(timeoutMins) {
    if (window._idleInt) window._idleInt.forEach(clearInterval);
    const old = document.getElementById("idle-debug-overlay"); if (old) old.remove();
    
    const IDLE_MS = (timeoutMins || 60) * 60 * 1000;
    let lastReset = Date.now();
    const overlay = document.createElement("div"); overlay.id = "idle-debug-overlay";
    document.body.appendChild(overlay);

    window._idleInt = [setInterval(() => {
      const rem = Math.max(0, Math.floor((IDLE_MS - (Date.now() - lastReset)) / 1000));
      overlay.textContent = `Session: ${Math.floor(rem/60)}m ${rem%60}s`;
    }, 1000)];

    const reset = () => { lastReset = Date.now(); clearTimeout(window._idleTo); window._idleTo = setTimeout(() => window.location.href = "/logout", IDLE_MS); };
    ["mousedown", "keydown"].forEach(e => document.addEventListener(e, reset, { capture: true }));
    reset();
  }

  /**
   * EXECUTION
   */
  window.addEventListener("load", () => {
    injectStaticStyles();
    runFeatureEngines();
    applyEnterpriseConfig();
  });
})();
