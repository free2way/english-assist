import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const W = 1280;
const H = 720;
const OUT_DIR = path.resolve('docs/presentation/output');
const PREVIEW_DIR = path.resolve('tmp/slides/aceenglish-product-intro/preview');
const ASSET_DIR = path.resolve('docs/presentation/assets');
const OUT_PPTX = path.join(OUT_DIR, 'aceenglish-product-intro.pptx');

const COLORS = {
  ink: '#111827',
  muted: '#667085',
  soft: '#F6F8FB',
  white: '#FFFFFF',
  blue: '#2F6BFF',
  green: '#10B981',
  coral: '#FF6B5F',
  lemon: '#F4D35E',
  violet: '#8B5CF6',
  line: '#E5EAF2',
  dark: '#152238',
};

const FONT = {
  title: 'Poppins',
  body: 'Lato',
  mono: 'Aptos Mono',
};

const screenshots = {
  dashboard: path.join(ASSET_DIR, 'screenshot-dashboard-agent-focused.png'),
  textbook: path.join(ASSET_DIR, 'screenshot-textbook-sentences-focused.png'),
  tutor: path.join(ASSET_DIR, 'screenshot-ai-tutor-focused.png'),
  teacher: path.join(ASSET_DIR, 'screenshot-teacher-agent-focused.png'),
};

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function line(fill = 'transparent', width = 0) {
  return { style: 'solid', fill, width };
}

function shape(slide, geometry, left, top, width, height, fill = 'transparent', border = 'transparent', borderWidth = 0) {
  return slide.shapes.add({
    geometry,
    position: { left, top, width, height },
    fill,
    line: line(border, borderWidth),
  });
}

function text(slide, value, left, top, width, height, options = {}) {
  const box = shape(slide, 'rect', left, top, width, height, options.fill || 'transparent', options.line || 'transparent', options.lineWidth || 0);
  box.text = value;
  box.text.fontSize = options.size || 24;
  box.text.color = options.color || COLORS.ink;
  box.text.bold = Boolean(options.bold);
  box.text.typeface = options.face || FONT.body;
  box.text.alignment = options.align || 'left';
  box.text.verticalAlignment = options.valign || 'top';
  box.text.insets = options.insets || { left: 0, right: 0, top: 0, bottom: 0 };
  return box;
}

function pill(slide, value, left, top, width, fill, color = COLORS.ink) {
  shape(slide, 'roundRect', left, top, width, 36, fill, 'transparent', 0);
  text(slide, value, left + 16, top + 8, width - 32, 20, {
    size: 13,
    bold: true,
    color,
    face: FONT.mono,
  });
}

function title(slide, kicker, heading, subheading) {
  pill(slide, kicker, 64, 52, Math.min(420, Math.max(190, kicker.length * 12)), '#EAF1FF', COLORS.blue);
  text(slide, heading, 64, 108, 690, 132, {
    size: 44,
    bold: true,
    face: FONT.title,
    color: COLORS.ink,
  });
  if (subheading) {
    text(slide, subheading, 66, 254, 650, 70, {
      size: 19,
      face: FONT.body,
      color: COLORS.muted,
    });
  }
}

async function screenshot(slide, key, left, top, width, height, options = {}) {
  const img = slide.images.add({
    blob: await readImageBlob(screenshots[key]),
    fit: options.fit || 'cover',
    alt: `${key} app screenshot`,
  });
  img.position = { left, top, width, height };
  img.geometry = 'roundRect';
  return img;
}

function accentGrid(slide) {
  shape(slide, 'rect', 0, 0, W, H, COLORS.soft);
  shape(slide, 'ellipse', 1010, -90, 270, 270, '#DDF7EC', 'transparent', 0);
  shape(slide, 'ellipse', 1090, 520, 220, 220, '#FFE8E3', 'transparent', 0);
  shape(slide, 'rect', 0, 0, 14, H, COLORS.blue);
}

function header(slide, index) {
  text(slide, `ACEENGLISH / ${String(index).padStart(2, '0')}`, 64, 28, 260, 20, {
    size: 11,
    bold: true,
    face: FONT.mono,
    color: COLORS.blue,
  });
}

