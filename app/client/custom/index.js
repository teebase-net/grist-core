/* global window document MutationObserver */
/**
 * index.js
 *
 * Custom patch script injected by Grist app.js
 *
 * 🔧 MOD DMH — June 2025:
 * - v1.3.0: Triggers permission control logic only after doc is fully loaded by hooking into GristWSConnection.onmessage.
 * - Hides:
 *   • “+ Add Column” unless SysUsers.Unlock_Structure = true
 *   • Share icon unless SysUsers.Export_Data = true
 *   • Download buttons unless SysUsers.Export_Data = true
 * - Skips gracefully if user or table not found.
 */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.3.0");

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Unlock_Structure permission check                                   │
 * └─────────────────────────────────────────────────────────────────────┘
 */
async function hasUnlockStructure(docId) {
  try {
    const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
    const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

    if (!res.ok) {
      console.warn("SysUsers table missing — skipping structure control.");
      return null;
    }

    const data = await res.json();
    if (!data?.id?.length || !data?.Email || !data?.Unlock_Structure) {
      console.warn("Required fields missing — skipping structure control.");
      return null;
    }

    const user = Array.from({ length: data.id.length }, (_, i) => ({
      Email: data.Email[i],
      Unlock_Structure: data.Unlock_Structure[i]
    })).find(u =>
      u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
    );

    return user?.Unlock_Structure === true;
  } catch (err) {
    console.warn("Unlock_Structure check failed — skipping structure control.", err);
    return null;
  }
}

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Export_Data permission check                                        │
 * └─────────────────────────────────────────────────────────────────────┘
 */
async function hasExportDataPermission(docId) {
  try {
    const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
    const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

    if (!res.ok) {
      console.warn("SysUsers table missing — skipping export control.");
      return null;
    }

    const data = await res.json();
    if (!data?.id?.length || !data?.Email || !data?.Export_Data) {
      console.warn("Required fields missing — skipping export control.");
      return null;
    }

    const user = Array.from({ length: data.id.length }, (_, i) => ({
      Email: data.Email[i],
      Export_Data: data.Export_Data[i]
    })).find(u =>
      u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
    );

    return user?.Export_Data === true;
  } catch (err) {
    console.warn("Export_Data check failed — skipping export control.", err);
    return null;
  }
}

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ DOM togglers                                                        │
 * └─────────────────────────────────────────────────────────────────────┘
 */
function toggleElements(selector, allowed) {
  document.querySelectorAll(selector).forEach(el => {
    el.style.display = allowed ? '' : 'none';
  });
}

function observeAndToggle(selector, allowed) {
  const toggle = () => toggleElements(selector, allowed);
  new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
  toggle();
}

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Main control handlers                                               │
 * └─────────────────────────────────────────────────────────────────────┘
 */
async function controlAddColumnButtons(docId) {
  const allowed = await hasUnlockStructure(docId);
  if (allowed === null) return;
  observeAndToggle('.mod-add-column', allowed);
  console.log(`[Custom Patch] Unlock_Structure = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}

async function controlShareIcon(docId) {
  const allowed = await hasExportDataPermission(docId);
  if (allowed === null) return;
  observeAndToggle('.test-tb-share', allowed);
  console.log(`[Custom Patch] Share icon = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}

async function controlExportButtons(docId) {
  const allowed = await hasExportDataPermission(docId);
  if (allowed === null) return;
  observeAndToggle('.test-download-section', allowed);
  console.log(`[Custom Patch] Export_Data for downloads = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}

function runAllControls(docId) {
  controlAddColumnButtons(docId);
  controlShareIcon(docId);
  controlExportButtons(docId);
}

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Hook into Grist WebSocket openDoc lifecycle                         │
 * └─────────────────────────────────────────────────────────────────────┘
 */
if (window.GristWSConnection?.prototype?.onmessage) {
  const originalOnMessage = window.GristWSConnection.prototype.onmessage;

  window.GristWSConnection.prototype.onmessage = function(event) {
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
} else {
  console.warn("[Custom Patch] ⚠️ GristWSConnection not found — cannot hook openDoc");
}

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Backup fallback: run after window load                              │
 * └─────────────────────────────────────────────────────────────────────┘
 */
window.addEventListener('load', () => {
  const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];
  if (docId) {
    console.log("[Custom Patch] ⏳ window.onload fallback triggered");
    runAllControls(docId);
  }
});
