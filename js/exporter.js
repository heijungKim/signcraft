/* ===== 벡터 출력 / 파일 다운로드 ===== */
window.Exporter = (function () {

  function download(filename, blobOrUrl) {
    const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function isDouble(spec) {
    return spec.productType === "banner" && spec.values.printSide === "double";
  }

  function filename(spec, ext, side) {
    const suffix = side ? `_${side === "back" ? "뒷면" : "앞면"}` : "";
    return `signcraft_${PRODUCTS.label(spec.productType)}_${spec.widthMM}x${spec.heightMM}${suffix}.${ext}`;
  }

  // 실제 mm 규격이 반영된 SVG(벡터) → 일러스트에서 정확한 크기로 열림
  function buildSVG(spec, side) {
    let svg = Editor.toSVG(side);
    const w = spec.widthMM, h = spec.heightMM;
    svg = svg.replace(
      /<svg[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `version="1.1" width="${w}mm" height="${h}mm" ` +
      `viewBox="0 0 ${Editor.getCanvas(side).getWidth()} ${Editor.getCanvas(side).getHeight()}" ` +
      `data-product="${PRODUCTS.label(spec.productType)}" data-size="${w}x${h}mm"` +
      `${side ? ` data-side="${side}"` : ""}>`
    );
    return svg;
  }

  function exportSVG(spec) {
    if (isDouble(spec)) {
      download(filename(spec, "svg", "front"), new Blob([buildSVG(spec, "front")], { type: "image/svg+xml" }));
      setTimeout(() => download(filename(spec, "svg", "back"), new Blob([buildSVG(spec, "back")], { type: "image/svg+xml" })), 350);
    } else {
      download(filename(spec, "svg"), new Blob([buildSVG(spec, "front")], { type: "image/svg+xml" }));
    }
  }
  function exportPNG(spec) {
    if (isDouble(spec)) {
      download(filename(spec, "png", "front"), Editor.toDataURL("front"));
      setTimeout(() => download(filename(spec, "png", "back"), Editor.toDataURL("back")), 350);
    } else {
      download(filename(spec, "png"), Editor.toDataURL("front"));
    }
  }

  function specObject(spec) {
    const o = {};
    PRODUCTS.summarize(spec).forEach(([k, v]) => (o[k] = v));
    return o;
  }

  // 제작 요청 패키지: 벡터(SVG) + 사양서(JSON) 동시 다운로드
  function exportOrder(spec, quote, req) {
    exportSVG(spec);
    const files = isDouble(spec)
      ? [filename(spec, "svg", "front"), filename(spec, "svg", "back")]
      : [filename(spec, "svg")];
    const order = {
      주문일시: new Date().toISOString(),
      제품: PRODUCTS.label(spec.productType),
      크기: spec.widthMM + "×" + spec.heightMM + "mm",
      바탕색: spec.values.boardColor,
      옵션: specObject(spec),
      수량: quote.qty,
      예상견적_VAT별도: quote.totalText,
      요청자: req.name, 연락처: req.contact, 요청사항: req.memo,
      벡터파일: files,
    };
    setTimeout(() => {
      download(filename(spec, "svg").replace(".svg", "_사양서.json"),
        new Blob([JSON.stringify(order, null, 2)], { type: "application/json" }));
    }, 700);
    return order;
  }

  function mailOrder(spec, quote, req) {
    const opts = PRODUCTS.summarize(spec).map(([k, v]) => `${k}: ${v}`).join("\n");
    const subject = encodeURIComponent(`[제작요청] ${PRODUCTS.label(spec.productType)} ${spec.widthMM}×${spec.heightMM}mm`);
    const body = encodeURIComponent(
      `■ 제작 요청서\n` +
      `제품: ${PRODUCTS.label(spec.productType)}\n` +
      `크기: ${spec.widthMM}×${spec.heightMM}mm\n` +
      `${opts}\n` +
      `수량: ${quote.qty}\n` +
      `예상 견적(VAT별도): ${quote.totalText}\n` +
      `요청자: ${req.name}\n연락처: ${req.contact}\n요청사항: ${req.memo}\n\n` +
      `※ 벡터(SVG) 원본 파일을 첨부해 주세요.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return { exportSVG, exportPNG, exportOrder, mailOrder, download };
})();
