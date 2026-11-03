/* =========================================================
   Momentum — Motion layer (GSAP + ScrollTrigger)
   Every animation here is progressive enhancement:
   content is always readable, animated only when supported.
   ========================================================= */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var canAnimate = !!gsap && !reduceMotion;

  /* ---------------------------------------------------------
     1. Split headings into words for staggered reveals
     --------------------------------------------------------- */
  function splitWords(el) {
    if (el.dataset.splitDone === "true") return;
    if (el.children.length > 0) return; // only split plain-text nodes
    var text = el.textContent.trim();
    if (!text) return;

    var tokens = text.split(" ");
    el.textContent = "";
    tokens.forEach(function (token, i) {
      var word = document.createElement("span");
      word.className = "word";
      var inner = document.createElement("span");
      inner.className = "word-inner";
      inner.textContent = token;
      word.appendChild(inner);
      el.appendChild(word);
      if (i < tokens.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.dataset.splitDone = "true";
  }

  var splitTargets = document.querySelectorAll('[data-split="words"]');
  Array.prototype.forEach.call(splitTargets, splitWords);

  /* ---------------------------------------------------------
     2. Reveal on scroll
     --------------------------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");

  // Group-level stagger so grids and timelines cascade naturally
  function staggerDelay(el) {
    var parent = el.parentElement;
    if (!parent) return 0;
    var siblings = Array.prototype.filter.call(parent.children, function (c) {
      return c.classList.contains("reveal");
    });
    var index = siblings.indexOf(el);
    if (index < 0) return 0;
    return Math.min(index * 0.09, 0.45);
  }

  function showAll() {
    Array.prototype.forEach.call(reveals, function (el) {
      el.classList.add("is-visible");
      el.style.opacity = "";
      el.style.transform = "";
    });
  }

  function setupReveals() {
    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el);

          if (!canAnimate) {
            el.classList.add("is-visible");
            return;
          }

          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.85,
            ease: "power3.out",
            delay: staggerDelay(el),
            onComplete: function () {
              el.classList.add("is-visible");
              // Release the transform so hover tilt can own it
              gsap.set(el, { clearProps: "transform,opacity" });
            },
          });
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 }
    );

    Array.prototype.forEach.call(reveals, function (el) {
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------
     3. Split-text animations
     --------------------------------------------------------- */
  function animateSplit(el, trigger, delay) {
    var inners = el.querySelectorAll(".word-inner");
    if (!inners.length) return;

    if (!canAnimate) return;

    gsap.from(inners, {
      yPercent: 115,
      opacity: 0,
      duration: 0.85,
      ease: "power3.out",
      stagger: 0.035,
      delay: delay || 0,
      scrollTrigger:
        trigger === "scroll" && ScrollTrigger
          ? { trigger: el, start: "top 88%", once: true }
          : undefined,
    });
  }

  // Hero title plays immediately
  var heroTitle = document.querySelector(".hero-title");
  if (heroTitle) animateSplit(heroTitle, "load", 0.15);

  // Article headings + pull quote play as they enter
  Array.prototype.forEach.call(
    document.querySelectorAll('.article-body h2[data-split], .quote-card p[data-split]'),
    function (el) {
      animateSplit(el, "scroll", 0);
    }
  );

  /* ---------------------------------------------------------
     4. Animated counters
     --------------------------------------------------------- */
  function setupCounters() {
    var counters = document.querySelectorAll(".counter");
    if (!counters.length) return;

    function run(el) {
      var target = parseFloat(el.dataset.count || "0");
      if (!canAnimate) {
        el.textContent = String(target);
        return;
      }
      var obj = { value: 0 };
      gsap.to(obj, {
        value: target,
        duration: 1.6,
        ease: "power2.out",
        onUpdate: function () {
          el.textContent = String(Math.round(obj.value));
        },
      });
    }

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(counters, run);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          run(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    Array.prototype.forEach.call(counters, function (el) {
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------
     5. Scroll-driven parallax (ScrollTrigger when available)
     --------------------------------------------------------- */
  function setupParallax() {
    if (!canAnimate || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    var heroContent = document.querySelector(".hero-content");
    if (heroContent) {
      gsap.to(heroContent, {
        yPercent: 16,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }

    // Figures and the pull quote drift gently in 3D as the page moves
    gsap.utils.toArray(".article-figure, .quote-card, .takeaway-box").forEach(function (el) {
      gsap.fromTo(
        el,
        { rotateX: 4, transformPerspective: 900 },
        {
          rotateX: -4,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );
    });

    // Section headings get a subtle horizontal drift
    gsap.utils.toArray(".section-head").forEach(function (el) {
      gsap.fromTo(
        el,
        { x: -18 },
        {
          x: 0,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 92%", end: "top 55%", scrub: true },
        }
      );
    });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function init() {
    setupReveals();
    setupCounters();
    setupParallax();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Safety net: if anything below the fold never fires, reveal it anyway
  window.addEventListener("load", function () {
    setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) {
        var top = el.getBoundingClientRect().top;
        if (top < window.innerHeight && !el.classList.contains("is-visible")) {
          el.classList.add("is-visible");
          if (canAnimate) gsap.set(el, { clearProps: "transform,opacity" });
        }
      });
    }, 1200);
  });
})();
