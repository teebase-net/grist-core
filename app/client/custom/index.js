/* global window document MutationObserver */
/**
 * index.js
 *
 * Custom patch script injected by Grist app.js
 *
 * 🔧 MOD DMH — June 2025:
 * - 1. Conditionally hides the “+ Add Column” button unless the current user has
 *   `Unlock_Structure = true` in the `SysUsers` table.
 * - 2. Conditionally hides the Share icon unless the current user has
 *   `Export_Data = true` in the `SysUsers` table.
 * - 3. Conditionally hides the Download links via the ellipsis icon unless the current user has
 *   `Export_Data = true` in the `SysUsers` table.
 * - Skips gracefully if table or fields are missing.
 *
 * File: /app/client/custom/index.js
 * Version: v1.2.1
 */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.2.1");

// Wait for docId with a resilient polling loop (15s timeout)
async function waitForDocId(timeout = 15000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const docId = window.gristDoc?.docId;
    if (docId && typeof docId === 'string') {
      console.log("[Custom Patch] ✅ docId found:", docId);
      return docId;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  console.warn("[Custom Patch] ❌ Timed out waiting for gristDoc.docId");
  return null;
}

(async function () {
  const docId = await waitForDocId();
  if (!docId) {
    console.warn("[Custom Patch] ❌ Could not retrieve docId — permission features not activated.");
    return;
  }

  async function hasPermission(field) {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (!res.ok) {
        console.warn(`SysUsers table missing — skipping ${field} control.`);
        return null;
      }

      const data = await res.json();
      if (!data?.id?.length || !data?.Email || !data?.[field]) {
        console.warn(`Required fields missing — skipping ${field} control.`);
        return null;
      }

      const user = Array.from({ length: data.id.length }, (_, i) => ({
        Email: data.Email[i],
        [field]: data[field][i]
      })).find(u =>
        u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
      );

      return user?.[field] === true;
    } catch (err) {
      console.warn(`${field} check failed — skipping ${field} control.`, err);
      return null;
    }
  }

  async function controlAddColumnButtons() {
    const allowed = await hasPermission('Unlock_Structure');
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

  async function controlShareIcon() {
    const allowed = await hasPermission('Export_Data');
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

  async function controlExportButtons() {
    const allowed = await hasPermission('Export_Data');
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

  // Start all checks once the page has fully loaded
  window.addEventListener('load', () => {
    controlAddColumnButtons();
    controlShareIcon();
    controlExportButtons();
  });
})();