function card(slide, label, body, left, top, width, height, color) {
  shape(slide, 'roundRect', left, top, width, height, COLORS.white, COLORS.line, 1);
  shape(slide, 'rect', left, top, 7, height, color, 'transparent', 0);
  text(slide, label, left + 28, top + 24, width - 56, 28, {
    size: 18,
    bold: true,
    face: FONT.title,
    color: COLORS.ink,
  });
  text(slide, body, left + 28, top + 62, width - 56, height - 84, {
    size: 16,
    color: COLORS.muted,
  });
}

function speakerNotes(slide, notes) {
  slide.speakerNotes.setText(notes);
}

async function slideCover(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  shape(slide, 'roundRect', 690, 74, 520, 572, COLORS.white, COLORS.line, 1);
  await screenshot(slide, 'dashboard', 716, 102, 468, 516);
  shape(slide, 'rect', 716, 102, 468, 516, '#FFFFFF1A');
  pill(slide, 'AI ENGLISH LEARNING ASSISTANT', 64, 72, 342, '#EAF1FF', COLORS.blue);
  text(slide, 'AceEnglish', 64, 150, 560, 72, {
    size: 60,
    bold: true,
    face: FONT.title,
  });
  text(slide, '把教材学习、口语练习、发音评测和教师洞察放进一个 AI 学习闭环。', 68, 246, 550, 78, {
    size: 24,
    color: COLORS.muted,
  });
  card(slide, '一句话理解', '它不是一个聊天框，而是一套会安排任务、陪练、评测和提醒老师的英语学习助教。', 64, 420, 520, 132, COLORS.green);
  text(slide, '面向学生、老师和教学管理者的 AI 落地实践', 68, 610, 600, 28, {
    size: 17,
    bold: true,
    color: COLORS.blue,
  });
  speakerNotes(slide, '开场强调：AceEnglish 是一个可用的学习应用，AI 是藏在学习流程里的助教能力。');
}

async function slideWhatItDoes(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 2);
  title(slide, 'WHAT IT DOES', '它帮学生把英语学习变成每天可执行的路径', '普通用户可以这样理解：不用自己决定先学什么，系统会按教材、错题和练习结果推荐下一步。');
  card(slide, '教材同步', '按外研版教材单元组织词汇、重点句、语法、听写和朗读评测。', 64, 380, 350, 150, COLORS.blue);
  card(slide, 'AI 口语陪练', '围绕当前单元话题提问、追问、纠错，让学生真的开口表达。', 464, 380, 350, 150, COLORS.green);
  card(slide, '教师看得见', '管理页能看到班级趋势、学生风险信号和教师干预建议。', 864, 380, 350, 150, COLORS.coral);
  text(slide, '学习路线：输入教材内容 -> 完成练习 -> AI 反馈 -> 生成下一步任务 -> 教师获得洞察', 92, 594, 1080, 30, {
    size: 18,
    bold: true,
    color: COLORS.dark,
    align: 'center',
  });
  speakerNotes(slide, '这一页面向普通人解释产品功能，不谈工程细节。');
}

async function slideDashboard(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 3);
  title(slide, 'STUDENT CENTER', '首页是每天的学习指挥台', '这里能看到今日任务、当前单元、多 Agent 协同状态和下一步推荐。');
  await screenshot(slide, 'dashboard', 640, 78, 545, 548);
  card(slide, '学习编排 Agent', '读取进度、错题、发音记录，决定今天先做什么。', 64, 382, 230, 116, COLORS.blue);
  card(slide, '评测反馈 Agent', '把听写和口语结果转成复习包，回流给下一轮推荐。', 320, 382, 230, 116, COLORS.green);
  text(slide, '学生看到的是任务，背后运转的是一组协同工作的 AI 助教。', 68, 560, 480, 56, {
    size: 24,
    bold: true,
    face: FONT.title,
    color: COLORS.ink,
  });
  speakerNotes(slide, '截图展示首页。重点讲“不是一堆按钮”，而是学习编排。');
}

