/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.5.7
 * OWNER: teebase-net (MOD DMH)
 * 📄 PERMANENT FEATURE MANIFEST & TECHNICAL DOCUMENTATION:
 * 1. VERSION LOGGING - Minimal console footprint. Identifies patch version on boot.
 * 2. WEBSOCKET SNIFFING - Proxies WebSocket.prototype.send to capture 'docId'.
 * 3. THEME ENFORCEMENT - Controlled by 'SysUsers.Theme'.
 * 4. GRIDVIEW ALIGNMENT - FIXED: 30px Precision Selector & Shadow Removal (v2.5.6).
 * 5. DEV BANNER - Injects pink (#f48fb1) safety banner for "- DEV" docs.
 * 6. DISCRETE TIMER - Sub-overlay showing real-time session remaining.
 * 7. PERMISSION & CONFIG CLOAKING - Hides UI based on 'SysUsers' permissions.
 * 8. SESSION WATCHDOG - 120s warning modal + forced logout.
 * 9. ACTION HIGHLIGHTING - Forces "Delete" menu items to pure red (#ff0000).
 * 10. FOOTER ALIGNMENT PATCH - FIXED: Removes spacer gap when frozenCount is 0.
 * 11. PATCH ENTERPRISE (ENT ONLY)
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {

    // ==========================================
    // 0. SINGLETON GUARD
    // ==========================================
    if (window._gristCustomIndexLoaded) {
        console.warn("⚠️ Custom Master Controller already loaded. Skipping duplicate execution.");
        return;
    }
    window._gristCustomIndexLoaded = true;

    // ==========================================
    // 1. VERSION LOGGING
    // ==========================================
    console.log("🚀 Custom - Grist Master Controller [v2.5.7]");


    // ==========================================
    // STABLE SANDBOX UTILITIES
    // ==========================================

    const onBody = (fn) => {
        if (document.body) return fn();
        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect();
                fn();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    };

    const safeRun = (name, fn, needsBody = false) => {
        const run = () => {
            try {
                fn();
            } catch (e) {
                console.error(`❌ Feature [${name}] failed:`, e);
            }
        };
        if (needsBody) onBody(run); else run();
    };


    // ==========================================
    // 2. WEBSOCKET SNIFFING & AUTO-LOOKUP
    // ==========================================
    const DEFAULT_TIMEOUT = 60;

    async function autoConfigurePermissions(docId) {
        try {
            console.log(`🔍 [Master Controller] Configuring doc: ${docId}`);
            const profile = await fetch("/api/profile/user", { credentials: "include" }).then(r => r.json());
            let email = profile?.email?.toLowerCase();
            console.log(`👤 [Debug] User Email identified: ${email}`);

            if ((!email || email === 'unknown') &&
                (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                email = "you@example.com";
                console.warn("⚠️ [Debug] Localhost detected, defaulting email to you@example.com");
            }

            if (!email) {
                console.error("❌ [Debug] Could not identify user email. Aborting config.");
                throw new Error("Could not identify user email.");
            }

            const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: "include" });
            if (!res.ok) {
                console.error("❌ [Debug] SysUsers table fetch failed (404/500).");
                throw new Error("SysUsers table not found.");
            }

            const data = await res.json();
            console.log("📊 [Debug] SysUsers Data:", data);

            const userIndex = data.Email?.findIndex(e => e?.toLowerCase() === email);
            console.log(`🎯 [Debug] User Index for ${email}: ${userIndex}`);

            if (userIndex === -1) {
                console.warn(`⚠️ [Debug] User ${email} not found in SysUsers. Using Defaults.`);
                window.initPermissionCloaking({ Unlock_Structure: false, Export_Data: false, Timeout_Minutes: DEFAULT_TIMEOUT });
                return;
            }

            const perms = {
                Unlock_Structure: data.Unlock_Structure?.[userIndex] === true,
                Export_Data: data.Export_Data?.[userIndex] === true,
                Timeout_Minutes: Number(data.Timeout_Minutes?.[userIndex]) || DEFAULT_TIMEOUT
            };
            console.log("✅ [Debug] Applying Permissions:", perms);

            window.initPermissionCloaking(perms);
        } catch (err) {
            console.error("🔥 [Debug] Config Exception:", err);
            window.initPermissionCloaking({ Unlock_Structure: false, Export_Data: false, Timeout_Minutes: DEFAULT_TIMEOUT });
        }
    }

    safeRun("WebSocket Sniffing", () => {
        const _originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
            try {
                const msg = JSON.parse(data);
                if (msg.method === 'openDoc') {
                    const docId = msg.args[0];
                    window._gristDocId = docId;
                    autoConfigurePermissions(docId);
                }
            } catch (e) { }
            return _originalSend.apply(this, arguments);
        };
    });


    // ==========================================
    // 3. THEME ENFORCEMENT
    // ==========================================
    window.applyGristTheme = function (theme) {
        safeRun("Theme Enforcement", () => {
            if (theme === 'dark') {
                document.body.classList.add('theme-dark');
            } else {
                document.body.classList.remove('theme-dark');
            }
        }, true);
    };


    // ==========================================
    // 4. GRIDVIEW ALIGNMENT (v2.5.6 Final)
    // ==========================================
    safeRun("Gridview Alignment", () => {
        const id = "custom-gridview-styles";
        let style = document.getElementById(id);
        if (!style) {
            style = document.createElement("style");
            style.id = id;
            document.head.appendChild(style);
        }
        style.textContent = `
            /* MOD DMH: 30px Narrow Selector - Final Preference */
            :root {
                --gridview-rownum-width: 30px !important;
            }

            /* 1. Corner Spacers and Row Numbers */
            .gridview_corner_spacer,
            .gridview_data_row_num,
            .gridview_data_corner_overlay,
            .gridview_header_corner {
                width: 30px !important;
                min-width: 30px !important;
                /* Invasion Fix: Opaque background and z-index to stay above scrolling fields */
                background-color: var(--grist-theme-table-header-bg, #f0f0f0) !important;
                z-index: 100 !important;
            }

            /* 2. Backdrop and Offset calculations */
            .gridview_header_backdrop_left {
                width: 31px !important; /* width + 1px border */
            }

            /* FIXED: Suppress distracting shadow lines, frozen divider lines, and phantom borders */
            .scroll_shadow_left,
            .scroll_shadow_frozen,
            .frozen_line,
            .gridview_left_border {
                display: none !important;
            }

            /* 3. Printing adjustments */
            @media print {
                .print-widget .gridview_data_header {
                    padding-left: 30px !important;
                }
            }

            /* 4. Sticky positioning for frozen columns */
            .record .field.frozen {
                left: calc(30px + 1px + (var(--frozen-position, 0) - var(--frozen-offset, 0)) * 1px) !important;
            }
        `;
        console.log("[Custom Patch] GridView Alignment v2.5.6: 30px Final + Shadow/Line Removal.");
    });


    // ==========================================
    // 5. DEV BANNER
    // ==========================================
    safeRun("Dev Banner", () => {
        const checkBanner = () => {
            if (document.title.includes("- DEV") && !document.getElementById('grist-dev-banner')) {
                const banner = document.createElement('div');
                banner.id = 'grist-dev-banner';
                banner.style = "height:14px; background:#f48fb1; width:100%; position:fixed; top:0; z-index:10000; pointer-events:none; color:white; font-family:sans-serif; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; text-transform:uppercase; letter-spacing:1px;";
                banner.innerText = "DEVELOPMENT MODE";
                document.body.prepend(banner);
            }
        };
        const bannerObserver = new MutationObserver(checkBanner);
        bannerObserver.observe(document.head, { childList: true, subtree: true });
        checkBanner();
    });


    // ==========================================
    // 6. DISCRETE TIMER
    // ==========================================
    safeRun("Discrete Timer", () => {
        const timerDiv = document.createElement('div');
        timerDiv.id = 'grist-session-timer';
        timerDiv.style = "position:fixed; bottom:4px; right:20px; font-family:inherit; font-size:11px; font-weight:500; pointer-events:none; z-index:9999; color:#8f8f8f; opacity:0.9;";
        document.body.appendChild(timerDiv);

        window.updateGristTimer = function (secondsLeft) {
            if (secondsLeft < 0) secondsLeft = 0;
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            timerDiv.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
    }, true);


    // ==========================================
    // 7. PERMISSION & CONFIG CLOAKING
    // ==========================================
    window.initPermissionCloaking = function (perms) {
        safeRun("Permission Cloaking", () => {
            const oldCloak = document.getElementById('grist-permission-cloak');
            if (oldCloak) oldCloak.remove();
            const cloakStyle = document.createElement('style');
            cloakStyle.id = 'grist-permission-cloak';
            let css = '';
            if (perms.Unlock_Structure === false) {
                css += '.mod-add-column, .test-tb-share, .anc-btn, .test-ui-add-column { display: none !important; }';
            }
            if (perms.Export_Data === false) {
                css += '.test-download-section, .mod-export, .test-ui-download { display: none !important; }';
            }
            cloakStyle.innerHTML = css;
            document.head.appendChild(cloakStyle);

            if (perms.Timeout_Minutes && window.updateGristTimeout) {
                window.updateGristTimeout(perms.Timeout_Minutes);
            }
        });
    };


    // ==========================================
    // 8. SESSION WATCHDOG
    // ==========================================
    safeRun("Session Watchdog", () => {
        let timeoutSecs = 3600; // Default 60 mins
        let warningThreshold = 120;
        let startTime = Date.now();

        window.updateGristTimeout = (mins) => {
            const newTimeout = parseInt(mins) * 60;
            if (!isNaN(newTimeout) && newTimeout > 0) timeoutSecs = newTimeout;
        };

        const resetTimer = () => { startTime = Date.now(); };
        window.addEventListener('click', resetTimer, true);
        window.addEventListener('keydown', resetTimer, true);

        if (window._gristSessionInterval) clearInterval(window._gristSessionInterval);

        window._gristSessionInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = timeoutSecs - elapsed;
            if (typeof window.updateGristTimer === 'function') window.updateGristTimer(remaining);

            if (remaining <= warningThreshold && remaining > 0) {
                let modal = document.getElementById('watchdog-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'watchdog-modal';
                    modal.style = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:520px; background:#ff9800; color:white; padding:40px 20px; text-align:center; z-index:20000; font-family:sans-serif; border-radius:24px; box-shadow:0 20px 60px rgba(0,0,0,0.4); display:flex; flex-direction:column; align-items:center; justify-content:center; letter-spacing: 0.5px; pointer-events: auto;";
                    modal.innerHTML = `
                        <div style="font-size: 48px; font-weight: bold; margin-bottom: 20px;">Session Expiring</div>
                        <div style="font-size: 22px; font-weight: 500; opacity: 0.9;">You will be logged out due to inactivity in:</div>
                        <div id="watchdog-display" style="font-size: 80px; font-weight: 500; margin: 10px 0;">0:00</div>
                        <div style="font-size: 22px; font-weight: 500; opacity: 0.9;">Click to stay logged in</div>
                    `;
                    document.body.appendChild(modal);
                }
                const display = document.getElementById('watchdog-display');
                if (display) {
                    const m = Math.floor(remaining / 60);
                    const s = remaining % 60;
                    display.innerText = `${m}:${s.toString().padStart(2, '0')}`;
                }
            } else if (remaining <= 0) {
                window.location.href = '/logout';
            } else {
                const modal = document.getElementById('watchdog-modal');
                if (modal) modal.remove();
            }
        }, 1000);
    }, true);


    // ==========================================
    // 9. ACTION HIGHLIGHTING
    // ==========================================
    safeRun("Action Highlighting", () => {
        const style = document.createElement('style');
        style.innerHTML = `
            .grist-delete-active, 
            .grist-delete-active *,
            .test-cmd-name[class*="delete"],
            .test-menu-item-delete-record,
            .test-menu-item-delete-widget { 
                color: #ff0000 !important; 
            }
            .grist-delete-active-bold { font-weight: bold !important; }
        `;
        document.head.appendChild(style);

        const highlightDelete = () => {
            document.querySelectorAll('.test-cmd-name').forEach(span => {
                if (span.innerText.trim().toLowerCase().includes("delete")) {
                    const item = span.closest('.weasel-menu-item, [role="menuitem"], li');
                    if (item) {
                        item.classList.add('grist-delete-active');
                        if (span.innerText.toLowerCase().includes("widget")) item.classList.add('grist-delete-active-bold');
                    }
                }
            });
        };
        const observer = new MutationObserver(highlightDelete);
        observer.observe(document.body, { childList: true, subtree: true });
        ['mousedown', 'contextmenu', 'click'].forEach(e => document.addEventListener(e, () => setTimeout(highlightDelete, 20)));
    }, true);


    // ==========================================
    // 10. FOOTER ALIGNMENT PATCH
    // ==========================================
    safeRun("Footer Alignment", () => {
        const style = document.createElement('style');
        style.innerHTML = `
            .gridview_footer_spacer { display: none !important; width: 0px !important; }
            .has-frozen-pane .gridview_footer_spacer { display: block !important; width: 30px !important; }
        `;
        document.head.appendChild(style);
        const footerObserver = new MutationObserver(() => {
            const footer = document.querySelector('.gridview_footer');
            if (footer) {
                if (document.querySelector('.gridview_header.frozen')) footer.classList.add('has-frozen-pane');
                else footer.classList.remove('has-frozen-pane');
            }
        });
        footerObserver.observe(document.body, { childList: true, subtree: true });
    }, true);

    // ==========================================
    // 11. PATCH ENTERPRISE (ENT ONLY)
    // ==========================================
    safeRun("Enterprise Patch Loader", () => {
        // Use optional chaining to safely check edition
        const isEnterprise = window.gristConfig?.edition === 'enterprise';

        if (!isEnterprise) return;

        console.log("🚀 Custom - Enterprise detected. Initializing LayoutTray patch...");

        const script = document.createElement('script');
        script.src = '/static/your_compiled_layout_tray.js'; 
        script.onerror = () => console.error("❌ Custom - Failed to load LayoutTray patch.");
        document.head.appendChild(script);
    });
 
})();
