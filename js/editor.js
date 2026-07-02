/* ===== 2D 에디터 (Fabric.js) — 앞면/뒷면 2개 캔버스 관리 ===== */
window.Editor = (function () {
  let onChange = () => {};
  let onSelect = () => {};
  const sides = {};        // front / back → fabric.Canvas
  let active = "front";
  const isText = (o) => o && (o.type === "textbox" || o.type === "i-text" || o.type === "text");

  function makeCanvas(id, bg) {
    const c = new fabric.Canvas(id, { backgroundColor: bg, preserveObjectStacking: true });
    ["object:modified", "object:added", "object:removed"].forEach((ev) => c.on(ev, fire));
    c.on("selection:created", () => { fire(); onSelect(c.getActiveObject()); });
    c.on("selection:updated", () => { fire(); onSelect(c.getActiveObject()); });
    c.on("selection:cleared", () => { fire(); onSelect(null); });
    return c;
  }

  function init(onChangeCb, onSelectCb) {
    onChange = onChangeCb || (() => {});
    onSelect = onSelectCb || (() => {});
    sides.front = makeCanvas("designCanvas", "#f4f4f4");
    sides.back = makeCanvas("designCanvasBack", "#f4f4f4");
    sides.front.wrapperEl.classList.add("side-canvas");
    sides.back.wrapperEl.classList.add("side-canvas");
    setActiveSide("front");
  }

  function fire() { onChange(); }
  function cur() { return sides[active]; }
  function eachCanvas(fn) { fn(sides.front); fn(sides.back); }

  function setActiveSide(side) {
    active = side;
    sides.front.wrapperEl.style.display = side === "front" ? "" : "none";
    sides.back.wrapperEl.style.display = side === "back" ? "" : "none";
    cur().renderAll();
    fire();
  }
  function getActiveSide() { return active; }

  function setSize(widthMM, heightMM) {
    const maxW = 820, maxH = 460;
    const scale = Math.min(maxW / widthMM, maxH / heightMM);
    const nw = Math.round(widthMM * scale), nh = Math.round(heightMM * scale);
    eachCanvas((c) => {
      const ow = c.getWidth(), oh = c.getHeight();
      // 캔버스 비율 변화에 맞춰 개체 위치/크기 비례 재배치(화면 밖 이탈 방지)
      if (ow && oh && (ow !== nw || oh !== nh)) {
        const sx = nw / ow, sy = nh / oh;
        c.getObjects().forEach((o) => {
          o.left *= sx; o.top *= sy;
          o.scaleX *= sx; o.scaleY *= sy;
          o.setCoords();
        });
      }
      c.setWidth(nw); c.setHeight(nh); c.renderAll();
    });
    fire();
  }

  function setBg(color) { // 현재 편집 중인 면만
    cur().setBackgroundColor(color, cur().renderAll.bind(cur()));
    fire();
  }
  function setBgBoth(color) {
    eachCanvas((c) => c.setBackgroundColor(color, c.renderAll.bind(c)));
    fire();
  }

  function addText(text, opts) {
    const c = cur();
    const t = new fabric.Textbox(text || "텍스트", {
      left: c.getWidth() / 2, top: c.getHeight() / 2,
      originX: "center", originY: "center",
      fontFamily: opts.fontFamily || "Noto Sans KR",
      fontSize: opts.fontSize || 60,
      fill: opts.fill || "#111111",
      fontWeight: opts.bold ? "700" : "400",
      textAlign: "center", editable: false, // 캔버스 직접입력 대신 좌측 입력창으로(한글 IME 안전)
    });
    c.add(t).setActiveObject(t); c.renderAll(); fire();
  }

  function addShape(kind) {
    const c = cur();
    const cx = c.getWidth() / 2, cy = c.getHeight() / 2;
    let obj;
    if (kind === "rect") obj = new fabric.Rect({ width: 140, height: 90, fill: "", stroke: "#111", strokeWidth: 3, left: cx, top: cy, originX: "center", originY: "center" });
    else if (kind === "circle") obj = new fabric.Circle({ radius: 60, fill: "", stroke: "#111", strokeWidth: 3, left: cx, top: cy, originX: "center", originY: "center" });
    else if (kind === "line") obj = new fabric.Line([cx - 80, cy, cx + 80, cy], { stroke: "#111", strokeWidth: 4 });
    if (obj) { c.add(obj).setActiveObject(obj); c.renderAll(); fire(); }
  }

  function addImage(dataUrl) {
    const c = cur();
    fabric.Image.fromURL(dataUrl, (img) => {
      const max = Math.min(c.getWidth(), c.getHeight()) * 0.5;
      if (img.width > max) img.scaleToWidth(max);
      img.set({ left: c.getWidth() / 2, top: c.getHeight() / 2, originX: "center", originY: "center" });
      c.add(img).setActiveObject(img); c.renderAll(); fire();
    });
  }

  function applyToSelection(props) {
    const obj = cur().getActiveObject();
    if (!obj) return;
    Object.entries(props).forEach(([k, v]) => obj.set(k, v));
    cur().renderAll(); fire();
  }

  // 선택된 텍스트 개체의 문구를 실시간 수정(한글 IME 안전 경로)
  function setSelectedText(t) {
    const o = cur().getActiveObject();
    if (isText(o)) { o.set("text", t); cur().renderAll(); fire(); }
  }
  function getSelectedText() {
    const o = cur().getActiveObject();
    return isText(o) ? o.text : null;
  }

  function deselectAll() {
    eachCanvas((c) => { c.discardActiveObject(); c.renderAll(); });
    fire();
  }

  function deleteSelection() {
    const c = cur();
    c.getActiveObjects().forEach((o) => c.remove(o));
    c.discardActiveObject(); c.renderAll(); fire();
  }

  // 앞면 디자인을 뒷면으로 복사(배경 포함)
  function copyFrontToBack() {
    const json = sides.front.toJSON();
    sides.back.loadFromJSON(json, () => { sides.back.renderAll(); fire(); });
  }

  // 3D 입체 채널 글자용 — 텍스트 개체를 캔버스 비율 좌표로 반환
  function getTextObjects(side) {
    const c = sides[side || "front"];
    const Wc = c.getWidth(), Hc = c.getHeight();
    return c.getObjects()
      .filter((o) => o.type === "textbox" || o.type === "text" || o.type === "i-text")
      .map((o) => {
        const r = o.getBoundingRect(true, true);
        const lines = (o._textLines && o._textLines.length) ? o._textLines.map((l) => l.join("")) : [o.text || ""];
        const lineH = o.fontSize * (o.lineHeight || 1.16) * (o.scaleY || 1);
        return {
          lines,                                          // 자동 줄바꿈된 줄 목록
          cxFrac: (r.left + r.width / 2) / Wc,            // 중심 x
          topFrac: r.top / Hc,                            // 윗변 y
          lineHFrac: lineH / Hc,                          // 줄 높이
          emFrac: (o.fontSize * (o.scaleY || 1)) / Hc,    // 폰트 크기(em) = 3D 글자 크기
          fill: typeof o.fill === "string" ? o.fill : "#222222",
          angle: o.angle || 0,
          fontFamily: o.fontFamily || "Noto Sans KR",
          bold: o.fontWeight === "700" || o.fontWeight === "bold",
        };
      });
  }

  function getElement(side) { return sides[side || "front"].getElement(); }
  function getCanvas(side) { return sides[side || active]; }
  function toSVG(side) { return sides[side || active].toSVG(); }
  function toDataURL(side) { return sides[side || active].toDataURL({ format: "png", multiplier: 2 }); }

  return {
    init, setActiveSide, getActiveSide, setSize, setBg, setBgBoth,
    addText, addShape, addImage, applyToSelection, deselectAll, deleteSelection, copyFrontToBack,
    setSelectedText, getSelectedText,
    getElement, getCanvas, getTextObjects, toSVG, toDataURL,
  };
})();
