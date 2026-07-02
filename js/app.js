/* ===== 메인 앱 (컨트롤 ↔ 에디터 ↔ 3D ↔ 견적 연결) ===== */
(function () {
  const $ = (id) => document.getElementById(id);

  function readSpec() {
    return {
      productType: $("productType").value,
      material: $("material").value,
      boardColor: $("boardColor").value,
      thickness: $("thickness").value,
      widthMM: +$("widthMM").value || 600,
      heightMM: +$("heightMM").value || 300,
      optCut: $("optCut").checked,
      optLed: $("optLed").checked,
      qty: +$("qty").value || 1,
    };
  }

  let lastQuote = null;

  function updateQuote() {
    const spec = readSpec();
    const q = Quote.calc(spec);
    lastQuote = q;
    $("qArea").textContent = q.areaText;
    $("qMaterial").textContent = q.materialText;
    $("qBase").textContent = q.baseText;
    $("qOption").textContent = q.optionText;
    $("qTotal").textContent = q.totalText;
  }

  function updateAll() {
    const spec = readSpec();
    Preview3D.build(spec);
    Preview3D.refresh();
    updateQuote();
  }

  // ---- 초기화 ----
  Editor.init(() => { Preview3D.refresh(); });
  const spec0 = readSpec();
  Editor.setSize(spec0.widthMM, spec0.heightMM, spec0.boardColor);
  Editor.addText("OPEN", { fontFamily: "Black Han Sans", fontSize: 90, fill: "#111111" });

  let has3D = false;
  try {
    Preview3D.init(Editor.getElement());
    has3D = true;
  } catch (e) {
    console.error("3D 미리보기 초기화 실패:", e);
  }
  updateAll();

  // ---- 좌측 컨트롤 ----
  $("productType").addEventListener("change", updateAll);
  $("material").addEventListener("change", updateAll);
  $("thickness").addEventListener("change", updateAll);
  $("boardColor").addEventListener("input", () => { Editor.setBg($("boardColor").value); updateAll(); });

  function onSizeChange() {
    const s = readSpec();
    Editor.setSize(s.widthMM, s.heightMM, s.boardColor);
    updateAll();
  }
  $("widthMM").addEventListener("input", onSizeChange);
  $("heightMM").addEventListener("input", onSizeChange);
  document.querySelectorAll(".presets [data-w]").forEach((b) =>
    b.addEventListener("click", () => {
      $("widthMM").value = b.dataset.w; $("heightMM").value = b.dataset.h; onSizeChange();
    })
  );

  // ---- 텍스트 ----
  $("addText").addEventListener("click", () => {
    Editor.addText($("textInput").value || "텍스트", {
      fontFamily: $("fontFamily").value,
      fontSize: +$("fontSize").value,
      fill: $("fontColor").value,
      bold: $("fontBold").checked,
    });
  });
  $("fontFamily").addEventListener("change", () => Editor.applyToSelection({ fontFamily: $("fontFamily").value }));
  $("fontSize").addEventListener("change", () => Editor.applyToSelection({ fontSize: +$("fontSize").value }));
  $("fontColor").addEventListener("input", () => Editor.applyToSelection({ fill: $("fontColor").value }));
  $("fontBold").addEventListener("change", () => Editor.applyToSelection({ fontWeight: $("fontBold").checked ? "700" : "400" }));

  // ---- 도형 / 이미지 ----
  $("addRect").addEventListener("click", () => Editor.addShape("rect"));
  $("addCircle").addEventListener("click", () => Editor.addShape("circle"));
  $("addLine").addEventListener("click", () => Editor.addShape("line"));
  $("deleteSel").addEventListener("click", () => Editor.deleteSelection());
  $("imgUpload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => Editor.addImage(ev.target.result);
    reader.readAsDataURL(file);
  });

  // ---- 견적 옵션 ----
  ["optCut", "optLed", "qty"].forEach((id) => $(id).addEventListener("input", updateQuote));

  // ---- 탭 전환 ----
  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      const view = $(tab.dataset.view === "edit" ? "editView" : "view3d");
      view.classList.add("active");
      if (tab.dataset.view === "view3d") setTimeout(() => Preview3D.onShow(), 30);
    })
  );

  // ---- 출력 ----
  $("exportSVG").addEventListener("click", () => Exporter.exportSVG(readSpec()));
  $("exportPNG").addEventListener("click", () => Exporter.exportPNG(readSpec()));

  // ---- 제작 요청 모달 ----
  const modal = $("modal");
  $("requestBtn").addEventListener("click", () => {
    updateQuote();
    const spec = readSpec(), q = lastQuote;
    $("orderSummary").innerHTML = [
      ["제품", Quote.PRODUCT_LABEL[spec.productType]],
      ["재질 / 두께", q.materialText],
      ["크기", spec.widthMM + "×" + spec.heightMM + "mm"],
      ["옵션", [spec.optCut && "재단·절곡", spec.optLed && "LED"].filter(Boolean).join(", ") || "없음"],
      ["수량", q.qty + "개"],
      ["예상 견적(VAT별도)", q.totalText],
    ].map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join("");
    modal.classList.remove("hidden");
  });
  $("modalClose").addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });

  function readReq() {
    return { name: $("reqName").value, contact: $("reqContact").value, memo: $("reqMemo").value };
  }
  $("submitReq").addEventListener("click", () => {
    Exporter.exportOrder(readSpec(), lastQuote, readReq());
    alert("벡터 파일(SVG)과 사양서(JSON)가 다운로드됩니다.\n담당자에게 전달해 주세요!");
  });
  $("mailReq").addEventListener("click", () => Exporter.mailOrder(readSpec(), lastQuote, readReq()));
})();
