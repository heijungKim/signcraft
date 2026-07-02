/* ===== 360° 3D 미리보기 (Three.js) ===== */
window.Preview3D = (function () {
  let renderer, scene, camera, controls, mesh, texture, edgeMesh;
  let wrap, inited = false;
  let sourceCanvasEl = null;
  let currentSpec = null;

  function init(canvasEl) {
    sourceCanvasEl = canvasEl;
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

    texture = new THREE.CanvasTexture(sourceCanvasEl);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    window.addEventListener("resize", onResize);
    inited = true;
    animate();
  }

  function materialParams(spec) {
    const map = texture;
    switch (spec.material) {
      case "clear": // 투명 아크릴 — 은은한 하늘빛 틴트 + 광택, 글자는 보이게
        return new THREE.MeshPhysicalMaterial({
          map, color: 0xcfe8ff, transparent: true, opacity: 0.55,
          roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05,
          reflectivity: 0.6, side: THREE.DoubleSide,
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
      default:
        return new THREE.MeshStandardMaterial({ map, roughness: 0.4 });
    }
  }

  function build(spec) {
    currentSpec = spec;
    if (!inited) return;
    disposeMesh(mesh); mesh = null;
    disposeMesh(edgeMesh); edgeMesh = null;

    // 실제 비율 유지: 긴 변을 3 유닛으로 정규화
    const ratio = spec.widthMM / spec.heightMM;
    let pw, ph;
    if (ratio >= 1) { pw = 3.2; ph = 3.2 / ratio; } else { ph = 3.2; pw = 3.2 * ratio; }
    const depth = Math.max(0.04, (spec.thickness / 1000) * 6); // 두께 시각화

    const geo = new THREE.BoxGeometry(pw, ph, depth);
    const faceMat = materialParams(spec);
    const sideColor = new THREE.Color(spec.material === "stainless" || spec.material === "mirror" ? 0xbfc6cf : (spec.boardColor || "#dddddd"));
    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.5, metalness: spec.material === "stainless" ? 0.8 : 0.1 });

    // BoxGeometry material order: +x,-x,+y,-y,+z(front),-z(back)
    mesh = new THREE.Mesh(geo, [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]);
    scene.add(mesh);

    // 외곽선
    const edges = new THREE.EdgesGeometry(geo);
    edgeMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.12, transparent: true }));
    scene.add(edgeMesh);
  }

  function disposeMesh(m) {
    if (!m) return;
    scene.remove(m);
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x && x.dispose && x.dispose());
    else if (mat && mat.dispose) mat.dispose();
  }

  function refresh() { if (texture) texture.needsUpdate = true; }

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
    if (renderer) renderer.render(scene, camera);
  }

  function onShow() { onResize(); refresh(); }

  return { init, build, refresh, onShow, onResize };
})();