async function slideTextbook(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 4);
  title(slide, 'TEXTBOOK PRACTICE', '围绕真实教材，不是泛泛聊天', '学生从单元内容出发，完成词汇、重点句、听写、语法和朗读评测。');
  await screenshot(slide, 'textbook', 64, 330, 540, 300);
  card(slide, '词汇预习', '先认词义、发音和例句，为后续听说做输入准备。', 650, 334, 250, 126, COLORS.blue);
  card(slide, '重点句跟读', '用教材句子做跟读和朗读，建立真实表达素材。', 932, 334, 250, 126, COLORS.green);
  card(slide, '听写与语法', '通过听写和语法练习找出漏词、拼写、句型问题。', 650, 492, 532, 126, COLORS.coral);
  speakerNotes(slide, '普通人容易把 AI 应用理解成聊天。这里强调：AI 依附在教材和任务上。');
}

async function slideTutor(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 5);
  pill(slide, 'AI SPEAKING TUTOR', 64, 52, 250, '#EAF1FF', COLORS.blue);
  text(slide, 'AI 外教让学生真的开口练', 64, 108, 560, 118, {
    size: 44,
    bold: true,
    face: FONT.title,
    color: COLORS.ink,
  });
  text(slide, '它会根据当前单元下发口语目标，并支持语音识别、TTS 播报和 Azure 发音评测。', 66, 248, 520, 70, {
    size: 19,
    face: FONT.body,
    color: COLORS.muted,
  });
  await screenshot(slide, 'tutor', 700, 96, 456, 496);
  card(slide, '目标导向', '对练目标来自学习编排 Agent，而不是随便聊天。', 64, 362, 420, 104, COLORS.green);
  card(slide, '即时反馈', '回答太短、偏题、表达不流畅时，会进入错题和复盘链路。', 64, 488, 420, 104, COLORS.coral);
  text(slide, '这就是 AI 在学习场景里的正确位置：陪练、纠错、推动下一步。', 68, 626, 540, 30, {
    size: 18,
    bold: true,
    color: COLORS.blue,
  });
  speakerNotes(slide, '这里讲 AI 外教，不要讲模型参数，讲学生能感受到什么。');
}

async function slideAgents(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 6);
  title(slide, 'AI AGENTS', '四个 Agent 像一个小教学团队一样配合', '每个 Agent 只负责一件事：安排、陪练、评测、提醒老师。');
  const nodes = [
    ['学习编排', '决定下一步任务', 108, 370, COLORS.blue],
    ['口语陪练', '执行对话训练', 386, 370, COLORS.green],
    ['评测反馈', '归因错误和弱项', 664, 370, COLORS.coral],
    ['教师洞察', '生成干预建议', 942, 370, COLORS.violet],
  ];
  nodes.forEach(([label, body, x, y, color], index) => {
    if (index < nodes.length - 1) {
      shape(slide, 'rightArrow', Number(x) + 206, Number(y) + 48, 84, 28, '#D9E2F5', 'transparent', 0);
    }
    shape(slide, 'roundRect', Number(x), Number(y), 220, 128, COLORS.white, COLORS.line, 1);
    shape(slide, 'ellipse', Number(x) + 22, Number(y) + 26, 40, 40, String(color), 'transparent', 0);
    text(slide, String(label), Number(x) + 78, Number(y) + 24, 120, 28, {
      size: 20,
      bold: true,
      face: FONT.title,
    });
    text(slide, String(body), Number(x) + 78, Number(y) + 58, 120, 44, {
      size: 14,
      color: COLORS.muted,
    });
  });
  card(slide, '为什么要多个 Agent？', '单一聊天助手只会回答问题；多个 Agent 可以把学习状态、练习结果和教师建议串成连续闭环。', 230, 548, 820, 92, COLORS.lemon);
  speakerNotes(slide, '这一页用普通人能懂的比喻：四个助教分工合作。');
}

async function slideTeacher(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 7);
  title(slide, 'TEACHER INSIGHT', '老师看到的不只是数据，而是建议', '教师洞察 Agent 会把学生侧的学习信号汇总成风险等级、触发原因和干预动作。');
  await screenshot(slide, 'teacher', 70, 310, 600, 326, { fit: 'cover' });
  card(slide, '班级视角', '看学习趋势、活跃情况、准备度和风险学生。', 720, 330, 420, 102, COLORS.blue);
  card(slide, '干预建议', '告诉老师应该先处理错题、发音还是学习进度。', 720, 456, 420, 102, COLORS.green);
  text(slide, '这让 AI 从“学生工具”变成“教学管理助手”。', 724, 590, 420, 32, {
    size: 20,
    bold: true,
    color: COLORS.coral,
  });
  speakerNotes(slide, '教师端是这个产品区别于普通学习 APP 的关键。');
}

