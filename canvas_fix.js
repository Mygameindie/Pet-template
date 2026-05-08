// canvas_fix.js
// Auto-resize canvas correctly for portrait & landscape
// Keeps rendering sharp using devicePixelRatio

(function () {
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Set internal resolution
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    // Set visible size
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";

    // Prevent blur
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Optional callback for your game
    if (typeof window.onGameResize === "function") {
      window.onGameResize(cssWidth, cssHeight);
    }
  }

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);

  resizeCanvas();
})();