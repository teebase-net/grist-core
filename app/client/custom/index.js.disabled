"use strict";

/*===================================================================================
  Custom Patch: Conditional visibility of “Add Column” button
  File: custom/index.js
  Applied: 2025-05-06
  Purpose:
    Hides the “+” Add Column button unless the logged-in user has `Unlock_Structure = true`
    in the SysUsers table. If table or fields are missing, skips all logic entirely.

  Version: v0.5 (corrected)
===================================================================================*/

console.log("[Custom JS] index.js loaded ✅ v0.5");

(function () {
  const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];

  async function hasUnlockStructure() {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (!res.ok) {
        console.warn("SysUsers table missing — skipping control logic.");
        return null;
      }

      const data = await res.json();
      if (!data?.id?.length || !data?.Email || !data?.Unlock_Structure) {
        console.warn("Required fields missing — skipping control logic.");
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
      console.warn("Unlock_Structure check failed — skipping control logic.", err);
      return null;
    }
  }

  async function controlAddColumnButtons() {
    const allowed = await hasUnlockStructure();
    if (allowed === null) return; // Skip everything if check not valid

    const toggle = () => {
      document.querySelectorAll('.mod-add-column').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    };

    new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
    toggle();

    console.log(`[Custom JS] Unlock_Structure = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
  }

  window.addEventListener('load', () => {
    setTimeout(controlAddColumnButtons, 1500);
  });
})();
