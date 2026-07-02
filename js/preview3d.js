/* ===== 360° 3D 미리보기 (Three.js) ===== */
window.Preview3D = (function () {
  let renderer, scene, camera, controls, mesh, texture, textureBack, edgeMesh, glowMesh, glowTex, concreteTex, woodTex;
  let keyLight, rimLight, backLight, ambientLight, hemiLight; // 스튜디오 조명(색상 조절용)
  // 선택적 블룸(selective bloom): "빛나야 할 오브젝트"만 BLOOM_LAYER에 넣어 블룸 텍스처를 뽑고,
  // 일반 렌더 위에 더해 합성 — 글자 얼굴처럼 빛나면 안 되는 오브젝트는 밝기와 무관하게 절대 번지지 않음.
  const BLOOM_LAYER = 1;
  let bloomLayer, bloomPass, bloomComposer, finalComposer, darkMaterial;
  const bloomMatCache = {};
  let signGroup = null, props = [];
  let wrap, inited = false;
  let sourceCanvasEl = null, sourceCanvasBackEl = null;
  let currentSpec = null;
  let maxAniso = 1, lastTexW = 0, lastTexH = 0;
  // 3D 채널 글자 외곽선 폰트 — 에디터 폰트별 TTF 매칭
  const OT_BASE = "https://cdn.jsdelivr.net/npm/@expo-google-fonts/";
  const OT_DEFAULT = OT_BASE + "black-han-sans/BlackHanSans_400Regular.ttf";
  const OT_MAP = {
    "Black Han Sans": { 400: "black-han-sans/BlackHanSans_400Regular.ttf" },
    "Noto Sans KR": { 400: "noto-sans-kr/NotoSansKR_400Regular.ttf", 700: "noto-sans-kr/NotoSansKR_700Bold.ttf" },
    "Nanum Gothic": { 400: "nanum-gothic/NanumGothic_400Regular.ttf", 700: "nanum-gothic/NanumGothic_700Bold.ttf" },
    "Jua": { 400: "jua/Jua_400Regular.ttf" },
    "Gowun Dodum": { 400: "gowun-dodum/GowunDodum_400Regular.ttf" },
    "Montserrat": { 400: "montserrat/Montserrat_400Regular.ttf", 700: "montserrat/Montserrat_700Bold.ttf" },
    "Bebas Neue": { 400: "bebas-neue/BebasNeue_400Regular.ttf" },
  };
  const otFonts = {}; // url -> opentype font
  const otState = {}; // url -> 'loading' | 'ok' | 'fail'

  function fontUrlFor(family, bold) {
    const m = OT_MAP[family];
    if (!m) return OT_DEFAULT;
    const w = bold && m[700] ? 700 : 400;
    return OT_BASE + (m[w] || m[400]);
  }

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

    // 선택적 블룸: BLOOM_LAYER에 속한 오브젝트만 빛나게(글자 얼굴은 절대 안 빛나고, 후광 실루엣만 빛남)
    try {
      bloomLayer = new THREE.Layers();
      bloomLayer.set(BLOOM_LAYER);
      darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

      const renderScene = new THREE.RenderPass(scene, camera);
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.9, 0.4, 0.35);

      bloomComposer = new THREE.EffectComposer(renderer);
      bloomComposer.renderToScreen = false;
      bloomComposer.addPass(renderScene);
      bloomComposer.addPass(bloomPass);

      const mixPass = new THREE.ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: bloomComposer.renderTarget2.texture },
          },
          vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `
            uniform sampler2D baseTexture;
            uniform sampler2D bloomTexture;
            varying vec2 vUv;
            void main() { gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv); }
          `,
        }),
        "baseTexture"
      );
      mixPass.needsSwap = true;

      finalComposer = new THREE.EffectComposer(renderer);
      finalComposer.addPass(renderScene);
      finalComposer.addPass(mixPass);
    } catch (e) { bloomComposer = finalComposer = null; console.warn("블룸 후처리 초기화 실패:", e); }

    // 조명 — 기본은 중립 화이트(색 왜곡 최소화), setLightColor()로 스튜디오 조명 색 변경 가능
    ambientLight = new THREE.AmbientLight(0xffffff, 0.75); scene.add(ambientLight);
    keyLight = new THREE.DirectionalLight(0xffffff, 0.8); keyLight.position.set(4, 6, 8); scene.add(keyLight);
    rimLight = new THREE.DirectionalLight(0xffffff, 0.4); rimLight.position.set(-6, -2, -4); scene.add(rimLight);
    backLight = new THREE.DirectionalLight(0xffffff, 0.6); backLight.position.set(0, 3, -8); scene.add(backLight); // 후면 보조광(양면 인쇄 확인용)

    hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.5); scene.add(hemiLight); // 하늘색만 조명색을 따름(바닥은 중립 유지)

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

    // 시멘트(콘크리트) 질감 텍스처 — 회색 얼룩/노이즈
    const cc = document.createElement("canvas"); cc.width = cc.height = 256;
    const cx2 = cc.getContext("2d");
    cx2.fillStyle = "#9096"; cx2.fillStyle = "#8f949b"; cx2.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      const v = 128 + (Math.random() - 0.5) * 70; // 밝기 편차
      const a = 0.05 + Math.random() * 0.12;
      cx2.fillStyle = `rgba(${v | 0},${v | 0},${(v * 1.02) | 0},${a.toFixed(2)})`;
      cx2.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // 큰 얼룩(콘크리트 반점)
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 26;
      const g = cx2.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < 0.5;
      g.addColorStop(0, dark ? "rgba(70,74,80,0.18)" : "rgba(190,194,200,0.15)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      cx2.fillStyle = g; cx2.beginPath(); cx2.arc(x, y, r, 0, Math.PI * 2); cx2.fill();
    }
    concreteTex = new THREE.CanvasTexture(cc);
    concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;

    // 우드(목재) 질감 텍스처 — 나뭇결 줄무늬 + 옹이
    const wc = document.createElement("canvas"); wc.width = wc.height = 256;
    const wx = wc.getContext("2d");
    wx.fillStyle = "#c9a877"; wx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      const y = Math.random() * 256, h = 1 + Math.random() * 3;
      const dark = Math.random() < 0.55;
      const a = 0.05 + Math.random() * 0.13;
      wx.fillStyle = dark ? `rgba(90,58,28,${a.toFixed(2)})` : `rgba(235,210,165,${a.toFixed(2)})`;
      wx.fillRect(0, y, 256, h);
    }
    for (let i = 0; i < 6; i++) { // 옹이 무늬
      const x = Math.random() * 256, y = Math.random() * 256, r = 8 + Math.random() * 14;
      const g = wx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(90,58,28,0.28)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      wx.fillStyle = g; wx.beginPath(); wx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); wx.fill();
    }
    woodTex = new THREE.CanvasTexture(wc);
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(1, 3);

    window.addEventListener("resize", onResize);
    inited = true;
    animate();
  }

  // 전면 재질: 선택한 표면 재질(유백/컬러/스테인리스/미러/우드 등)에 맞춰
  // 광택·거칠기·범프가 다른 조명 반응 재질을 사용(재질별 느낌 반영). 미지정/원단만 무광 평면 유지.
  function materialParams(spec, map) {
    map = map || texture;
    switch (spec.material) {
      case "mirror": // 미러 아크릴 — 거울 반사(디자인 은은히)
        return new THREE.MeshStandardMaterial({ map, color: 0xffffff, metalness: 0.55, roughness: 0.05, envMapIntensity: 2.0 });
      case "stainless": // 스테인리스 — 헤어라인 금속
        return new THREE.MeshStandardMaterial({ map, color: 0xdfe3e9, metalness: 0.7, roughness: 0.3, envMapIntensity: 1.5 });
      case "clear": // 투명 아크릴 — 디자인 색 그대로 + 약간 투명
        return new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
      case "color": // 컬러 아크릴 — 매끈한 광택 플라스틱(클리어코트)
        return new THREE.MeshPhysicalMaterial({ map, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
      case "milky": // 유백 아크릴 — 빛을 은은히 머금는 반투명 무광
        return new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.6, envMapIntensity: 0.45 });
      case "wood": // 우드(목재) — 나뭇결 범프 + 따뜻한 톤
        return new THREE.MeshStandardMaterial({ map, color: 0xdfc49c, roughness: 0.85, metalness: 0, bumpMap: woodTex, bumpScale: 0.018, envMapIntensity: 0.3 });
      default: // fabric 등 기타 — 디자인 색 그대로(무광 평면)
        return new THREE.MeshBasicMaterial({ map });
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

    const sideColor = new THREE.Color(
      spec.material === "stainless" || spec.material === "mirror" ? 0xbfc6cf :
      spec.material === "wood" ? 0xb08a5c :
      (spec.boardColor || "#dddddd")
    );
    const sideMat = new THREE.MeshStandardMaterial({
      color: sideColor,
      map: spec.material === "wood" ? woodTex : null,
      roughness: spec.material === "wood" ? 0.85 : 0.5,
      metalness: spec.material === "stainless" ? 0.8 : 0.1,
    });

    // 채널 글자 사용 여부 판단(한글/영문 외곽선 압출)
    const wantChannel = (letter === "front" || letter === "halo") && spec.letters && spec.letters.length;
    if (wantChannel) ensureFont(OT_DEFAULT); // 대체용 기본 폰트 확보
    const chLetters = wantChannel ? extrudableLetters(spec.letters) : [];
    const useChannel = chLetters.length > 0;

    // 후광(발광) 표시: 채널 글자가 있으면 글자별 후광(addChannelLetters)만 사용하고,
    // 글자가 없거나(문구 미입력) 발광 베이스(면발광/라운드/큐브)면 패널 전체에 은은한 발광판을 깐다.
    let haloOpacity = 0, haloColor = spec.lightColor || 0xffffff;
    if (letter === "halo") haloOpacity = useChannel ? 0 : 0.95;
    else if (base === "panel" || base === "round" || base === "cube") haloOpacity = 0.4;

    // 전면 재질: 채널이면 바탕색 배커, 아니면 디자인 텍스처(디자인 색 그대로 = 무광 평면)
    let faceMat;
    if (useChannel) {
      faceMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.boardColor || "#dddddd") });
    } else {
      faceMat = materialParams(spec, texture);
    }
    const backMat = spec.backDesign ? materialParams(spec, textureBack) : sideMat;

    if (kind === "cube") {
      const capMat = new THREE.MeshBasicMaterial({ color: 0xf3f5f9 });
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
      glowMesh.layers.enable(BLOOM_LAYER);
      signGroup.add(glowMesh);
    }

    // 트러스바 지지 구조
    if (base === "truss") addTruss(pw, ph, d);

    // 입체 채널 글자(영문/숫자)
    if (useChannel) addChannelLetters(spec, pw, ph, d, chLetters);

    scene.add(signGroup);
    applyMounting(spec, pw, ph, d);
  }

  // 채널 글자 외곽선 폰트(TTF) 지연 로드 — url별 캐시
  function ensureFont(url) {
    if (otState[url] || !window.opentype) return;
    otState[url] = "loading";
    window.opentype.load(url, (err, f) => {
      if (err || !f) { otState[url] = "fail"; console.warn("3D 글자 폰트 로드 실패:", url, err); return; }
      otFonts[url] = f; otState[url] = "ok";
      if (currentSpec) build(currentSpec);
    });
  }
  function usableFont(url) { return otFonts[url] || otFonts[OT_DEFAULT] || null; }

  // 텍스트가 있는 개체만 추림(줄바꿈 유지)
  function extrudableLetters(letters) {
    return letters
      .map((L) => ({ ...L, lines: (L.lines || []).map((s) => s.replace(/\s+$/g, "")) }))
      .filter((L) => L.lines.some((s) => s.trim().length));
  }

  // 글자 외곽선 → THREE.Shape → 압출 지오메트리 (targetEm = 3D 폰트 크기 단위)
  function buildTextGeometry(txt, targetEm, depth3d, otFont) {
    let shapes = [];
    try {
      const d = otFont.getPath(txt, 0, 0, 100).toPathData(2); // 100px em 기준 외곽선
      if (!d) return null;
      const parsed = new THREE.SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
      parsed.paths.forEach((p) => THREE.SVGLoader.createShapes(p).forEach((s) => shapes.push(s)));
    } catch (e) { return null; }
    if (!shapes.length) return null;

    const scale = targetEm / 100;        // 100px em → 목표 em(에디터와 동일 크기)
    const depthPx = depth3d / scale;
    const bevelPx = Math.min(depthPx * 0.07, 1.2);

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
    const halo = spec.letter === "halo";
    const depth3d = Math.min(0.26, d * 1.4 + 0.14);
    const glowColor = spec.lightColor || 0xfff2d6;

    chLetters.forEach((L) => {
      // 에디터 폰트에 맞는 TTF 사용(없으면 기본 폰트로 임시 렌더 후 로드되면 교체)
      const url = fontUrlFor(L.fontFamily, L.bold);
      if (!otState[url]) ensureFont(url);
      const otFont = usableFont(url);
      if (!otFont) return;

      const targetEm = Math.max(0.04, L.emFrac * ph); // 폰트 크기(em) = 에디터와 동일
      const col = new THREE.Color(L.fill || "#222222");
      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
      // 앞면발광: 글자 얼굴 자체가 은은히 빛남(블룸으로 번짐). 후광채널: 얼굴은 장면 조명의 영향을 받지 않는
      // unlit 재질로 지정한 글자색 그대로만 보이게 하고(밝게 뜨지 않음), 실제 후광은 별도 발광 실루엣만 담당.
      const mat = front
        ? new THREE.MeshStandardMaterial({ color: col, emissive: lum < 0.2 ? new THREE.Color(0xffffff) : col, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.0, side: THREE.DoubleSide })
        : new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });

      // 자동 줄바꿈된 각 줄을 위→아래로 배치(에디터 레이아웃과 동일)
      L.lines.forEach((line, i) => {
        if (!line.trim()) return;
        const geo = buildTextGeometry(line, targetEm, depth3d, otFont);
        if (!geo) return;
        const cyFrac = L.topFrac + (i + 0.5) * L.lineHFrac;
        const px = (L.cxFrac - 0.5) * pw, py = (0.5 - cyFrac) * ph;
        const angle = -L.angle * Math.PI / 180;
        const m = new THREE.Mesh(geo, mat);
        m.position.set(px, py, d / 2 + depth3d / 2);
        m.rotation.z = angle;
        if (front) m.layers.enable(BLOOM_LAYER); // 앞면발광: 글자 얼굴 자체가 빛남
        signGroup.add(m); // 후광채널은 BLOOM_LAYER에 넣지 않음 — 글자 얼굴은 절대 빛나지 않음

        // 후광 채널: 글자와 같은 모양(살짝 확대)의 발광 실루엣만 얼굴 바로 뒤에 배치 — 이 실루엣만 블룸 대상
        if (halo) {
          const glowGeo = buildTextGeometry(line, targetEm * 1.16, depth3d * 0.25, otFont);
          if (glowGeo) {
            const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: glowColor }));
            glow.position.set(px, py, d / 2 + 0.015);
            glow.rotation.z = angle;
            glow.layers.enable(BLOOM_LAYER);
            signGroup.add(glow);
          }
        }
      });
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
    const concrete = () => {
      if (concreteTex) concreteTex.repeat.set(3, 2.6);
      return new THREE.MeshStandardMaterial({
        color: 0x7f848a, roughness: 1.0, metalness: 0,
        map: concreteTex, bumpMap: concreteTex, bumpScale: 0.05,
      });
    };
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
    if (bloomComposer) bloomComposer.setSize(w, h);
    if (finalComposer) finalComposer.setSize(w, h);
    if (bloomPass) bloomPass.resolution.set(w, h);
  }

  function darkenNonBloomed(obj) {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
      bloomMatCache[obj.uuid] = obj.material;
      obj.material = darkMaterial;
    }
  }
  function restoreMaterial(obj) {
    if (bloomMatCache[obj.uuid]) {
      obj.material = bloomMatCache[obj.uuid];
      delete bloomMatCache[obj.uuid];
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (texture) texture.needsUpdate = true;
    if (textureBack) textureBack.needsUpdate = true;
    if (bloomComposer && finalComposer) {
      scene.traverse(darkenNonBloomed);
      bloomComposer.render();
      scene.traverse(restoreMaterial);
      finalComposer.render();
    } else if (renderer) {
      renderer.render(scene, camera);
    }
  }

  function onShow() { onResize(); refresh(); }

  // 3D 뷰 전체를 비추는 스튜디오 조명(앰비언트/키/림/백라이트) 색상 변경 — 후광(글로우) 색상과는 별개
  function setLightColor(hex) {
    const c = hex || "#ffffff";
    if (ambientLight) ambientLight.color.set(c);
    if (keyLight) keyLight.color.set(c);
    if (rimLight) rimLight.color.set(c);
    if (backLight) backLight.color.set(c);
    if (hemiLight) hemiLight.color.set(c); // 하늘색만(땅색은 중립 유지해 입체감 보존)
  }

  return { init, build, refresh, onShow, onResize, setLightColor };
})();
