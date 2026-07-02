/* ===== 제품별 옵션 · 단가 정의 (데이터 기반) =====
   각 옵션값은 가격에 영향:
     rate = 면적당(m²) 기본 단가 지정(덮어씀)
     mult = 배수 곱
     add  = 정액 추가(원)
   실제 단가는 사업장에 맞게 이 파일에서 조정하세요. */
window.PRODUCTS = (function () {
  const P = {
    acrylic: {
      label: "아크릴",
      desc: "실내외 아크릴 사인 · 표찰 · 아크릴 현수막",
      baseRate: 120000,
      size: { w: 600, h: 300 },
      presets: [[600, 300], [900, 600], [1200, 600], [1800, 900]],
      fields: [
        { id: "material", label: "아크릴 종류", type: "select", def: "clear", options: [
          { v: "clear", t: "투명 아크릴", rate: 120000 },
          { v: "milky", t: "유백 아크릴", rate: 130000 },
          { v: "color", t: "컬러 아크릴", rate: 140000 },
          { v: "mirror", t: "미러(거울) 아크릴", rate: 180000 },
        ]},
        { id: "boardColor", label: "바탕 색상", type: "color", def: "#f4f4f4" },
        { id: "thickness", label: "두께", type: "select", def: "5", options: [
          { v: "3", t: "3mm", mult: 0.85 }, { v: "5", t: "5mm", mult: 1 },
          { v: "8", t: "8mm", mult: 1.25 }, { v: "10", t: "10mm", mult: 1.5 },
        ]},
        { id: "edgeWork", label: "절단 · 후가공", type: "select", def: "none", options: [
          { v: "none", t: "직각 재단" },
          { v: "cut", t: "도무송(모양) 재단 +15%", mult: 1.15 },
          { v: "bend", t: "절곡 가공 +20%", mult: 1.2 },
        ]},
        { id: "mount", label: "고정(부착) 방식", type: "select", def: "tape", options: [
          { v: "tape", t: "양면 테이프" },
          { v: "drill", t: "타공+피스 +8,000", add: 8000 },
          { v: "spacer", t: "스페이서 볼트 +18,000", add: 18000 },
        ]},
      ],
    },

    banner: {
      label: "현수막",
      desc: "행사 · 홍보용 현수막 · 배너 (원단 인쇄)",
      baseRate: 12000,
      size: { w: 3000, h: 600 },
      presets: [[3000, 600], [4000, 700], [5000, 900], [900, 600]],
      fields: [
        { id: "fabric", label: "원단", type: "select", def: "poly", options: [
          { v: "poly", t: "일반 폴리원단", rate: 12000 },
          { v: "waterproof", t: "방수 원단", rate: 15000 },
          { v: "mesh", t: "메쉬(바람구멍)", rate: 14000 },
          { v: "cloth", t: "고급 현수막천", rate: 20000 },
        ]},
        { id: "boardColor", label: "바탕 색상", type: "color", def: "#ffffff" },
        { id: "printSide", label: "인쇄면", type: "select", def: "single", options: [
          { v: "single", t: "단면 인쇄" },
          { v: "double", t: "양면 인쇄 +70%", mult: 1.7 },
        ]},
        { id: "finish", label: "마감 처리", type: "select", def: "eyelet", options: [
          { v: "eyelet", t: "사방 고리(아일렛)" },
          { v: "rope", t: "로프 마감 +5,000", add: 5000 },
          { v: "wood", t: "각목(지관) 마감 +12,000", add: 12000 },
          { v: "none", t: "무마감" },
        ]},
      ],
    },

    sign: {
      label: "간판",
      desc: "매장 전면 간판 · 채널/평판 · 조명 옵션",
      baseRate: 150000,
      size: { w: 900, h: 600 },
      presets: [[900, 600], [1200, 800], [1800, 900], [2400, 1200]],
      // 빠른 조합 프리셋(베이스 + 레터링) — 클릭 시 아래 옵션이 세팅됨
      combos: [
        { label: "후렉스 간판", set: { base: "flex", letter: "none" } },
        { label: "후렉스＋채널", set: { base: "flex", letter: "front" } },
        { label: "트러스＋알루미늄채널", set: { base: "truss", letter: "front" } },
        { label: "갈바프레임＋면발광", set: { base: "panel", letter: "none" } },
        { label: "갈바 후광채널", set: { base: "panel", letter: "halo" } },
        { label: "갈바 라운드채널", set: { base: "round", letter: "halo" } },
        { label: "큐브 간판", set: { base: "cube", letter: "none" } },
      ],
      fields: [
        { id: "base", label: "베이스 구조", type: "select", def: "flex", options: [
          { v: "flex", t: "후렉스(실사출력 박스)", rate: 130000 },
          { v: "panel", t: "갈바프레임 면발광", rate: 200000 },
          { v: "round", t: "오사이 라운드 발광", rate: 240000 },
          { v: "truss", t: "트러스바 패널", rate: 210000 },
          { v: "cube", t: "큐브 간판", rate: 270000 },
        ]},
        { id: "letter", label: "레터링(글자)", type: "select", def: "none", options: [
          { v: "none", t: "바탕 인쇄만" },
          { v: "front", t: "앞면발광 채널 +45%", mult: 1.45 },
          { v: "halo", t: "후광(백라이트) 채널 +60%", mult: 1.6 },
        ]},
        { id: "material", label: "표면 재질", type: "select", def: "milky", options: [
          { v: "milky", t: "아크릴(유백)", mult: 1 },
          { v: "color", t: "아크릴(컬러)", mult: 1.1 },
          { v: "stainless", t: "스테인리스", mult: 1.8 },
          { v: "wood", t: "우드(목재)", mult: 1.2 },
        ]},
        { id: "boardColor", label: "바탕 색상", type: "color", def: "#1b3fb0" },
        { id: "thickness", label: "두께(전면판)", type: "select", def: "8", options: [
          { v: "5", t: "5mm", mult: 1 }, { v: "8", t: "8mm", mult: 1.15 },
          { v: "10", t: "10mm", mult: 1.3 }, { v: "15", t: "15mm", mult: 1.6 },
        ]},
        { id: "install", label: "시공 방식", type: "select", def: "wall", options: [
          { v: "wall", t: "벽 부착" },
          { v: "protrude", t: "돌출(연결) +50,000", add: 50000 },
          { v: "stand", t: "스탠드형 +35,000", add: 35000 },
        ]},
      ],
    },
  };

  const order = ["acrylic", "banner", "sign"];
  function get(pt) { return P[pt] || P.acrylic; }
  function defaults(pt) { const o = {}; get(pt).fields.forEach((f) => (o[f.id] = f.def)); return o; }
  function optOf(field, val) { return (field.options || []).find((o) => o.v === val); }

  // 선택된 옵션을 읽기 좋은 [라벨, 값] 목록으로 (가격표기 제거)
  function summarize(spec) {
    return get(spec.productType).fields
      .filter((f) => f.type !== "color")
      .map((f) => {
        const o = optOf(f, spec.values[f.id]);
        const text = o ? o.t.replace(/\s*[+][\d,%]+.*/, "") : spec.values[f.id];
        return [f.label, text];
      });
  }

  // 3D 미리보기용 재질/두께/구조 매핑
  function render3d(spec) {
    const v = spec.values;
    if (spec.productType === "banner") return { material: "fabric", depthMM: 2 };
    let depth = +(v.thickness || 5);
    if (spec.productType === "sign") {
      return {
        material: v.material || "milky",
        depthMM: depth,
        base: v.base || "flex",
        letter: v.letter || "none",
        install: v.install || "wall",
      };
    }
    return { material: v.material || "milky", depthMM: depth };
  }

  return { P, order, get, defaults, optOf, summarize, render3d, label: (pt) => get(pt).label };
})();
