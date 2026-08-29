(() => {
  'use strict';
  const dlog = window.__guDlog || function () {};
  if (!window.THREE) { dlog('hero3d.js: window.THREE missing'); return; }

  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('heroCanvas');
  if (!hero || !canvas) { dlog('hero3d.js: hero or canvas element missing'); return; }

  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const isNarrow = window.innerWidth < 768;

  let renderer, scene, camera, group;
  let raf = null;
  let running = false;
  let sceneStart = 0;
  let mouseX = 0, mouseY = 0;
  let curTiltX = 0, curTiltY = 0;

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  try {
    const ctxTest = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!ctxTest) { dlog('hero3d.js: canvas.getContext returned null on real canvas'); return; }
  } catch (e) { dlog('hero3d.js: canvas.getContext threw: ' + e.message); return; }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    dlog('hero3d.js: WebGLRenderer created OK');
  } catch (e) { dlog('hero3d.js: WebGLRenderer creation threw: ' + e.message); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isNarrow ? 1.5 : 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(5.6, 4.6, 6.4);
  camera.lookAt(0, 0.6, 0);

  scene.add(new THREE.HemisphereLight(0x8a8a80, 0x100c08, 0.55));
  const dirLight = new THREE.DirectionalLight(0xfff4dc, 0.7);
  dirLight.position.set(4, 6, 3);
  scene.add(dirLight);

  group = new THREE.Group();
  scene.add(group);

  const COLOR = {
    floor: 0x17181a,
    wall: 0x2c2e2c,
    wire: 0xf5c332,
    brass: 0xc9a15c,
    wood: 0x8a6a45,
    steel: 0x35383a,
  };

  const timeline = [];

  function addRise(mesh, height, start, dur) {
    mesh.userData.baseHeight = height;
    mesh.scale.y = 0.001;
    mesh.position.y = 0;
    timeline.push({ kind: 'rise', mesh, start, dur, height });
  }
  function addPop(obj, start, dur) {
    obj.scale.setScalar(0.001);
    timeline.push({ kind: 'pop', mesh: obj, start, dur });
  }
  function addMaterialize(wire, solid, start, dur) {
    timeline.push({ kind: 'materialize', wire, solid, start, dur });
  }
  function addLightUp(light, target, start, dur) {
    light.intensity = 0;
    timeline.push({ kind: 'light', light, target, start, dur });
  }
  function addEmissive(mesh, target, start, dur) {
    mesh.material.emissiveIntensity = 0;
    timeline.push({ kind: 'emissive', mesh, target, start, dur });
  }

  // floor
  const floorGeo = new THREE.BoxGeometry(5.6, 0.08, 5.6);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: COLOR.floor, roughness: 0.9 }));
  floor.scale.y = 0.001;
  group.add(floor);
  timeline.push({ kind: 'floor', mesh: floor, start: 0, dur: 500 });

  // walls (back + left + right), open front for interior view
  function makeWall(w, h, d, x, z, ry, start) {
    const wireMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: COLOR.wire, wireframe: true, transparent: true, opacity: 1 }));
    const solidMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: COLOR.wall, roughness: 0.85, transparent: true, opacity: 0 }));
    [wireMesh, solidMesh].forEach(m => { m.position.set(x, 0, z); m.rotation.y = ry; m.scale.y = 0.001; group.add(m); });
    addRise(wireMesh, h, start, 900);
    addRise(solidMesh, h, start, 900);
    addMaterialize(wireMesh, solidMesh, start + 900, 800);
  }
  const WH = 1.5;
  makeWall(5.6, WH, 0.1, 0, -2.8, 0, 150);
  makeWall(5.6, WH, 0.1, -2.8, 0, Math.PI / 2, 320);
  makeWall(5.6, WH, 0.1, 2.8, 0, Math.PI / 2, 490);

  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
  function addContactShadow(parent, radius, y) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), shadowMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = y || 0.011;
    parent.add(disc);
    return disc;
  }

  // counter: base cabinet + brass trim rim + back shelf with bottles
  function makeCounter(x, z, start) {
    const c = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.6), new THREE.MeshStandardMaterial({ color: COLOR.steel, roughness: 0.7 }));
    base.position.y = 0.425;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.05, 0.66), new THREE.MeshStandardMaterial({ color: COLOR.brass, roughness: 0.35, metalness: 0.5 }));
    trim.position.y = 0.875;
    c.add(base, trim);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.18), new THREE.MeshStandardMaterial({ color: COLOR.wood, roughness: 0.6 }));
    shelf.position.set(0, 1.05, -0.18);
    c.add(shelf);
    for (let i = 0; i < 4; i++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85 }));
      bottle.position.set(-0.7 + i * 0.42, 1.18, -0.18);
      c.add(bottle);
      addPop(bottle, start + 750 + i * 60, 350);
    }
    c.position.set(x, 0, z);
    group.add(c);
    [base, trim, shelf].forEach(m => { addRise(m, m.geometry.parameters.height, start, 700); });
  }
  makeCounter(1.7, -2.35, 1500);

  // chairs
  function makeChair(x, z, rotY, start) {
    const ch = new THREE.Group();
    const seatMat = new THREE.MeshStandardMaterial({ color: COLOR.wood, roughness: 0.65 });
    const legMat = new THREE.MeshStandardMaterial({ color: COLOR.steel, roughness: 0.4, metalness: 0.5 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.34), seatMat);
    seat.position.y = 0.42;
    ch.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.04), seatMat);
    back.position.set(0, 0.61, -0.15);
    ch.add(back);
    const legPositions = [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]];
    legPositions.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), legMat);
      leg.position.set(lx, 0.21, lz);
      ch.add(leg);
    });
    ch.position.set(x, 0, z);
    ch.rotation.y = rotY;
    group.add(ch);
    addPop(ch, start, 500);
  }

  // tables — round top with rim, 4 slim legs, contact shadow, chairs around
  function makeTable(x, z, start, withChairs) {
    const t = new THREE.Group();
    const topMat = new THREE.MeshStandardMaterial({ color: COLOR.wood, roughness: 0.55 });
    const legMat = new THREE.MeshStandardMaterial({ color: COLOR.steel, roughness: 0.4, metalness: 0.5 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 20), topMat);
    top.position.y = 0.72;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.02, 20), new THREE.MeshStandardMaterial({ color: COLOR.brass, roughness: 0.4, metalness: 0.4 }));
    rim.position.y = 0.745;
    t.add(top, rim);
    const legR = 0.32;
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 6), legMat);
      leg.position.set(Math.cos(ang) * legR, 0.36, Math.sin(ang) * legR);
      t.add(leg);
    }
    addContactShadow(t, 0.5);
    t.position.set(x, 0, z);
    group.add(t);
    addPop(t, start, 550);

    if (withChairs) {
      makeChair(x + 0.66, z, -Math.PI / 2, start + 150);
      makeChair(x - 0.66, z, Math.PI / 2, start + 250);
    }
  }
  makeTable(-1.5, 1.2, 1900, true);
  makeTable(0.4, 1.75, 2100, true);
  if (!isNarrow) makeTable(2.05, 0.35, 2300, false);

  // pendant lights
  function makePendant(x, z, start) {
    const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0x141414, emissive: 0xffce4d, emissiveIntensity: 0 }));
    fixture.position.set(x, 1.35, z);
    group.add(fixture);
    const pl = new THREE.PointLight(0xffb84d, 0, 4.2, 2);
    pl.position.set(x, 1.25, z);
    group.add(pl);
    addEmissive(fixture, 1.6, start, 900);
    addLightUp(pl, x === 0.4 ? 1.1 : 1.4, start, 900);
  }
  makePendant(-1.5, 1.2, 2900);
  makePendant(0.4, 1.75, 3050);

  const totalConstructionMs = 4100;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function tick(now) {
    if (!running) return;
    if (!sceneStart) sceneStart = now;
    const elapsed = now - sceneStart;

    timeline.forEach(item => {
      const t = clamp01((elapsed - item.start) / item.dur);
      if (elapsed < item.start) return;
      switch (item.kind) {
        case 'floor': {
          const e = easeOutCubic(t);
          item.mesh.scale.y = Math.max(0.02, e);
          break;
        }
        case 'rise': {
          const e = easeOutCubic(t);
          item.mesh.scale.y = Math.max(0.001, e);
          item.mesh.position.y = (item.height * e) / 2;
          break;
        }
        case 'materialize': {
          item.wire.material.opacity = 1 - t;
          item.solid.material.opacity = t * 0.92;
          break;
        }
        case 'pop': {
          const e = easeOutBack(t);
          item.mesh.scale.setScalar(Math.max(0.001, e));
          break;
        }
        case 'light': {
          item.light.intensity = easeOutCubic(t) * item.target;
          break;
        }
        case 'emissive': {
          item.mesh.material.emissiveIntensity = easeOutCubic(t) * item.target;
          break;
        }
      }
    });

    if (elapsed > totalConstructionMs) {
      group.rotation.y += 0.0009;
    }

    if (!isTouch) {
      const targetTiltY = mouseX * 0.12;
      const targetTiltX = -mouseY * 0.06;
      curTiltX += (targetTiltX - curTiltX) * 0.05;
      curTiltY += (targetTiltY - curTiltY) * 0.05;
      camera.position.x = 5.6 + curTiltY * 1.4;
      camera.position.y = 4.6 + curTiltX * 1.2;
      camera.lookAt(0, 0.6, 0);
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  window.addEventListener('resize', () => { resize(); }, { passive: true });
  if (!isTouch) {
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) start(); else stop();
      });
    }, { threshold: 0.05 });
    io.observe(hero);
  } else {
    start();
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    hero.classList.remove('hero-3d-active');
  });

  resize();
  hero.classList.add('hero-3d-active');
  start();
})();
