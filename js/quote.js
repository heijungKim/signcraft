/* ===== 견적 계산 로직 =====
   면적(m²) 기준 재질 단가 + 두께 배수 + 옵션. 실제 단가는 사업장에 맞게 조정하세요. */
window.Quote = (function () {
  // 재질별 m² 단가 (원)
  const MATERIAL_RATE = {
    clear:     120000, // 투명 아크릴
    milky:     130000, // 유백 아크릴
    color:     140000, // 컬러 아크릴
    mirror:    180000, // 미러 아크릴
    stainless: 260000, // 스테인리스
    wood:      150000, // 우드
  };
  const MATERIAL_LABEL = {
    clear: "투명 아크릴", milky: "유백 아크릴", color: "컬러 아크릴",
    mirror: "미러 아크릴", stainless: "스테인리스", wood: "우드",
  };
  const PRODUCT_LABEL = {
    acrylic: "아크릴 간판", banner: "현수막(배너)",
    channel: "채널 간판", metal: "금속 간판",
  };
  // 두께 배수
  const THICKNESS_MULT = { "3": 0.85, "5": 1.0, "8": 1.25, "10": 1.5 };
  // 제품 종류 배수
  const PRODUCT_MULT = { acrylic: 1.0, banner: 0.4, channel: 1.6, metal: 1.4 };

  const won = (n) => "₩" + Math.round(n).toLocaleString("ko-KR");

  function calc(spec) {
    const areaM2 = (spec.widthMM / 1000) * (spec.heightMM / 1000);
    const rate = MATERIAL_RATE[spec.material] || 120000;
    const thick = THICKNESS_MULT[String(spec.thickness)] || 1;
    const prod = PRODUCT_MULT[spec.productType] || 1;

    let base = areaM2 * rate * thick * prod;
    if (base < 30000) base = 30000; // 최소 제작비

    let option = 0;
    if (spec.optCut) option += base * 0.15;      // 재단/절곡
    if (spec.optLed) option += 45000;            // LED

    const perUnit = base + option;
    const qty = Math.max(1, spec.qty || 1);
    const total = perUnit * qty;

    return {
      areaM2, base, option, perUnit, total, qty,
      areaText: areaM2.toFixed(3) + " m² (" + spec.widthMM + "×" + spec.heightMM + "mm)",
      materialText: (MATERIAL_LABEL[spec.material] || spec.material) + " · " + spec.thickness + "mm",
      productText: PRODUCT_LABEL[spec.productType] || spec.productType,
      baseText: won(base), optionText: won(option), totalText: won(total),
    };
  }

  return { calc, won, MATERIAL_LABEL, PRODUCT_LABEL };
})();
