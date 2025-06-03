/* eslint-env browser */

"use strict";

/*===================================================================================
  Custom Patch: Control visibility of Add Column, Share icon, and Download options
  File: custom/index.js
  Version: v1.3.3 — Shows alerts when access is denied
===================================================================================*/

console.log("[Custom Patch] index.js loaded ✅ v1.3.3");

(function () {
  let capturedDocId = null;

  // 🧠 Intercept WebSocket to grab docId from openDoc
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) {
        capturedDocId = msg.args[0];
        console.log(`[Custom Patch] 📄 docId captured from openDoc: ${capturedDocId}`);
      }
    } catch (err) {
      console.warn("[Custom Patch] ⚠️ WebSocket interception failed", err);
    }
    return originalSend.call(this, data);
  };

  async function getDocId(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const id = window.gristDoc?.docId || capturedDocId;
      if (id) return id;
      await new Promise(r => setTimeout(r, 100));
    }
    console.warn("[Custom Patch] ❌ Could not retrieve valid docId — skipping fallback.");
    return null;
  }

  async function getCurrentUserPermissions(docId) {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });
      if (!res.ok) throw new Error("SysUsers fetch failed");

      const data = await res.json();
      const email = profile?.email?.toLowerCase();
      const userIndex = data.Email?.findIndex(e => e?.toLowerCase() === email);
      if (userIndex === -1) return { canAdd: false, canExport: false };

      return {
        canAdd: data.Unlock_Structure?.[userIndex] === true,
        canExport: data.Export_Data?.[userIndex] === true,
      };
    } catch (err) {
      console.warn("[Custom Patch] ❌ Permission lookup failed", err);
      return { canAdd: false, canExport: false };
    }
  }

  // 🌐 Native Grist-style alert popup (lower-right corner)
  function showAlert(msg, type = 'error') {
    const event = new CustomEvent('uiShowToast', {
      detail: { text: msg, type, timeout: 5000 }
    });
    window.dispatchEvent(event);
  }

  function observeAndHide(selector, visible, messageIfHidden) {
    const apply = () => {
      const found = document.querySelectorAll(selector);
      if (!visible && found.length) {
        found.forEach(el => el.style.display = 'none');
        if (messageIfHidden) showAlert(messageIfHidden);
      } else if (visible) {
        found.forEach(el => el.style.display = '');
      }
    };
    apply();
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  async function applyVisibilityControls() {
    const docId = await getDocId();
    if (!docId) return;

    const perms = await getCurrentUserPermissions(docId);
    console.log(`[Custom Patch] 🧾 Permissions — Add: ${perms.canAdd}, Export: ${perms.canExport}`);

    observeAndHide('.mod-add-column', perms.canAdd, "❌ You don't have permission to add columns.");
    observeAndHide('.test-tb-share', perms.canExport, "❌ You don't have permission to share.");
    observeAndHide('.test-download-section', perms.canExport, "❌ You don't have permission to download data.");
  }

  window.addEventListener('load', () => {
    console.log("[Custom Patch] ⏳ window.onload fallback triggered");
    applyVisibilityControls();
  });
})();
