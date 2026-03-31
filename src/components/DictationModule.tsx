import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, BookOpen, Check, ChevronRight, PencilLine, RotateCw, Volume2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { LessonStageKey, MistakeReason, MistakeRecord, UnitBundle } from './textbook/types';

interface Props {
  currentUnit: UnitBundle | null;
  onCompleteStage: (stage: LessonStageKey) => void;
  onAddMistake: (record: Omit<MistakeRecord, 'id' | 'createdAt'>) => void;
  playWordAudio: (text: string, accent?: 'US' | 'UK') => Promise<unknown>;
  generateTTS: (text: string, voice?: string) => Promise<boolean>;
  playBrowserTTS: (text: string, accent: 'US' | 'UK', rate?: number) => Promise<boolean>;
  classifyDictationIssue: (input: string, target: string) => { reason: MistakeReason; hint: string };
  mistakeReasonLabels: Record<MistakeReason, string>;
}

export function DictationModule({
  currentUnit,
  onCompleteStage,
  onAddMistake,
  playWordAudio,
  generateTTS,
  playBrowserTTS,
  classifyDictationIssue,
  mistakeReasonLabels,
}: Props) {
  const [mode, setMode] = useState<'word' | 'sentence'>('word');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [feedbackHint, setFeedbackHint] = useState('');
  const [feedbackReason, setFeedbackReason] = useState<MistakeReason | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const currentData = currentUnit ? (mode === 'word' ? currentUnit.vocab : currentUnit.sentences) : [];
  const currentItem = currentData[currentIndex];

  const handleSpeak = async () => {
    if (!currentItem || isSpeaking) return;
    setIsSpeaking(true);
    const text = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;

    try {
      let success = await playWordAudio(text, 'US').then(() => true).catch(() => false);
      if (!success) success = await generateTTS(text, 'US');
      if (!success) await playBrowserTTS(text, 'US', 0.9);
    } catch {
      await playBrowserTTS(text, 'US', 0.9);
    } finally {
      setIsSpeaking(false);
    }
  };

  const checkAnswer = () => {
    if (!currentItem) return;
    const target = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    const normalizedInput = userInput.trim().toLowerCase().replace(/[.,!?;:]/g, '');
    const normalizedTarget = target.trim().toLowerCase().replace(/[.,!?;:]/g, '');

    if (normalizedInput === normalizedTarget) {
      setShowResult('correct');
      setFeedbackHint('这题正确，可以继续下一题。');
      setFeedbackReason(null);
      setScore((prev) => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      if (currentIndex === currentData.length - 1) {
        onCompleteStage('dictation');
      }
      return;
    }

    const issue = classifyDictationIssue(userInput, target);
    setShowResult('wrong');
    setFeedbackHint(issue.hint);
    setFeedbackReason(issue.reason);
    setScore((prev) => ({ ...prev, total: prev.total + 1 }));
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

  const nextItem = () => {
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    setCurrentIndex((prev) => (prev + 1) % currentData.length);
  };

  const reset = () => {
    setCurrentIndex(0);
    setUserInput('');
    setShowResult('none');
    setFeedbackHint('');
    setFeedbackReason(null);
    setScore({ correct: 0, total: 0 });
  };

  useEffect(() => {
    reset();
  }, [currentUnit?.id, mode]);

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

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setMode('word');
              reset();
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
              reset();
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

        {currentData.length > 0 ? (
          <div className="space-y-8 py-4">
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={handleSpeak}
                disabled={isSpeaking}
                className={cn(
                  'w-24 h-24 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-inner',
                  isSpeaking ? 'bg-blue-100 text-blue-500 animate-pulse' : 'bg-blue-50 text-blue-500'
                )}
              >
                {isSpeaking ? <RotateCw size={48} className="animate-spin" /> : <Volume2 size={48} />}
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
                  下一题
                  <ChevronRight size={18} />
                </button>
              )}
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
          <div className="font-bold text-slate-700">{currentData.length > 0 ? currentIndex + 1 : 0} / {currentData.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">正确率</div>
          <div className="font-bold text-emerald-500">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</div>
        </div>
      </div>
    </div>
  );
}
