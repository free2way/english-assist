# 听口打分链路：问题定位与修复记录

面向对象：本项目后续维护者。
范围：`朗读评测` / `AI 外教口语评测` 两条 Azure 语音链路的识别率与延迟问题。

## 一、根因（真机探针实测后修正过的版本）

> 说明：本节最初的推断（"分段后完整度会腰斩"）已被 2026-10-10 的真机探针推翻并改写，见下面的实测数据。

### 1. 连续识别模式下只取最后一段的结果（打分失真，不是"分数偏低"）

`src/lib/azureSpeech.ts`（改前）用连续识别 + 发音评测，`recognized` 事件里只保留最后一次结果：

```ts
recognizer.recognized = (_sender, event) => {
  if (hasAssessmentPayload(event?.result)) latestResult = event.result;  // 覆盖，只留最后一段
};
```

`npm run probe:speech` 实测（同一句教材句子，TTS 合成，中间插入 1.8s 停顿，账号区域 eastasia）：

| 场景 | 分段 | 服务返回 |
| --- | --- | --- |
| 连续识别，默认分段阈值 | 2 段 | 段1 `I usually get up at 6:30.` pron 98.2 / comp 100；段2 `And then have breakfast with my family.` pron 98.2 / comp 100 |
| 连续识别，SegmentationSilenceTimeoutMs=1500 | 2 段 | 同上 |
| 一次性识别（push stream，停止时关闭流） | 1 段 | `I usually get up at 6:30 and then have breakfast with my family.` pron 79 / acc 97 / flu 66 / **comp 100** |

实测结论与最初推断的差别：

- 分段后每段的 `CompletenessScore` **不会腰斩**（每段都按参考文本打分，实测两段都是 100），所以旧代码给出的分数不是"偏低"，而是**只代表最后半句且偏高**；
- 真实损失是：① 只上报最后一段的词 → 逐词反馈缺前半句；② 学生漏读/读错前半句时分数看不出来（评测只覆盖尾段）；③ 段与段之间的停顿不计入流利度（旧代码显示的 fluency 恒为 100）；
- 官方连续模式样例把**所有分段的词合并**再重算，并设 `Speech_SegmentationSilenceTimeoutMs=1500`，本项目的修复遵循了这一做法。

### 2. 每次录音都要等一次 Azure STS token 往返（延迟的主因）

- 服务端 `GET /api/speech-token` 每次都新建 `fetch(...issueToken)`，即使 10 分钟有效期内也不缓存；
- 前端每次 TTS / 评测前都先取 token，且没有本地缓存；
- 这段往返在"点开始录音 → 真正开始说话"的关键路径上；并且线上函数跑在 Vercel 默认区域（iad1，美国东部），国内学生会先跨境到美国拿 token 再连到 Azure eastasia。

实测：本机（经代理）到 eastasia 的 STS 握手 + 首字节约 1.2～1.4s；探针里 `sessionStarted` 稳定在 **0.87～0.96s**（已含一次未缓存的 token 获取与 WebSocket 建连）。

### 3. 串行启动 + 状态说谎

改前的顺序是：`getUserMedia` → `MediaRecorder.start()` → 取 token → 连接 WebSocket → 开始识别。但 UI 在第一步之后就已经显示"正在录音"。
结果是学生看到"正在录音"就开始读，前面一两个单词根本没进识别；同时"点了按钮没反应"的体感来自这里。

### 4. 停止后硬等 800ms

```ts
if (!latestResult) await wait(800);  // 盲等
```

实测停止后服务端的补发分段在 **~440ms** 到达（连续识别），旧代码固定多等 800ms；而"等不到最终分段就报错/丢字"的情况，在旧代码里没有区分处理。

### 5. 其他

- 同时开两条麦克风流（SDK 一条 + MediaRecorder 一条）；
- 麦克风授权弹窗一直不点，UI 会永远停在"准备中"；
- 错误提示笼统（网络失败 / 授权失败 / 没说话混在一起）。

## 二、本次修复

| 文件 | 改动 |
| --- | --- |
| `src/lib/azureSpeech.ts` | 重写：token 缓存、预加载、共享麦克风流、多段结果聚合、就绪/中间结果回调、智能停止、错误映射 |
| `server/app.ts`、`api/_lib/app.ts` | `/api/speech-token` 增加 STS token 内存缓存（9 分钟，带刷新余量，并记录真实 `expiresInSeconds`） |
| `src/components/textbook/TextbookModule.tsx` | 录音流程改为 prepare → listening → scoring 三态；单条麦克风流；实时识别回显；并发保护（切句/卸载时取消在途会话） |
| `src/components/textbook/TextbookReadingPracticePage.tsx` | 状态文案、实时识别卡片、逐词反馈区分「漏读 / 多读 / 低分」 |
| `src/App.tsx` | AI 外教口语评测与语音输入接入新接口，增加"正在准备麦克风"状态 |
| `vite.config.ts` | 允许 `API_PROXY_TARGET` 覆盖后端地址（本机 3001 被占用时用） |
| `scripts/test-speech-aggregation.ts`、`scripts/probe-azure-pronunciation.mjs` | 新增合并打分单测与真机探针 |
| `package.json` | `npm run test:speech`、`npm run probe:speech` |

关键实现说明：

1. **多段合并打分**（`aggregatePronunciationSegments`）
   - 单段：直接采用 Azure 的服务端分数（整体对着完整参考句打的，可信）；
   - 多段：把各段的词按时间顺序合并，用 LCS 对齐参考句得到 `match / omission / insertion`，再重算
     accuracy = 匹配词准确度均值；completeness = 匹配词数 / 参考词数；fluency = 词时长之和 / 首尾跨度；
     pron 权重沿用官方样例（升序 0.6 / 0.2 / 0.2）。
