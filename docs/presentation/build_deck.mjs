import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;

const DECK_ID = "english-assist-ai-practice";
const OUT_DIR = path.resolve("docs/presentation/output");
const REF_DIR = path.resolve("docs/presentation/ref");
const SCRATCH_DIR = path.resolve("tmp/slides", DECK_ID);
const PREVIEW_DIR = path.join(SCRATCH_DIR, "preview");
const VERIFICATION_DIR = path.join(SCRATCH_DIR, "verification");
const INSPECT_PATH = path.join(SCRATCH_DIR, "inspect.ndjson");

const INK = "#101214";
const GRAPHITE = "#30363A";
const MUTED = "#687076";
const PAPER = "#F7F4ED";
const PAPER_96 = "#F7F4EDF5";
const ACCENT = "#27C47D";
const ACCENT_DARK = "#116B49";
const GOLD = "#D7A83D";
const CORAL = "#E86F5B";
const TRANSPARENT = "#00000000";
const FALLBACK_PLATE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const TITLE_FACE = "Caladea";
const BODY_FACE = "Lato";
const MONO_FACE = "Aptos Mono";

const SOURCES = {
  repo: "Repository review: README.md, docs/DEPLOY_VERCEL_TURSO.md, src/App.tsx, src/components/ManagementModule.tsx, src/components/ChallengeModule.tsx, server/app.ts, server/db.ts",
};

