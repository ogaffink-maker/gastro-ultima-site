(() => {
  'use strict';
  if (!window.THREE) return;

  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('heroCanvas');
  if (!hero || !canvas) return;

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
    if (!ctxTest) return;
  } catch (e) { return; }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isNarrow ? 1.5 : 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
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

  // counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: COLOR.brass, roughness: 0.4, metalness: 0.35 }));
  counter.position.set(1.7, 0, -2.35);
  group.add(counter);
  addRise(counter, 0.9, 1500, 700);

  // tables
  function makeTable(x, z, start) {
    const t = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16), new THREE.MeshStandardMaterial({ color: COLOR.wood, roughness: 0.6 }));
    top.position.y = 0.62;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), new THREE.MeshStandardMaterial({ color: COLOR.steel, roughness: 0.5, metalness: 0.4 }));
    leg.position.y = 0.3;
    t.add(top, leg);
    t.position.set(x, 0, z);
    group.add(t);
    addPop(t, start, 550);
  }
  makeTable(-1.5, 1.2, 1900);
  makeTable(0.4, 1.6, 2100);
  if (!isNarrow) makeTable(1.9, 0.4, 2300);

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
  makePendant(-1.5, 1.2, 2600);
  makePendant(0.4, 1.6, 2750);

  const totalConstructionMs = 3800;

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
