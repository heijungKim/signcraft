/* ===== 2D 에디터 (Fabric.js) — 앞면/뒷면 2개 캔버스 관리 ===== */
window.Editor = (function () {
  let onChange = () => {};
  const sides = {};        // front / back → fabric.Canvas
  let active = "front";

  function makeCanvas(id, bg) {
    const c = new fabric.Canvas(id, { backgroundColor: bg, preserveObjectStacking: true });
    ["object:modified", "object:added", "object:removed", "selection:created", "selection:updated"]
      .forEach((ev) => c.on(ev, fire));
    return c;
  }

  function init(onChangeCb) {
    onChange = onChangeCb || (() => {});
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
      textAlign: "center", editable: true,
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

  function getElement(side) { return sides[side || "front"].getElement(); }
  function getCanvas(side) { return sides[side || active]; }
  function toSVG(side) { return sides[side || active].toSVG(); }
  function toDataURL(side) { return sides[side || active].toDataURL({ format: "png", multiplier: 2 }); }

  return {
    init, setActiveSide, getActiveSide, setSize, setBg, setBgBoth,
    addText, addShape, addImage, applyToSelection, deleteSelection, copyFrontToBack,
    getElement, getCanvas, toSVG, toDataURL,
  };
})();
