/* =========================================================
   Momentum — Hero 3D scene (Three.js)
   A living network graph: nodes = people, edges = relationships,
   the bright hub = you. It rotates with scroll and follows the cursor.
   Loaded as an ES module; degrades gracefully when WebGL is missing.
   ========================================================= */

(async function initHeroScene() {
  "use strict";

  const canvas = document.getElementById("heroCanvas");
  const hero = document.getElementById("top");
  const fallback = document.getElementById("heroFallback");
  if (!canvas || !hero) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = window.matchMedia("(max-width: 820px)").matches;
  const lowPower = isSmall || (navigator.hardwareConcurrency || 4) <= 4;

  function showFallback() {
    canvas.style.display = "none";
    if (fallback) fallback.classList.add("is-shown");
  }

  /* ---------- Capability checks ---------- */
  function hasWebGL() {
    try {
      const probe = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (probe.getContext("webgl2") || probe.getContext("webgl"))
      );
    } catch (err) {
      return false;
    }
  }

  if (!hasWebGL()) {
    showFallback();
    return;
  }

  /* ---------- Load Three.js lazily ---------- */
  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    showFallback();
    return;
  }

  try {
    await buildScene(THREE);
  } catch (err) {
    console.warn("Hero 3D scene unavailable:", err);
    showFallback();
  }

  /* =======================================================
     Scene builder
     ======================================================= */
  async function buildScene(THREE) {
    const PALETTE = {
      gold: new THREE.Color("#e0a44a"),
      amber: new THREE.Color("#c8892b"),
      teal: new THREE.Color("#3bc2ae"),
      blue: new THREE.Color("#5b8fd6"),
      white: new THREE.Color("#ffffff"),
    };

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !lowPower,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x071624, 0.045);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
    camera.position.set(0, 0, 17);

    /* ---------- Environment for realistic reflections ---------- */
    try {
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
      pmrem.dispose();
    } catch (err) {
      /* reflections are a bonus, not a requirement */
    }

    /* ---------- World group (holds everything so we can move it as one) ---------- */
    const world = new THREE.Group();
    world.position.set(lowPower ? 0 : 4.2, lowPower ? 0.2 : 0, 0);
    scene.add(world);

    /* ---------- Soft radial sprite texture ---------- */
    function makeGlowTexture() {
      const size = 128;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.28, "rgba(255,236,190,0.85)");
      g.addColorStop(0.65, "rgba(224,164,74,0.22)");
      g.addColorStop(1, "rgba(224,164,74,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    }
    const glowTex = makeGlowTexture();

    /* ---------- Node cloud (people) ---------- */
    const NODE_COUNT = lowPower ? 32 : 74;
    const HUB_COUNT = lowPower ? 5 : 9;
    const positions = [];

    // Fibonacci sphere gives an even, natural-looking distribution
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const shell = 5.1 + Math.random() * 1.9;
      positions.push(
        new THREE.Vector3(
          Math.cos(theta) * radiusAtY * shell,
          y * shell * 0.78,
          Math.sin(theta) * radiusAtY * shell
        )
      );
    }

    const nodeColors = positions.map((_, i) => {
      if (i < HUB_COUNT) return PALETTE.gold.clone();
      const r = Math.random();
      if (r < 0.5) return PALETTE.blue.clone();
      if (r < 0.8) return PALETTE.white.clone();
      return PALETTE.teal.clone();
    });

    const nodeGeometry = new THREE.BufferGeometry();
    const flat = [];
    positions.forEach((p) => flat.push(p.x, p.y, p.z));
    nodeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(flat, 3));
    nodeGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        nodeColors.flatMap((c) => [c.r, c.g, c.b]),
        3
      )
    );

    const nodePoints = new THREE.Points(
      nodeGeometry,
      new THREE.PointsMaterial({
        size: 0.34,
        map: glowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    world.add(nodePoints);

    /* ---------- Edges (relationships) ---------- */
    const edgePositions = [];
    const edgeColors = [];
    const maxDist = 3.4;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = positions[i].distanceTo(positions[j]);
        if (d > maxDist) continue;
        edgePositions.push(
          positions[i].x, positions[i].y, positions[i].z,
          positions[j].x, positions[j].y, positions[j].z
        );
        const a = nodeColors[i];
        const b = nodeColors[j];
        edgeColors.push(a.r, a.g, a.b, b.r, b.g, b.b);
      }
    }

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
    edgeGeometry.setAttribute("color", new THREE.Float32BufferAttribute(edgeColors, 3));

    const edges = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    world.add(edges);

    /* ---------- Ambient dust ---------- */
    const dustCount = lowPower ? 140 : 420;
    const dustPos = [];
    for (let i = 0; i < dustCount; i++) {
      dustPos.push(
        (Math.random() - 0.5) * 34,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 26
      );
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        size: 0.07,
        color: 0xbfd4ea,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(dust);

    /* ---------- You: the bright central node ---------- */
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.26, 2),
      new THREE.MeshStandardMaterial({
        color: 0xfff3dc,
        emissive: PALETTE.gold,
        emissiveIntensity: 1.5,
        roughness: 0.25,
        metalness: 0.4,
      })
    );
    world.add(core);

    const coreGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffd79a,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    coreGlow.scale.set(3.4, 3.4, 1);
    world.add(coreGlow);

    /* ---------- Glass orbs (opportunities) ---------- */
    const orbs = [];
    const orbConfig = [
      { r: 0.62, color: 0xdfe9f5, pos: [-2.6, 1.9, 1.1] },
      { r: 0.42, color: 0xf1d4a3, pos: [2.5, -1.6, 1.6] },
      { r: 0.34, color: 0x9fe4d8, pos: [1.1, 2.7, -1.4] },
    ];

    const sphereGeo = new THREE.SphereGeometry(1, 48, 48);
    orbConfig.forEach((cfg, i) => {
      const material = lowPower
        ? new THREE.MeshStandardMaterial({
            color: cfg.color,
            metalness: 1,
            roughness: 0.18,
            envMapIntensity: 1.2,
          })
        : new THREE.MeshPhysicalMaterial({
            color: cfg.color,
            metalness: 0,
            roughness: 0.06,
            transmission: 0.94,
            thickness: 1.1,
            ior: 1.45,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            envMapIntensity: 1.1,
          });

      const orb = new THREE.Mesh(sphereGeo, material);
      orb.scale.setScalar(cfg.r);
      orb.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      orb.userData = {
        baseY: cfg.pos[1],
        speed: 0.5 + i * 0.22,
        phase: i * 1.7,
        spin: 0.12 + i * 0.06,
      };
      world.add(orb);
      orbs.push(orb);
    });

    /* ---------- Floating geometry (growth, structure, momentum) ---------- */
    const shapes = [];

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.035, 16, 90),
      new THREE.MeshStandardMaterial({
        color: 0xe0a44a,
        metalness: 0.95,
        roughness: 0.22,
        emissive: 0x2a1a06,
      })
    );
    ring.position.set(-1.4, -2.4, 0.4);
    ring.rotation.set(1.1, 0.4, 0);
    world.add(ring);
    shapes.push({ mesh: ring, rx: 0.14, ry: 0.2 });

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 0),
      new THREE.MeshStandardMaterial({
        color: 0x8fb6e8,
        metalness: 0.9,
        roughness: 0.16,
      })
    );
    crystal.position.set(3.1, 2.4, -1.2);
    world.add(crystal);
    shapes.push({ mesh: crystal, rx: 0.2, ry: -0.26 });

    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.85, 0)),
      new THREE.LineBasicMaterial({
        color: 0x3bc2ae,
        transparent: true,
        opacity: 0.7,
      })
    );
    wire.position.set(-3.3, -0.7, -1.6);
    world.add(wire);
    shapes.push({ mesh: wire, rx: -0.16, ry: 0.22 });

    /* ---------- Lighting ---------- */
    scene.add(new THREE.AmbientLight(0x9ec5ff, 0.5));

    const key = new THREE.DirectionalLight(0xfff0d8, 1.9);
    key.position.set(6, 8, 7);
    scene.add(key);

    const gold = new THREE.PointLight(0xe0a44a, 140, 34, 2);
    gold.position.set(-7, 5, 5);
    scene.add(gold);

    const teal = new THREE.PointLight(0x3bc2ae, 110, 34, 2);
    teal.position.set(7, -5, -4);
    scene.add(teal);

    /* ---------- Sizing ---------- */
    function resize() {
      const w = hero.clientWidth || window.innerWidth;
      const h = hero.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", debounce(resize, 160));

    /* ---------- Pointer parallax ---------- */
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    function onPointer(clientX, clientY) {
      target.x = (clientX / window.innerWidth) * 2 - 1;
      target.y = (clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener(
      "pointermove",
      (e) => onPointer(e.clientX, e.clientY),
      { passive: true }
    );
    // Gentle device tilt support on mobile
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (e.gamma == null || e.beta == null) return;
        target.x = Math.max(-1, Math.min(1, e.gamma / 35));
        target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
      },
      { passive: true }
    );

    /* ---------- Scroll response ---------- */
    let scrollProgress = 0;
    function readScroll() {
      const h = hero.offsetHeight || 1;
      scrollProgress = Math.min(1, Math.max(0, window.scrollY / h));
    }
    window.addEventListener("scroll", readScroll, { passive: true });
    readScroll();

    /* ---------- Visibility control (keeps the page at 60fps) ---------- */
    let heroVisible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => {
          heroVisible = entries[0].isIntersecting;
          if (heroVisible) start();
          else stop();
        },
        { threshold: 0.02 }
      ).observe(hero);
    }

    let running = false;
    let rafId = null;
    const clock = new THREE.Clock();

    function frame() {
      rafId = requestAnimationFrame(frame);
      const delta = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // Ease pointer for silky parallax
      pointer.x += (target.x - pointer.x) * 0.045;
      pointer.y += (target.y - pointer.y) * 0.045;

      camera.position.x = pointer.x * 2.1;
      camera.position.y = -pointer.y * 1.5;
      camera.position.z = 17 + scrollProgress * 5;
      camera.lookAt(world.position.x * 0.55, 0, 0);

      // The network turns as you read — connections keep forming
      world.rotation.y += delta * 0.075 + pointer.x * delta * 0.24;
      world.rotation.x = scrollProgress * 0.4 + pointer.y * 0.1;

      // Hub breathes
      const pulse = 1 + Math.sin(t * 1.6) * 0.14;
      core.scale.setScalar(pulse);
      core.rotation.y += delta * 0.5;
      coreGlow.scale.setScalar(3.4 + Math.sin(t * 1.6) * 0.35);
      coreGlow.material.opacity = 0.62 + Math.sin(t * 1.6) * 0.18;

      // Orbs drift
      orbs.forEach((orb) => {
        const d = orb.userData;
        orb.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * 0.3;
        orb.rotation.y += delta * d.spin;
        orb.rotation.x += delta * d.spin * 0.4;
      });

      // Shapes rotate
      shapes.forEach((s) => {
        s.mesh.rotation.x += delta * s.rx;
        s.mesh.rotation.y += delta * s.ry;
      });

      // Dust drifts upward and wraps
      dust.rotation.y += delta * 0.012;
      dust.position.y = Math.sin(t * 0.12) * 0.6;

      renderer.render(scene, camera);
    }

    function start() {
      if (running || reduceMotion) return;
      running = true;
      clock.getDelta();
      frame();
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else if (heroVisible) start();
    });

    /* ---------- First paint ---------- */
    if (reduceMotion) {
      // Accessibility: one calm, static composition — no motion at all
      renderer.render(scene, camera);
    } else {
      start();
    }
    requestAnimationFrame(() => canvas.classList.add("ready"));

    /* ---------- Helpers ---------- */
    function debounce(fn, wait) {
      let id;
      return function () {
        clearTimeout(id);
        id = setTimeout(fn, wait);
      };
    }
  }
})();
