/* eslint-env browser */
"use strict";

console.log("[Custom Patch] index.js Enterprise Suite loaded ✅ v1.7.10-FullRestored");

(function () {
  let capturedDocId = null;

  // === 1. WebSocket Interceptor ===
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) {
        capturedDocId = msg.args[0];
        console.log(`[Custom Patch] 📄 docId captured: ${capturedDocId}`);
      }
    } catch (err) {}
    return originalSend.call(this, data);
  };

  async function getDocId(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const id = window.gristDoc?.docId || capturedDocId;
      if (id) return id;
      await new Promise(r => setTimeout(r, 100));
    }
    return null;
  }

  // === 2. STATIC UI: GridView (30px UI) ===
  function injectGridViewStyles() {
    if (document.getElementById("custom-gridview-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-gridview-styles";
    style.textContent = `
      :root { --gridview-rownum-width: 30px !important; --timer-text-color: #929299; }
      .gridview_corner_spacer, .gridview_data_row_num, .gridview_data_corner_overlay { width: 30px !important; min-width: 30px !important; }
      .gridview_header_backdrop_left { width: 31px !important; }
      .scroll_shadow_left, .scroll_shadow_frozen { left: 30px !important; }
      .gridview_row .record .field.frozen { left: calc(30px + (var(--frozen-width-prefix, 0) * 1px)) !important; }
    `;
    document.head.appendChild(style);
    console.log("[Custom Patch] GridView (30px UI) injected.");
  }

  // === 3. STATIC UI: GristDoc (0px Padding) ===
  function injectGristDocStyles() {
    if (document.getElementById("custom-gristdoc-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-gristdoc-styles";
    style.textContent = `
      .test-grist-doc { padding: 0px !important; }
      [data-theme='dark'] {
        --bg-canvas: #1e1e1e !important; --gridview-bg: #1e1e1e !important;
        --bg-light: #252525 !important; --color-primary: #5dade2 !important;
        --timer-text-color: #e8e8e8 !important;
      }
      [data-theme='dark'] .field.with_bg_color { filter: saturate(0.7) brightness(0.9); opacity: 0.85; }
    `;
    document.head.appendChild(style);
    console.log("[Custom Patch] GristDoc (0px Padding & Dark Fix) injected.");
  }

  // === 4. STATIC UI: Constant Overrides & Compact Cards ===
  function injectGridViewConstantOverrides() {
    const style = document.createElement("style");
    style.textContent = `.gridview_row_numbers, .gridview_header_corner { width: 30px !important; max-width: 30px !important; }`;
    document.head.appendChild(style);
  }

  function injectDetailViewStyles() {
    const style = document.createElement("style");
    style.textContent = `.layout_box.layout_fill_window.layout_hbox { padding-left: 0 !important; padding-right: 0 !important; }`;
    document.head.appendChild(style);
    console.log("[Custom Patch] DetailView (Compact) injected.");
  }

  // === 5. DYNAMIC UI: Markdown & Mermaid ===
  function processEnhancedMarkdown() {
    new MutationObserver(() => {
      document.querySelectorAll('.markdown-render').forEach(el => {
        if (el.innerHTML.includes('[ ]') || el.innerHTML.includes('[x]')) {
          el.innerHTML = el.innerHTML.replace(/\[ \]/g, '☐').replace(/\[x\]/g, '☑');
        }
        el.querySelectorAll('blockquote').forEach(bq => {
          if (bq.textContent.includes('[!')) {
            const type = bq.textContent.match(/\[!(\w+)\]/)?.[1] || "INFO";
            bq.style = "border-left: 4px solid #3498db; background: rgba(52,152,219,0.1); padding: 10px;";
            bq.innerHTML = `<strong>${type}</strong><br>` + bq.innerHTML.replace(/\[!\w+\]/, '');
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function injectMermaid() {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js";
    script.onload = () => {
      mermaid.initialize({ startOnLoad: false });
      new MutationObserver(() => {
        document.querySelectorAll('pre code.language-mermaid').forEach(c => {
          const d = document.createElement('div'); d.className = 'mermaid'; d.textContent = c.textContent;
          c.parentElement.replaceWith(d); mermaid.run();
        });
      }).observe(document.body, { childList: true, subtree: true });
    };
    document.head.appendChild(script);
  }

  // === 6. DATA-DEPENDENT: Permissions & Session Timer ===
  function setupIdleTimer(timeoutMinutes) {
    if (window._idleIntervals) window._idleIntervals.forEach(clearInterval);
    const old = document.getElementById("idle-debug-overlay"); if (old) old.remove();

    const IDLE_MS = (timeoutMinutes || 60) * 60 * 1000;
    let lastReset = Date.now();
    const overlay = document.createElement("div");
    overlay.id = "idle-debug-overlay";
    Object.assign(overlay.style, { position: "fixed", bottom: "2px", right: "5px", color: "var(--timer-text-color)", fontSize: "10px", zIndex: "999999", pointerEvents: "none" });
    document.body.appendChild(overlay);

    window._idleIntervals = [setInterval(() => {
      const rem = Math.max(0, Math.floor((IDLE_MS - (Date.now() - lastReset)) / 1000));
      overlay.textContent = `Session: ${Math.floor(rem/60)}m ${rem%60}s`;
    }, 1000)];

    const reset = () => {
      lastReset = Date.now();
      clearTimeout(window._idleTimeout);
      window._idleTimeout = setTimeout(() => window.location.href = "/logout", IDLE_MS);
    };
    ["mousedown", "keydown"].forEach(e => document.addEventListener(e, reset, { capture: true }));
    reset();
  }

  async function applyVisibilityControls() {
    const docId = await getDocId();
    if (!docId) return setupIdleTimer(60);

    try {
      const profile = await fetch("/api/profile/user").then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`);
      const data = await res.json();
      const idx = data.Email?.findIndex(e => e?.toLowerCase() === profile.email?.toLowerCase());

      if (idx !== -1 && idx !== undefined) {
        setupIdleTimer(data.Timeout_Minutes?.[idx]);
        document.documentElement.setAttribute('data-theme', (data.Theme?.[idx] || 'light').toLowerCase());
        const density = data.Display_Density?.[idx];
        if (density === 'Minimal') document.documentElement.style.setProperty('--gridview-data-row-height', '23px');
        
        const canAdd = data.Unlock_Structure?.[idx] === true;
        document.querySelectorAll(".mod-add-column").forEach(el => el.style.display = canAdd ? "" : "none");
      }
    } catch (e) { setupIdleTimer(60); }
  }

  async function maybeShowDevBanner() {
    const docId = await getDocId();
    const res = await fetch(`/api/docs/${docId}`).then(r => r.json());
    if (res.name?.includes("- DEV")) {
      const b = document.createElement("div"); b.innerText = "DEV ENVIRONMENT";
      Object.assign(b.style, { position: "fixed", top: 0, width: "100%", height: "10px", background: "#f48fb1", fontSize: "10px", textAlign: "center", zIndex: 9999 });
      document.body.prepend(b);
    }
  }

  // === 99. Run everything on window load (EXACTLY AS REQUESTED) ===
  window.addEventListener("load", () => {
    console.log("[Custom Patch] ⏳ window.onload triggered");
    
    // 1. Static UI & CSS Overrides
    injectGridViewStyles();           
    injectGristDocStyles();          
    injectGridViewConstantOverrides(); 
    injectDetailViewStyles();        
    
    // 2. Feature Engines
    processEnhancedMarkdown();
    injectMermaid();

    // 3. Data-Dependent Overrides
    applyVisibilityControls();
    maybeShowDevBanner();
  });

})();
