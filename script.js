/* =========================================================
   Momentum — Interactive behaviour
   Theme switching, navigation, reading progress, 3D tilt,
   magnetic buttons, accordions and the network infographic.
   ========================================================= */

(function () {
  "use strict";

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

  var header = document.getElementById("siteHeader");
  var nav = document.getElementById("primaryNav");
  var navToggle = document.getElementById("navToggle");
  var progress = document.getElementById("readProgress");
  var backToTop = document.getElementById("backToTop");
  var ring = backToTop ? backToTop.querySelector(".back-to-top-ring circle") : null;
  var RING_LENGTH = 132;

  /* =======================================================
     Theme
     ======================================================= */
  var themeToggle = document.getElementById("themeToggle");
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, persist) {
    doc.setAttribute("data-theme", theme);
    if (themeToggle) themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#060d15" : "#0f2f4d");
    if (persist) {
      try { localStorage.setItem("momentum-theme", theme); } catch (e) {}
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = doc.getAttribute("data-theme") === "dark" ? "light" : "dark";
      // A brief wash so the change reads as a deliberate transition
      if (!reduceMotion && document.startViewTransition) {
        document.startViewTransition(function () { applyTheme(next, true); });
      } else {
        applyTheme(next, true);
      }
    });
  }

  /* =======================================================
     Header, reading progress, back to top
     ======================================================= */
  var tocProgressBar = document.getElementById("tocProgressBar");
  var articleBody = document.getElementById("article");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;

    if (header) header.classList.toggle("scrolled", y > 40);

    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (y / docHeight) * 100 : 0;

    if (progress) progress.style.width = pct + "%";
    if (backToTop) backToTop.classList.toggle("show", y > 620);
    if (ring) ring.style.strokeDashoffset = String(RING_LENGTH - (pct / 100) * RING_LENGTH);

    if (tocProgressBar && articleBody) {
      var rect = articleBody.getBoundingClientRect();
      var total = rect.height - window.innerHeight * 0.4;
      var read = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      tocProgressBar.style.width = (total > 0 ? (read / total) * 100 : 0) + "%";
    }

    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true }
  );
  onScroll();

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* =======================================================
     Mobile navigation
     ======================================================= */
  function closeMenu() {
    if (!nav || !navToggle) return;
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && !navToggle.contains(e.target)) closeMenu();
    });

    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* =======================================================
     Smooth in-page scrolling
     ======================================================= */
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (!id || id === "#" || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
      if (history.replaceState) history.replaceState(null, "", id);
    });
  });

  /* =======================================================
     Table of contents scroll-spy
     ======================================================= */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll("#tocList a"));
  var tocSections = tocLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && tocSections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = "#" + entry.target.id;
          tocLinks.forEach(function (link) {
            link.classList.toggle("active", link.getAttribute("href") === id);
          });
        });
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );
    tocSections.forEach(function (s) { spy.observe(s); });
  }

  /* =======================================================
     3D tilt on cards
     ======================================================= */
  function initTilt() {
    if (reduceMotion || !finePointer) return;

    Array.prototype.forEach.call(document.querySelectorAll("[data-tilt]"), function (el) {
      var max = parseFloat(el.dataset.tiltMax || "8");
      var raf = null;

      el.addEventListener("pointerenter", function () {
        el.classList.add("is-tilting");
      });

      el.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          var rx = (0.5 - py) * max;
          var ry = (px - 0.5) * max;
          el.style.transform =
            "perspective(950px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" +
            ry.toFixed(2) + "deg) translateY(-5px)";
          el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
          el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        });
      });

      el.addEventListener("pointerleave", function () {
        el.classList.remove("is-tilting");
        el.style.transform = "";
      });
    });
  }

  /* =======================================================
     Magnetic buttons
     ======================================================= */
  function initMagnetic() {
    if (reduceMotion || !finePointer) return;

    Array.prototype.forEach.call(document.querySelectorAll("[data-magnetic]"), function (el) {
      var strength = 0.26;
      var raf = null;

      el.addEventListener("pointermove", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        if (raf) return;
        raf = window.requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect();
          var x = (e.clientX - (r.left + r.width / 2)) * strength;
          var y = (e.clientY - (r.top + r.height / 2)) * strength;
          el.style.transform = "translate(" + x.toFixed(2) + "px, " + y.toFixed(2) + "px)";
        });
      });

      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* =======================================================
     Accordion (animated <details>)
     ======================================================= */
  function initAccordion() {
    Array.prototype.forEach.call(document.querySelectorAll(".accordion-item"), function (item) {
      var summary = item.querySelector("summary");
      var panel = item.querySelector(".accordion-panel");
      if (!summary || !panel) return;

      summary.addEventListener("click", function (e) {
        if (reduceMotion || !panel.animate) return; // let the browser handle it
        e.preventDefault();

        if (item.open) {
          var h = panel.scrollHeight;
          panel.style.overflow = "hidden";
          var closeAnim = panel.animate(
            [{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
            { duration: 240, easing: EASE }
          );
          closeAnim.onfinish = function () {
            item.open = false;
            panel.style.height = "";
            panel.style.overflow = "";
          };
        } else {
          item.open = true;
          var openH = panel.scrollHeight;
          panel.style.overflow = "hidden";
          var openAnim = panel.animate(
            [{ height: "0px", opacity: 0 }, { height: openH + "px", opacity: 1 }],
            { duration: 340, easing: EASE }
          );
          openAnim.onfinish = function () {
            panel.style.height = "";
            panel.style.overflow = "";
          };
        }
      });
    });
  }

  /* =======================================================
     Network infographic
     ======================================================= */
  var FLOW_INFO = [
    {
      title: "Start with you",
      text: "Before anyone can remember you, they need something to remember. Write two honest sentences about what you do and what you want to learn next — then practice saying them until they sound like you rather than a script.",
    },
    {
      title: "Turn introductions into relationships",
      text: "Send a short note within a day of meeting someone, referencing the specific thing you discussed. Ask one thoughtful question instead of making a request — curiosity is what keeps a first conversation alive.",
    },
    {
      title: "Become visible for something specific",
      text: "Share your work, comment with substance, and let people see how you think. Visibility is not self-promotion; it is giving others an easy, accurate answer to the question “what is this person good at?”",
    },
    {
      title: "Earn advocacy, not just contacts",
      text: "Referrals come from people who have seen you deliver. Do good work in public, help others without a receipt, and when the time is right, ask trusted collaborators whether they would be comfortable mentioning your name.",
    },
    {
      title: "Close the loop",
      text: "When an opportunity lands, tell the people who helped you get there — and pass the favour forward to someone earlier in their journey. Networks stay strong when gratitude travels in both directions.",
    },
  ];

  function initFlow() {
    var steps = Array.prototype.slice.call(document.querySelectorAll(".flow-step"));
    var detail = document.getElementById("flowDetail");
    var detailTitle = document.getElementById("flowDetailTitle");
    var detailText = document.getElementById("flowDetailText");
    if (!steps.length || !detailTitle || !detailText) return;

    function select(index) {
      steps.forEach(function (step, i) {
        var active = i === index;
        step.classList.toggle("active", active);
        step.setAttribute("aria-pressed", String(active));
      });

      var info = FLOW_INFO[index] || FLOW_INFO[0];
      detailTitle.textContent = info.title;
      detailText.textContent = info.text;

      if (detail && !reduceMotion && detail.animate) {
        detail.animate(
          [{ opacity: 0.35, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 340, easing: EASE }
        );
      }
    }

    steps.forEach(function (step, i) {
      step.addEventListener("click", function () { select(i); });
      step.addEventListener("pointerenter", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        select(i);
      });
      step.addEventListener("focus", function () { select(i); });
    });
  }

  /* =======================================================
     Newsletter
     ======================================================= */
  function initNewsletter() {
    var form = document.getElementById("newsletterForm");
    if (!form) return;
    var msg = document.getElementById("formMsg");
    var emailInput = document.getElementById("email");
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = (emailInput.value || "").trim();

      if (!emailRe.test(value)) {
        msg.textContent = "Please enter a valid email address.";
        msg.classList.add("error");
        emailInput.focus();
        return;
      }

      msg.classList.remove("error");
      msg.textContent = "Thanks! You're subscribed — check your inbox to confirm.";
      form.classList.add("subscribed");
      form.reset();
      window.setTimeout(function () { form.classList.remove("subscribed"); }, 900);
    });
  }

  /* =======================================================
     Social sharing
     ======================================================= */
  function initShare() {
    var pageUrl = encodeURIComponent(window.location.href);
    var pageTitle = encodeURIComponent(document.title);

    function setShare(id, url) {
      var el = document.getElementById(id);
      if (!el) return;
      el.href = url;
      el.target = "_blank";
      el.rel = "noopener";
    }

    setShare("shareX", "https://twitter.com/intent/tweet?url=" + pageUrl + "&text=" + pageTitle);
    setShare("shareLinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=" + pageUrl);
    setShare("shareFB", "https://www.facebook.com/sharer/sharer.php?u=" + pageUrl);

    var copyBtn = document.getElementById("copyLink");
    var copyToast = document.getElementById("copyToast");
    if (!copyBtn) return;

    copyBtn.addEventListener("click", function () {
      var url = window.location.href;
      function done() {
        if (!copyToast) return;
        copyToast.classList.add("show");
        window.setTimeout(function () { copyToast.classList.remove("show"); }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        var tmp = document.createElement("input");
        tmp.value = url;
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand("copy"); } catch (e) {}
        tmp.remove();
        done();
      }
    });
  }

  /* =======================================================
     Footer year
     ======================================================= */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* =======================================================
     Boot
     ======================================================= */
  // Reflect any theme set by the pre-paint script
  applyTheme(doc.getAttribute("data-theme") || "light", false);

  initTilt();
  initMagnetic();
  initAccordion();
  initFlow();
  initNewsletter();
  initShare();
})();
