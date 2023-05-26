const xrPolyfillPromise = new Promise<void>((resolve) => {
    if (navigator.xr) {
        return resolve();
    }
    if ((window as any).WebXRPolyfill) {
        new (window as any).WebXRPolyfill();
        return resolve();
    } else {
        const url = "https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js";
        const s = document.createElement("script");
        s.src = url;
        document.head.appendChild(s);
        s.onload = () => {
          new (window as any).WebXRPolyfill();
          resolve();
        };
    }
});
