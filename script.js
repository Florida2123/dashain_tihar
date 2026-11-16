/**
 * PETALS, TIKA AND DIYAS · FESTIVAL DIARY JAVASCRIPT
 * Author: Suruchi Gurung (Class 10)
 * Description: Vanilla JS Engine, Live Settings, Canvas Blossom Simulation,
 *              Dynamic Memory Wall, Draggable Rail & Accessible Lightbox.
 */

(function () {
  "use strict";

  /* ==========================================================================
     1. GLOBAL SETTINGS STORE & PERSISTENCE
     ========================================================================== */
  var STORAGE_KEY = "festival-diary-v2";

  var DEFAULT_SETTINGS = {
    look: "default",
    theme: "light", // 'light' | 'dark'
    accent: "sakura", // 'sakura' | 'makhamali' | 'sayapatri' | 'tika' | 'lilac' | 'custom'
    customAccent: "#BE3569",
    font: "editorial", // 'editorial' | 'modern' | 'soft'
    grain: false,
    petals: true,
    petalAmount: 32, // 0 to 100
    petalSpeed: 1.0, // 0.3 to 2.0
    petalSize: 1.0, // 0.6 to 1.8
    petalWind: 0, // -100 to 100
    petalColor: "mixed", // 'sakura' | 'pearl' | 'sayapatri' | 'mixed'
    textSize: "normal", // 'small' | 'normal' | 'large'
    marginNotes: true,
    wallLayout: "masonry", // 'masonry' | 'grid'
    motion: "full", // 'full' | 'calm' | 'off'
    cursor: true,
  };

  var settings = Object.assign({}, DEFAULT_SETTINGS);
  var subscribers = [];

  function loadSettings() {
    try {
      localStorage.removeItem("festival-diary-v1");
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.theme === "auto") parsed.theme = "light";
        settings = Object.assign({}, DEFAULT_SETTINGS, parsed);
      }
    } catch (e) {
      console.warn("Local storage unavailable. Using default settings.");
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function updateSetting(key, value) {
    settings[key] = value;
    saveSettings();
    notifySubscribers(key, value);
  }

  function subscribe(fn) {
    subscribers.push(fn);
  }

  function notifySubscribers(key, value) {
    for (var i = 0; i < subscribers.length; i++) {
      subscribers[i](key, value, settings);
    }
  }

  /* ==========================================================================
     2. DOM ATTRIBUTES & CSS VARIABLES SYNC
     ========================================================================== */
  var doc = document.documentElement;

  function syncDOMWithSettings() {
    doc.setAttribute("data-theme", settings.theme);
    doc.setAttribute("data-accent", settings.accent);
    if (settings.accent === "custom") {
      doc.style.setProperty("--color-accent-custom", settings.customAccent);
    }
    doc.setAttribute("data-font", settings.font);
    doc.setAttribute("data-size", settings.textSize);
    doc.setAttribute("data-grain", settings.grain ? "true" : "false");
    doc.setAttribute("data-notes", settings.marginNotes ? "true" : "false");
    doc.setAttribute("data-wall", settings.wallLayout);
    doc.setAttribute("data-motion", settings.motion);
    doc.setAttribute("data-cursor", settings.cursor ? "true" : "false");

    // Update Theme Color Meta Tag
    var metaTheme = document.getElementById("meta-theme-color");
    if (metaTheme) {
      var isDark = settings.theme === "dark";
      metaTheme.setAttribute("content", isDark ? "#0E0D12" : "#FFF7F9");
    }
  }

  subscribe(function () {
    syncDOMWithSettings();
  });

  /* Calculate Contrast Ratio for Custom Accent */
  function getLuminance(hex) {
    var rgb = parseInt(hex.slice(1), 16);
    var r = (rgb >> 16) & 0xff;
    var g = (rgb >> 8) & 0xff;
    var b = (rgb >> 0) & 0xff;
    var a = [r, g, b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function checkAccentContrast(hex) {
    var notice = document.getElementById("contrast-notice");
    if (!notice) return;
    try {
      var lumAccent = getLuminance(hex);
      var lumBg =
        settings.theme === "dark"
          ? getLuminance("#0E0D12")
          : getLuminance("#FFF7F9");
      var brightest = Math.max(lumAccent, lumBg);
      var darkest = Math.min(lumAccent, lumBg);
      var ratio = (brightest + 0.05) / (darkest + 0.05);

      if (ratio < 3.2) {
        notice.hidden = false;
      } else {
        notice.hidden = true;
      }
    } catch (err) {
      notice.hidden = true;
    }
  }

  /* ==========================================================================
     3. INTRO CURTAIN & ORCHESTRATION
     ========================================================================== */
  function initIntroCurtain() {
    var curtain = document.getElementById("intro-curtain");
    var hero = document.getElementById("home");
    if (!curtain) return;

    var prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    var hasVisited = false;
    try {
      hasVisited = sessionStorage.getItem("visited-festival-diary") === "true";
    } catch (e) {}

    function liftCurtain() {
      if (curtain.classList.contains("is-lifted")) return;
      curtain.classList.add("is-lifted");
      try {
        sessionStorage.setItem("visited-festival-diary", "true");
      } catch (e) {}
      if (hero) {
        setTimeout(function () {
          hero.classList.add("is-revealed");
        }, 150);
      }
    }

    if (prefersReduced || hasVisited || settings.motion === "off") {
      curtain.classList.add("is-lifted");
      if (hero) hero.classList.add("is-revealed");
      return;
    }

    // Auto-lift curtain after 1.4s or instantly on interaction
    var curtainTimer = setTimeout(liftCurtain, 1400);
    curtain.addEventListener("click", function () {
      clearTimeout(curtainTimer);
      liftCurtain();
    });
  }

  /* ==========================================================================
     4. PETAL BLOSSOM ENGINE (CANVAS SIMULATION)
     ========================================================================== */
  var bgCanvas, bgCtx, fgCanvas, fgCtx;
  var petalsList = [];
  var animFrameId = null;
  var lastFrameTime = performance.now();
  var mousePos = { x: -1000, y: -1000 };
  var scrollVelocity = 0;
  var lastScrollY = window.scrollY;
  var tiharBlendRatio = 0; // 0 (pure dashain sakura) to 1 (tihar sayapatri)

  // Pre-rendered offscreen sprite cache: 4 palettes x 3 depth tiers
  var spriteCache = {};

  function createPetalSprite(palette, depthTier) {
    var size = depthTier === 0 ? 32 : depthTier === 1 ? 48 : 64;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    var cx = size / 2;
    var cy = size / 2;
    var r = size * 0.42;

    // Palette Colors
    var startColor, endColor, veinColor;
    if (palette === "sakura") {
      startColor = "#FFE8F0";
      endColor = depthTier === 0 ? "#FFA8C5" : "#FF80A8";
      veinColor = "rgba(255, 255, 255, 0.45)";
    } else if (palette === "pearl") {
      startColor = "#FFFFFF";
      endColor = depthTier === 0 ? "#FCE4EC" : "#F8BBD0";
      veinColor = "rgba(255, 255, 255, 0.6)";
    } else if (palette === "sayapatri") {
      startColor = "#FFF5CC";
      endColor = depthTier === 0 ? "#FFC72C" : "#FFAE1A";
      veinColor = "rgba(255, 255, 255, 0.5)";
    } else {
      // mixed
      startColor = "#FFEEDA";
      endColor = "#FF94B8";
      veinColor = "rgba(255, 255, 255, 0.5)";
    }

    var grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    grad.addColorStop(0, startColor);
    grad.addColorStop(1, endColor);

    ctx.save();
    ctx.translate(cx, cy);

    // Draw realistic sakura petal shape with notched tip
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(
      -r * 0.7,
      r * 0.6,
      -r * 0.85,
      -r * 0.2,
      -r * 0.4,
      -r * 0.8,
    );
    ctx.bezierCurveTo(-r * 0.2, -r * 0.95, -r * 0.05, -r * 0.75, 0, -r * 0.65); // notch
    ctx.bezierCurveTo(
      r * 0.05,
      -r * 0.75,
      r * 0.2,
      -r * 0.95,
      r * 0.4,
      -r * 0.8,
    );
    ctx.bezierCurveTo(r * 0.85, -r * 0.2, r * 0.7, r * 0.6, 0, r * 0.9);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle center vein
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.quadraticCurveTo(0, 0, 0, -r * 0.55);
    ctx.strokeStyle = veinColor;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.stroke();

    ctx.restore();
    return canvas;
  }

  function initSprites() {
    var palettes = ["sakura", "pearl", "sayapatri", "mixed"];
    for (var p = 0; p < palettes.length; p++) {
      var pal = palettes[p];
      spriteCache[pal] = [
        createPetalSprite(pal, 0), // Far (small, soft)
        createPetalSprite(pal, 1), // Mid
        createPetalSprite(pal, 2), // Near (large, sharp)
      ];
    }
  }

  function Petal(isForeground) {
    this.fg = !!isForeground;
    this.reset(true);
  }

  Petal.prototype.reset = function (initial) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    this.z = this.fg
      ? 0.85 + Math.random() * 0.15
      : 0.35 + Math.random() * 0.55;
    this.x = Math.random() * w;
    this.y = initial ? Math.random() * h : -40 - Math.random() * 40;
    this.baseSize = this.fg ? 36 + Math.random() * 18 : 18 + Math.random() * 16;
    this.rot = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.02;
    this.flipPhase = Math.random() * Math.PI * 2;
    this.flipSpeed = 0.015 + Math.random() * 0.03;
    this.swayAmp = 20 + Math.random() * 40;
    this.swayFreq = 0.001 + Math.random() * 0.0015;
    this.phase = Math.random() * Math.PI * 2;
    this.fallSpeed = 0.7 + Math.random() * 0.9;
    this.burstVx = 0;
    this.burstVy = 0;
  };

  var lastCanvasW = window.innerWidth;
  var lastCanvasH = window.innerHeight;

  function isLowEndDevice() {
    var hasSaveData = navigator.connection && navigator.connection.saveData;
    var lowConcurrency =
      navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    return !!(hasSaveData || lowConcurrency);
  }

  function updatePetalsCount() {
    if (
      !settings.petals ||
      settings.petalAmount === 0 ||
      settings.motion === "off"
    ) {
      petalsList = [];
      return;
    }

    var w = window.innerWidth;
    var maxBudget = 80;
    if (w < 700) {
      maxBudget = 30; // Phone budget
    } else if (w < 1024) {
      maxBudget = 55; // Tablet budget
    }

    if (isLowEndDevice()) {
      maxBudget = Math.round(maxBudget * 0.65);
    }

    var targetCount = Math.round(maxBudget * (settings.petalAmount / 50));
    var isMobile = w < 700;

    // Remove foreground petals if on mobile
    if (isMobile) {
      petalsList = petalsList.filter(function (p) {
        return !p.fg;
      });
    }

    var currentCount = petalsList.length;
    if (currentCount < targetCount) {
      for (var i = currentCount; i < targetCount; i++) {
        petalsList.push(new Petal(false));
      }
      if (!isMobile) {
        var fgCount = petalsList.filter(function (p) {
          return p.fg;
        }).length;
        while (fgCount < 6) {
          petalsList.push(new Petal(true));
          fgCount++;
        }
      }
    } else if (currentCount > targetCount) {
      petalsList.length = targetCount;
    }
  }

  var TARGET_FPS = 45;
  var FRAME_INTERVAL = 1000 / TARGET_FPS; // ~22.2ms cap to avoid 120-144fps GPU drain

  function resizeCanvases() {
    if (!bgCanvas || !fgCanvas) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dpr = 1; // Petals are soft 48px pre-rendered shapes; 1x DPR cuts pixel fill-rate by 75% on Retina/4K screens

    bgCanvas.width = w * dpr;
    bgCanvas.height = h * dpr;
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (w < 700) {
      // Skip foreground canvas entirely on mobile to save memory & composite passes
      fgCanvas.width = 0;
      fgCanvas.height = 0;
    } else {
      fgCanvas.width = w * dpr;
      fgCanvas.height = h * dpr;
      fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    updatePetalsCount();
  }

  function spawnBloomBurst(originX, originY, count) {
    if (!settings.petals || settings.motion === "off") return;
    count = count || 14;
    for (var i = 0; i < count; i++) {
      var p = new Petal(Math.random() > 0.7);
      p.x = originX;
      p.y = originY;
      var angle = Math.random() * Math.PI * 2;
      var speed = 3.5 + Math.random() * 5.5;
      p.burstVx = Math.cos(angle) * speed;
      p.burstVy = Math.sin(angle) * speed - 1.5;
      petalsList.push(p);
    }
  }

  function runPetalLoop(now) {
    animFrameId = requestAnimationFrame(runPetalLoop);

    if (
      document.hidden ||
      !settings.petals ||
      settings.motion === "off" ||
      petalsList.length === 0
    ) {
      return;
    }

    var elapsed = now - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
      return;
    }
    var dt = Math.min(elapsed, 50);
    lastFrameTime = now - (elapsed % FRAME_INTERVAL);

    var w = window.innerWidth;
    var h = window.innerHeight;
    bgCtx.clearRect(0, 0, w, h);
    if (w >= 700) {
      fgCtx.clearRect(0, 0, w, h);
    }

    // Scroll Velocity Decay
    scrollVelocity *= 0.94;
    var effectiveScrollBoost = Math.min(scrollVelocity * 0.08, 3.5);

    // Global Wind Force
    var windForce = settings.petalWind * 0.018;

    // Active Color Palette Selection
    var palette = settings.petalColor;
    if (palette === "mixed") {
      palette = tiharBlendRatio > 0.5 ? "sayapatri" : "sakura";
    }

    var sprites = spriteCache[palette] || spriteCache.sakura;
    var dtNorm = dt / 16.66;

    for (var i = 0; i < petalsList.length; i++) {
      var p = petalsList[i];
      if (p.fg && w < 700) continue; // Skip foreground petals on mobile
      var ctx = p.fg ? fgCtx : bgCtx;

      // Mouse Pointer Wake Push (fast distSq check avoids Math.hypot on 99% of petals)
      var dx = p.x - mousePos.x;
      var dy = p.y - mousePos.y;
      var distSq = dx * dx + dy * dy;
      if (distSq < 25600 && distSq > 0) {
        var dist = Math.sqrt(distSq);
        var pushForce = (1 - dist / 160) * 1.8;
        p.x += (dx / dist) * pushForce;
        p.y += (dy / dist) * pushForce;
      }

      // Handle Burst Velocities
      if (Math.abs(p.burstVx) > 0.05 || Math.abs(p.burstVy) > 0.05) {
        p.x += p.burstVx;
        p.y += p.burstVy;
        p.burstVx *= 0.95;
        p.burstVy = p.burstVy * 0.95 + 0.1; // gravity gently resumes
      }

      // Natural Falling & Sway Physics
      var sway = Math.sin(now * p.swayFreq + p.phase) * p.swayAmp;
      var fall =
        p.fallSpeed * settings.petalSpeed * (0.6 + 0.8 * p.z) +
        effectiveScrollBoost;
      var horiz = sway * 0.04 + windForce * (0.4 + p.z);

      p.y += fall * dtNorm;
      p.x += horiz * dtNorm;
      p.rot += p.spin * dtNorm;
      p.flipPhase += p.flipSpeed * dtNorm;

      // Boundary Recycling
      if (p.y > h + 50) {
        p.reset(false);
      }
      if (p.x < -60) p.x = w + 50;
      if (p.x > w + 60) p.x = -50;

      // Depth Tier Index for Sprites
      var tier = p.z < 0.5 ? 0 : p.z < 0.8 ? 1 : 2;
      var sprite = sprites[tier];

      // Render Petal with Pseudo-3D Tumbling
      var scale = (p.baseSize / 48) * settings.petalSize;
      var scaleX = Math.cos(p.flipPhase);
      var alpha = p.fg ? 0.32 : 0.45 + p.z * 0.5;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(scale * scaleX, scale);
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    }
  }

  function initPetalEngine() {
    bgCanvas = document.getElementById("petal-canvas-bg");
    fgCanvas = document.getElementById("petal-canvas-fg");
    if (!bgCanvas || !fgCanvas) return;

    bgCtx = bgCanvas.getContext("2d");
    fgCtx = fgCanvas.getContext("2d");

    initSprites();
    resizeCanvases();

    function handleResize() {
      var curW = window.innerWidth;
      var curH = window.innerHeight;
      // Skip resize reinit caused by mobile browser address bar hide/show (<120px height diff)
      if (curW === lastCanvasW && Math.abs(curH - lastCanvasH) < 120) {
        return;
      }
      lastCanvasW = curW;
      lastCanvasH = curH;
      resizeCanvases();
    }

    window.addEventListener("resize", debounce(handleResize, 180));
    window.addEventListener("orientationchange", function () {
      setTimeout(function () {
        lastCanvasW = window.innerWidth;
        lastCanvasH = window.innerHeight;
        resizeCanvases();
      }, 120);
    });

    // Track Pointer for Wind Wake
    window.addEventListener("mousemove", function (e) {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    });

    // Track Scroll for Speed Boost
    window.addEventListener(
      "scroll",
      function () {
        var currentY = window.scrollY;
        var diff = Math.abs(currentY - lastScrollY);
        scrollVelocity = Math.min(scrollVelocity + diff, 40);
        lastScrollY = currentY;
      },
      { passive: true },
    );

    // Hero Click Spawns Blossom Burst
    var heroArch = document.getElementById("hero-arch-wrapper");
    if (heroArch) {
      heroArch.addEventListener("click", function (e) {
        spawnBloomBurst(e.clientX, e.clientY, 14);
      });
    }

    // Suspend loop when document is hidden (switched tab / minimized)
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
      } else {
        if (!animFrameId && settings.petals && settings.motion !== "off") {
          lastFrameTime = performance.now();
          animFrameId = requestAnimationFrame(runPetalLoop);
        }
      }
    });

    // Start Simulation Loop
    lastFrameTime = performance.now();
    animFrameId = requestAnimationFrame(runPetalLoop);
  }

  /* ==========================================================================
     5. NAVIGATION, SCROLL PROGRESS & CHAPTER MOOD SHIFT
     ========================================================================== */
  function initNavAndScroll() {
    var progressBar = document.getElementById("scroll-progress");
    var navLinks = document.querySelectorAll(".nav-links .nav-link");
    var navIndicator = document.getElementById("nav-indicator");
    var heroArch = document.getElementById("hero-arch-wrapper");
    var bgDashain = document.getElementById("bg-dashain");
    var bgTihar = document.getElementById("bg-tihar");
    var tiharSection = document.getElementById("tihar");

    var sections = [
      { id: "home", el: document.getElementById("home") },
      { id: "dashain", el: document.getElementById("dashain") },
      { id: "tihar", el: document.getElementById("tihar") },
      { id: "videos", el: document.getElementById("videos") },
      { id: "memories", el: document.getElementById("memories") },
    ];

    function updateNavIndicator(activeLink) {
      if (!navIndicator || !activeLink) return;
      var rect = activeLink.getBoundingClientRect();
      var parentRect = activeLink.parentElement.getBoundingClientRect();
      navIndicator.style.width = rect.width + "px";
      navIndicator.style.transform =
        "translateX(" + (rect.left - parentRect.left) + "px)";
    }

    function onScroll() {
      var scrollY = window.scrollY;
      var docH = document.documentElement.scrollHeight - window.innerHeight;

      // 1. Scroll Progress Bar
      if (progressBar && docH > 0) {
        var pct = Math.min(Math.max((scrollY / docH) * 100, 0), 100);
        progressBar.style.width = pct + "%";
      }

      // 2. Parallax for Hero Arch (max 40px, disabled on reduced motion)
      if (
        heroArch &&
        settings.motion !== "off" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        if (scrollY < window.innerHeight) {
          heroArch.style.transform =
            "translate3d(0, " + scrollY * 0.08 + "px, 0)";
        }
      }

      // 3. Chapter Mood Shift & Cross-fade
      if (tiharSection && bgDashain && bgTihar) {
        var tiharRect = tiharSection.getBoundingClientRect();
        var winH = window.innerHeight;
        if (tiharRect.top < winH && tiharRect.bottom > 0) {
          var progress = 1 - tiharRect.top / winH;
          tiharBlendRatio = Math.min(Math.max(progress, 0), 1);
          bgTihar.style.opacity = tiharBlendRatio;
          bgDashain.style.opacity = 1 - tiharBlendRatio * 0.75;
        } else if (tiharRect.top >= winH) {
          tiharBlendRatio = 0;
          bgTihar.style.opacity = "0";
          bgDashain.style.opacity = "1";
        }
      }

      // 4. Active Section Spy
      var scrollMiddle = scrollY + window.innerHeight * 0.35;
      var currentActiveId = "home";
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i];
        if (s.el && s.el.offsetTop <= scrollMiddle) {
          currentActiveId = s.id;
        }
      }

      for (var j = 0; j < navLinks.length; j++) {
        var link = navLinks[j];
        var href = link.getAttribute("href").replace("#", "");
        if (href === currentActiveId) {
          if (!link.classList.contains("is-active")) {
            navLinks.forEach(function (l) {
              l.classList.remove("is-active");
            });
            link.classList.add("is-active");
            updateNavIndicator(link);
          }
        }
      }
    }

    var scrollTicking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (!scrollTicking) {
          requestAnimationFrame(function () {
            onScroll();
            scrollTicking = false;
          });
          scrollTicking = true;
        }
      },
      { passive: true },
    );

    // Pause offscreen marquee animation to save continuous compositing
    var marquee = document.querySelector(".marquee-track");
    if (marquee && "IntersectionObserver" in window) {
      var marqueeObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            marquee.style.animationPlayState = entry.isIntersecting
              ? "running"
              : "paused";
          });
        },
        { threshold: 0 },
      );
      marqueeObserver.observe(marquee);
    }
    window.addEventListener(
      "resize",
      debounce(function () {
        var activeLink = document.querySelector(
          ".nav-links .nav-link.is-active",
        );
        if (activeLink) updateNavIndicator(activeLink);
      }, 150),
    );

    // Initial position
    setTimeout(function () {
      var initialLink =
        document.querySelector(".nav-links .nav-link.is-active") || navLinks[0];
      if (initialLink) updateNavIndicator(initialLink);
    }, 100);

    // Mobile Menu Overlay Toggle
    var menuToggle = document.getElementById("menu-toggle");
    var mobileOverlay = document.getElementById("mobile-nav-overlay");
    var mobileClose = document.getElementById("mobile-menu-close");
    var mobileLinks = document.querySelectorAll(".mobile-nav-link");

    function openMobileMenu() {
      if (!mobileOverlay) return;
      mobileOverlay.classList.add("is-open");
      mobileOverlay.setAttribute("aria-hidden", "false");
      menuToggle.setAttribute("aria-expanded", "true");
      var scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = scrollbarWidth + "px";
      }
      document.body.style.overflow = "hidden";
      if (mobileClose) mobileClose.focus();
    }

    function closeMobileMenu() {
      if (!mobileOverlay) return;
      mobileOverlay.classList.remove("is-open");
      mobileOverlay.setAttribute("aria-hidden", "true");
      menuToggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      menuToggle.focus();
    }

    if (menuToggle) menuToggle.addEventListener("click", openMobileMenu);
    if (mobileClose) mobileClose.addEventListener("click", closeMobileMenu);
    mobileLinks.forEach(function (l) {
      l.addEventListener("click", closeMobileMenu);
    });

    window.addEventListener("keydown", function (e) {
      if (
        e.key === "Escape" &&
        mobileOverlay &&
        mobileOverlay.classList.contains("is-open")
      ) {
        closeMobileMenu();
      }
    });

    // Focus trap inside mobile nav overlay
    if (mobileOverlay) {
      mobileOverlay.addEventListener("keydown", function (e) {
        if (e.key === "Tab") {
          var focusable = mobileOverlay.querySelectorAll(
            'button, a, [tabindex="0"]',
          );
          var first = focusable[0];
          var last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });
    }

    // Back to Top Button
    var backToTopBtn = document.getElementById("back-to-top-btn");
    if (backToTopBtn) {
      backToTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ==========================================================================
     6. AUTOMATIC MEMORY WALL BUILDER & FILTERING
     ========================================================================== */
  function initMemoryWall() {
    var wallGrid = document.getElementById("memory-wall-grid");
    if (!wallGrid) return;

    // Collect all media figures from the story moments
    var sourceMediaElements = document.querySelectorAll(".story-moment .media");
    wallGrid.innerHTML = "";

    sourceMediaElements.forEach(function (origMedia, idx) {
      var kind = origMedia.getAttribute("data-kind") || "photo";
      var group = origMedia.getAttribute("data-group") || "dashain";
      var caption = origMedia.getAttribute("data-caption") || "";

      var clone = document.createElement("figure");
      clone.className = "media media-wall-item";
      clone.setAttribute("data-kind", kind);
      clone.setAttribute("data-group", group);
      clone.setAttribute("data-caption", caption);
      clone.setAttribute("tabindex", "0");
      clone.setAttribute("role", "button");
      clone.setAttribute("aria-label", "View " + caption);

      if (kind === "photo") {
        var origImg = origMedia.querySelector("img");
        var img = document.createElement("img");
        img.src = origImg
          ? origImg.getAttribute("src")
          : "images/dashain-0" + (idx + 1) + ".jpg";
        img.alt = caption;
        img.loading = "lazy";
        img.decoding = "async";
        clone.appendChild(img);
      } else {
        var origVideo = origMedia.querySelector("video");
        var vid = document.createElement("video");
        vid.src = origVideo ? origVideo.getAttribute("src") : "";
        vid.poster = origVideo ? origVideo.getAttribute("poster") : "";
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = "metadata";
        clone.appendChild(vid);
      }

      wallGrid.appendChild(clone);
    });

    // Filter Chips
    var chips = document.querySelectorAll(".filter-chips .chip");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) {
          c.classList.remove("is-active");
          c.setAttribute("aria-checked", "false");
        });
        chip.classList.add("is-active");
        chip.setAttribute("aria-checked", "true");

        var filter = chip.getAttribute("data-filter");
        filterMemoryWall(filter);
      });
    });

    function filterMemoryWall(filter) {
      var items = wallGrid.querySelectorAll(".media-wall-item");
      items.forEach(function (item) {
        var kind = item.getAttribute("data-kind");
        var group = item.getAttribute("data-group");
        var match =
          filter === "all" ||
          (filter === "video" && kind === "video") ||
          group === filter;

        if (match) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    }

    // Wall Layout Buttons (Masonry vs Grid)
    var masonryBtn = document.getElementById("layout-masonry-btn");
    var gridBtn = document.getElementById("layout-grid-btn");

    if (masonryBtn && gridBtn) {
      masonryBtn.addEventListener("click", function () {
        masonryBtn.classList.add("is-active");
        gridBtn.classList.remove("is-active");
        updateSetting("wallLayout", "masonry");
      });
      gridBtn.addEventListener("click", function () {
        gridBtn.classList.add("is-active");
        masonryBtn.classList.remove("is-active");
        updateSetting("wallLayout", "grid");
      });
    }
  }

  /* ==========================================================================
     7. HORIZONTAL VIDEO RAIL (MOUSE DRAGGING & PLAYBACK)
     ========================================================================== */
  function initVideoRail() {
    var rail = document.getElementById("video-rail");
    if (!rail) return;

    var isDown = false;
    var startX, scrollLeft;

    rail.addEventListener("mousedown", function (e) {
      isDown = true;
      rail.classList.add("is-dragging");
      startX = e.pageX - rail.offsetLeft;
      scrollLeft = rail.scrollLeft;
    });

    rail.addEventListener("mouseleave", function () {
      isDown = false;
      rail.classList.remove("is-dragging");
    });

    rail.addEventListener("mouseup", function () {
      isDown = false;
      rail.classList.remove("is-dragging");
    });

    rail.addEventListener("mousemove", function (e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - rail.offsetLeft;
      var walk = (x - startX) * 1.5;
      rail.scrollLeft = scrollLeft - walk;
    });

    // Ensure only one video plays at a time
    var allVideos = document.querySelectorAll("video");
    allVideos.forEach(function (v) {
      v.addEventListener("play", function () {
        allVideos.forEach(function (other) {
          if (other !== v && !other.paused) {
            other.pause();
          }
        });
      });
    });

    // Pause offscreen videos
    if ("IntersectionObserver" in window) {
      var videoObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting && !entry.target.paused) {
              entry.target.pause();
            }
          });
        },
        { threshold: 0.2 },
      );

      allVideos.forEach(function (v) {
        videoObserver.observe(v);
      });
    }
  }

  /* ==========================================================================
     8. ACCESSIBLE LIGHTBOX (WITH TOUCH SWIPE & FLIP-STYLE TRANSITION)
     ========================================================================== */
  function initLightbox() {
    var modal = document.getElementById("lightbox");
    var backdrop = document.getElementById("lightbox-backdrop");
    var stage = document.getElementById("lightbox-stage");
    var captionEl = document.getElementById("lightbox-caption");
    var counterEl = document.getElementById("lightbox-counter");
    var closeBtn = document.getElementById("lightbox-close-btn");
    var prevBtn = document.getElementById("lightbox-prev-btn");
    var nextBtn = document.getElementById("lightbox-next-btn");
    if (!modal) return;

    var currentItems = [];
    var currentIndex = 0;
    var lastFocusedElement = null;
    var touchStartX = 0;

    function buildItemList() {
      // Collect visible media items
      var list = [];
      var allMedia = document.querySelectorAll(".media");
      allMedia.forEach(function (m) {
        if (m.offsetParent !== null && !m.classList.contains("media-arch")) {
          list.push(m);
        }
      });
      return list;
    }

    function openLightbox(mediaEl) {
      currentItems = buildItemList();
      currentIndex = currentItems.indexOf(mediaEl);
      if (currentIndex === -1) {
        currentItems.push(mediaEl);
        currentIndex = currentItems.length - 1;
      }

      lastFocusedElement = mediaEl;

      // Prevent body scroll and preserve scrollbar width
      var scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = scrollBarWidth + "px";
      document.body.style.overflow = "hidden";

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");

      renderLightboxItem(currentIndex);
      closeBtn.focus();
    }

    function closeLightbox() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      stage.innerHTML = "";

      document.body.style.overflow = "";
      document.body.style.paddingRight = "";

      if (lastFocusedElement) {
        lastFocusedElement.focus();
      }
    }

    function renderLightboxItem(index) {
      if (index < 0 || index >= currentItems.length) return;
      var item = currentItems[index];
      var kind = item.getAttribute("data-kind") || "photo";
      var caption = item.getAttribute("data-caption") || "";

      stage.innerHTML = "";

      if (kind === "photo") {
        var origImg = item.querySelector("img");
        var img = document.createElement("img");
        img.src = origImg ? origImg.currentSrc || origImg.src : "";
        img.alt = caption;
        stage.appendChild(img);
      } else {
        var origVid = item.querySelector("video");
        var vid = document.createElement("video");
        vid.src = origVid ? origVid.src : "";
        vid.poster = origVid ? origVid.poster : "";
        vid.controls = true;
        vid.autoplay = true;
        vid.playsInline = true;
        stage.appendChild(vid);
      }

      captionEl.textContent = caption;
      counterEl.textContent = index + 1 + " of " + currentItems.length;

      // Preload adjacent images
      preloadNeighbor(index - 1);
      preloadNeighbor(index + 1);
    }

    function preloadNeighbor(idx) {
      if (idx >= 0 && idx < currentItems.length) {
        var neighbor = currentItems[idx];
        if (neighbor.getAttribute("data-kind") === "photo") {
          var imgEl = neighbor.querySelector("img");
          if (imgEl && imgEl.src) {
            var pImg = new Image();
            pImg.src = imgEl.src;
          }
        }
      }
    }

    function showPrev() {
      currentIndex =
        (currentIndex - 1 + currentItems.length) % currentItems.length;
      renderLightboxItem(currentIndex);
    }

    function showNext() {
      currentIndex = (currentIndex + 1) % currentItems.length;
      renderLightboxItem(currentIndex);
    }

    // Click handler for all media elements
    document.addEventListener("click", function (e) {
      var media = e.target.closest(".media");
      if (media && !media.closest(".lightbox-modal")) {
        e.preventDefault();
        openLightbox(media);
      }
    });

    closeBtn.addEventListener("click", closeLightbox);
    backdrop.addEventListener("click", closeLightbox);
    prevBtn.addEventListener("click", showPrev);
    nextBtn.addEventListener("click", showNext);

    // Keyboard Navigation
    window.addEventListener("keydown", function (e) {
      if (!modal.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();

      // Trap Focus
      if (e.key === "Tab") {
        var focusables = modal.querySelectorAll(
          'button, video, [tabindex="0"]',
        );
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Touch Swipe Gestures (Horizontal navigation & Swipe-down to close)
    var touchStartX = 0;
    var touchStartY = 0;

    stage.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true },
    );

    stage.addEventListener(
      "touchend",
      function (e) {
        var touchEndX = e.changedTouches[0].screenX;
        var touchEndY = e.changedTouches[0].screenY;
        var diffX = touchStartX - touchEndX;
        var diffY = touchStartY - touchEndY;

        // Swipe down to close
        if (diffY < -60 && Math.abs(diffY) > Math.abs(diffX) * 1.5) {
          closeLightbox();
          return;
        }

        // Horizontal swipe navigation
        if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 0) showNext();
          else showPrev();
        }
      },
      { passive: true },
    );
  }

  /* ==========================================================================
     9. SETTINGS PANEL LOGIC & LIVE CONTROLS
     ========================================================================== */
  function initSettingsPanel() {
    var fab = document.getElementById("settings-toggle");
    var panel = document.getElementById("settings-panel");
    var closeBtn = document.getElementById("settings-close-btn");
    var tooltip = document.getElementById("settings-tooltip");
    var resetBtn = document.getElementById("settings-reset-btn");
    if (!fab || !panel) return;

    // Show First-Visit Tooltip for 4 seconds
    try {
      if (!localStorage.getItem("settings-tooltip-seen")) {
        setTimeout(function () {
          tooltip.classList.add("is-active");
          tooltip.setAttribute("aria-hidden", "false");
          setTimeout(function () {
            tooltip.classList.remove("is-active");
            tooltip.setAttribute("aria-hidden", "true");
            localStorage.setItem("settings-tooltip-seen", "true");
          }, 4000);
        }, 1200);
      }
    } catch (e) {}

    function togglePanel() {
      var isOpen = panel.classList.contains("is-open");
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    }

    function openPanel() {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      fab.setAttribute("aria-expanded", "true");
      closeBtn.focus();
    }

    function closePanel() {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      fab.setAttribute("aria-expanded", "false");
      fab.focus();
    }

    fab.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", closePanel);

    // Close on Escape or Outside Click
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        closePanel();
      }
    });

    document.addEventListener("click", function (e) {
      if (
        panel.classList.contains("is-open") &&
        !panel.contains(e.target) &&
        !fab.contains(e.target)
      ) {
        closePanel();
      }
    });

    // Trap focus inside settings panel
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        var focusable = panel.querySelectorAll('button, input, [tabindex="0"]');
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Quick Looks Presets
    var quickLookButtons = document.querySelectorAll(".quick-look-pill");
    quickLookButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var preset = btn.getAttribute("data-preset");
        if (preset === "dashain") {
          updateSetting("theme", "light");
          updateSetting("accent", "sakura");
          updateSetting("petals", true);
          updateSetting("petalAmount", 45);
          updateSetting("petalColor", "sakura");
          updateSetting("motion", "full");
        } else if (preset === "tihar") {
          updateSetting("theme", "dark");
          updateSetting("accent", "sayapatri");
          updateSetting("petals", true);
          updateSetting("petalAmount", 55);
          updateSetting("petalColor", "mixed");
          updateSetting("grain", true);
          updateSetting("motion", "full");
        } else if (preset === "calm") {
          updateSetting("petals", false);
          updateSetting("motion", "calm");
          updateSetting("cursor", false);
        }
        syncInputsWithSettings();
      });
    });

    // Theme Mode Radio
    var themeRadios = document.querySelectorAll('input[name="setting-theme"]');
    themeRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateSetting("theme", radio.value);
      });
    });

    // Accent Swatches
    var swatches = document.querySelectorAll(".swatch-btn");
    swatches.forEach(function (swatch) {
      swatch.addEventListener("click", function () {
        swatches.forEach(function (s) {
          s.classList.remove("is-active");
        });
        swatch.classList.add("is-active");
        var acc = swatch.getAttribute("data-accent");
        updateSetting("accent", acc);
      });
    });

    // Custom Color Input
    var customColorInput = document.getElementById("setting-custom-color");
    if (customColorInput) {
      customColorInput.addEventListener("input", function () {
        swatches.forEach(function (s) {
          s.classList.remove("is-active");
        });
        updateSetting("accent", "custom");
        updateSetting("customAccent", customColorInput.value);
        checkAccentContrast(customColorInput.value);
      });
    }

    // Font Style
    var fontRadios = document.querySelectorAll('input[name="setting-font"]');
    fontRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateSetting("font", radio.value);
      });
    });

    // Film Grain Toggle
    var grainToggle = document.getElementById("setting-grain-toggle");
    if (grainToggle) {
      grainToggle.addEventListener("click", function () {
        var active = !settings.grain;
        grainToggle.classList.toggle("is-active", active);
        grainToggle.setAttribute("aria-checked", active ? "true" : "false");
        updateSetting("grain", active);
      });
    }

    // Show Petals Toggle
    var petalsToggle = document.getElementById("setting-petals-toggle");
    if (petalsToggle) {
      petalsToggle.addEventListener("click", function () {
        var active = !settings.petals;
        petalsToggle.classList.toggle("is-active", active);
        petalsToggle.setAttribute("aria-checked", active ? "true" : "false");
        updateSetting("petals", active);
        updatePetalsCount();
      });
    }

    // Petals Amount Slider
    var amountSlider = document.getElementById("setting-petals-amount");
    var amountVal = document.getElementById("val-petals-amount");
    if (amountSlider) {
      amountSlider.addEventListener("input", function () {
        var val = parseInt(amountSlider.value, 10);
        amountVal.textContent = val;
        updateSetting("petalAmount", val);
        updatePetalsCount();
      });
    }

    // Petals Speed Slider
    var speedSlider = document.getElementById("setting-petals-speed");
    var speedVal = document.getElementById("val-petals-speed");
    if (speedSlider) {
      speedSlider.addEventListener("input", function () {
        var val = parseInt(speedSlider.value, 10) / 100;
        speedVal.textContent = val.toFixed(1) + "x";
        updateSetting("petalSpeed", val);
      });
    }

    // Petals Size Slider
    var sizeSlider = document.getElementById("setting-petals-size");
    var sizeVal = document.getElementById("val-petals-size");
    if (sizeSlider) {
      sizeSlider.addEventListener("input", function () {
        var val = parseInt(sizeSlider.value, 10) / 100;
        sizeVal.textContent = val.toFixed(1) + "x";
        updateSetting("petalSize", val);
      });
    }

    // Petals Wind Slider
    var windSlider = document.getElementById("setting-petals-wind");
    var windVal = document.getElementById("val-petals-wind");
    if (windSlider) {
      windSlider.addEventListener("input", function () {
        var val = parseInt(windSlider.value, 10);
        if (val === 0) windVal.textContent = "Gentle";
        else if (val < 0) windVal.textContent = "Left " + Math.abs(val);
        else windVal.textContent = "Right " + val;
        updateSetting("petalWind", val);
      });
    }

    // Petals Color Radios
    var petalColorRadios = document.querySelectorAll(
      'input[name="setting-petal-color"]',
    );
    petalColorRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateSetting("petalColor", radio.value);
      });
    });

    // Text Size Radios
    var textSizeRadios = document.querySelectorAll(
      'input[name="setting-text-size"]',
    );
    textSizeRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateSetting("textSize", radio.value);
      });
    });

    // Margin Notes Toggle
    var notesToggle = document.getElementById("setting-notes-toggle");
    if (notesToggle) {
      notesToggle.addEventListener("click", function () {
        var active = !settings.marginNotes;
        notesToggle.classList.toggle("is-active", active);
        notesToggle.setAttribute("aria-checked", active ? "true" : "false");
        updateSetting("marginNotes", active);
      });
    }

    // Wall Layout Radios
    var wallRadios = document.querySelectorAll(
      'input[name="setting-wall-layout"]',
    );
    wallRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateSetting("wallLayout", radio.value);
      });
    });

    // Motion Radios
    var motionRadios = document.querySelectorAll(
      'input[name="setting-motion"]',
    );
    motionRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateSetting("motion", radio.value);
      });
    });

    // Custom Cursor Toggle
    var cursorToggle = document.getElementById("setting-cursor-toggle");
    if (cursorToggle) {
      cursorToggle.addEventListener("click", function () {
        var active = !settings.cursor;
        cursorToggle.classList.toggle("is-active", active);
        cursorToggle.setAttribute("aria-checked", active ? "true" : "false");
        updateSetting("cursor", active);
      });
    }

    // Reset to Defaults
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        settings = Object.assign({}, DEFAULT_SETTINGS);
        saveSettings();
        notifySubscribers();
        syncInputsWithSettings();
        updatePetalsCount();
      });
    }

    function syncInputsWithSettings() {
      // Theme
      var tRadio = document.querySelector(
        'input[name="setting-theme"][value="' + settings.theme + '"]',
      );
      if (tRadio) tRadio.checked = true;

      // Swatches
      swatches.forEach(function (s) {
        s.classList.toggle(
          "is-active",
          s.getAttribute("data-accent") === settings.accent,
        );
      });
      if (customColorInput)
        customColorInput.value = settings.customAccent || "#BE3569";

      // Font
      var fRadio = document.querySelector(
        'input[name="setting-font"][value="' + settings.font + '"]',
      );
      if (fRadio) fRadio.checked = true;

      // Grain
      if (grainToggle) {
        grainToggle.classList.toggle("is-active", settings.grain);
        grainToggle.setAttribute(
          "aria-checked",
          settings.grain ? "true" : "false",
        );
      }

      // Petals
      if (petalsToggle) {
        petalsToggle.classList.toggle("is-active", settings.petals);
        petalsToggle.setAttribute(
          "aria-checked",
          settings.petals ? "true" : "false",
        );
      }
      if (amountSlider) {
        amountSlider.value = settings.petalAmount;
        if (amountVal) amountVal.textContent = settings.petalAmount;
      }
      if (speedSlider) {
        speedSlider.value = Math.round(settings.petalSpeed * 100);
        if (speedVal)
          speedVal.textContent = settings.petalSpeed.toFixed(1) + "x";
      }
      if (sizeSlider) {
        sizeSlider.value = Math.round(settings.petalSize * 100);
        if (sizeVal) sizeVal.textContent = settings.petalSize.toFixed(1) + "x";
      }
      if (windSlider) {
        windSlider.value = settings.petalWind;
        if (windVal) {
          if (settings.petalWind === 0) windVal.textContent = "Gentle";
          else if (settings.petalWind < 0)
            windVal.textContent = "Left " + Math.abs(settings.petalWind);
          else windVal.textContent = "Right " + settings.petalWind;
        }
      }

      // Petal Color
      var pcRadio = document.querySelector(
        'input[name="setting-petal-color"][value="' +
          settings.petalColor +
          '"]',
      );
      if (pcRadio) pcRadio.checked = true;

      // Text Size
      var tsRadio = document.querySelector(
        'input[name="setting-text-size"][value="' + settings.textSize + '"]',
      );
      if (tsRadio) tsRadio.checked = true;

      // Notes
      if (notesToggle) {
        notesToggle.classList.toggle("is-active", settings.marginNotes);
        notesToggle.setAttribute(
          "aria-checked",
          settings.marginNotes ? "true" : "false",
        );
      }

      // Wall Layout
      var wlRadio = document.querySelector(
        'input[name="setting-wall-layout"][value="' +
          settings.wallLayout +
          '"]',
      );
      if (wlRadio) wlRadio.checked = true;

      // Motion
      var mRadio = document.querySelector(
        'input[name="setting-motion"][value="' + settings.motion + '"]',
      );
      if (mRadio) mRadio.checked = true;

      // Cursor
      if (cursorToggle) {
        cursorToggle.classList.toggle("is-active", settings.cursor);
        cursorToggle.setAttribute(
          "aria-checked",
          settings.cursor ? "true" : "false",
        );
      }
    }

    syncInputsWithSettings();
  }

  /* ==========================================================================
     10. CUSTOM CURSOR (SPRING LERP & HOVER STATES)
     ========================================================================== */
  function initCustomCursor() {
    var cursor = document.getElementById("custom-cursor");
    var dot = document.getElementById("cursor-dot");
    var ring = document.getElementById("cursor-ring");
    var label = document.getElementById("cursor-label");
    if (!cursor || !dot || !ring) return;

    var mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    var isFinePointer = mql.matches;

    var mouse = { x: -100, y: -100 };
    var dotPos = { x: -100, y: -100 };
    var ringPos = { x: -100, y: -100 };

    function onPointerChange(e) {
      isFinePointer = e.matches;
      if (!isFinePointer) {
        cursor.style.opacity = "0";
        mouse.x = -100;
        mouse.y = -100;
      }
    }
    if (mql.addEventListener) {
      mql.addEventListener("change", onPointerChange);
    } else if (mql.addListener) {
      mql.addListener(onPointerChange);
    }

    var cursorRaf = null;

    function scheduleCursorRender() {
      if (!cursorRaf && isFinePointer && settings.cursor && settings.motion !== "off") {
        cursorRaf = requestAnimationFrame(renderCursor);
      }
    }

    // Render loop with smooth lerping that sleeps when motionless
    function renderCursor() {
      cursorRaf = null;
      if (!isFinePointer || !settings.cursor || settings.motion === "off") return;

      var dxDot = mouse.x - dotPos.x;
      var dyDot = mouse.y - dotPos.y;
      var dxRing = mouse.x - ringPos.x;
      var dyRing = mouse.y - ringPos.y;

      dotPos.x += dxDot * 0.75;
      dotPos.y += dyDot * 0.75;
      ringPos.x += dxRing * 0.25;
      ringPos.y += dyRing * 0.25;

      dot.style.transform =
        "translate3d(" +
        dotPos.x +
        "px, " +
        dotPos.y +
        "px, 0) translate(-50%, -50%)";
      ring.style.transform =
        "translate3d(" +
        ringPos.x +
        "px, " +
        ringPos.y +
        "px, 0) translate(-50%, -50%)";

      // If either dot or ring still has visible movement remaining, continue; otherwise sleep!
      if (
        Math.abs(dxRing) > 0.2 ||
        Math.abs(dyRing) > 0.2 ||
        Math.abs(dxDot) > 0.2 ||
        Math.abs(dyDot) > 0.2
      ) {
        cursorRaf = requestAnimationFrame(renderCursor);
      }
    }

    window.addEventListener("mousemove", function (e) {
      if (!isFinePointer) return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      scheduleCursorRender();
    });

    window.addEventListener(
      "touchstart",
      function () {
        // Touch interaction: immediately hide custom cursor so it never gets stuck at tap position
        if (cursorRaf) {
          cancelAnimationFrame(cursorRaf);
          cursorRaf = null;
        }
        mouse.x = -100;
        mouse.y = -100;
        dotPos.x = -100;
        dotPos.y = -100;
        ringPos.x = -100;
        ringPos.y = -100;
        cursor.style.opacity = "0";
        cursor.classList.remove("is-hovering-media", "is-hovering-link");
      },
      { passive: true },
    );

    // Contextual Hover States
    document.addEventListener("mouseover", function (e) {
      if (!isFinePointer) return;
      var target = e.target;
      var media = target.closest(".media");
      var link = target.closest("a, button, .chip, input");

      if (media && !target.closest(".lightbox-modal")) {
        cursor.classList.add("is-hovering-media");
        var kind = media.getAttribute("data-kind") || "photo";
        label.textContent = kind === "video" ? "Play" : "View";
      } else if (link) {
        cursor.classList.add("is-hovering-link");
      }
    });

    document.addEventListener("mouseout", function (e) {
      if (!isFinePointer) return;
      var target = e.target;
      if (target.closest(".media")) {
        cursor.classList.remove("is-hovering-media");
        label.textContent = "";
      }
      if (target.closest("a, button, .chip, input")) {
        cursor.classList.remove("is-hovering-link");
      }
    });
  }

  /* ==========================================================================
     11. MAKE IT BLOOM & FESTIVAL TOAST
     ========================================================================== */
  function initBloomButton() {
    var bloomBtn = document.getElementById("bloom-btn");
    var toast = document.getElementById("bloom-toast");
    if (!bloomBtn) return;

    var toastTimeout = null;

    bloomBtn.addEventListener("click", function (e) {
      var rect = bloomBtn.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;

      // Spawn burst of 14 petals
      spawnBloomBurst(x, y, 14);

      // Show Toast Notification
      if (toast) {
        clearTimeout(toastTimeout);
        toast.classList.add("is-visible");
        toast.setAttribute("aria-hidden", "false");

        toastTimeout = setTimeout(function () {
          toast.classList.remove("is-visible");
          toast.setAttribute("aria-hidden", "true");
        }, 4000);
      }
    });
  }

  /* ==========================================================================
     12. HELPER UTILITIES
     ========================================================================== */
  function debounce(func, wait) {
    var timeout;
    return function () {
      var context = this,
        args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        func.apply(context, args);
      }, wait);
    };
  }

  /* ==========================================================================
     13. INITIALIZATION ORCHESTRATOR
     ========================================================================== */
  function init() {
    loadSettings();
    syncDOMWithSettings();
    initIntroCurtain();
    initPetalEngine();
    initNavAndScroll();
    initMemoryWall();
    initVideoRail();
    initLightbox();
    initSettingsPanel();
    initCustomCursor();
    initBloomButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
