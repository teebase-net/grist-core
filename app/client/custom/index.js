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
 * - 3. Conditionally hides the Download links via the elipse icon unless the current user has
 *   `Export_Data = true` in the `SysUsers` table.
 * - Skips gracefully if table or fields are missing.
 *
 * File: /app/client/custom/index.js
 * Version: v1.0.1
 */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.0.1");

(function () {
  async function waitForDocId(maxWait = 10000) {
    const interval = 100;
    let waited = 0;

    while (waited < maxWait) {
      const docId = window?.gristDoc?.docId;
      if (docId && typeof docId === "string" && docId.length > 5) {
        return docId;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }

    console.warn("[Custom Patch] ❌ Timed out waiting for docId — skipping permission controls.");
    return null;
  }

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

  async function controlAddColumnButtons(docId) {
    const allowed = await hasUnlockStructure(docId);
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
      console.warn("Export_Data check failed — skipping share icon control.", err);
      return null;
    }
  }

  async function controlShareIcon(docId) {
    const allowed = await hasExportDataPermission(docId);
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
    const allowed = await hasExportDataPermission(docId);
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

  window.addEventListener('load', () => {
    waitForDocId().then(docId => {
      if (!docId) {
        console.warn("[Custom Patch] ❌ No valid docId — permission features not activated.");
        return;
      }
      controlAddColumnButtons(docId);
      controlShareIcon(docId);
      controlExportButtons(docId);
    });
  });
})();