2. **分段静音阈值 1500ms**：学生换气不会立刻切段；已有分段仍会被合并，不会丢分。
3. **停止策略**：先 `stopContinuousRecognitionAsync`，然后按"停止时是否正在说话"决定等待窗口（0 / 1.2s / 2.5s / 3s），一旦收到补发的最终分段立刻返回 —— 取代原来的固定 800ms 盲等。
4. **token 缓存**：服务端 9 分钟内存缓存 + 单飞请求；前端按 `expiresInSeconds` 缓存并提前 60s 刷新；页面打开即预加载 SDK 与 token。
5. **共享麦克风流**：`AudioConfig.fromStreamInput(mediaStream)` 与 MediaRecorder 用同一条 `getUserMedia`（含回声消除/降噪/自动增益），回放的就是被评测的音频。
6. **错误映射**：401/403 → 授权失败提示；1006/网络 → 连接失败提示；无语音 → 专门的提示；麦克风授权 30s 未响应 → 超时提示。

## 三、验证（2026-10-10 已用真实账号跑过，区域 eastasia）

```bash
npm run lint          # tsc --noEmit
npm run test:speech   # 合并打分单测（6 个用例）
npm run probe:speech  # 真机探针：AZURE_SPEECH_KEY/REGION，或 AZURE_SPEECH_TOKEN_ENDPOINT 从线上取 token
```

探针支持 `PROBE_INPUT=<16k 单声道 16bit WAV>`，可以直接把**真实学生录音**喂进去复现线上表现。

已测数据：

| 样本 | 一次性识别（A） | 连续识别（B/C） |
| --- | --- | --- |
| 合成朗读 + 1.8s 中间停顿 | pron 79 / acc 97 / flu 66 / comp 100，整句 14 词 | 切成 2 段，各段 pron 98.2 / comp 100；合并后 acc 97 / comp 100 / flu 62.9 |
| 停止到出分耗时 | 0.56～2.34s（两次） | 补发分段 ~0.44s 到达 |

引擎鲁棒性（同一句，一次性识别）：

| 样本 | 结果 |
| --- | --- |
| 美音 TTS，干净 | acc 97～99 / comp 100 |
| 美音 TTS + 白噪声（语音段 7.6dB） | acc 99 / comp 100 |
| 中文口音 TTS，干净 | acc 71 / comp 86（把 "then have breakfast" 听成 "then have with breakfast"） |
| 中文口音 TTS + 低通（室内）噪声 15dB | acc 82～83 / comp 93 |
| 中文口音 TTS + 低通噪声 10dB | acc 84～85 / comp 93 |
| 中文口音 TTS + **白噪声** 15dB | acc 6（崩）——白噪声掩蔽辅音，属于不真实的最坏情况 |

结论：**在接近真实房间噪声的条件下，Azure 对重口音仍然给出 82+ 的准确度，引擎本身不是"识别率低"的原因**。白噪声那一行是极端合成条件，不要当作学生真实场景，但可以据此推断：**麦克风质量与录音环境（安静房间、耳麦、说话音量）对分数的影响远大于换引擎**。

浏览器侧手测清单：

1. 朗读评测页 → 点"开始录音朗读"，应先出现"正在连接评测服务"，就绪后才变成"正在录音"；
2. 朗读中应看到实时识别文本；
3. 读到一半故意停顿 1.5~2s 再继续，分数不应崩（旧版本这里只上报尾段）；
4. 点"结束录音并提交评分"后应在 1s 内出分（旧版本固定多等 800ms）；
5. 拒绝麦克风权限 / 断网时应有明确提示并回到可重试状态。

调试开关：`localStorage.speechDebug = '1'` 后控制台会输出 `[speech]` 前缀的分段时间线。

## 四、后续建议（按优先级）

1. **部署本次改动**：线上仍是旧代码（`/api/speech-token` 无缓存、前端仍只取尾段）。部署后 `localStorage.speechDebug=1` 观察一次真实朗读的耗时分布。
2. **把 Vercel 函数区域换到香港（hkg1）**：现在函数跑在默认 iad1（美国东部），学生每次取 token 都要跨境往返；函数区域与 Azure eastasia 同区能省掉这一跳（Hobby 计划能否改区域取决于账号套餐，Pro 可在项目的 Functions 设置里改）。
3. **用真实学生录音喂探针**：`PROBE_INPUT=xxx.wav npm run probe:speech`。若真实录音在低通噪声 15dB 下复现出 acc < 60，问题在采集端（麦克风/环境/音量），应优先做录音质量提示而不是换引擎。
4. **升级 SDK 到 1.52+ 并用 `PushAudioInputStream.Commit()`**：可以做到"点停止 → 立刻出分"的确定性收敛（`setfeature=forcecommit`，预览特性）；1.41+ 还提供语义分段。当前锁在 1.48。
5. **服务端 token 缓存的上限**：Vercel serverless 每个实例各自持有缓存，冷启动仍会打一次 STS；并发量大时可把 token 缓存到 Turso/KV。
6. **学习数据仍存在 localStorage**（学习进度、错题、发音评测记录，见 `src/App.tsx` 的 `getStudyStorageKey`）：换设备/清缓存即丢失，教师端看到的也不是真实数据。建议先把发音评测记录和错题落到服务端表。
7. **安全**：`server/db.ts` 里默认管理员账号密码仍是硬编码常量，建议改为首启初始化 + 环境变量注入；`server/app.ts` 与 `api/_lib/app.ts` 是两份几乎完全相同的拷贝，本次改动需要两处同步，长期应合并为单一实现 + 薄适配层。
