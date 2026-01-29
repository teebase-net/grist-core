/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.3.9-Modular
 * OWNER: teebase-net (MOD DMH)
 * 📄 PERMANENT FEATURE MANIFEST & TECHNICAL DOCUMENTATION:
 * 1. VERSION LOGGING - Minimal console footprint. Identifies patch version on boot.
 * 2. WEBSOCKET SNIFFING - Proxies WebSocket.prototype.send to capture 'docId'.
 * 3. THEME ENFORCEMENT - Controlled by 'SysUsers.Theme'.
 * 4. GRIDVIEW ALIGNMENT - FIXED: Resets frozen header label/button offsets.
 * 5. DEV BANNER - Injects pink (#f48fb1) safety banner for "- DEV" docs.
 * 6. DISCRETE TIMER - Sub-overlay showing real-time session remaining.
 * 7. PERMISSION & CONFIG CLOAKING - Hides UI based on 'SysUsers' permissions.
 * 8. SESSION WATCHDOG - 120s warning modal + forced logout.
 * 9. ACTION HIGHLIGHTING - Forces "Delete" menu items to bold red (#f97583).
 * 10. FOOTER ALIGNMENT PATCH - FIXED: Removes spacer gap when frozenCount is 0.
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function() {

    // ==========================================
    // 1. VERSION LOGGING
    // ==========================================
    console.log("🚀 Grist Master Controller [v2.3.9-Modular] Active");


    // ==========================================
    // 2. WEBSOCKET SNIFFING
    // ==========================================
    (function initWebsocketSniffer() {
        const _originalSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function(data) {
            try {
                const msg = JSON.parse(data);
                if (msg.method === 'openDoc') {
                    window._gristDocId = msg.args[0];
                    window.dispatchEvent(new CustomEvent('gristDocIdCaptured', { detail: msg.args[0] }));
                }
            } catch (e) {}
            return _originalSend.apply(this, arguments);
        };
    })();


    // ==========================================
    // 3. THEME ENFORCEMENT
    // ==========================================
    window.applyGristTheme = function(theme) {
        if (theme === 'dark') {
            document.body.classList.add('theme-dark');
        } else {
            document.body.classList.remove('theme-dark');
        }
    };


// ==========================================
    // 4. GRIDVIEW ALIGNMENT (30px Snap)
    // ==========================================
    (function initGridviewAlignment() {
        const style = document.createElement('style');
        style.id = 'grist-alignment-snap-30';
        style.innerHTML = `
            /* Narrow the record selector / row number column to 30px */
            .gridview_row_num, 
            .gridview_row_num_header,
            .record-selector-column {
                width: 30px !important;
                min-width: 30px !important;
                max-width: 30px !important;
                flex: 0 0 30px !important;
            }

            /* Adjust the frozen pane offset to match the new 30px width */
            .gridview_data_pane_container {
                --frozen-width-prefix: 30;
            }

            /* Fix Header Label Alignment within the now-narrower frozen context */
            .gridview_header.frozen .gridview_header_content {
                padding-left: 8px !important;
                margin-left: 0 !important;
            }
        `;
        document.head.appendChild(style);
    })();


    // ==========================================
    // 5. DEV BANNER
    // ==========================================
    (function initDevBanner() {
        const checkBanner = () => {
            if (document.title.includes("- DEV") && !document.getElementById('grist-dev-banner')) {
                const banner = document.createElement('div');
                banner.id = 'grist-dev-banner';
                banner.style = "height:10px; background:#f48fb1; width:100%; position:fixed; top:0; z-index:10000; pointer-events:none;";
                document.body.prepend(banner);
            }
        };
        const bannerObserver = new MutationObserver(checkBanner);
        bannerObserver.observe(document.head, { childList: true, subtree: true });
        checkBanner();
    })();


    // ==========================================
    // 6. DISCRETE TIMER
    // ==========================================
    (function initDiscreteTimer() {
        const timerDiv = document.createElement('div');
        timerDiv.id = 'grist-session-timer';
        timerDiv.style = "position:fixed; bottom:10px; right:10px; font-family:monospace; font-size:12px; pointer-events:none; opacity:0.7; z-index:9999; color:inherit;";
        document.body.appendChild(timerDiv);

        window.updateGristTimer = function(secondsLeft) {
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            timerDiv.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
    })();


    // ==========================================
    // 7. PERMISSION & CONFIG CLOAKING
    // ==========================================
    window.initPermissionCloaking = function(perms) {
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
    };


    // ==========================================
    // 8. SESSION WATCHDOG
    // ==========================================
    (function initSessionWatchdog() {
        let timeoutSecs = 1800; // Default 30m
        let warningThreshold = 120;
        let startTime = Date.now();

        const resetTimer = () => { startTime = Date.now(); };
        ['mousedown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, resetTimer));

        setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = timeoutSecs - elapsed;

            if (typeof window.updateGristTimer === 'function') window.updateGristTimer(remaining);

            if (remaining <= warningThreshold && remaining > 0) {
                let modal = document.getElementById('watchdog-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'watchdog-modal';
                    modal.style = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:500px; background:orange; color:white; padding:40px; text-align:center; z-index:20000; font-weight:bold; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5);";
                    modal.innerText = "SESSION EXPIRING SOON - MOVE MOUSE TO EXTEND";
                    document.body.appendChild(modal);
                }
            } else if (remaining <= 0) {
                window.location.href = '/logout';
            } else {
                const modal = document.getElementById('watchdog-modal');
                if (modal) modal.remove();
            }
        }, 1000);
    })();


// ==========================================
    // 9. ACTION HIGHLIGHTING
    // ==========================================
    (function initActionHighlighting() {
        document.addEventListener('contextmenu', () => {
            // Delay ensures the context menu is fully rendered in the DOM
            setTimeout(() => {
                const menuItems = document.querySelectorAll('.dropdown-menu li, .context_menu li, .test-context-menu-item, .v-menu__content li');
                menuItems.forEach(item => {
                    const text = item.innerText.toLowerCase();
                    // Targets "Delete", "Delete Widget", "Delete Row", etc.
                    if (text.includes("delete")) {
                        item.style.setProperty('color', '#f97583', 'important');
                        item.style.setProperty('font-weight', 'bold', 'important');
                        
                        // Ensure children (spans/divs) inherit the red color
                        const children = item.querySelectorAll('*');
                        children.forEach(child => child.style.setProperty('color', '#f97583', 'important'));
                    }
                });
            }, 50);
        });
    })();


    // ==========================================
    // 10. FOOTER ALIGNMENT PATCH
    // ==========================================
    (function initFooterPatch() {
        const style = document.createElement('style');
        style.innerHTML = `
            .gridview_footer_spacer {
                display: none !important;
                width: 0px !important;
            }
            .has-frozen-pane .gridview_footer_spacer {
                display: block !important;
                width: 30px !important;
            }
        `;
        document.head.appendChild(style);

        const footerObserver = new MutationObserver(() => {
            const frozenHeader = document.querySelector('.gridview_header.frozen');
            const footer = document.querySelector('.gridview_footer');
            if (footer) {
                if (frozenHeader) {
                    footer.classList.add('has-frozen-pane');
                } else {
                    footer.classList.remove('has-frozen-pane');
                }
            }
        });
        footerObserver.observe(document.body, { childList: true, subtree: true });
    })();

})();
