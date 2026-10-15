import React from 'react';
import { Check, Mic2, Radio, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AzurePronunciationResult, StudyState, UnitBundle } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  currentReadingSentence: UnitBundle['sentences'][number] | undefined;
  readingIndex: number;
  recordingPhase: 'idle' | 'preparing' | 'listening' | 'scoring';
  interimSentenceText: string;
  readingMode: 'sentence' | 'passage';
  onChangeReadingMode: (mode: 'sentence' | 'passage') => void;
  passageText: string;
  passagePhase: 'idle' | 'preparing' | 'listening' | 'scoring';
  passageInterimText: string;
  passageLevel: number;
  passageAssessment: AzurePronunciationResult | null;
  passageRecognizedText: string;
  passageError: string;
  onTogglePassageRecording: () => void;
  recordingLevel: number;
  recordingQualityWarning: string;
  recordedSentenceUrl: string;
  recognizedSentenceText: string;
  pronunciationScore: number | null;
  recordingError: string;
  azureAssessment: AzurePronunciationResult | null;
  azureAssessmentError: string;
  getPronunciationHint: (score: number) => string;
  onSelectStage: () => void;
  onPlaySentence: (text: string) => void;
  onToggleRecording: () => void;
  onCompleteCurrentSentence: () => void;
  onSelectReadingSentence: (index: number) => void;
}

