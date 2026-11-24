import React, { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, Filter, Mic2, Play, Radio, RotateCw, Square, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AzurePronunciationResult, MistakeRecord, StudyState, UnitBundle } from './types';

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
  onPlaySentence: (text: string, rate?: number) => void;
  onToggleRecording: () => void;
  onCompleteCurrentSentence: () => void;
  onSelectReadingSentence: (index: number) => void;
  onFinishReadingGoNext?: () => void;
  retryTarget?: MistakeRecord | null;
  onRetryTargetHandled?: () => void;
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
  onPlaySentence,
  onToggleRecording,
  onCompleteCurrentSentence,
  onSelectReadingSentence,
  onFinishReadingGoNext,
  retryTarget,
  onRetryTargetHandled,
}: Props) {
  const [onlyLowScore, setOnlyLowScore] = useState(false);
  const [showReference, setShowReference] = useState(false);

  const isRecording = recordingPhase === 'listening';
  const isBusy = recordingPhase === 'preparing' || recordingPhase === 'scoring';

  const latestScoreBySentence = useMemo(() => {
    const map = new Map<string, number>();
    studyState.pronunciationAssessments.forEach((record) => {
      if (!map.has(record.sentenceId)) {
        map.set(record.sentenceId, record.pronunciationScore);
      }
    });
    return map;
  }, [studyState.pronunciationAssessments]);

  const sentenceEntries = useMemo(() => {
    const all = currentUnit.sentences.map((sentence, idx) => ({
      sentence,
      idx,
      score: latestScoreBySentence.get(sentence.id) ?? null,
    }));
    if (!onlyLowScore) return all;
    const filtered = all.filter((item) => item.score !== null && item.score < 75);
    return filtered.length > 0 ? filtered : all;
  }, [currentUnit.sentences, latestScoreBySentence, onlyLowScore]);

  const lowScoreCount = useMemo(
    () => currentUnit.sentences.filter((s) => {
      const score = latestScoreBySentence.get(s.id);
      return score !== undefined && score < 75;
    }).length,
    [currentUnit.sentences, latestScoreBySentence],
  );

  const recordingButtonLabel = recordingPhase === 'preparing'
    ? '正在连接麦克风...'
    : recordingPhase === 'scoring'
      ? '正在评分...'
      : isRecording
        ? '停止并查看评分'
        : '点击开始跟读录音';

  const errorMessage = azureAssessmentError || recordingError;

  return (
    <div className="space-y-5">
      {retryTarget && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 flex items-center justify-between gap-3">
          <span>正在纠音复练：<strong>{retryTarget.expected}</strong>（跟读达到 75 分以上自动销账）</span>
          <button
            onClick={() => onRetryTargetHandled?.()}
            className="text-xs font-bold text-purple-600 hover:underline shrink-0"
          >
            退出复练
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">课文与重点句朗读</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {readingMode === 'sentence'
                ? '先听示范，再开口跟读；标红单词点一下可单独听慢速读音。'
                : '先听全文示范，再整段一次朗读，练习连贯度与完整度。'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => onChangeReadingMode('sentence')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                  readingMode === 'sentence' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
                )}
              >
                逐句精练
              </button>
              <button
                onClick={() => onChangeReadingMode('passage')}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                  readingMode === 'passage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
                )}
              >
                整篇朗读
              </button>
            </div>
            {(currentUnit.phrases && currentUnit.phrases.length > 0) && (
              <button
                onClick={() => setShowReference((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center gap-1 hover:bg-slate-200"
              >
                <BookOpen size={13} />
                固定搭配
                {showReference ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible phrases reference (replaces redundant Overview page clutter) */}
        {showReference && currentUnit.phrases && currentUnit.phrases.length > 0 && (
          <div className="mb-5 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-xs font-bold text-slate-500 mb-3">本单元固定搭配</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {currentUnit.phrases.map((phrase) => (
                <div key={phrase.id} className="rounded-xl bg-white border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 text-sm">{phrase.phrase}</span>
                    <button
                      onClick={() => onPlaySentence(phrase.example || phrase.phrase, 0.95)}
                      className="text-blue-500 hover:text-blue-600"
                      title="听搭配例句"
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{phrase.meaning}</div>
                  {phrase.example && <div className="text-[11px] text-slate-400 mt-1 italic">{phrase.example}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {readingMode === 'passage' ? (
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <span className="text-xs font-bold text-slate-500">{currentUnit.unit} 课文全文</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPlaySentence(passageText, 1)}
                    disabled={!passageText}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-blue-600 text-xs font-bold inline-flex items-center gap-1.5 hover:border-blue-300 disabled:opacity-40"
                  >
                    <Volume2 size={14} />
                    听全文示范
                  </button>
                  <button
                    onClick={() => onPlaySentence(passageText, 0.78)}
                    disabled={!passageText}
                    className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5 hover:border-blue-300 disabled:opacity-40"
                  >
                    <RotateCw size={13} />
                    慢速示范
                  </button>
                </div>
              </div>
              <div className="text-base sm:text-lg text-slate-800 leading-8 whitespace-pre-wrap font-medium">
                {passageText || '当前单元还没有可用于整篇朗读的课文。'}
              </div>
            </div>

            <div
              className={cn(
                'rounded-3xl border p-5 transition-all',
                passagePhase === 'listening' ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200 bg-white',
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onTogglePassageRecording}
                    disabled={passagePhase === 'preparing' || passagePhase === 'scoring' || !passageText}
                    className={cn(
                      'px-6 py-3.5 rounded-2xl inline-flex items-center justify-center gap-2 shadow-sm transition-all text-sm font-black',
                      passagePhase === 'preparing' || passagePhase === 'scoring'
                        ? 'bg-slate-200 text-slate-500 cursor-wait'
                        : passagePhase === 'listening'
                          ? 'bg-rose-500 text-white hover:bg-rose-600'
                          : 'bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50',
                    )}
                  >
                    {passagePhase === 'listening' ? <Square size={16} /> : <Mic2 size={16} />}
                    {passagePhase === 'listening'
                      ? '结束录音并评分'
                      : passagePhase === 'scoring'
                        ? '正在评分...'
                        : passagePhase === 'preparing'
                          ? '正在准备麦克风...'
                          : '开始整篇朗读'}
                  </button>
                  <span className="text-xs text-slate-500">
                    {passagePhase === 'listening' ? '请朗读上方全文，读完点击红色按钮结束' : '点击后直接开口朗读全文'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400">音量</span>
                  <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', passageLevel > 0.12 ? 'bg-emerald-400' : 'bg-slate-300')}
                      style={{ width: `${Math.round(passageLevel * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {passagePhase === 'listening' && (
                <div className="mt-4 rounded-2xl bg-white border border-rose-100 p-3.5 max-h-32 overflow-y-auto">
                  <div className="text-[11px] font-bold text-slate-400 mb-1">实时听到的内容</div>
                  <div className="text-sm text-slate-700">{passageInterimText || '正在倾听，请开始朗读…'}</div>
                </div>
              )}
            </div>

            {passageError && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">{passageError}</div>
            )}

            {passageAssessment && (
              <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-bold text-slate-800">整篇朗读评分</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: '总分', value: passageAssessment.pronunciationScore },
                      { label: '准确', value: passageAssessment.accuracyScore },
                      { label: '流利', value: passageAssessment.fluencyScore },
                      { label: '完整', value: passageAssessment.completenessScore },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-xl bg-white border border-slate-100 px-3 py-1.5">
                        <div className="text-[10px] text-slate-400">{metric.label}</div>
                        <div className="text-base font-black text-slate-800">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-500 mb-2">逐词反馈（点击任意词可听慢速示范）</div>
                  <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto">
                    {passageAssessment.words.map((word, wordIdx) => (
                      <button
                        key={`${word.word}-${wordIdx}`}
                        type="button"
                        onClick={() => onPlaySentence(word.word, 0.8)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all hover:scale-105',
                          word.errorType === 'Omission'
                            ? 'bg-rose-50 border-dashed border-rose-300 text-rose-600'
                            : word.errorType === 'Insertion'
                              ? 'bg-slate-100 border-slate-200 text-slate-500'
                              : word.accuracyScore >= 85
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : word.accuracyScore >= 70
                                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                                  : 'bg-rose-50 border-rose-200 text-rose-700',
                        )}
                        title="点击听这个词的标准发音"
                      >
                        {word.word}{' '}
                        {word.errorType === 'Omission' ? '漏读' : word.errorType === 'Insertion' ? '多读' : Math.round(word.accuracyScore)}
                      </button>
                    ))}
                  </div>
                </div>

                {passageRecognizedText && (
                  <div className="text-xs text-slate-500">识别内容：{passageRecognizedText}</div>
                )}
              </div>
            )}
          </div>
        ) : currentReadingSentence ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.95fr] gap-6">
            {/* Left: focused active sentence + recording + single clean result card */}
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-400">
                    第 {readingIndex + 1} / {currentUnit.sentences.length} 句
                  </span>
                  {studyState.followedSentenceIds.includes(currentReadingSentence.id) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                      已跟读 ✓
                    </span>
                  )}
                </div>

                <div className="text-2xl sm:text-[26px] font-black text-slate-900 leading-snug">
                  {currentReadingSentence.text}
                </div>
                <div className="text-sm text-slate-500 mt-2">{currentReadingSentence.translation}</div>

                {/* Listen controls */}
                <div className="flex flex-wrap items-center gap-2.5 mt-5">
                  <button
                    onClick={() => onPlaySentence(currentReadingSentence.text, 1)}
                    className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-blue-600 text-xs font-bold inline-flex items-center gap-1.5 hover:border-blue-300 transition-all"
                  >
                    <Volume2 size={15} />
                    标准示范
                  </button>
                  <button
                    onClick={() => onPlaySentence(currentReadingSentence.text, 0.75)}
                    className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5 hover:border-blue-300 transition-all"
                  >
                    <RotateCw size={13} />
                    慢速示范 (0.75x)
                  </button>
                  {recordedSentenceUrl && (
                    <button
                      onClick={() => {
                        const audio = new Audio(recordedSentenceUrl);
                        audio.play().catch(() => undefined);
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-amber-100 transition-all"
                    >
                      <Play size={13} />
                      听我的录音
                    </button>
                  )}
                </div>

                {/* Primary record card */}
                <div
                  className={cn(
                    'mt-5 rounded-2xl border p-4 transition-all',
                    isBusy
                      ? 'border-blue-200 bg-blue-50/70'
                      : isRecording
                        ? 'border-rose-200 bg-rose-50/70'
                        : 'border-slate-200 bg-white',
                  )}
                >
                  {isRecording && (
                    <div className="mb-3 rounded-xl bg-white border border-rose-100 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-rose-500 inline-flex items-center gap-1.5">
                          <Radio size={13} className="animate-pulse" />
                          正在录音，请大声朗读上方句子
                        </span>
                        <div className="h-2 w-20 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-100',
                              recordingLevel > 0.75 ? 'bg-rose-400' : recordingLevel > 0.12 ? 'bg-emerald-400' : 'bg-slate-300',
                            )}
                            style={{ width: `${Math.round(recordingLevel * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 min-h-[20px]">
                        {interimSentenceText || '等待声音输入…'}
                      </div>
                      {recordingLevel > 0 && recordingLevel <= 0.08 && (
                        <div className="text-xs text-amber-600 mt-1">声音偏小，请靠近麦克风一点</div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={onToggleRecording}
                      disabled={isBusy}
                      className={cn(
                        'flex-1 sm:flex-none px-6 py-3.5 rounded-2xl inline-flex items-center justify-center gap-2 shadow-sm transition-all text-sm font-black',
                        isBusy
                          ? 'bg-slate-200 text-slate-500 cursor-wait'
                          : isRecording
                            ? 'bg-rose-500 text-white hover:bg-rose-600 active:scale-95'
                            : 'bg-purple-500 text-white hover:bg-purple-600 active:scale-95',
                      )}
                    >
                      {isRecording ? <Square size={16} /> : <Mic2 size={16} />}
                      {recordingButtonLabel}
                    </button>

                    <button
                      onClick={onCompleteCurrentSentence}
                      className="px-5 py-3.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all inline-flex items-center gap-1.5"
                    >
                      {readingIndex >= currentUnit.sentences.length - 1 ? '标记完成本课时' : '下一句'}
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Single deduplicated pronunciation result card */}
              {(azureAssessment || errorMessage || recordingQualityWarning) && (
                <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4">
                  {azureAssessment && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black',
                              azureAssessment.pronunciationScore >= 80
                                ? 'bg-emerald-50 text-emerald-600'
                                : azureAssessment.pronunciationScore >= 65
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-rose-50 text-rose-600',
                            )}
                          >
                            <span className="text-xl leading-none">{azureAssessment.pronunciationScore}</span>
                            <span className="text-[10px] font-bold mt-0.5">总分</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800">
                              {pronunciationScore !== null ? getPronunciationHint(pronunciationScore) : '发音评测完成'}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                              <span>准确度 <strong>{azureAssessment.accuracyScore}</strong></span>
                              <span>流利度 <strong>{azureAssessment.fluencyScore}</strong></span>
                              <span>完整度 <strong>{azureAssessment.completenessScore}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-500 mb-2">
                          逐词评分（点任意标红/低分词，立刻听慢速示范）
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {azureAssessment.words.map((word, wordIdx) => (
                            <button
                              key={`${word.word}-${wordIdx}`}
                              type="button"
                              onClick={() => onPlaySentence(word.word, 0.8)}
                              className={cn(
                                'px-3 py-1.5 rounded-xl text-sm font-bold border transition-all hover:scale-105 inline-flex items-center gap-1',
                                word.errorType === 'Omission'
                                  ? 'bg-rose-50 border-dashed border-rose-300 text-rose-600'
                                  : word.errorType === 'Insertion'
                                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                                    : word.accuracyScore >= 85
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                      : word.accuracyScore >= 70
                                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                                        : 'bg-rose-50 border-rose-200 text-rose-700',
                              )}
                              title="点击听这个词的慢速发音"
                            >
                              <span>{word.word}</span>
                              <span className="text-[11px] opacity-80">
                                {word.errorType === 'Omission'
                                  ? '漏读'
                                  : word.errorType === 'Insertion'
                                    ? '多读'
                                    : Math.round(word.accuracyScore)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {recognizedSentenceText && (
                        <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
                          系统听到：<span className="text-slate-700 font-medium">{recognizedSentenceText}</span>
                        </div>
                      )}
                    </>
                  )}

                  {recordingQualityWarning && (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800">
                      <strong>录音提示：</strong>{recordingQualityWarning}
                    </div>
                  )}

                  {errorMessage && (
                    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
                      {errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: clean sentence list with scores & filter */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">本单元句子 ({currentUnit.sentences.length})</span>
                {lowScoreCount > 0 && (
                  <button
                    onClick={() => setOnlyLowScore((prev) => !prev)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all',
                      onlyLowScore ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100',
                    )}
                  >
                    <Filter size={11} />
                    只看待提升 ({lowScoreCount})
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {sentenceEntries.map(({ sentence, idx, score }) => {
                  const done = studyState.followedSentenceIds.includes(sentence.id);
                  const active = currentReadingSentence.id === sentence.id;
                  return (
                    <button
                      key={sentence.id}
                      onClick={() => onSelectReadingSentence(idx)}
                      className={cn(
                        'w-full rounded-2xl border p-3.5 text-left transition-all',
                        active
                          ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                          : 'border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-white',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-800 leading-snug">{sentence.text}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {score !== null && (
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold',
                                score >= 80
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : score >= 65
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-rose-100 text-rose-700',
                              )}
                            >
                              {score}分
                            </span>
                          )}
                          {done && <Check size={15} className="text-emerald-500" />}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{sentence.translation}</div>
                    </button>
                  );
                })}
              </div>

              {onFinishReadingGoNext && (
                <button
                  onClick={onFinishReadingGoNext}
                  className="w-full mt-2 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  完成朗读，进入下一步：语法练习
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6 text-sm text-slate-500 text-center">
            当前单元还没有可用的朗读句子。
          </div>
        )}
      </div>
    </div>
  );
}
