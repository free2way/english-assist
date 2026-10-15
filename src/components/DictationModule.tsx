import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, BookOpen, Check, ChevronRight, PencilLine, RefreshCw, RotateCw, Volume2, X } from 'lucide-react';
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

  const fullData = currentUnit ? (mode === 'word' ? currentUnit.vocab : currentUnit.sentences) : [];
  const currentData = useMemo(() => {
    if (!onlyWrongMode) return fullData;
    return fullData.filter((item) => wrongIds.includes(item.id));
  }, [fullData, onlyWrongMode, wrongIds]);
  const currentItem = currentData[currentIndex];
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

  const resetRound = () => {
    setCurrentIndex(0);
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
    if (!currentItem) return;
    const target = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    const normalizedInput = userInput.trim().toLowerCase().replace(/[.,!?;:]/g, '');
    const normalizedTarget = target.trim().toLowerCase().replace(/[.,!?;:]/g, '');
    const key = itemKey(currentItem);

    setAnsweredIds((prev) => (prev.includes(key) ? prev : [...prev, key]));

    if (normalizedInput === normalizedTarget) {
      setShowResult('correct');
      setFeedbackHint('这题正确，可以继续下一题。');
      setFeedbackReason(null);
      setScore((prev) => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));

      // A targeted re-practice of a mistake clears it from the mistake book.
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
        translation: mode === 'sentence' ? (currentItem as any).translation : undefined,
        reason: issue.reason,
        hint: issue.hint,
      });
    }
  };

  const finishRound = () => {
    if (!currentUnit) return;
    setFinished(true);
    // Completion is "every item answered once" - the old rule only completed
    // the stage when the LAST item happened to be correct.
    onCompleteStage('dictation');
    onRecordAttempt({ mode, correct: score.correct, total: score.total });
  };

  const nextItem = () => {
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    if (currentIndex >= currentData.length - 1) {
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

  useEffect(() => {
    resetRound();
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
    setMode(nextMode);
    resetRound();
    setCurrentIndex(index);
  }, [retryTarget, currentUnit]);

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex flex-col mb-6 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">听写训练</h2>
            <p className="text-sm text-slate-500">
              {currentUnit ? `${currentUnit.grade} ${currentUnit.semester} · ${currentUnit.unit} · ${currentUnit.title}` : '暂无可用教材单元'}
            </p>
          </div>
        </div>
      </div>

      {retryTarget && (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          正在复练错题：{retryTarget.prompt}（答对即从错题本销账）
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setMode('word');
              resetRound();
            }}
            className={cn(
              'flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2',
              mode === 'word' ? 'bg-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500'
            )}
          >
            <BookOpen size={18} />
            单词听写
          </button>
          <button
            onClick={() => {
              setMode('sentence');
              resetRound();
            }}
            className={cn(
              'flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2',
              mode === 'sentence' ? 'bg-purple-500 text-white shadow-lg shadow-purple-100' : 'bg-slate-50 text-slate-500'
            )}
          >
            <PencilLine size={18} />
            句子听写
          </button>
        </div>

        {currentData.length > 0 && !finished ? (
          <div className="space-y-8 py-4">
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={() => handleSpeak(1)}
                disabled={isSpeaking}
                className={cn(
                  'w-24 h-24 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-inner',
                  isSpeaking ? 'bg-blue-100 text-blue-500 animate-pulse' : 'bg-blue-50 text-blue-500'
                )}
              >
                {isSpeaking ? <RotateCw size={48} className="animate-spin" /> : <Volume2 size={48} />}
              </button>
              <button
                onClick={() => handleSpeak(0.75)}
                disabled={isSpeaking}
                className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-600 text-xs font-bold disabled:opacity-50"
              >
                慢速再听一遍（0.75x）
              </button>
              <div className="text-center">
                <p className="text-slate-400 text-xs mb-1 uppercase tracking-widest font-bold">点击图标播放音频</p>
                <p className="text-slate-800 font-bold">{mode === 'word' ? '拼写该单词' : '写下你听到的句子'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={showResult !== 'none'}
                  className={cn(
                    'w-full bg-slate-50 border rounded-2xl p-6 text-center text-lg font-bold outline-none transition-all resize-none h-32',
                    showResult === 'correct'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : showResult === 'wrong'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5'
                  )}
                  placeholder={mode === 'word' ? 'Type the word here...' : 'Type the sentence here...'}
                />
                <AnimatePresence>
                  {showResult !== 'none' && (
                    <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="absolute -top-4 -right-4 w-12 h-12 rounded-full flex items-center justify-center shadow-lg">
                      {showResult === 'correct' ? (
                        <div className="bg-emerald-500 text-white w-full h-full rounded-full flex items-center justify-center"><Check size={24} /></div>
                      ) : (
                        <div className="bg-red-500 text-white w-full h-full rounded-full flex items-center justify-center"><X size={24} /></div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {showResult === 'wrong' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <div>
                    <p className="text-xs font-bold text-red-800 mb-1">正确答案：</p>
                    <p className="text-sm text-red-700 font-mono">{mode === 'word' ? (currentItem as any).word : (currentItem as any).text}</p>
                    {mode === 'sentence' && <p className="text-[10px] text-red-500 mt-1">{(currentItem as any).translation}</p>}
                    {feedbackReason && <p className="text-[10px] text-amber-600 mt-2">错误类型：{mistakeReasonLabels[feedbackReason]}</p>}
                    {feedbackHint && <p className="text-[10px] text-slate-500 mt-1">复习建议：{feedbackHint}</p>}
                  </div>
                </motion.div>
              )}

              {showResult === 'correct' && feedbackHint && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-sm text-emerald-700">{feedbackHint}</div>
              )}

              {showResult === 'none' ? (
                <button
                  onClick={checkAnswer}
                  disabled={!userInput.trim()}
                  className="w-full blue-gradient py-4 rounded-2xl text-white font-bold shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  检查答案
                </button>
              ) : (
                <button onClick={nextItem} className="w-full bg-slate-800 py-4 rounded-2xl text-white font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {currentIndex >= currentData.length - 1 ? '结束本轮听写' : '下一题'}
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        ) : currentData.length > 0 && finished ? (
          <div className="py-6 space-y-5">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Round Summary</div>
              <div className="text-3xl font-black text-slate-800 mt-2">
                {score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%
              </div>
              <div className="text-sm text-slate-500 mt-1">
                本轮 {mode === 'word' ? '单词' : '句子'}听写 答对 {score.correct} / {score.total}
              </div>
            </div>

            {wrongItems.length > 0 ? (
              <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4">
                <div className="text-xs font-bold text-rose-700 mb-2">需要再听一遍的 {wrongItems.length} 条</div>
                <div className="space-y-2">
                  {wrongItems.map((item) => (
                    <div key={itemKey(item)} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                      <span className="text-sm font-mono text-rose-700">
                        {mode === 'word' ? (item as any).word : (item as any).text}
                      </span>
                      <button
                        onClick={() => play(mode === 'word' ? (item as any).word : (item as any).text, 0.85)}
                        className="text-xs font-bold text-slate-500"
                      >
                        再听一次
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
                本轮全对，可以切到另一种题型，或者进入下一个课时。
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {wrongItems.length > 0 && (
                <button onClick={practiceWrongOnly} className="px-4 py-3 rounded-2xl bg-rose-500 text-white text-sm font-bold">
                  只练错题（{wrongItems.length}）
                </button>
              )}
              <button onClick={resetRound} className="px-4 py-3 rounded-2xl bg-slate-800 text-white text-sm font-bold inline-flex items-center gap-2">
                <RefreshCw size={16} />
                重新开始一轮
              </button>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-300">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p>当前单元暂无{mode === 'word' ? '单词' : '句子'}听写数据</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">当前进度</div>
          <div className="font-bold text-slate-700">
            {currentData.length > 0 ? Math.min(currentIndex + 1, currentData.length) : 0} / {currentData.length}
            {answeredIds.length > 0 && <span className="text-slate-400 font-normal"> · 已答 {answeredIds.length}</span>}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">正确率</div>
          <div className="font-bold text-emerald-500">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</div>
        </div>
      </div>
    </div>
  );
}