async function slidePracticalAI(presentation) {
  const slide = presentation.slides.add();
  accentGrid(slide);
  header(slide, 8);
  title(slide, 'PRACTICAL AI', '这里的 AI 落地，不是把聊天框塞进页面', 'AI 能力被放进教学流程：有上下文、有任务、有反馈，也有下一步。');
  const rows = [
    ['数据层', '教材、单元、错题、发音分、练习记录', COLORS.blue],
    ['工具层', 'AI 对话、语音识别、TTS、Azure 发音评测', COLORS.green],
    ['Agent 层', '编排、陪练、评测、教师洞察协同工作', COLORS.coral],
  ];
  rows.forEach(([label, body, color], index) => {
    const y = 348 + index * 88;
    shape(slide, 'roundRect', 170, y, 940, 62, COLORS.white, COLORS.line, 1);
    shape(slide, 'rect', 170, y, 10, 62, String(color), 'transparent', 0);
    text(slide, String(label), 210, y + 18, 160, 24, { size: 20, bold: true, face: FONT.title });
    text(slide, String(body), 396, y + 20, 620, 24, { size: 17, color: COLORS.muted });
  });
  text(slide, '普通用户感受到的是“它知道我该练什么”；产品背后是 AI 与 agent 对学习流程的重新组织。', 180, 620, 900, 42, {
    size: 20,
    bold: true,
    align: 'center',
    color: COLORS.ink,
  });
  speakerNotes(slide, '这一页把 AI 落地讲清楚：不是模型炫技，而是流程重构。');
}

async function slideClose(presentation) {
  const slide = presentation.slides.add();
  shape(slide, 'rect', 0, 0, W, H, COLORS.dark);
  shape(slide, 'ellipse', -80, 500, 300, 300, '#2F6BFF55', 'transparent', 0);
  shape(slide, 'ellipse', 1010, -120, 300, 300, '#10B98155', 'transparent', 0);
  pill(slide, 'SUMMARY', 64, 62, 150, '#FFFFFF22', COLORS.white);
  text(slide, 'AceEnglish 让英语学习更像有一个小团队陪着走', 64, 148, 760, 132, {
    size: 44,
    bold: true,
    face: FONT.title,
    color: COLORS.white,
  });
  text(slide, '学生得到路径和反馈，老师得到洞察和建议，AI agent 在中间负责协调。', 68, 310, 680, 62, {
    size: 22,
    color: '#D7DEE9',
  });
  const items = [
    ['学生', '少走弯路，知道下一步练什么'],
    ['老师', '少看散乱数据，多看行动建议'],
    ['学校', '有一套可演示、可扩展的 AI 教学样板'],
  ];
  items.forEach(([label, body], index) => {
    const x = 64 + index * 370;
    shape(slide, 'roundRect', x, 470, 320, 110, '#FFFFFF12', '#FFFFFF22', 1);
    text(slide, label, x + 26, 494, 110, 28, { size: 22, bold: true, color: COLORS.white, face: FONT.title });
    text(slide, body, x + 26, 532, 250, 34, { size: 16, color: '#D7DEE9' });
  });
  speakerNotes(slide, '结尾回到普通人价值：学生、老师、学校各自得到什么。');
}

async function renderAndExport(presentation) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  for (let i = 0; i < presentation.slides.items.length; i += 1) {
    const preview = await presentation.export({
      slide: presentation.slides.items[i],
      format: 'png',
      scale: 1,
    });
    const bytes = new Uint8Array(await preview.arrayBuffer());
    await fs.writeFile(path.join(PREVIEW_DIR, `slide-${String(i + 1).padStart(2, '0')}.png`), bytes);
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT_PPTX);
  return OUT_PPTX;
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
await slideCover(presentation);
await slideWhatItDoes(presentation);
await slideDashboard(presentation);
await slideTextbook(presentation);
await slideTutor(presentation);
await slideAgents(presentation);
await slideTeacher(presentation);
await slidePracticalAI(presentation);
await slideClose(presentation);

console.log(await renderAndExport(presentation));
