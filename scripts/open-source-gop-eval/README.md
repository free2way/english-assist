# 开源发音评测可行性验证（GOP-lite）

配套文档：[docs/SPEECH_ENGINE_EVALUATION.md](../../docs/SPEECH_ENGINE_EVALUATION.md)

目的：在不依赖任何商业 API 的前提下，验证"用开源模型给朗读打分"能做到什么程度。
方法：`facebook/wav2vec2-base-960h`（字母级 CTC）+ `torchaudio.forced_align` 对参考句做强制对齐，
取每个字母在最优路径上的平均后验概率作为 confidence，再按词聚合；`noisy.wav` / `truncated.wav`
由文件名触发脚本内的加噪（SNR 5dB）/ 截断处理。

## 运行

```bash
cd scripts/open-source-gop-eval
./samples.sh                      # 仅 macOS，用 say 生成样本音频
uv venv --python 3.11 --python-preference only-managed
uv pip install torch torchaudio transformers soundfile numpy
.venv/bin/python score.py audio/good.wav audio/accented.wav audio/wrongwords.wav audio/noisy.wav audio/truncated.wav
```

输出每个样本的 `gop_lite_score`、对齐覆盖率、最差字母/最差词，以及单条推理耗时。

## 本机基准结果（Apple M 系列 10 核 CPU）

| 样本 | 时长 | GOP-lite | 覆盖率 | 最差词 |
| --- | --- | --- | --- | --- |
| good | 3.65s | 96.1 | 53.3% | FAMILY 81 |
| wrongwords | 3.41s | 83.1 | 51.8% | BREAKFAST 0.0 |
| noisy (+5dB) | 3.65s | 60.3 | 43.4% | THEN 14 |
| truncated | 1.83s | 23.1 | 76.9% | GET / UP / SIX 0.0 |
| accented（中文口音） | 5.04s | 27.4 | 29.9% | I 0.2 / MY 0.8 |

结论见文档：**内容维度（读错/漏读）可用；发音分不可直接商用，需要音素级 GOP + 学习者语料标定。**
