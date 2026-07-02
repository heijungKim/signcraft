/* ===== 2D 에디터 (Fabric.js) ===== */
window.Editor = (function () {
  let canvas;
  let onChange = () => {};
  const MM_TO_PX = 800 / 600; // 초기 기준(가로 600mm → 800px). setSize에서 재계산.
  let pxPerMM = 800 / 600;

  function init(onChangeCb) {
    onChange = onChangeCb || (() => {});
    canvas = new fabric.Canvas("designCanvas", {
      backgroundColor: "#f4f4f4",
      preserveObjectStacking: true,
    });

    canvas.on("object:modified", fire);
    canvas.on("object:added", fire);
    canvas.on("object:removed", fire);
    canvas.on("selection:created", fire);
    canvas.on("selection:updated", fire);
    return canvas;
  }

  function fire() { onChange(); }

  // 캔버스를 실제 비율(mm)에 맞춰 리사이즈. 최대 표시 폭 800px 기준.
  function setSize(widthMM, heightMM, bgColor) {
    const maxW = 820, maxH = 460;
    const scale = Math.min(maxW / widthMM, maxH / heightMM);
    pxPerMM = scale;
    canvas.setWidth(Math.round(widthMM * scale));
    canvas.setHeight(Math.round(heightMM * scale));
    if (bgColor) canvas.setBackgroundColor(bgColor, canvas.renderAll.bind(canvas));
    canvas.renderAll();
    fire();
  }

  function setBg(color) {
    canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    fire();
  }

  function addText(text, opts) {
    const t = new fabric.Textbox(text || "텍스트", {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center", originY: "center",
      fontFamily: opts.fontFamily || "Noto Sans KR",
      fontSize: opts.fontSize || 60,
      fill: opts.fill || "#111111",
      fontWeight: opts.bold ? "700" : "400",
      textAlign: "center",
      editable: true,
    });
    canvas.add(t).setActiveObject(t);
    canvas.renderAll();
    fire();
  }

  function addShape(kind) {
    let obj;
    const cx = canvas.getWidth() / 2, cy = canvas.getHeight() / 2;
    if (kind === "rect") {
      obj = new fabric.Rect({ width: 140, height: 90, fill: "", stroke: "#111", strokeWidth: 3, left: cx, top: cy, originX: "center", originY: "center" });
    } else if (kind === "circle") {
      obj = new fabric.Circle({ radius: 60, fill: "", stroke: "#111", strokeWidth: 3, left: cx, top: cy, originX: "center", originY: "center" });
    } else if (kind === "line") {
      obj = new fabric.Line([cx - 80, cy, cx + 80, cy], { stroke: "#111", strokeWidth: 4 });
    }
    if (obj) { canvas.add(obj).setActiveObject(obj); canvas.renderAll(); fire(); }
  }

  function addImage(dataUrl) {
    fabric.Image.fromURL(dataUrl, (img) => {
      const max = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.5;
      if (img.width > max) img.scaleToWidth(max);
      img.set({ left: canvas.getWidth() / 2, top: canvas.getHeight() / 2, originX: "center", originY: "center" });
      canvas.add(img).setActiveObject(img);
      canvas.renderAll(); fire();
    });
  }

  function applyToSelection(props) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    Object.entries(props).forEach(([k, v]) => obj.set(k, v));
    canvas.renderAll(); fire();
  }

  function deleteSelection() {
    const objs = canvas.getActiveObjects();
    objs.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.renderAll(); fire();
  }

  function getCanvas() { return canvas; }
  function getElement() { return canvas.getElement(); }
  function toSVG() { return canvas.toSVG(); }
  function toDataURL() { return canvas.toDataURL({ format: "png", multiplier: 2 }); }

  return {
    init, setSize, setBg, addText, addShape, addImage,
    applyToSelection, deleteSelection, getCanvas, getElement, toSVG, toDataURL,
  };
})();