export function TextbookReadingPracticePage({
  currentUnit,
  studyState,
  currentReadingSentence,
  readingIndex,
  recordingPhase,
  interimSentenceText,
  readingMode,
  onChangeReadingMode,
  passageText,
  passagePhase,
  passageInterimText,
  passageLevel,
  passageAssessment,
  passageRecognizedText,
  passageError,
  onTogglePassageRecording,
  recordingLevel,
  recordingQualityWarning,
  recordedSentenceUrl,
  recognizedSentenceText,
  pronunciationScore,
  recordingError,
  azureAssessment,
  azureAssessmentError,
  getPronunciationHint,
  onSelectStage,
  onPlaySentence,
  onToggleRecording,
  onCompleteCurrentSentence,
  onSelectReadingSentence,
}: Props) {
  const isRecording = recordingPhase === 'listening';
  const isBusy = recordingPhase === 'preparing' || recordingPhase === 'scoring';
  const recordingTitle = recordingPhase === 'preparing'
    ? '正在连接评测服务'
    : recordingPhase === 'scoring'
      ? '正在提交评分'
      : isRecording
        ? '正在录音'
        : '准备开始录音';
  const recordingDescription = recordingPhase === 'preparing'
    ? '正在准备麦克风和 Azure 连接，就绪后会自动开始录音。'
    : recordingPhase === 'scoring'
      ? '正在把你的朗读提交给 Azure 发音评测，请稍等。'
      : isRecording
        ? '请朗读上面的英文句子；读完后，点下面红色按钮结束录音并提交评分。'
        : '点下面按钮开始录音，系统会边录边做发音评测。';
  const recordingButtonLabel = recordingPhase === 'preparing'
    ? '正在准备...'
    : recordingPhase === 'scoring'
      ? '正在评分...'
      : isRecording
        ? '结束录音并提交评分'
        : '开始录音朗读';

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h3 className="font-bold text-slate-800">课文朗读训练</h3>
          <p className="text-sm text-slate-500 mt-1">
            {readingMode === 'sentence' ? '按句推进，逐句播放、跟读、标记完成。' : '整段课文一次录完，检查完整度、流利度与漏读词。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onChangeReadingMode('sentence')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                readingMode === 'sentence' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400',
              )}
            >
              逐句朗读
            </button>
            <button
              onClick={() => onChangeReadingMode('passage')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                readingMode === 'passage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400',
              )}
            >
              整篇朗读
            </button>
          </div>
          <button onClick={onSelectStage} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold">
            当前课时：重点句跟读
          </button>
        </div>
      </div>

      {readingMode === 'passage' ? (
        <div className="space-y-6">
          <div className="rounded-3xl bg-slate-50 border border-slate-100 p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
              Passage · {currentUnit.unit}
            </div>
            <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
              {passageText || '当前单元还没有可用于整篇朗读的课文。'}
            </div>
            <div className="text-xs text-slate-400 mt-3">
              建议：先整段读一遍，卡住的地方再回到"逐句朗读"针对练习。
            </div>
          </div>

          <div
            className={cn(
              'rounded-3xl border p-5',
              passagePhase === 'listening' ? 'border-red-100 bg-red-50' : 'border-purple-100 bg-white',
            )}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-sm font-black text-slate-800">
                  {passagePhase === 'preparing'
                    ? '正在连接评测服务'
                    : passagePhase === 'scoring'
                      ? '正在提交评分'
                      : passagePhase === 'listening'
                        ? '正在录音（整篇）'
                        : '准备开始整篇朗读'}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  {passagePhase === 'listening'
                    ? '请从第一句开始整段朗读；读完后点红色按钮结束并提交评分。'
                    : passagePhase === 'idle'
                      ? '点击按钮开始整段录音，系统会按课文全文评测。'
                      : '请稍等…'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400">麦克风</span>
                <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', passageLevel > 0.12 ? 'bg-emerald-400' : 'bg-slate-300')}
                    style={{ width: `${Math.round(passageLevel * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {passagePhase === 'listening' && (
              <div className="mb-4 rounded-2xl bg-white border border-red-100 p-4 max-h-40 overflow-y-auto">
                <div className="text-xs font-bold text-slate-400 mb-1">实时识别</div>
                <div className="text-sm text-slate-700">{passageInterimText || '等待开始朗读…'}</div>
              </div>
            )}

            <button
              onClick={onTogglePassageRecording}
              disabled={passagePhase === 'preparing' || passagePhase === 'scoring' || !passageText}
              className={cn(
                'w-full sm:w-auto px-5 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm font-black',
                passagePhase === 'preparing' || passagePhase === 'scoring'
                  ? 'bg-slate-200 text-slate-500 cursor-wait'
                  : passagePhase === 'listening'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-purple-500 text-white hover:scale-105 disabled:opacity-50 disabled:grayscale',
              )}
            >
              {passagePhase === 'listening' ? <Square size={18} /> : <Mic2 size={18} />}
              {passagePhase === 'listening' ? '结束录音并提交评分' : passagePhase === 'scoring' ? '正在评分...' : '开始整篇朗读'}
            </button>
          </div>

          {passageError && (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">{passageError}</div>
          )}

          {passageAssessment && (
            <div className="rounded-3xl border border-slate-100 bg-white p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-1">整篇朗读评测</div>
                  <div className="text-sm text-slate-600">基于课文全文的发音评测，适合练连贯与完整度。</div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold">
                  总分 {passageAssessment.pronunciationScore}
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { label: '发音总分', value: passageAssessment.pronunciationScore },
                  { label: '准确度', value: passageAssessment.accuracyScore },
                  { label: '流利度', value: passageAssessment.fluencyScore },
                  { label: '完整度', value: passageAssessment.completenessScore },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className="text-xl font-black text-slate-800 mt-1">{item.value}</div>
                  </div>
                ))}
              </div>

              {passageRecognizedText && (
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-400 mb-2">识别到的内容</div>
                  <div className="text-sm text-slate-700">{passageRecognizedText}</div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-400 mb-3">逐词反馈（漏读 / 多读 / 低分）</div>
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
                    {passageAssessment.words.map((word) => (
                      <span
                        key={`${word.word}-${word.accuracyScore}-${word.errorType}`}
                        className={cn(
                          'px-2.5 py-1.5 rounded-xl text-xs font-bold border',
                          word.errorType === 'Omission'
                            ? 'bg-rose-50 border-dashed border-rose-300 text-rose-600'
                            : word.errorType === 'Insertion'
                              ? 'bg-slate-100 border-slate-200 text-slate-500'
                              : word.accuracyScore >= 85
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : word.accuracyScore >= 70
                                  ? 'bg-amber-50 border-amber-100 text-amber-700'
                                  : 'bg-rose-50 border-rose-100 text-rose-700',
                        )}
                      >
                        {word.word} {word.errorType === 'Omission' ? '漏读' : word.errorType === 'Insertion' ? '多读' : Math.round(word.accuracyScore)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-400 mb-3">学习建议</div>
                  <div className="space-y-2">
                    {passageAssessment.feedback.map((item) => (
                      <div key={item} className="text-sm text-slate-600">• {item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : currentReadingSentence ? (
        <div className="grid grid-cols-1 2xl:grid-cols-[1.4fr_1fr] gap-6">
          <div className="rounded-3xl bg-slate-50 border border-slate-100 p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">
              Sentence {readingIndex + 1}/{currentUnit.sentences.length}
            </div>
            <div className="text-2xl font-black text-slate-800 leading-relaxed">{currentReadingSentence.text}</div>
            <div className="text-sm text-slate-500 mt-3">{currentReadingSentence.translation}</div>
            <div
              className={cn(
                'mt-6 rounded-3xl border p-5 transition-all',
                isBusy
                  ? 'border-blue-100 bg-blue-50'
                  : isRecording
                    ? 'border-red-100 bg-red-50'
                    : 'border-purple-100 bg-white',
              )}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-2xl flex items-center justify-center',
                    isBusy
                      ? 'bg-blue-100 text-blue-600'
                      : isRecording
                        ? 'bg-red-100 text-red-600'
                        : 'bg-purple-100 text-purple-600',
                  )}
                >
                  {isRecording ? <Radio size={20} className="animate-pulse" /> : <Mic2 size={20} />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-800">{recordingTitle}</div>
                  <div className="text-sm text-slate-600 mt-1">{recordingDescription}</div>
                </div>
              </div>

              {isRecording && (
                <div className="mb-4 rounded-2xl bg-white border border-red-100 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-xs font-bold text-slate-400">实时识别</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">麦克风</span>
                      <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width] duration-100',
                            recordingLevel > 0.75
                              ? 'bg-rose-400'
                              : recordingLevel > 0.12
                                ? 'bg-emerald-400'
                                : 'bg-slate-300',
                          )}
                          style={{ width: `${Math.round(recordingLevel * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 min-h-[20px]">
                    {interimSentenceText || '等待开始朗读…'}
                  </div>
                  {recordingLevel > 0 && recordingLevel <= 0.08 && (
                    <div className="text-xs text-amber-600 mt-2">声音有点小，再靠近麦克风一点</div>
                  )}
                </div>
              )}

              <button
                onClick={onToggleRecording}
                disabled={isBusy}
                className={cn(
                  'w-full sm:w-auto px-5 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm font-black',
                  isBusy
                    ? 'bg-slate-200 text-slate-500 cursor-wait'
                    : isRecording
                      ? 'bg-red-500 text-white shadow-red-100 hover:bg-red-600 active:scale-95'
                      : 'bg-purple-500 text-white hover:scale-105 active:scale-95',
                )}
                aria-label={isRecording ? '停止录音并提交评测' : '开始录音并朗读'}
              >
                {isRecording ? <Square size={18} /> : <Mic2 size={18} />}
                {recordingButtonLabel}
              </button>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              <button onClick={() => onPlaySentence(currentReadingSentence.text)} className="px-4 py-3 rounded-2xl bg-white border border-slate-100 text-blue-500 text-sm font-bold">
                播放本句
              </button>
              <button onClick={onCompleteCurrentSentence} className="px-4 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold">
                完成并进入下一句
              </button>
              <button
                onClick={() => {
                  if (!recordedSentenceUrl) return;
                  const audio = new Audio(recordedSentenceUrl);
                  audio.play().catch(() => undefined);
                }}
                disabled={!recordedSentenceUrl}
                className={cn(
                  'px-4 py-3 rounded-2xl text-sm font-bold',
                  recordedSentenceUrl
                    ? 'bg-white border border-amber-200 text-amber-600'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
              >
                学员录音回放
              </button>
            </div>

            {(recordedSentenceUrl || recognizedSentenceText || recordingError) && (
              <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-400">跟读对比结果</div>
                    <div className="text-sm text-slate-600 mt-1">用同一个麦克风按钮控制开始和停止，第二次点击后会立刻提交 Azure 发音评测。</div>
                  </div>
                  {pronunciationScore !== null && (
                    <div
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm font-bold',
                        pronunciationScore >= 80 ? 'bg-emerald-50 text-emerald-600' : pronunciationScore >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                      )}
                    >
                      发音相似度 {pronunciationScore}%
                    </div>
                  )}
                </div>

                {recordedSentenceUrl && (
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-2">我的录音</div>
                    <audio controls src={recordedSentenceUrl} className="w-full" />
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-2">目标句子</div>
                    <div className="text-sm font-bold text-slate-800">{currentReadingSentence.text}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-xs font-bold text-slate-400 mb-2">识别结果</div>
                    <div className="text-sm font-bold text-slate-800">{recognizedSentenceText || '等待识别结果'}</div>
                  </div>
                </div>

                {pronunciationScore !== null && (
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">{getPronunciationHint(pronunciationScore)}</div>
                )}

                {recordingError && <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">{recordingError}</div>}

                {recordingQualityWarning && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
                    <span className="font-bold">录音质量提示：</span>{recordingQualityWarning}
                  </div>
                )}
              </div>
            )}

            {(azureAssessment || azureAssessmentError) && (
              <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-400 mb-1">Azure 发音评测</div>
                    <div className="text-sm text-slate-600">基于参考句进行准确度、流利度和完整度评测。</div>
                  </div>
                  {azureAssessment && <div className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold">总分 {azureAssessment.pronunciationScore}</div>}
                </div>

                {azureAssessment && (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">发音总分</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.pronunciationScore}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">准确度</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.accuracyScore}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">流利度</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.fluencyScore}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs text-slate-400">完整度</div>
                        <div className="text-xl font-black text-slate-800 mt-1">{azureAssessment.completenessScore}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs font-bold text-slate-400 mb-3">逐词反馈</div>
                        <div className="flex flex-wrap gap-2">
                          {azureAssessment.words.map((word) => (
                            <span
                              key={`${word.word}-${word.accuracyScore}-${word.errorType}`}
                              className={cn(
                                'px-3 py-2 rounded-xl text-sm font-bold border',
                                word.errorType === 'Omission'
                                  ? 'bg-rose-50 border-dashed border-rose-300 text-rose-600'
                                  : word.errorType === 'Insertion'
                                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                                    : word.accuracyScore >= 85
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                      : word.accuracyScore >= 70
                                        ? 'bg-amber-50 border-amber-100 text-amber-700'
                                        : 'bg-rose-50 border-rose-100 text-rose-700'
                              )}
                            >
                              {word.word}{' '}
                              {word.errorType === 'Omission'
                                ? '漏读'
                                : word.errorType === 'Insertion'
                                  ? '多读'
                                  : Math.round(word.accuracyScore)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                        <div className="text-xs font-bold text-slate-400 mb-3">学习建议</div>
                        <div className="space-y-2">
                          {azureAssessment.feedback.map((item) => (
                            <div key={item} className="text-sm text-slate-600">• {item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {azureAssessmentError && <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">{azureAssessmentError}</div>}
              </div>
            )}
          </div>

          <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
            {currentUnit.sentences.map((sentence, index) => {
              const done = studyState.followedSentenceIds.includes(sentence.id);
              const active = currentReadingSentence.id === sentence.id;
              return (
                <button
                  key={sentence.id}
                  onClick={() => onSelectReadingSentence(index)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    active ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-800">{sentence.text}</span>
                    {done && <Check size={16} className="text-emerald-500 shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">{sentence.translation}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm text-slate-500">当前单元还没有可用的朗读句子。</div>
      )}
    </div>
  );
}
