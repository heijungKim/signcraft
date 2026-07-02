/* ===== 견적 계산 (제품별 옵션 기반) ===== */
window.Quote = (function () {
  const won = (n) => "₩" + Math.round(n).toLocaleString("ko-KR");

  function calc(spec) {
    const prod = PRODUCTS.get(spec.productType);
    const areaM2 = (spec.widthMM / 1000) * (spec.heightMM / 1000);

    let rate = prod.baseRate, mult = 1, add = 0;
    prod.fields.forEach((f) => {
      const o = PRODUCTS.optOf(f, spec.values[f.id]);
      if (!o) return;
      if (o.rate) rate = o.rate;
      if (o.mult) mult *= o.mult;
      if (o.add) add += o.add;
    });

    let base = areaM2 * rate * mult;
    if (base < 30000) base = 30000; // 최소 제작비

    const perUnit = base + add;
    const qty = Math.max(1, spec.qty || 1);
    const total = perUnit * qty;

    return {
      areaM2, base, add, perUnit, qty, total,
      productText: prod.label,
      areaText: areaM2.toFixed(3) + " m² (" + spec.widthMM + "×" + spec.heightMM + "mm)",
      baseText: won(base), addText: won(add), totalText: won(total),
    };
  }

  return { calc, won };
})();