const SLIDES = [
  {
    kicker: "AI Education Practice",
    title: "English Assist\n不是聊天 Demo，而是教学流程里的 AI 应用",
    subtitle: "一个面向初高中英语听口训练的垂直场景产品原型，把教材同步、语音评测、AI 对话和教师管理放进同一条学习闭环。",
    moment: "适合做 AI agent 落地实践案例，但还需要补齐安全、数据与评测可信度。",
    notes: "开场先定性。这个项目的价值不在于又做了一个聊天窗口，而在于把 AI 放进真实的学习任务里。",
    sources: ["repo"],
  },
  {
    kicker: "Why It Matters",
    title: "为什么它值得被拿出来讲",
    subtitle: "相比通用助手，这个应用更能说明 AI 如何进入一条明确业务流程。",
    cards: [
      [
        "场景清晰",
        "目标用户是初高中英语学习场景。教材、单元、练习、复盘、教师管理都已经有明确边界，不是泛化空转。",
      ],
      [
        "闭环完整",
        "学生完成词汇预习、重点句跟读、语法练习、听写训练、口语评测，再回到教师侧观察，形成完整闭环。",
      ],
      [
        "易于复用",
        "React + Express + libSQL/Turso 的组合足够轻，既能本地演示，也能部署到云端，适合作为落地样板。",
      ],
    ],
    notes: "这页要强调它比纯聊天产品更像业务系统，因此更适合做落地实践推荐。",
    sources: ["repo"],
  },
  {
    kicker: "Product Loop",
    title: "产品主链路已经成形",
    subtitle: "它把一节英语学习课拆成可执行、可记录、可反馈的多个任务节点。",
    cards: [
      [
        "学生入口",
        "从教材单元进入，先做词汇预习与重点句浏览，再进入语法、听写和朗读评测，不需要自己拼学习路径。",
      ],
      [
        "AI 参与点",
        "AI 对话负责口语陪练，TTS 负责发音播放，Azure Speech 负责口语识别与发音评分，系统再产出纠错反馈。",
      ],
      [
        "教师入口",
        "管理端可以看教材导入、学生列表、班级趋势、风险学生与学习活跃度，具备教学运营视角的雏形。",
      ],
    ],
    notes: "这一页从用户视角讲清楚为什么这不是零散功能堆叠，而是一条被编排过的链路。",
    sources: ["repo"],
  },
  {
    kicker: "AI Stack",
    title: "当前 AI 实践已经覆盖三类能力",
    subtitle: "这个项目不是单模型调用，而是把多个 AI 能力映射到了不同学习任务。",
    metrics: [
      ["3", "AI 能力层", "对话生成 / 语音合成 / 语音评测"],
      ["5", "学习环节", "预习、重点句、语法、听写、口语评测"],
      ["1", "核心价值", "把 AI 放进教学流程而不是悬浮功能"],
    ],
    notes: "结合代码实现讲：对话模型走 OpenAI 兼容接口，TTS 支持模型音频，发音评测走 Azure Speech token 和前端评测流程。",
    sources: ["repo"],
  },
  {
    kicker: "Architecture",
    title: "工程架构足够轻，但已经具备部署与扩展基础",
    subtitle: "前后端分工明确，数据库和部署路径也已经被打通。",
    cards: [
      [
        "前端",
        "Vite + React 构建学生端与教师端体验，教材学习、语音交互和统计面板都在同一个应用中交付。",
      ],
      [
        "后端",
        "Express 暴露登录、教材、管理和 speech token 接口，Turso/libSQL 负责用户、会话与教材结构数据。",
      ],
      [
        "部署",
        "本地可跑 file 模式数据库，线上可切到 Turso，再通过 Vercel Functions 提供 API，适合低成本试点。",
      ],
    ],
    notes: "这页适合面向技术负责人说明：虽然架构不重，但不是临时 demo，具备部署路径。",
    sources: ["repo"],
  },
  {
    kicker: "Recommendation",
    title: "它已经具备被推荐的几个关键理由",
    subtitle: "如果对外定位准确，它是一份很好的垂直 AI 应用示范。",
    cards: [
      [
        "不是伪需求",
        "英语听口训练是明确高频场景，AI 的口语陪练、发音评测和复盘建议都有天然价值。",
      ],
      [
        "不是伪集成",
        "AI 能力直接作用在教学任务上，而不是在页面侧边放一个聊天框假装智能化。",
      ],
      [
        "不是伪落地",
        "从教材内容、账户权限、管理页到云部署都已存在，已经比概念验证更进一步。",
      ],
    ],
    notes: "这里可以给推荐结论的上半句：它值得推荐，但必须带着成熟度边界一起推荐。",
    sources: ["repo"],
  },
  {
    kicker: "Gaps",
    title: "如果要面向别人推荐，当前最大的短板是什么",
    subtitle: "这些问题不会影响演示，但会影响真实交付和产品可信度。",
    cards: [
      [
        "安全",
        "默认管理员口令写在代码里，AI Key 保存在浏览器本地且由前端直连模型服务，这不适合真实机构环境。",
      ],
      [
        "数据",
        "学习记录主要保存在 localStorage，教师视角读取的也是本地快照，不是服务端统一学习档案。",
      ],
      [
        "评测",
        "闯关得分目前按是否填写内容计分，说明成果展示还强于真实评测可信度，需要尽快补齐。",
      ],
    ],
    notes: "这页要讲得坦诚。它是 MVP，不是成熟产品。真实可信的推荐需要把这些问题先补上。",
    sources: ["repo"],
  },
  {
    kicker: "Roadmap",
    title: "把它升级为可规模化方案的增强路线",
    subtitle: "建议分三步：先补底座，再做 AI 深化，最后建立可复制方法论。",
    cards: [
      [
        "阶段一",
        "服务端代理 AI 调用、移除默认口令、把学习记录迁移到数据库、增加限流与审计，让它先变成可交付的基础版。",
      ],
      [
        "阶段二",
        "重做闯关评分、个性化学习计划、教师洞察和内容工作流，把 AI 从功能点升级为真正的教学编排能力。",
      ],
      [
        "阶段三",
        "沉淀指标、案例素材、决策日志和 ROI 叙事，把它包装成可对外复制的 AI agent 落地案例。",
      ],
    ],
    notes: "这页要让听众看到增长路径：它不是天花板低，而是现在正处在值得继续投的阶段。",
    sources: ["repo"],
  },
  {
    kicker: "Takeaway",
    title: "最终判断：可以推荐，但应定位为“强场景 MVP”",
    subtitle: "最好的推荐方式不是夸成成熟产品，而是把它定义为一条很扎实的 AI 教育应用演进路线。",
    metrics: [
      ["Yes", "适合展示 AI 落地", "因业务链路完整且场景具体"],
      ["MVP", "当前成熟度判断", "更像强演示、试点与方法论样板"],
      ["Next", "下一步重点", "安全、数据、评测可信度、运营能力"],
    ],
    notes: "收尾时可以直接给一句话：它已经足够成为推荐案例，但推荐的是思路与落地能力，不是现阶段就可大规模交付的成品。",
    sources: ["repo"],
  },
];

const inspectRecords = [];

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(REF_DIR, { recursive: true });
  await fs.mkdir(SCRATCH_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  await fs.mkdir(VERIFICATION_DIR, { recursive: true });
}

function normalizeText(text) {
  if (Array.isArray(text)) return text.map((item) => String(item ?? "")).join("\n");
  return String(text ?? "");
}

function textLineCount(text) {
  const value = normalizeText(text);
  return value.trim() ? Math.max(1, value.split(/\n/).length) : 0;
}

