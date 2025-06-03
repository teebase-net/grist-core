/* global window document MutationObserver */

"use strict";

/*===================================================================================
  Custom Patch: Conditional UI based on SysUsers table
  File: /app/client/custom/index.js
  Applied: 2025-06
  Purpose:
    - Hides “+ Add Column” unless Unlock_Structure = true
    - Hides Share + Export options unless Export_Data = true
    - Uses WebSocket intercept to wait for real docId before executing logic
    - Falls back to window.onload if intercept fails

  Version: v1.3.1
===================================================================================*/

console.log("[Custom Patch] index.js loaded ✅ v1.3.1");

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getProfile() {
  try {
    return await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
  } catch {
    return null;
  }
}

async function fetchSysUsers(docId) {
  const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });
  if (!res.ok) {
    console.warn("SysUsers table missing — skipping permission control.");
    return null;
  }
  return res.json();
}

async function hasPermission(field, docId) {
  try {
    const profile = await getProfile();
    const data = await fetchSysUsers(docId);
    if (!data || !data.id?.length || !data.Email || !data[field]) return null;

    const user = Array.from({ length: data.id.length }, (_, i) => ({
      Email: data.Email[i],
      Flag: data[field][i]
    })).find(u =>
      u.Email?.trim().toLowerCase() === profile?.email?.trim().toLowerCase()
    );

    return user?.Flag === true;
  } catch (err) {
    console.warn(`Permission check failed for ${field}`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 UI Controllers
// ─────────────────────────────────────────────────────────────────────────────

async function controlAddColumnButtons(docId) {
  const allowed = await hasPermission('Unlock_Structure', docId);
  if (allowed === null) return;

  const toggle = () => {
    document.querySelectorAll('.mod-add-column').forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });
  };

  new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
  toggle();
  console.log(`[Custom Patch] Unlock_Structure = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}

async function controlShareIcon(docId) {
  const allowed = await hasPermission('Export_Data', docId);
  if (allowed === null) return;

  const toggle = () => {
    document.querySelectorAll('.test-tb-share').forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });
  };

  new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
  toggle();
  console.log(`[Custom Patch] Share icon = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}

async function controlExportButtons(docId) {
  const allowed = await hasPermission('Export_Data', docId);
  if (allowed === null) return;

  const toggle = () => {
    document.querySelectorAll('.test-download-section').forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });
  };

  new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
  toggle();
  console.log(`[Custom Patch] Export_Data for download links = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}

async function runAllControls(docId) {
  await controlAddColumnButtons(docId);
  await controlShareIcon(docId);
  await controlExportButtons(docId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔌 GristWSConnection Intercept (Option C)
// ─────────────────────────────────────────────────────────────────────────────

(function waitForGristConnection() {
  const GristWS = window.GristWSConnection?.prototype;
  if (!GristWS) {
    return setTimeout(waitForGristConnection, 50);
  }

  const originalOnMessage = GristWS.onmessage;

  GristWS.onmessage = function(event) {
    originalOnMessage.call(this, event);

    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg?.result?.doc && msg?.result?.docId) {
      console.log("[Custom Patch] ✅ Detected openDoc — activating permission logic");
      runAllControls(msg.result.docId);
    }
  };

  console.log("[Custom Patch] ✅ GristWSConnection hook installed");
})();

// ─────────────────────────────────────────────────────────────────────────────
// 🕗 Fallback: run late if all else fails
// ─────────────────────────────────────────────────────────────────────────────

window.onload = async () => {
  console.log("[Custom Patch] ⏳ window.onload fallback triggered");

  const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];
  if (!docId || docId === "o") {
    console.warn("[Custom Patch] ❌ Could not retrieve valid docId — skipping fallback.");
    return;
  }

  await runAllControls(docId);
};
