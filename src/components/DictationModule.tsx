import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, BookOpen, Check, ChevronRight, Eye, EyeOff, PencilLine, RefreshCw, RotateCw, Volume2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LessonStageKey, MistakeReason, MistakeRecord, UnitBundle } from './textbook/types';

interface Props {
  currentUnit: UnitBundle | null;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  /** Azure-first TTS; `rate` < 1 gives the slow replay used for dictation. */
  speak: (text: string, accent?: 'US' | 'UK', rate?: number) => Promise<boolean>;
  onRecordAttempt: (attempt: { mode: 'word' | 'sentence'; correct: number; total: number }) => void;
  retryTarget: MistakeRecord | null;
  onRetryTargetHandled: () => void;
  onResolveMistake: (mistake: MistakeRecord) => void;
  classifyDictationIssue: (input: string, target: string) => { reason: MistakeReason; hint: string };
  mistakeReasonLabels: Record<MistakeReason, string>;
}

/** Simple character-level diff for single-word spelling feedback. */
function renderSpellingDiff(input: string, target: string) {
  const cleanIn = input.trim().toLowerCase();
  const cleanTarget = target.trim();
  const chars = cleanTarget.split('');
  return (
    <span className="inline-flex flex-wrap gap-0.5 font-mono text-base font-bold">
      {chars.map((ch, idx) => {
        const matched = cleanIn[idx] === ch.toLowerCase();
        return (
          <span
            key={`${ch}-${idx}`}
            className={cn(
              'px-0.5 rounded',
              matched ? 'text-emerald-700 bg-emerald-100/70' : 'text-rose-700 bg-rose-200/80 underline decoration-2',
            )}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export function DictationModule({
  currentUnit,
  onCompleteStage,
  onAddMistake,
  speak,
  onRecordAttempt,
  retryTarget,
  onRetryTargetHandled,
  onResolveMistake,
  classifyDictationIssue,
  mistakeReasonLabels,
}: Props) {
  const [mode, setMode] = useState<'word' | 'sentence'>('word');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [feedbackHint, setFeedbackHint] = useState('');
  const [feedbackReason, setFeedbackReason] = useState<MistakeReason | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [onlyWrongMode, setOnlyWrongMode] = useState(false);
  const [showMeaningHint, setShowMeaningHint] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const pendingRetryIndexRef = useRef<number | null>(null);

  const fullData = currentUnit ? (mode === 'word' ? currentUnit.vocab : currentUnit.sentences) : [];
  const currentData = useMemo(() => {
    if (!onlyWrongMode) return fullData;
    return fullData.filter((item) => wrongIds.includes(item.id));
  }, [fullData, onlyWrongMode, wrongIds]);
  const safeIndex = currentData.length > 0 ? Math.min(currentIndex, currentData.length - 1) : 0;
  const currentItem = currentData[safeIndex];
  const itemKey = (item: { id: string }) => item.id;

  const play = async (text: string, rate: number) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      await speak(text, 'US', rate);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleSpeak = async (rate = 1) => {
    if (!currentItem) return;
    const text = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    await play(text, rate);
  };

  const resetRound = (nextIndex = 0) => {
    setCurrentIndex(nextIndex);
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    setScore({ correct: 0, total: 0 });
    setAnsweredIds([]);
    setWrongIds([]);
    setFinished(false);
    setOnlyWrongMode(false);
  };

  const checkAnswer = () => {
    if (!currentItem || showResult !== 'none' || !userInput.trim()) return;
    const target = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    const normalizedInput = userInput.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
    const normalizedTarget = target.trim().toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
    const key = itemKey(currentItem);

    setAnsweredIds((prev) => (prev.includes(key) ? prev : [...prev, key]));

    if (normalizedInput === normalizedTarget) {
      setShowResult('correct');
      setFeedbackHint('拼写完全正确！按回车进入下一题。');
      setFeedbackReason(null);
      setScore((prev) => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      // If practicing wrong-only items, clear this item from wrongIds!
      if (onlyWrongMode) {
        setWrongIds((prev) => prev.filter((id) => id !== key));
      }

      if (retryTarget && retryTarget.expected.trim().toLowerCase() === target.trim().toLowerCase()) {
        onResolveMistake(retryTarget);
        onRetryTargetHandled();
      }
      return;
    }

    const issue = classifyDictationIssue(userInput, target);
    setShowResult('wrong');
    setFeedbackHint(issue.hint);
    setFeedbackReason(issue.reason);
    setScore((prev) => ({ ...prev, total: prev.total + 1 }));
    setWrongIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (currentUnit) {
      onAddMistake({
        unitId: currentUnit.id,
        category: 'dictation',
        stage: 'dictation',
        prompt: mode === 'word' ? `单词听写：${(currentItem as any).word}` : `句子听写：${(currentItem as any).text}`,
        expected: target,
        answer: userInput.trim(),
        translation: mode === 'sentence' ? (currentItem as any).translation : (currentItem as any).definition,
        reason: issue.reason,
        hint: issue.hint,
      });
    }
  };

  const finishRound = () => {
    if (!currentUnit) return;
    setFinished(true);
    const accuracy = score.total > 0 ? score.correct / score.total : 0;
    if (accuracy >= 0.6 || (onlyWrongMode && wrongIds.length === 0)) {
      onCompleteStage('dictation');
    }
    onRecordAttempt({ mode, correct: score.correct, total: score.total });
  };

  const nextItem = () => {
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    if (onlyWrongMode) {
      // Because answered-right items are removed from wrongIds, currentData shrinks.
      if (currentData.length === 0 || safeIndex >= currentData.length - 1) {
        if (currentData.length === 0) {
          finishRound();
          return;
        }
        if (safeIndex >= currentData.length - 1) {
          finishRound();
          return;
        }
      }
      setCurrentIndex((prev) => Math.min(prev + 1, Math.max(0, currentData.length - 1)));
      return;
    }

    if (safeIndex >= currentData.length - 1) {
      finishRound();
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const practiceWrongOnly = () => {
    setFinished(false);
    setOnlyWrongMode(true);
    setCurrentIndex(0);
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    setScore({ correct: 0, total: 0 });
    setAnsweredIds([]);
  };

  const wrongItems = fullData.filter((item) => wrongIds.includes(itemKey(item)));

  // Reset round on unit or mode change (unless jumping to a targeted mistake)
  useEffect(() => {
    if (pendingRetryIndexRef.current !== null) {
      const idx = pendingRetryIndexRef.current;
      pendingRetryIndexRef.current = null;
      resetRound(idx);
      return;
    }
    resetRound(0);
  }, [currentUnit?.id, mode]);

  // Jump straight to the item the student was told to re-practice.
  useEffect(() => {
    if (!retryTarget || !currentUnit) return;
    const wantsSentence = retryTarget.prompt.startsWith('句子听写');
    const nextMode: 'word' | 'sentence' = wantsSentence ? 'sentence' : 'word';
    const list = nextMode === 'word' ? currentUnit.vocab : currentUnit.sentences;
    const index = list.findIndex((item) => (
      (nextMode === 'word' ? (item as any).word : (item as any).text).trim().toLowerCase()
      === retryTarget.expected.trim().toLowerCase()
    ));
    if (index < 0) return;
    if (nextMode !== mode) {
      pendingRetryIndexRef.current = index;
      setMode(nextMode);
    } else {
      resetRound(index);
    }
  }, [retryTarget, currentUnit, mode]);

  // Auto-play audio & focus input on every new question
  useEffect(() => {
    if (finished || !currentItem) return;
    inputRef.current?.focus();
    if (!autoPlay) return;
    const text = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    const timer = setTimeout(() => {
      void play(text, 1);
    }, 260);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, mode, currentUnit?.id, finished, onlyWrongMode]);

  // Allow pressing Enter after checking answer to immediately jump to next question
  useEffect(() => {
    if (showResult === 'none' || finished) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        nextItem();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (showResult === 'none') {
        checkAnswer();
      } else {
        nextItem();
      }
    }
  };

  const accuracyPct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {retryTarget && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center justify-between gap-3">
          <span>正在复练错题：<strong>{retryTarget.prompt}</strong>（答对即从错题本销账）</span>
          <button onClick={onRetryTargetHandled} className="text-xs font-bold text-blue-600 hover:underline shrink-0">
            退出复练
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
        {/* Top bar: mode switcher + helper toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode('word');
                resetRound(0);
              }}
              className={cn(
                'px-4 py-2 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1.5',
                mode === 'word' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
              )}
            >
              <BookOpen size={15} />
              单词拼写 ({currentUnit?.vocab.length || 0})
            </button>
            <button
              onClick={() => {
                setMode('sentence');
                resetRound(0);
              }}
              className={cn(
                'px-4 py-2 rounded-xl font-bold text-xs transition-all inline-flex items-center gap-1.5',
                mode === 'sentence' ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
              )}
            >
              <PencilLine size={15} />
              句子听写 ({currentUnit?.sentences.length || 0})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowMeaningHint((prev) => !prev)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-bold border inline-flex items-center gap-1 transition-all',
                showMeaningHint ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-500',
              )}
            >
              {showMeaningHint ? <Eye size={13} /> : <EyeOff size={13} />}
              {showMeaningHint ? '中文提示：开' : '盲听模式'}
            </button>
            <button
              type="button"
              onClick={() => setAutoPlay((prev) => !prev)}
              className={cn(
                'px-3 py-1.5 rounded-xl font-bold border transition-all',
                autoPlay ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500',
              )}
            >
              {autoPlay ? '自动播音：开' : '手动播音'}
            </button>
          </div>
        </div>

        {/* Progress strip */}
        {currentData.length > 0 && !finished && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>
                {onlyWrongMode ? '错题重听 · ' : ''}第 {safeIndex + 1} / {currentData.length} 题
              </span>
              <span className="font-bold text-emerald-600">当前正确率 {accuracyPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(((safeIndex + (showResult !== 'none' ? 1 : 0)) / currentData.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {currentData.length > 0 && !finished && currentItem ? (
          <div className="space-y-6 py-2 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSpeak(1)}
                  disabled={isSpeaking}
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-inner',
                    isSpeaking ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-blue-50 text-blue-600',
                  )}
                  title="标准语速再听一遍"
                >
                  {isSpeaking ? <RotateCw size={36} className="animate-spin" /> : <Volume2 size={36} />}
                </button>
                <button
                  onClick={() => handleSpeak(0.75)}
                  disabled={isSpeaking}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                >
                  慢速听 (0.75x)
                </button>
              </div>

              {showMeaningHint && (
                <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-xs text-slate-400 mr-2">中文意思</span>
                  <span className="text-sm font-bold text-slate-800">
                    {mode === 'word' ? (currentItem as any).definition : (currentItem as any).translation}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="relative">
                {mode === 'word' ? (
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    disabled={showResult !== 'none'}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className={cn(
                      'w-full bg-slate-50 border rounded-2xl px-6 py-5 text-center text-xl font-bold outline-none transition-all',
                      showResult === 'correct'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : showResult === 'wrong'
                          ? 'border-rose-400 bg-rose-50 text-rose-700'
                          : 'border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10',
                    )}
                    placeholder="输入听到的英文单词，按 Enter 检查"
                  />
                ) : (
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    disabled={showResult !== 'none'}
                    spellCheck={false}
                    className={cn(
                      'w-full bg-slate-50 border rounded-2xl p-5 text-center text-lg font-bold outline-none transition-all resize-none h-28',
                      showResult === 'correct'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : showResult === 'wrong'
                          ? 'border-rose-400 bg-rose-50 text-rose-700'
                          : 'border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10',
                    )}
                    placeholder="输入听到的英文句子，按 Enter 检查"
                  />
                )}

                <AnimatePresence>
                  {showResult !== 'none' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-md"
                    >
                      {showResult === 'correct' ? (
                        <div className="bg-emerald-500 text-white w-full h-full rounded-full flex items-center justify-center"><Check size={20} /></div>
                      ) : (
                        <div className="bg-rose-500 text-white w-full h-full rounded-full flex items-center justify-center"><X size={20} /></div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {showResult === 'wrong' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3">
                  <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-rose-800">正确答案（标红为写错或漏掉的字母）：</div>
                    {mode === 'word' ? (
                      <div>{renderSpellingDiff(userInput, (currentItem as any).word)}</div>
                    ) : (
                      <p className="text-sm text-rose-800 font-mono font-bold">{(currentItem as any).text}</p>
                    )}
                    {mode === 'sentence' && <p className="text-xs text-rose-600">{(currentItem as any).translation}</p>}
                    {feedbackReason && <p className="text-xs text-amber-700">错因：{mistakeReasonLabels[feedbackReason]} · {feedbackHint}</p>}
                  </div>
                </motion.div>
              )}

              {showResult === 'correct' && feedbackHint && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-sm font-bold text-emerald-700 text-center">
                  {feedbackHint}
                </div>
              )}

              {showResult === 'none' ? (
                <button
                  onClick={checkAnswer}
                  disabled={!userInput.trim()}
                  className="w-full blue-gradient py-3.5 rounded-2xl text-white font-bold shadow-md shadow-blue-100 active:scale-[0.99] transition-all disabled:opacity-40"
                >
                  检查答案（Enter）
                </button>
              ) : (
                <button
                  onClick={nextItem}
                  className="w-full bg-slate-900 py-3.5 rounded-2xl text-white font-bold active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  {safeIndex >= currentData.length - 1 ? '查看本轮成绩（Enter）' : '下一题（Enter）'}
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        ) : currentData.length > 0 && finished ? (
          <div className="py-6 space-y-5 max-w-xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-black text-slate-800">{accuracyPct}%</div>
              <div className="text-sm text-slate-500 mt-1">
                本轮{mode === 'word' ? '单词' : '句子'}听写答对 {score.correct} / {score.total}
              </div>
              {accuracyPct < 60 && (
                <div className="mt-2 text-xs font-bold text-amber-600">
                  正确率达到 60% 以上或清空错题即可完成本课时，先点「只练错题」巩固一遍吧！
                </div>
              )}
            </div>

            {wrongItems.length > 0 ? (
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
                <div className="text-xs font-bold text-rose-700 mb-2">需要再听一遍的 {wrongItems.length} 条</div>
                <div className="space-y-2">
                  {wrongItems.map((item) => (
                    <div key={itemKey(item)} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5">
                      <div>
                        <span className="text-sm font-mono font-bold text-rose-700">
                          {mode === 'word' ? (item as any).word : (item as any).text}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">
                          {mode === 'word' ? (item as any).definition : (item as any).translation}
                        </span>
                      </div>
                      <button
                        onClick={() => play(mode === 'word' ? (item as any).word : (item as any).text, 0.85)}
                        className="text-xs font-bold text-blue-600 hover:underline shrink-0"
                      >
                        再听一次
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 text-center font-bold">
                本轮全对！本单元听写课时已自动标记完成。
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              {wrongItems.length > 0 && (
                <button onClick={practiceWrongOnly} className="px-5 py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600">
                  只练错题（{wrongItems.length}）
                </button>
              )}
              <button onClick={() => resetRound(0)} className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2 hover:bg-slate-800">
                <RefreshCw size={15} />
                重新练一轮
              </button>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <BookOpen size={44} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">当前单元暂无{mode === 'word' ? '单词' : '句子'}听写数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
