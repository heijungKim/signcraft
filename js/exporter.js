/* ===== 벡터 출력 / 파일 다운로드 ===== */
window.Exporter = (function () {

  function download(filename, blobOrUrl) {
    const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // 실제 mm 규격이 반영된 SVG(벡터)로 출력 → 일러스트레이터에서 정확한 크기로 열림
  function buildSVG(spec) {
    let svg = Editor.toSVG(); // fabric SVG (px 기준)
    const w = spec.widthMM, h = spec.heightMM;
    // 캔버스 픽셀 → mm 단위계로 치환 (width/height + viewBox 유지)
    svg = svg.replace(
      /<svg[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `version="1.1" width="${w}mm" height="${h}mm" ` +
      `viewBox="0 0 ${Editor.getCanvas().getWidth()} ${Editor.getCanvas().getHeight()}" ` +
      `data-material="${spec.material}" data-thickness="${spec.thickness}mm" ` +
      `data-size="${w}x${h}mm">`
    );
    return svg;
  }

  function exportSVG(spec) {
    const svg = buildSVG(spec);
    download(filename(spec, "svg"), new Blob([svg], { type: "image/svg+xml" }));
  }

  function exportPNG(spec) {
    download(filename(spec, "png"), Editor.toDataURL());
  }

  function filename(spec, ext) {
    const p = Quote.PRODUCT_LABEL[spec.productType] || "sign";
    return `signcraft_${p}_${spec.widthMM}x${spec.heightMM}.${ext}`.replace(/\s+/g, "");
  }

  // 제작 요청 패키지: 벡터(SVG) + 사양서(JSON) 동시 다운로드
  function exportOrder(spec, quote, req) {
    exportSVG(spec);
    const order = {
      주문일시: new Date().toISOString(),
      제품: Quote.PRODUCT_LABEL[spec.productType],
      재질: Quote.MATERIAL_LABEL[spec.material],
      두께: spec.thickness + "mm",
      크기: spec.widthMM + "×" + spec.heightMM + "mm",
      바탕색: spec.boardColor,
      옵션: { 재단절곡: !!spec.optCut, LED: !!spec.optLed },
      수량: quote.qty,
      예상견적_VAT별도: quote.totalText,
      요청자: req.name, 연락처: req.contact, 요청사항: req.memo,
      벡터파일: filename(spec, "svg"),
    };
    setTimeout(() => {
      download(filename(spec, "svg").replace(".svg", "_사양서.json"),
        new Blob([JSON.stringify(order, null, 2)], { type: "application/json" }));
    }, 400);
    return order;
  }

  function mailOrder(spec, quote, req) {
    const subject = encodeURIComponent(`[제작요청] ${Quote.PRODUCT_LABEL[spec.productType]} ${spec.widthMM}×${spec.heightMM}mm`);
    const body = encodeURIComponent(
      `■ 제작 요청서\n` +
      `제품: ${Quote.PRODUCT_LABEL[spec.productType]}\n` +
      `재질: ${Quote.MATERIAL_LABEL[spec.material]} / ${spec.thickness}mm\n` +
      `크기: ${spec.widthMM}×${spec.heightMM}mm\n` +
      `수량: ${quote.qty}\n` +
      `예상 견적(VAT별도): ${quote.totalText}\n` +
      `요청자: ${req.name}\n연락처: ${req.contact}\n요청사항: ${req.memo}\n\n` +
      `※ 벡터(SVG) 원본 파일을 첨부해 주세요.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return { exportSVG, exportPNG, exportOrder, mailOrder, download };
})();
