# Directive: Custom UI Development (Stable Sandbox)

This SOP defines the technical architecture for the Grist "Master Controller" (`static/custom_index.js`). The goal is to ensure that custom UI features are isolated, stable, and do not cause cascading failures.

## Core Principle: Stability through Isolation

Every feature added to `custom_index.js` must be wrapped in a safety boundary. This prevents a bug in one feature (e.g., a null reference in a timer) from breaking other unrelated features (e.g., theme enforcement).

---

## 1. The Standard Boilerplate

Always initialize the `custom_index.js` with the following safety utilities:

```javascript
(function() {
    "use strict";

    // 1. VERSION LOGGING
    console.log("🚀 Custom - Grist Master Controller [vX.Y.Z]");

    // 2. DOM GUARD: Waits for document.body to exist
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

    // 3. SAFE RUNNER: Isolates execution and handles errors
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

    // ... Features go here ...
})();
```

## 2. Feature Implementation Rules

1.  **Use `safeRun`**: Every distinct feature must be called via `safeRun("Feature Name", function() { ... }, needsBody)`.
2.  **Explicit Body Requirement**: If a feature touches the DOM (e.g., `document.body`, `document.getElementById`), set `needsBody` to `true`.
3.  **Local Scope**: Use Immediately Invoked Function Expressions (IIFE) or inner functions to avoid polluting the global window object unless explicitly required.
4.  **No Cascading Errors**: Never let an error propagate outside of the feature's function scope.

## 3. Example Feature

```javascript
safeRun("Dev Banner", () => {
    if (document.title.includes("- DEV")) {
        const banner = document.createElement('div');
        banner.style = "height:10px; background:pink; width:100%; position:fixed; top:0;";
        document.body.prepend(banner);
    }
}, true); // true because it needs the body
```

## 4. Maintenance

- When adding a feature, update the Version number in the log.
- Document the new feature in `directives/feature_manifest.md`.
