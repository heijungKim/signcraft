/* ===== 360° 3D 미리보기 (Three.js) ===== */
window.Preview3D = (function () {
  let renderer, scene, camera, controls, mesh, texture, textureBack, edgeMesh, glowMesh, glowTex;
  let signGroup = null, props = [];
  let wrap, inited = false;
  let sourceCanvasEl = null, sourceCanvasBackEl = null;
  let currentSpec = null;
  let maxAniso = 1, lastTexW = 0, lastTexH = 0;
  let otFont = null, otLoading = false; // 3D 채널 글자 외곽선용 폰트(한글/영문)
  const OT_URL = "https://cdn.jsdelivr.net/npm/@expo-google-fonts/black-han-sans/BlackHanSans_400Regular.ttf";

  function init(canvasEl, canvasBackEl) {
    sourceCanvasEl = canvasEl;
    sourceCanvasBackEl = canvasBackEl || canvasEl;
    wrap = document.getElementById("threeWrap");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d11);

    const w = wrap.clientWidth || 700, h = wrap.clientHeight || 460;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    wrap.appendChild(renderer.domElement);

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.5); rim.position.set(-6, -2, -4); scene.add(rim);
    const back = new THREE.DirectionalLight(0xffffff, 0.7); back.position.set(0, 3, -8); scene.add(back); // 후면 보조광(양면 인쇄 확인용)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.7));

    // 환경 반사맵 — 금속/미러가 반사할 그라데이션(위=밝음, 아래=어두움)
    try {
      const c = document.createElement("canvas");
      c.width = 8; c.height = 256;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#f4f8ff");
      grad.addColorStop(0.45, "#aab6c8");
      grad.addColorStop(0.55, "#6d7787");
      grad.addColorStop(1, "#2a2f39");
      g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
      const envTex = new THREE.CanvasTexture(c);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.background = envTex;
      scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    } catch (e) { /* 환경맵 실패해도 진행 */ }

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 12;

    maxAniso = renderer.capabilities.getMaxAnisotropy();
    ensureTextures(true);

    // 조명(LED/네온)용 부드러운 후광 텍스처(방사형 그라데이션)
    const gc = document.createElement("canvas"); gc.width = gc.height = 256;
    const gx = gc.getContext("2d");
    const rg = gx.createRadialGradient(128, 128, 8, 128, 128, 128);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.45, "rgba(255,255,255,0.5)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    gx.fillStyle = rg; gx.fillRect(0, 0, 256, 256);
    glowTex = new THREE.CanvasTexture(gc);

    window.addEventListener("resize", onResize);
    inited = true;
    animate();
  }

  function materialParams(spec, map) {
    map = map || texture;
    switch (spec.material) {
      case "clear": // 투명 아크릴 — 무착색(디자인 색 그대로) + 광택/약간 투명
        return new THREE.MeshPhysicalMaterial({
          map, color: 0xffffff, transparent: true, opacity: 0.82,
          roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05,
          reflectivity: 0.5, side: THREE.DoubleSide,
        });
      case "milky": // 유백 아크릴 — 뽀얀 반투명 화이트
        return new THREE.MeshPhysicalMaterial({
          map, color: 0xffffff, transparent: true, opacity: 0.92,
          roughness: 0.5, metalness: 0.0, clearcoat: 0.4,
        });
      case "color": // 컬러 아크릴 — 바탕색(텍스처)에 유광 코팅
        return new THREE.MeshPhysicalMaterial({
          map, color: 0xffffff,
          roughness: 0.15, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.08,
        });
      case "mirror": // 미러 아크릴 — 디자인은 보이되 거울처럼 유광 반사
        return new THREE.MeshPhysicalMaterial({
          map, color: 0xffffff, metalness: 0.35, roughness: 0.04,
          clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 1, envMapIntensity: 2.0,
        });
      case "stainless": // 스테인리스 — 헤어라인 금속(디자인 은은히 비침)
        return new THREE.MeshStandardMaterial({
          map, color: 0xd7dce3, metalness: 0.75, roughness: 0.3, envMapIntensity: 1.5,
        });
      case "wood": // 우드 — 무광 나무
        return new THREE.MeshStandardMaterial({ map, color: 0xb98a55, metalness: 0.0, roughness: 0.85 });
      case "fabric": // 현수막 원단 — 무광 천
        return new THREE.MeshStandardMaterial({ map, color: 0xffffff, metalness: 0.0, roughness: 0.95, side: THREE.DoubleSide });
      default:
        return new THREE.MeshStandardMaterial({ map, roughness: 0.4 });
    }
  }

  // 캔버스 픽셀 크기가 바뀌면 텍스처를 새로 생성(GPU 버퍼 잔상 방지)
  function ensureTextures(force) {
    const w = sourceCanvasEl.width, h = sourceCanvasEl.height;
    if (!force && texture && lastTexW === w && lastTexH === h) return;
    if (texture) texture.dispose();
    if (textureBack) textureBack.dispose();
    texture = new THREE.CanvasTexture(sourceCanvasEl);
    texture.anisotropy = maxAniso;
    // 뒷면 캔버스 텍스처 — 뒷면 디자인은 뒤에서 정상으로 읽혀야 하므로 반전하지 않음
    textureBack = new THREE.CanvasTexture(sourceCanvasBackEl);
    textureBack.anisotropy = maxAniso;
    lastTexW = w; lastTexH = h;
  }

  function build(spec) {
    currentSpec = spec;
    if (!inited) return;
    ensureTextures(false);
    clearScene();

    // 실제 비율 유지: 긴 변을 3 유닛으로 정규화
    const ratio = spec.widthMM / spec.heightMM;
    let pw, ph;
    if (ratio >= 1) { pw = 3.2; ph = 3.2 / ratio; } else { ph = 3.2; pw = 3.2 * ratio; }

    signGroup = new THREE.Group();

    const base = spec.base || "flat";
    const letter = spec.letter || "none";

    // 베이스 구조별 두께/형상
    let d = Math.max(0.04, (spec.thickness / 1000) * 6);
    if (base === "flex" || base === "panel" || base === "truss") d = Math.max(d, 0.13);
    if (base === "round") d = Math.max(d, 0.24);

    let geo, kind = "box";
    if (base === "cube") {
      const cs = Math.min(Math.max(pw, ph), 2.4);
      pw = ph = cs; d = cs; kind = "cube";
      geo = new THREE.BoxGeometry(cs, cs, cs);
    } else if (base === "round") {
      kind = "round";
      geo = roundedPanel(pw, ph, d);
    } else {
      geo = new THREE.BoxGeometry(pw, ph, d);
    }

    const sideColor = new THREE.Color(spec.material === "stainless" || spec.material === "mirror" ? 0xbfc6cf : (spec.boardColor || "#dddddd"));
    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.5, metalness: spec.material === "stainless" ? 0.8 : 0.1 });

    // 채널 글자 사용 여부 판단(한글/영문 외곽선 압출)
    const wantChannel = (letter === "front" || letter === "halo") && spec.letters && spec.letters.length;
    if (wantChannel && !otFont) ensureOtFont();
    const chLetters = (wantChannel && otFont) ? extrudableLetters(spec.letters) : [];
    const useChannel = chLetters.length > 0;

    const baseEmissive = { flex: 0.28, panel: 0.9, round: 0.8, cube: 0.9, truss: 0.25 }[base] || 0;
    let haloOpacity = 0; const haloColor = 0xfff2d6;
    if (letter === "halo") haloOpacity = 0.95;

    // 전면 재질: 채널이면 디자인 없는 깔끔한 바탕색 배커, 아니면 디자인 텍스처
    let faceMat;
    if (useChannel) {
      const bc = new THREE.Color(spec.boardColor || "#dddddd");
      faceMat = new THREE.MeshStandardMaterial({
        color: bc, roughness: 0.5, metalness: 0.1,
        emissive: bc, emissiveIntensity: letter === "halo" ? 0.1 : baseEmissive * 0.45,
      });
    } else {
      faceMat = materialParams(spec, texture);
      let fe = baseEmissive;
      if (letter === "front") fe = Math.max(fe, 1.35);
      if (letter === "halo") fe = Math.min(fe, 0.18);
      if (fe > 0) {
        faceMat.emissive = new THREE.Color(0xffffff);
        faceMat.emissiveMap = texture;
        faceMat.emissiveIntensity = fe;
        faceMat.needsUpdate = true;
      }
    }
    const backMat = spec.backDesign ? materialParams(spec, textureBack) : sideMat;

    if (kind === "cube") {
      const capMat = new THREE.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.5 });
      // +x,-x,+y(top),-y(bottom),+z,-z → 4 옆면에 디자인
      mesh = new THREE.Mesh(geo, [faceMat, faceMat, capMat, capMat, faceMat, faceMat]);
    } else if (kind === "round") {
      // ExtrudeGeometry: group0=앞/뒤면, group1=옆면
      mesh = new THREE.Mesh(geo, [faceMat, sideMat]);
    } else {
      mesh = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, faceMat, backMat]);
    }
    signGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geo);
    edgeMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true }));
    signGroup.add(edgeMesh);

    // 후광(백라이트) 채널
    if (haloOpacity > 0) {
      const glowGeo = new THREE.PlaneGeometry(pw * 1.5, ph * 1.9);
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex, color: haloColor, transparent: true,
        opacity: haloOpacity, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.z = -d / 2 - 0.06;
      signGroup.add(glowMesh);
    }

    // 트러스바 지지 구조
    if (base === "truss") addTruss(pw, ph, d);

    // 입체 채널 글자(영문/숫자)
    if (useChannel) addChannelLetters(spec, pw, ph, d, chLetters);

    scene.add(signGroup);
    applyMounting(spec, pw, ph, d);
  }

  // 채널 글자 외곽선 폰트(TTF) 지연 로드
  function ensureOtFont() {
    if (otFont || otLoading || !window.opentype) return;
    otLoading = true;
    window.opentype.load(OT_URL, (err, f) => {
      otLoading = false;
      if (err || !f) { console.warn("3D 글자 폰트 로드 실패:", err); return; }
      otFont = f;
      if (currentSpec) build(currentSpec);
    });
  }

  // 텍스트가 있는 개체만 추림(한글/영문 모두 외곽선 압출 가능)
  function extrudableLetters(letters) {
    return letters
      .map((L) => ({ ...L, txt: (L.text || "").replace(/\s+$/g, "") }))
      .filter((L) => L.txt.trim().length);
  }

  // 글자 외곽선 → THREE.Shape → 압출 지오메트리
  function buildTextGeometry(txt, targetH, depth3d) {
    let shapes = [];
    try {
      const d = otFont.getPath(txt, 0, 0, 100).toPathData(2); // 100px 기준 외곽선
      if (!d) return null;
      const parsed = new THREE.SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
      parsed.paths.forEach((p) => THREE.SVGLoader.createShapes(p).forEach((s) => shapes.push(s)));
    } catch (e) { return null; }
    if (!shapes.length) return null;

    // px 크기 측정 → 3D 스케일 산출
    const flat = new THREE.ShapeGeometry(shapes);
    flat.computeBoundingBox();
    const bb = flat.boundingBox; flat.dispose();
    const Hpx = Math.max(1, bb.max.y - bb.min.y);
    const scale = targetH / Hpx;
    const depthPx = depth3d / scale;
    const bevelPx = Math.min(depthPx * 0.12, Hpx * 0.02);

    let geo;
    const opts = { depth: depthPx, bevelEnabled: true, bevelThickness: bevelPx, bevelSize: bevelPx, bevelSegments: 1, curveSegments: 6 };
    try { geo = new THREE.ExtrudeGeometry(shapes, opts); }
    catch (e) {
      try { geo = new THREE.ExtrudeGeometry(shapes, { depth: depthPx, bevelEnabled: false, curveSegments: 6 }); }
      catch (e2) { return null; }
    }
    geo.scale(scale, -scale, scale); // SVG(y-down) → three(y-up)
    geo.center();
    return geo;
  }

  // 텍스트 개체를 실제 3D 압출 채널 글자로 생성(한글/영문)
  function addChannelLetters(spec, pw, ph, d, chLetters) {
    const front = spec.letter === "front";
    const depth3d = Math.min(0.26, d * 1.4 + 0.14);

    chLetters.forEach((L) => {
      const targetH = Math.max(0.05, L.hFrac * ph); // 표시 높이(bbox) 기준
      const geo = buildTextGeometry(L.txt, targetH, depth3d);
      if (!geo) return;

      const col = new THREE.Color(L.fill || "#222222");
      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
      let mat;
      if (front) {
        const emis = lum < 0.2 ? new THREE.Color(0xffffff) : col; // 앞면발광(어두우면 흰빛)
        mat = new THREE.MeshStandardMaterial({ color: col, emissive: emis, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.0, side: THREE.DoubleSide });
      } else {
        mat = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }); // 후광 실루엣
      }

      const m = new THREE.Mesh(geo, mat);
      m.position.set((L.cxFrac - 0.5) * pw, (0.5 - L.cyFrac) * ph, d / 2 + depth3d / 2);
      m.rotation.z = -L.angle * Math.PI / 180;
      signGroup.add(m);
    });
  }

  // 라운드(오사이) 발광 박스 — 모서리 둥근 사각을 압출
  function roundedPanel(w, h, d) {
    const r = Math.min(w, h) * 0.48;
    const x = -w / 2, y = -h / 2;
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    const uvGen = {
      generateTopUV: (g, verts, a, b, c) => {
        const p = (i) => new THREE.Vector2((verts[i * 3] - x) / w, (verts[i * 3 + 1] - y) / h);
        return [p(a), p(b), p(c)];
      },
      generateSideWallUV: () => [new THREE.Vector2(0, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 0)],
    };
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, steps: 1, UVGenerator: uvGen });
    geo.translate(0, 0, -d / 2);
    return geo;
  }

  // 트러스바 프레임(뒤쪽 지지대)
  function addTruss(pw, ph, d) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x6a7078, metalness: 0.7, roughness: 0.5 });
    const z = -d / 2 - 0.09;
    const x = pw / 2 * 0.92, y = ph / 2 * 0.82;
    const mkBar = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), barMat);
      bar.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
      bar.rotation.z = Math.atan2(dy, dx);
      signGroup.add(bar);
    };
    mkBar(-x, y, x, y); mkBar(-x, -y, x, -y);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const xa = -x + 2 * x * i / n, xb = -x + 2 * x * (i + 1) / n;
      mkBar(xa, i % 2 ? y : -y, xb, i % 2 ? -y : y);
    }
  }

  // 시공 방식(벽부착/돌출/스탠드)에 따라 사인 배치 + 벽/브래킷/받침 추가
  function applyMounting(spec, pw, ph, depth) {
    const install = spec.install || "wall";
    const metal = () => new THREE.MeshStandardMaterial({ color: 0x2f343b, metalness: 0.75, roughness: 0.4 });
    const concrete = () => new THREE.MeshStandardMaterial({ color: 0x8b929c, roughness: 0.95, metalness: 0 });
    const addProp = (m) => { scene.add(m); props.push(m); };

    if (install === "protrude") {
      // 돌출(블레이드) 간판: 왼쪽 벽에서 오른쪽으로 튀어나옴
      const wallX = -pw / 2 - 0.15;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.25, ph + 1.6, 3.6), concrete());
      wall.position.set(wallX - 0.125, 0, -0.4);
      addProp(wall);
      // 사인은 벽 오른쪽으로 튀어나오도록 앞쪽(+z)으로 이동
      signGroup.position.set(0, 0, 0.5);
      // 상·하 브래킷 팔(벽 → 사인)
      [ph / 2 - 0.15, -ph / 2 + 0.15].forEach((y) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.09, 0.9), metal());
        arm.position.set(wallX + 0.05, y, 0.1);
        addProp(arm);
      });
    } else if (install === "stand") {
      // 스탠드형: 받침대 위에 세움
      const lift = 0.9;
      signGroup.position.set(0, lift, 0);
      const poleH = lift + 0.1;
      [-pw / 4, pw / 4].forEach((x) => {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, poleH, 0.12), metal());
        pole.position.set(x, lift - ph / 2 - poleH / 2 + 0.05, 0);
        addProp(pole);
      });
      const base = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.7, 0.08, 0.6), metal());
      base.position.set(0, lift - ph / 2 - poleH + 0.09, 0);
      addProp(base);
    } else {
      // 벽부착 / 기타: 소품 없이 중앙 배치(깔끔)
      signGroup.position.set(0, 0, 0);
    }
  }

  function clearScene() {
    glowMesh = null; // signGroup 소속 — 아래 traverse에서 정리됨
    if (signGroup) {
      scene.remove(signGroup);
      signGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach((m) => m && m.dispose && m.dispose()) : o.material.dispose(); }
      });
      signGroup = null;
    }
    props.forEach((p) => {
      scene.remove(p);
      if (p.geometry) p.geometry.dispose();
      if (p.material) p.material.dispose();
    });
    props = [];
    mesh = null; edgeMesh = null;
  }

  function disposeMesh(m) {
    if (!m) return;
    scene.remove(m);
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x && x.dispose && x.dispose());
    else if (mat && mat.dispose) mat.dispose();
  }

  function refresh() {
    if (texture) texture.needsUpdate = true;
    if (textureBack) textureBack.needsUpdate = true;
  }

  function onResize() {
    if (!inited || !wrap.clientWidth) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (texture) texture.needsUpdate = true;
    if (textureBack) textureBack.needsUpdate = true;
    if (renderer) renderer.render(scene, camera);
  }

  function onShow() { onResize(); refresh(); }

  return { init, build, refresh, onShow, onResize };
})();