function requiredTextHeight(text, fontSize, lineHeight = 1.18, minHeight = 8) {
  const lines = textLineCount(text);
  return lines === 0 ? minHeight : Math.max(minHeight, lines * fontSize * lineHeight);
}

function assertTextFits(text, boxHeight, fontSize, role = "text") {
  const required = requiredTextHeight(text, fontSize);
  const tolerance = Math.max(2, fontSize * 0.08);
  if (normalizeText(text).trim() && boxHeight + tolerance < required) {
    throw new Error(`${role} text box is too short for the current copy.`);
  }
}

function recordShape(slideNo, shape, role, shapeType, x, y, w, h) {
  inspectRecords.push({
    kind: "shape",
    slide: slideNo,
    id: shape?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    shapeType,
    bbox: [x, y, w, h],
  });
}

function recordText(slideNo, shape, role, text, x, y, w, h) {
  const value = normalizeText(text);
  inspectRecords.push({
    kind: "textbox",
    slide: slideNo,
    id: shape?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    text: value,
    bbox: [x, y, w, h],
  });
}

function lineConfig(fill = TRANSPARENT, width = 0) {
  return { style: "solid", fill, width };
}

function addShape(slide, geometry, x, y, w, h, fill = TRANSPARENT, line = TRANSPARENT, lineWidth = 0, meta = {}) {
  const shape = slide.shapes.add({
    geometry,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: lineConfig(line, lineWidth),
  });
  recordShape(meta.slideNo, shape, meta.role || geometry, geometry, x, y, w, h);
  return shape;
}

function addText(
  slide,
  slideNo,
  text,
  x,
  y,
  w,
  h,
  {
    size = 22,
    color = INK,
    bold = false,
    face = BODY_FACE,
    align = "left",
    valign = "top",
    fill = TRANSPARENT,
    line = TRANSPARENT,
    lineWidth = 0,
    checkFit = true,
    role = "text",
  } = {},
) {
  if (checkFit) assertTextFits(text, h, size, role);
  const box = addShape(slide, "rect", x, y, w, h, fill, line, lineWidth);
  box.text = text;
  box.text.fontSize = size;
  box.text.color = color;
  box.text.bold = Boolean(bold);
  box.text.alignment = align;
  box.text.verticalAlignment = valign;
  box.text.typeface = face;
  box.text.insets = { left: 0, right: 0, top: 0, bottom: 0 };
  recordText(slideNo, box, role, text, x, y, w, h);
  return box;
}

async function addImage(slide, slideNo, config, position, role) {
  const image = slide.images.add(config);
  image.position = position;
  inspectRecords.push({
    kind: "image",
    slide: slideNo,
    id: image?.id || `slide-${slideNo}-${role}-${inspectRecords.length + 1}`,
    role,
    bbox: [position.left, position.top, position.width, position.height],
  });
  return image;
}

async function addPlate(slide, slideNo) {
  slide.background.fill = PAPER;
  await addImage(
    slide,
    slideNo,
    { dataUrl: FALLBACK_PLATE_DATA_URL, fit: "cover", alt: `Fallback plate ${slideNo}` },
    { left: 0, top: 0, width: W, height: H },
    "fallback art plate",
  );
}

