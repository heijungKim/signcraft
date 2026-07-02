/* ===== 메인 앱 (제품별 동적 옵션 ↔ 에디터 ↔ 3D ↔ 견적) ===== */
(function () {
  const $ = (id) => document.getElementById(id);

  const state = { productType: "acrylic", values: {}, widthMM: 600, heightMM: 300, qty: 1 };
  let lastQuote = null;

  function currentSpec() {
    return { productType: state.productType, values: state.values, widthMM: state.widthMM, heightMM: state.heightMM, qty: state.qty };
  }

  // ---- 제품 옵션 UI 동적 렌더 ----
  function renderOptions() {
    const prod = PRODUCTS.get(state.productType);
    $("optTitle").textContent = prod.label + " 옵션";
    $("productDesc").textContent = prod.desc || "";
    const wrap = $("productOptions");
    wrap.innerHTML = "";
    prod.fields.forEach((f) => {
      const lab = document.createElement("label");
      lab.textContent = f.label;
      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        f.options.forEach((o) => {
          const op = document.createElement("option");
          op.value = o.v; op.textContent = o.t;
          input.appendChild(op);
        });
      } else if (f.type === "color") {
        input = document.createElement("input"); input.type = "color";
      } else {
        input = document.createElement("input"); input.type = "text";
      }
      input.value = state.values[f.id];
      const handler = () => { state.values[f.id] = input.value; onFieldChange(f.id); };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
      lab.appendChild(input);
      wrap.appendChild(lab);
    });
  }

  function renderPresets() {
    const wrap = $("sizePresets");
    wrap.innerHTML = "";
    (PRODUCTS.get(state.productType).presets || []).forEach(([w, h]) => {
      const b = document.createElement("button");
      b.textContent = w + "×" + h;
      b.addEventListener("click", () => setSize(w, h));
      wrap.appendChild(b);
    });
  }

  function onFieldChange(id) {
    if (id === "boardColor") Editor.setBg(state.values.boardColor);
    if (id === "printSide") updateSideSwitch();
    updateAll();
  }

  // ---- 크기 ----
  function setSize(w, h) {
    state.widthMM = w; state.heightMM = h;
    $("widthMM").value = w; $("heightMM").value = h;
    Editor.setSize(w, h);
    updateAll();
  }

  // ---- 제품 전환 ----
  function switchProduct(pt) {
    state.productType = pt;
    state.values = PRODUCTS.defaults(pt);
    const sz = PRODUCTS.get(pt).size;
    state.widthMM = sz.w; state.heightMM = sz.h;
    $("widthMM").value = sz.w; $("heightMM").value = sz.h;
    document.querySelectorAll("#productTabs button").forEach((b) => b.classList.toggle("active", b.dataset.p === pt));
    renderOptions();
    renderPresets();
    Editor.setBgBoth(state.values.boardColor);
    Editor.setSize(sz.w, sz.h);
    updateSideSwitch();
    updateAll();
  }

  // ---- 양면(앞/뒤) 편집 전환 UI ----
  function isDouble() {
    return state.productType === "banner" && state.values.printSide === "double";
  }
  function updateSideSwitch() {
    const show = isDouble();
    $("sideSwitch").style.display = show ? "" : "none";
    if (!show) {
      Editor.setActiveSide("front");
      document.querySelectorAll("#sideSwitch button[data-side]").forEach((b) => b.classList.toggle("active", b.dataset.side === "front"));
    }
  }

  // ---- 3D + 견적 갱신 ----
  function updateAll() {
    const spec = currentSpec();
    const r = PRODUCTS.render3d(spec);
    const doublePrint = spec.productType === "banner" && spec.values.printSide === "double";
    Preview3D.build({
      widthMM: spec.widthMM, heightMM: spec.heightMM,
      material: r.material, boardColor: spec.values.boardColor, thickness: r.depthMM,
      backDesign: doublePrint,
      lighting: spec.productType === "sign" ? spec.values.lighting : "none",
    });
    Preview3D.refresh();
    updateQuote(spec);
  }

  function updateQuote(spec) {
    const q = Quote.calc(spec);
    lastQuote = q;
    $("qProduct").textContent = q.productText;
    $("qArea").textContent = q.areaText;
    $("qBase").textContent = q.baseText;
    $("qOption").textContent = q.addText;
    $("qTotal").textContent = q.totalText;
    $("quoteSpec").innerHTML = PRODUCTS.summarize(spec)
      .map(([k, v]) => `<div class="sl"><span>${k}</span><b>${v}</b></div>`).join("");
  }

  // ---- 초기화 ----
  Editor.init(() => Preview3D.refresh());
  state.values = PRODUCTS.defaults("acrylic");
  Editor.setBgBoth(state.values.boardColor);
  Editor.setSize(state.widthMM, state.heightMM);
  Editor.addText("OPEN", { fontFamily: "Black Han Sans", fontSize: 90, fill: "#111111" });
  renderOptions();
  renderPresets();

  try { Preview3D.init(Editor.getElement("front"), Editor.getElement("back")); }
  catch (e) { console.error("3D 미리보기 초기화 실패:", e); }
  updateSideSwitch();
  updateAll();

  // ---- 제품 탭 ----
  document.querySelectorAll("#productTabs button").forEach((b) =>
    b.addEventListener("click", () => switchProduct(b.dataset.p))
  );

  // ---- 크기 입력 ----
  $("widthMM").addEventListener("input", () => { state.widthMM = +$("widthMM").value || 100; Editor.setSize(state.widthMM, state.heightMM); updateAll(); });
  $("heightMM").addEventListener("input", () => { state.heightMM = +$("heightMM").value || 100; Editor.setSize(state.widthMM, state.heightMM); updateAll(); });

  // ---- 앞/뒤 면 전환 ----
  document.querySelectorAll("#sideSwitch button[data-side]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#sideSwitch button[data-side]").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      Editor.setActiveSide(b.dataset.side);
    })
  );
  $("copyToBack").addEventListener("click", () => { Editor.copyFrontToBack(); Preview3D.refresh(); });

  // ---- 텍스트 ----
  $("addText").addEventListener("click", () => {
    Editor.addText($("textInput").value || "텍스트", {
      fontFamily: $("fontFamily").value, fontSize: +$("fontSize").value,
      fill: $("fontColor").value, bold: $("fontBold").checked,
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

  // ---- 수량 ----
  $("qty").addEventListener("input", () => { state.qty = +$("qty").value || 1; updateQuote(currentSpec()); });

  // ---- 탭 전환 (에디터 / 3D) ----
  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.view === "edit" ? "editView" : "view3d").classList.add("active");
      if (tab.dataset.view === "view3d") { Editor.deselectAll(); setTimeout(() => Preview3D.onShow(), 30); }
    })
  );

  // ---- 출력 ----
  $("exportSVG").addEventListener("click", () => Exporter.exportSVG(currentSpec()));
  $("exportPNG").addEventListener("click", () => Exporter.exportPNG(currentSpec()));

  // ---- 제작 요청 모달 ----
  const modal = $("modal");
  $("requestBtn").addEventListener("click", () => {
    const spec = currentSpec();
    updateQuote(spec);
    const rows = [
      ["제품", PRODUCTS.label(spec.productType)],
      ["크기", spec.widthMM + "×" + spec.heightMM + "mm"],
      ...PRODUCTS.summarize(spec),
      ["수량", lastQuote.qty + "개"],
      ["예상 견적(VAT별도)", lastQuote.totalText],
    ];
    $("orderSummary").innerHTML = rows
      .map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join("");
    modal.classList.remove("hidden");
  });
  $("modalClose").addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });

  function readReq() { return { name: $("reqName").value, contact: $("reqContact").value, memo: $("reqMemo").value }; }
  $("submitReq").addEventListener("click", () => {
    Exporter.exportOrder(currentSpec(), lastQuote, readReq());
    alert("벡터 파일(SVG)과 사양서(JSON)가 다운로드됩니다.\n담당자에게 전달해 주세요!");
  });
  $("mailReq").addEventListener("click", () => Exporter.mailOrder(currentSpec(), lastQuote, readReq()));
})();
