import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Eye, EyeOff, LayoutList, RotateCw, Sparkles, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MistakeRecord, StudyState, UnitBundle, VocabItem } from './types';

interface Props {
  currentUnit: UnitBundle;
  studyState: StudyState;
  previewCompleted: boolean;
  onSelectStage: () => void;
  onPlayWord: (word: string, rate?: number) => void;
  onMarkWord: (wordId: string, mastered: boolean, word: VocabItem) => void;
  onMarkUnknown: (word: VocabItem) => void;
  onCompleteAndGoSentences: () => void;
  retryTarget?: MistakeRecord | null;
  onRetryTargetHandled?: () => void;
  onResolveMistake?: (mistake: MistakeRecord) => void;
}

export function TextbookPreviewPage({
  currentUnit,
  studyState,
  previewCompleted,
  onPlayWord,
  onMarkWord,
  onMarkUnknown,
  onCompleteAndGoSentences,
  retryTarget,
  onRetryTargetHandled,
  onResolveMistake,
}: Props) {
  const allWords = currentUnit.vocab;
  const [viewMode, setViewMode] = useState<'card' | 'list' | 'quiz'>('card');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [unknownIds, setUnknownIds] = useState<string[]>([]);
  const [toast, setToast] = useState('');

  // Quick 4-option self-check quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizPicked, setQuizPicked] = useState<string | null>(null);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const safeIndex = allWords.length > 0 ? Math.min(Math.max(cardIndex, 0), allWords.length - 1) : 0;
  const activeWord = allWords[safeIndex];

  useEffect(() => {
    setCardIndex(0);
    setRevealed(false);
    setUnknownIds([]);
    setQuizIndex(0);
    setQuizPicked(null);
    setQuizCorrectCount(0);
    setQuizFinished(false);
  }, [currentUnit.id]);

  // Jump straight to the targeted mistake word when arriving from Mistake Book
  useEffect(() => {
    if (!retryTarget || allWords.length === 0) return;
    const norm = (value: string) => value.trim().toLowerCase();
    const targetIdx = allWords.findIndex(
      (item) => norm(item.word) === norm(retryTarget.prompt) || retryTarget.prompt.toLowerCase().includes(norm(item.word)),
    );
    if (targetIdx >= 0) {
      setViewMode('card');
      setCardIndex(targetIdx);
      setRevealed(false);
    }
  }, [retryTarget, allWords]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Auto-play pronunciation when switching cards in flashcard mode
  useEffect(() => {
    if (viewMode !== 'card' || !activeWord) return;
    const timer = setTimeout(() => {
      onPlayWord(activeWord.word, 1);
    }, 220);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, viewMode, currentUnit.id]);

  const quizQuestions = useMemo(() => {
    return allWords.slice(0, Math.min(allWords.length, 8)).map((word, idx) => {
      const distractors = allWords
        .filter((item) => item.id !== word.id)
        .slice(idx % Math.max(1, allWords.length - 1), (idx % Math.max(1, allWords.length - 1)) + 3)
        .map((item) => item.definition);
      const fallbackDistractors = allWords
        .filter((item) => item.id !== word.id && !distractors.includes(item.definition))
        .map((item) => item.definition);
      const options = Array.from(new Set([word.definition, ...distractors, ...fallbackDistractors])).slice(0, 4);
      const shift = options.length > 1 ? (idx + 1) % options.length : 0;
      const rotated = [...options.slice(shift), ...options.slice(0, shift)];
      return { word, options: rotated };
    });
  }, [allWords]);

  const masteredCount = allWords.filter((item) => studyState.masteredWordIds.includes(item.id)).length;

  const handleMarkKnown = (word: VocabItem, autoAdvance = false) => {
    onMarkWord(word.id, true, word);
    setUnknownIds((prev) => prev.filter((id) => id !== word.id));
    if (retryTarget && (retryTarget.prompt.toLowerCase().includes(word.word.toLowerCase()) || retryTarget.expected === word.definition)) {
      onResolveMistake?.(retryTarget);
      onRetryTargetHandled?.();
      setToast(`“${word.word}” 已掌握并从错题本销账`);
    } else {
      setToast(`已掌握 “${word.word}”`);
    }
    if (autoAdvance && safeIndex < allWords.length - 1) {
      setRevealed(false);
      setCardIndex((prev) => Math.min(prev + 1, allWords.length - 1));
    }
  };

  const handleMarkUnfamiliar = (word: VocabItem, autoAdvance = false) => {
    onMarkUnknown(word);
    setUnknownIds((prev) => (prev.includes(word.id) ? prev : [...prev, word.id]));
    setRevealed(true);
    setToast(`已将 “${word.word}” 加入错题本，稍后重点复习`);
    if (autoAdvance && safeIndex < allWords.length - 1) {
      setTimeout(() => {
        setRevealed(false);
        setCardIndex((prev) => Math.min(prev + 1, allWords.length - 1));
      }, 450);
    }
  };

  const handleQuizPick = (option: string) => {
    if (quizPicked !== null) return;
    const currentQ = quizQuestions[quizIndex];
    if (!currentQ) return;
    setQuizPicked(option);
    const correct = option === currentQ.word.definition;
    if (correct) {
      setQuizCorrectCount((prev) => prev + 1);
      onMarkWord(currentQ.word.id, true, currentQ.word);
      if (retryTarget && retryTarget.prompt.toLowerCase().includes(currentQ.word.word.toLowerCase())) {
        onResolveMistake?.(retryTarget);
        onRetryTargetHandled?.();
      }
    } else {
      onMarkUnknown(currentQ.word);
    }
  };

  const handleQuizNext = () => {
    if (quizIndex >= quizQuestions.length - 1) {
      setQuizFinished(true);
      return;
    }
    setQuizPicked(null);
    setQuizIndex((prev) => prev + 1);
  };

  // Keyboard shortcuts for tablet/desktop flashcard study
  useEffect(() => {
    if (viewMode !== 'card' || !activeWord) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === ' ') {
        event.preventDefault();
        setRevealed((prev) => !prev);
      } else if (event.key === 'ArrowRight') {
        setRevealed(false);
        setCardIndex((prev) => Math.min(prev + 1, allWords.length - 1));
      } else if (event.key === 'ArrowLeft') {
        setRevealed(false);
        setCardIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key.toLowerCase() === 'r') {
        onPlayWord(activeWord.word, 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, activeWord, allWords.length, onPlayWord]);

  if (allWords.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-100 text-center text-slate-400">
        当前单元暂无词汇数据
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {retryTarget && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center justify-between gap-3">
          <span>正在复练错题词汇：<strong>{retryTarget.prompt}</strong>（标记“已掌握”或速测答对即可销账）</span>
          <button
            onClick={() => onRetryTargetHandled?.()}
            className="text-xs font-bold text-blue-600 hover:underline shrink-0"
          >
            退出复练
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">核心词汇学习</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              已掌握 {masteredCount} / {allWords.length} 个词 · 桌面可用空格翻卡、方向键切词、R 键重听
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl self-start">
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5',
                viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
              )}
            >
              <BookOpen size={14} />
              闪卡背词
            </button>
            <button
              onClick={() => {
                setViewMode('quiz');
                setQuizIndex(0);
                setQuizPicked(null);
                setQuizCorrectCount(0);
                setQuizFinished(false);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5',
                viewMode === 'quiz' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
              )}
            >
              <Sparkles size={14} />
              词义速测
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5',
                viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500',
              )}
            >
              <LayoutList size={14} />
              全部词表 ({allWords.length})
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.round((masteredCount / allWords.length) * 100)}%` }}
          />
        </div>

        {toast && (
          <div className="mb-4 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-bold inline-flex items-center gap-2">
            <Check size={14} className="text-emerald-400" />
            {toast}
          </div>
        )}

        {/* Mode 1: Flashcard Mode */}
        {viewMode === 'card' && activeWord && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-6 sm:p-8 text-center">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-6">
                <span className="font-bold">第 {safeIndex + 1} / {allWords.length} 词</span>
                <div className="flex items-center gap-2">
                  {studyState.masteredWordIds.includes(activeWord.id) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">已掌握</span>
                  )}
                  {unknownIds.includes(activeWord.id) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">需重点记</span>
                  )}
                </div>
              </div>

              <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{activeWord.word}</div>
              {activeWord.phonetic && (
                <div className="text-sm font-mono text-slate-400 mt-2">{activeWord.phonetic}</div>
              )}

              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={() => onPlayWord(activeWord.word, 1)}
                  className="px-4 py-2.5 rounded-2xl bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-2 hover:bg-blue-600 transition-all shadow-sm"
                >
                  <Volume2 size={16} />
                  标准读音
                </button>
                <button
                  onClick={() => onPlayWord(activeWord.word, 0.75)}
                  className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-2 hover:border-blue-300 transition-all"
                >
                  <RotateCw size={14} />
                  慢速听 (0.75x)
                </button>
                <button
                  onClick={() => setRevealed((prev) => !prev)}
                  className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-2 hover:border-blue-300 transition-all"
                >
                  {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  {revealed ? '隐藏释义' : '查看释义与例句'}
                </button>
              </div>

              {revealed ? (
                <div className="mt-6 pt-6 border-t border-slate-200/70 max-w-xl mx-auto text-left space-y-3">
                  <div className="text-center text-lg font-bold text-slate-800">{activeWord.definition}</div>
                  {activeWord.example && (
                    <div className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-600 italic">“{activeWord.example}”</p>
                      <button
                        onClick={() => onPlayWord(activeWord.example, 0.95)}
                        className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 hover:bg-blue-100"
                        title="朗读例句"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setRevealed(true)}
                  className="mt-6 w-full max-w-md mx-auto py-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 text-xs font-bold text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all block"
                >
                  先回忆一下中文意思，点击此处或按空格揭晓答案
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  setRevealed(false);
                  setCardIndex((prev) => Math.max(prev - 1, 0));
                }}
                disabled={safeIndex === 0}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                上一个
              </button>

              <div className="flex flex-1 justify-center gap-3 min-w-[240px]">
                <button
                  onClick={() => handleMarkUnfamiliar(activeWord, true)}
                  className="flex-1 max-w-[200px] py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold hover:bg-amber-100 transition-all"
                >
                  还不熟 · 记入错题
                </button>
                <button
                  onClick={() => handleMarkKnown(activeWord, true)}
                  className="flex-1 max-w-[200px] py-3 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all shadow-sm"
                >
                  认识 · 下一个
                </button>
              </div>

              <button
                onClick={() => {
                  setRevealed(false);
                  setCardIndex((prev) => Math.min(prev + 1, allWords.length - 1));
                }}
                disabled={safeIndex >= allWords.length - 1}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold inline-flex items-center gap-1 disabled:opacity-40"
              >
                下一个
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Mode 2: 4-option Quick Self-Check Quiz */}
        {viewMode === 'quiz' && (
          <div className="space-y-5">
            {quizFinished ? (
              <div className="rounded-3xl bg-slate-50 border border-slate-100 p-8 text-center space-y-4">
                <div className="text-4xl font-black text-slate-800">
                  {Math.round((quizCorrectCount / Math.max(1, quizQuestions.length)) * 100)}%
                </div>
                <div className="text-sm text-slate-600">
                  速测完成：答对 {quizCorrectCount} / {quizQuestions.length} 题
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setQuizPicked(null);
                      setQuizCorrectCount(0);
                      setQuizFinished(false);
                    }}
                    className="px-5 py-3 rounded-2xl bg-slate-800 text-white text-sm font-bold"
                  >
                    再测一次
                  </button>
                  <button
                    onClick={onCompleteAndGoSentences}
                    className="px-5 py-3 rounded-2xl bg-blue-500 text-white text-sm font-bold"
                  >
                    进入下一步：课文朗读
                  </button>
                </div>
              </div>
            ) : quizQuestions[quizIndex] ? (
              <div className="rounded-3xl bg-slate-50 border border-slate-100 p-6 space-y-5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>词义速测 · 第 {quizIndex + 1} / {quizQuestions.length} 题</span>
                  <span className="font-bold text-emerald-600">已答对 {quizCorrectCount} 题</span>
                </div>
                <div className="text-center py-2">
                  <div className="text-3xl font-black text-slate-800">{quizQuestions[quizIndex].word.word}</div>
                  {quizQuestions[quizIndex].word.phonetic && (
                    <div className="text-xs font-mono text-slate-400 mt-1">{quizQuestions[quizIndex].word.phonetic}</div>
                  )}
                  <button
                    onClick={() => onPlayWord(quizQuestions[quizIndex].word.word, 1)}
                    className="mt-3 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-blue-600 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Volume2 size={14} />
                    听发音
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quizQuestions[quizIndex].options.map((option) => {
                    const isAnswer = option === quizQuestions[quizIndex].word.definition;
                    const isPicked = quizPicked === option;
                    return (
                      <button
                        key={option}
                        onClick={() => handleQuizPick(option)}
                        className={cn(
                          'px-4 py-3.5 rounded-2xl border text-sm font-bold text-left transition-all',
                          quizPicked !== null && isAnswer
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : isPicked
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300',
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {quizPicked !== null && (
                  <button
                    onClick={handleQuizNext}
                    className="w-full py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    {quizIndex >= quizQuestions.length - 1 ? '查看速测结果' : '下一题'}
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Mode 3: Full Word List (No 12-word truncation!) */}
        {viewMode === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allWords.map((word) => {
              const mastered = studyState.masteredWordIds.includes(word.id);
              const unfamiliar = unknownIds.includes(word.id);
              return (
                <div
                  key={word.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-all',
                    mastered
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : unfamiliar
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-slate-100 bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-base">{word.word}</span>
                        {word.phonetic && <span className="text-xs text-slate-400 font-mono">{word.phonetic}</span>}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">{word.definition}</div>
                      {word.example && <div className="text-xs text-slate-500 mt-1.5 italic">“{word.example}”</div>}
                    </div>
                    <button
                      onClick={() => onPlayWord(word.word, 1)}
                      className="w-9 h-9 rounded-xl bg-white text-blue-500 flex items-center justify-center border border-slate-200 shrink-0 hover:bg-blue-50"
                      title="听发音"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleMarkUnfamiliar(word, false)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-bold border transition-all',
                        unfamiliar
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300',
                      )}
                    >
                      {unfamiliar ? '已记错题' : '还不熟'}
                    </button>
                    <button
                      onClick={() => onMarkWord(word.id, !mastered, word)}
                      className={cn(
                        'flex-1 py-2 rounded-xl text-xs font-bold transition-all',
                        mastered
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
                      )}
                    >
                      {mastered ? '已掌握 ✓' : '标记掌握'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {previewCompleted ? '本单元词汇预习已完成，可随时复习或继续下一项。' : '过完一遍词汇（或完成词义速测）后，即可进入课文朗读。'}
          </div>
          <button
            onClick={onCompleteAndGoSentences}
            className={cn(
              'w-full sm:w-auto px-6 py-3 rounded-2xl text-white text-sm font-bold transition-all inline-flex items-center justify-center gap-1.5',
              previewCompleted ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600',
            )}
          >
            {previewCompleted ? '已完成，去练课文朗读' : '完成词汇学习，去练课文朗读'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