function addHeader(slide, slideNo, kicker, idx, total) {
  addText(slide, slideNo, String(kicker || "").toUpperCase(), 64, 34, 430, 24, {
    size: 13,
    color: ACCENT_DARK,
    bold: true,
    face: MONO_FACE,
    checkFit: false,
    role: "header",
  });
  addText(slide, slideNo, `${String(idx).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 1114, 34, 104, 24, {
    size: 13,
    color: ACCENT_DARK,
    bold: true,
    face: MONO_FACE,
    align: "right",
    checkFit: false,
    role: "header page",
  });
  addShape(slide, "rect", 64, 64, 1152, 2, INK, TRANSPARENT, 0, { slideNo, role: "header rule" });
  addShape(slide, "ellipse", 57, 57, 16, 16, ACCENT, INK, 2, { slideNo, role: "header marker" });
}

function addReferenceCaption(slide, slideNo) {
  addText(slide, slideNo, "Repository-derived content. All visible copy remains editable in PowerPoint.", 64, 676, 960, 18, {
    size: 10,
    color: MUTED,
    face: BODY_FACE,
    checkFit: false,
    role: "caption",
  });
}

function addTitleBlock(slide, slideNo, title, subtitle = null, x = 64, y = 86, w = 780) {
  addText(slide, slideNo, title, x, y, w, 150, {
    size: 40,
    color: INK,
    bold: true,
    face: TITLE_FACE,
    role: "title",
  });
  if (subtitle) {
    addText(slide, slideNo, subtitle, x + 2, y + 154, Math.min(w, 720), 82, {
      size: 19,
      color: GRAPHITE,
      face: BODY_FACE,
      role: "subtitle",
    });
  }
}

function addIconBadge(slide, slideNo, x, y, accent = ACCENT, kind = "signal") {
  addShape(slide, "ellipse", x, y, 54, 54, PAPER_96, INK, 1.2, { slideNo, role: "icon badge" });
  if (kind === "flow") {
    addShape(slide, "ellipse", x + 13, y + 18, 10, 10, accent, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "ellipse", x + 31, y + 27, 10, 10, accent, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "rect", x + 22, y + 25, 19, 3, INK, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
  } else if (kind === "layers") {
    addShape(slide, "roundRect", x + 13, y + 15, 26, 13, accent, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "roundRect", x + 18, y + 24, 26, 13, GOLD, INK, 1, { slideNo, role: "icon glyph" });
    addShape(slide, "roundRect", x + 23, y + 33, 20, 10, CORAL, INK, 1, { slideNo, role: "icon glyph" });
  } else {
    addShape(slide, "rect", x + 16, y + 29, 6, 12, accent, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
    addShape(slide, "rect", x + 25, y + 21, 6, 20, accent, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
    addShape(slide, "rect", x + 34, y + 14, 6, 27, accent, TRANSPARENT, 0, { slideNo, role: "icon glyph" });
  }
}

function wrapText(text, widthChars) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > widthChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function addCard(slide, slideNo, x, y, w, h, label, body, { accent = ACCENT, iconKind = "signal" } = {}) {
  addShape(slide, "roundRect", x, y, w, h, PAPER_96, INK, 1.2, { slideNo, role: `card ${label}` });
  addShape(slide, "rect", x, y, 8, h, accent, TRANSPARENT, 0, { slideNo, role: `card accent ${label}` });
  addIconBadge(slide, slideNo, x + 22, y + 24, accent, iconKind);
  addText(slide, slideNo, label, x + 88, y + 22, w - 108, 28, {
    size: 15,
    color: ACCENT_DARK,
    bold: true,
    face: MONO_FACE,
    role: "card label",
  });
  addText(slide, slideNo, wrapText(body, Math.max(24, Math.floor(w / 12))), x + 24, y + 86, w - 48, h - 110, {
    size: 17,
    color: INK,
    face: BODY_FACE,
    role: `card body ${label}`,
  });
}

function addMetricCard(slide, slideNo, x, y, w, h, metric, label, note = null, accent = ACCENT) {
  addShape(slide, "roundRect", x, y, w, h, PAPER_96, INK, 1.2, { slideNo, role: `metric ${label}` });
  addShape(slide, "rect", x, y, w, 7, accent, TRANSPARENT, 0, { slideNo, role: `metric accent ${label}` });
  addText(slide, slideNo, metric, x + 22, y + 24, w - 44, 54, {
    size: 34,
    color: INK,
    bold: true,
    face: TITLE_FACE,
    role: "metric value",
  });
  addText(slide, slideNo, label, x + 24, y + 82, w - 48, 40, {
    size: 16,
    color: GRAPHITE,
    face: BODY_FACE,
    role: "metric label",
  });
  if (note) {
    addText(slide, slideNo, note, x + 24, y + 132, w - 48, 30, {
      size: 10,
      color: MUTED,
      face: BODY_FACE,
      role: "metric note",
    });
  }
}

function addNotes(slide, body, sourceKeys) {
  const sourceLines = (sourceKeys || []).map((key) => `- ${SOURCES[key] || key}`).join("\n");
  slide.speakerNotes.setText(`${body}\n\n[Sources]\n${sourceLines}`);
}

async function slideCover(presentation) {
  const slideNo = 1;
  const data = SLIDES[0];
  const slide = presentation.slides.add();
  await addPlate(slide, slideNo);
  addShape(slide, "rect", 0, 0, W, H, "#FFFFFFCC", TRANSPARENT, 0, { slideNo, role: "overlay" });
  addShape(slide, "rect", 64, 86, 7, 455, ACCENT, TRANSPARENT, 0, { slideNo, role: "accent rule" });
  addText(slide, slideNo, data.kicker, 86, 88, 520, 26, {
    size: 13,
    color: ACCENT_DARK,
    bold: true,
    face: MONO_FACE,
    role: "kicker",
  });
  addText(slide, slideNo, data.title, 82, 130, 820, 190, {
    size: 48,
    color: INK,
    bold: true,
    face: TITLE_FACE,
    role: "cover title",
  });
  addText(slide, slideNo, data.subtitle, 86, 334, 640, 96, {
    size: 20,
    color: GRAPHITE,
    face: BODY_FACE,
    role: "cover subtitle",
  });
  addShape(slide, "roundRect", 86, 466, 472, 96, PAPER_96, INK, 1.2, { slideNo, role: "moment panel" });
  addText(slide, slideNo, data.moment, 112, 490, 420, 48, {
    size: 23,
    color: INK,
    bold: true,
    face: TITLE_FACE,
    role: "cover moment",
  });
  addReferenceCaption(slide, slideNo);
  addNotes(slide, data.notes, data.sources);
}

async function slideCards(presentation, idx) {
  const data = SLIDES[idx - 1];
  const slide = presentation.slides.add();
  await addPlate(slide, idx);
  addShape(slide, "rect", 0, 0, W, H, "#FFFFFFB8", TRANSPARENT, 0, { slideNo: idx, role: "overlay" });
  addHeader(slide, idx, data.kicker, idx, SLIDES.length);
  addTitleBlock(slide, idx, data.title, data.subtitle, 64, 86, 760);
  const cards = data.cards || [];
  const cols = Math.min(3, cards.length);
  const cardW = (1114 - (cols - 1) * 24) / cols;
  const iconKinds = ["signal", "flow", "layers"];
  for (let cardIdx = 0; cardIdx < cols; cardIdx += 1) {
    const [label, body] = cards[cardIdx];
    addCard(slide, idx, 84 + cardIdx * (cardW + 24), 426, cardW, 192, label, body, {
      iconKind: iconKinds[cardIdx % iconKinds.length],
      accent: [ACCENT, GOLD, CORAL][cardIdx % 3],
    });
  }
  addReferenceCaption(slide, idx);
  addNotes(slide, data.notes, data.sources);
}

async function slideMetrics(presentation, idx) {
  const data = SLIDES[idx - 1];
  const slide = presentation.slides.add();
  await addPlate(slide, idx);
  addShape(slide, "rect", 0, 0, W, H, "#FFFFFFBD", TRANSPARENT, 0, { slideNo: idx, role: "overlay" });
  addHeader(slide, idx, data.kicker, idx, SLIDES.length);
  addTitleBlock(slide, idx, data.title, data.subtitle, 64, 86, 720);
  const accents = [ACCENT, GOLD, CORAL];
  data.metrics.forEach(([metric, label, note], metricIdx) => {
    addMetricCard(slide, idx, 92 + metricIdx * 370, 404, 330, 174, metric, label, note, accents[metricIdx % 3]);
  });
  addReferenceCaption(slide, idx);
  addNotes(slide, data.notes, data.sources);
}

async function createDeck() {
  await ensureDirs();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await slideCover(presentation);
  for (let idx = 2; idx <= SLIDES.length; idx += 1) {
    if (SLIDES[idx - 1].metrics) {
      await slideMetrics(presentation, idx);
    } else {
      await slideCards(presentation, idx);
    }
  }
  return presentation;
}

async function saveBlobToFile(blob, filePath) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function writeInspectArtifact(presentation) {
  inspectRecords.unshift({
    kind: "deck",
    id: DECK_ID,
    slideCount: presentation.slides.count,
    slideSize: { width: W, height: H },
  });
  const lines = inspectRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
  await fs.writeFile(INSPECT_PATH, lines, "utf8");
}

async function verifyAndExport(presentation) {
  await writeInspectArtifact(presentation);
  for (let idx = 0; idx < presentation.slides.items.length; idx += 1) {
    const slide = presentation.slides.items[idx];
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    await saveBlobToFile(preview, path.join(PREVIEW_DIR, `slide-${String(idx + 1).padStart(2, "0")}.png`));
  }
  const pptxBlob = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(OUT_DIR, "english-assist-ai-practice.pptx");
  await pptxBlob.save(pptxPath);
  await fs.writeFile(
    path.join(VERIFICATION_DIR, "render_verify_loops.ndjson"),
    JSON.stringify({
      kind: "render_verify_loop",
      deckId: DECK_ID,
      loop: 1,
      slideCount: presentation.slides.count,
      previewDir: PREVIEW_DIR,
      inspectPath: INSPECT_PATH,
      pptxPath,
    }) + "\n",
    "utf8",
  );
  return pptxPath;
}

const presentation = await createDeck();
const pptxPath = await verifyAndExport(presentation);
console.log(pptxPath);
