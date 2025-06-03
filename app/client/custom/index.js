/* global window document MutationObserver */

/**
 * index.js
 *
 * Custom patch script injected by Grist app.js
 *
 * 🔧 MOD DMH — June 2025:
 * - Adds long-polling to reliably wait for `gristDoc.docId` before applying permission-based UI controls.
 * - Hides Add Column, Share, and Download elements based on values in `SysUsers` table.
 * - Skips gracefully if table or fields are missing.
 *
 * File: /app/client/custom/index.js
 * Version: v1.2.0
 */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.2.0");

(async function () {
  // Wait up to 15 seconds for docId to be available
  async function waitForDocId(timeout = 15000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (window.gristDoc?.docId) {
        return window.gristDoc.docId;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    console.warn("[Custom Patch] ❌ Timed out waiting for gristDoc.docId");
    return null;
  }

  const docId = await waitForDocId();
  if (!docId) {
    console.warn("[Custom Patch] ❌ Could not retrieve docId — permission features not activated.");
    return;
  }

  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Check Unlock_Structure field in SysUsers                            │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  async function hasUnlockStructure() {
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

  async function controlAddColumnButtons() {
    const allowed = await hasUnlockStructure();
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

  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Check Export_Data field in SysUsers                                 │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  async function hasExportDataPermission() {
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
      console.warn("Export_Data check failed — skipping share/download control.", err);
      return null;
    }
  }

  async function controlShareIcon() {
    const allowed = await hasExportDataPermission();
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
    const allowed = await hasExportDataPermission();
    if (allowed === null) return;

    const toggle = () => {
      document.querySelectorAll('.test-download-section').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    };

    new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
    toggle();
    console.log(`[Custom Patch] Export buttons = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
  }

  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Run all controls after window load                                  │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  window.addEventListener('load', () => {
    controlAddColumnButtons();
    controlShareIcon();
    controlExportButtons();
  });
})();
