"use strict";

/*===================================================================================
  Custom Patch: Conditional visibility of “Add Column” button
  File: custom/index.js
  Applied: 2025-05-05
  Purpose:
    Hides the “+” Add Column button unless the logged-in user has `Unlock_Structure = true`
    in the SysUsers table. If table or field missing, the entire logic is skipped.

  Version: v0.4
===================================================================================*/

console.log("[Custom JS] index.js loaded ✅ v0.4");

(function () {
  const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];

  async function hasUnlockStructure() {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());

      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (!res.ok) {
        console.warn("SysUsers table missing or inaccessible — skipping control logic.");
        return null;
      }

      const data = await res.json();
      const rowCount = data?.id?.length;
      if (!rowCount || !data?.Unlock_Structure || !data?.Email) {
        console.warn("Unlock_Structure or Email column missing — skipping control logic.");
        return null;
      }

      const records = Array.from({ length: rowCount }, (_, i) => {
        const row = {};
        for (const field in data) {
          row[field] = data[field][i];
        }
        return row;
      });

      const user = records.find(
        u => u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
      );

      return user?.Unlock_Structure === true;
    } catch (err) {
      console.warn("Unlock_Structure check failed — skipping control logic.", err);
      return null;
    }
  }

  async function controlAddColumnButtons() {
    const allowed = await hasUnlockStructure();

    // Explicitly skip logic if table or field not found
    if (allowed === null) return;

    const observer = new MutationObserver(() => {
      document.querySelectorAll('.mod-add-column').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.querySelectorAll('.mod-add-column').forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });

    console.log(`[Custom JS] Unlock_Structure = ${allowed}`);
  }

  window.addEventListener('load', () => {
    setTimeout(controlAddColumnButtons, 1500);
  });
})();
