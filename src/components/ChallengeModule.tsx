import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Mic2, RotateCcw, Trophy, Volume2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { StudyState, UnitBundle } from './textbook/types';
import type { ChallengeQuestionInput } from '../lib/study';

interface Props {
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  onBack: () => void;
  onSubmitResult: (payload: {
    score: number;
    total: number;
    details: Array<{ id: string; kind: string; prompt: string; answer: string; expected: string; correct: boolean }>;
  }) => void;
  scoreChallengeAnswer: (
    question: ChallengeQuestionInput,
    answer: string,
    unit: UnitBundle | null,
  ) => { correct: boolean; detail: string };
  buildChallengeQuestions: (unit: UnitBundle | null) => ChallengeQuestionInput[];
  getUnitChallengeStatus: (unit: UnitBundle | null, studyState: StudyState) => { ready: boolean; score: number; progress: number; challengeLabel: string };
  getChallengeHistoryForUnit: (studyState: StudyState, unitId: string) => Array<{ score: number; total: number }>;
  speak?: (text: string, accent?: 'US' | 'UK', rate?: number) => Promise<boolean>;
  onVoiceInput?: () => Promise<string>;
}

const KIND_LABELS: Record<string, string> = {
  'vocab-choice': '词汇理解',
  'vocab-spell': '听音拼写',
  'sentence-choice': '句意理解',
  speaking: '话题表达',
  vocab: '词汇',
  meaning: '词义',
  sentence: '句子',
};

export function ChallengeModule({
  currentUnit,
  studyState,
  onBack,
  onSubmitResult,
  scoreChallengeAnswer,
  buildChallengeQuestions,
  getUnitChallengeStatus,
  getChallengeHistoryForUnit,
  speak,
  onVoiceInput,
}: Props) {
  const questions = useMemo(() => buildChallengeQuestions(currentUnit), [buildChallengeQuestions, currentUnit]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Array<{ id: string; correct: boolean; detail: string }> | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const challengeStatus = getUnitChallengeStatus(currentUnit, studyState);
  const history = currentUnit ? getChallengeHistoryForUnit(studyState, currentUnit.id) : [];
  const latestAttempt = history[0] || null;

  useEffect(() => {
    setStepIndex(0);
    setAnswers({});
    setResults(null);
  }, [currentUnit?.id]);

  const currentQuestion = questions[stepIndex];

  // Auto-play audio for audio-enabled challenge questions
  useEffect(() => {
    if (!currentQuestion?.audioText || results || !speak) return;
    const timer = setTimeout(() => {
      void speak(currentQuestion.audioText!, 'US', 1);
    }, 260);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, currentUnit?.id, Boolean(results)]);

  const handleSubmit = () => {
    const graded = questions.map((question) => ({
      id: question.id,
      kind: question.kind,
      prompt: question.prompt,
      answer: (answers[question.id] || '').trim(),
      ...scoreChallengeAnswer(question, answers[question.id] || '', currentUnit),
    }));
    const score = graded.filter((item) => item.correct).length;
    setResults(graded);
    onSubmitResult({
      score,
      total: questions.length,
      details: graded.map(({ id, kind, prompt, answer, correct }) => ({
        id,
        kind,
        prompt,
        answer,
        expected: questions.find((question) => question.id === id)?.expected || '',
        correct,
      })),
    });
  };

  const handleRetry = () => {
    setResults(null);
    setAnswers({});
    setStepIndex(0);
  };

  const handleVoiceSpeak = async (questionId: string) => {
    if (!onVoiceInput || isRecordingVoice) return;
    setIsRecordingVoice(true);
    try {
      const text = await onVoiceInput();
      if (text.trim()) {
        setAnswers((prev) => ({
          ...prev,
          [questionId]: prev[questionId] ? `${prev[questionId].trim()} ${text.trim()}` : text.trim(),
        }));
      }
    } catch {
      // Errors are surfaced by caller
    } finally {
      setIsRecordingVoice(false);
    }
  };

  if (!currentUnit) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center text-slate-500">
        暂无可用单元，暂时无法开始闯关。
      </div>
    );
  }

  const score = results ? results.filter((item) => item.correct).length : 0;
  const scorePercent = results && results.length > 0 ? Math.round((score / results.length) * 100) : null;
  const answeredCount = questions.filter((q) => (answers[q.id] || '').trim().length > 0).length;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              <h2 className="text-lg font-black text-slate-800">{currentUnit.unit} 单元综合闯关</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {currentUnit.title} · 共 {questions.length} 题（词汇理解 + 听音拼写 + 句意 + 表达）
              {latestAttempt ? ` · 历史最近 ${Math.round((latestAttempt.score / latestAttempt.total) * 100)}%` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
              准备度 {challengeStatus.progress}%
            </span>
            <button onClick={onBack} className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200">
              返回今日学习
            </button>
          </div>
        </div>
      </div>

      {/* Results View */}
      {results ? (
        <div className="space-y-4">
          <div
            className={cn(
              'rounded-3xl border p-6 text-center space-y-3',
              score === results.length
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800',
            )}
          >
            <div className="text-4xl font-black">{scorePercent}%</div>
            <div className="text-sm font-bold">
              {score === results.length
                ? `满分通关！（${score}/${results.length}）你已经掌握本单元核心内容！`
                : `本次通过 ${score} / ${results.length} 题，未通过的题已自动收录到错题本。`}
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
              >
                <RotateCcw size={15} />
                再闯一次
              </button>
              <button
                onClick={onBack}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
              >
                返回今日学习
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((question, idx) => {
              const result = results.find((item) => item.id === question.id);
              return (
                <div
                  key={question.id}
                  className={cn(
                    'bg-white rounded-2xl p-5 border shadow-sm',
                    result?.correct ? 'border-emerald-200' : 'border-rose-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-400">
                        第 {idx + 1} 题 · {KIND_LABELS[question.kind] || question.kind}
                      </div>
                      <div className="font-bold text-slate-800 mt-1">{question.prompt}</div>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0',
                        result?.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                      )}
                    >
                      {result?.correct ? <Check size={14} /> : <X size={14} />}
                      {result?.correct ? '通过' : '未通过'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">你的作答：{answers[question.id] || '未作答'}</div>
                  {result && (
                    <div className={cn('text-xs font-medium mt-1.5', result.correct ? 'text-emerald-700' : 'text-rose-700')}>
                      {result.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : currentQuestion ? (
        /* Step-by-step focused quiz view */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 max-w-2xl mx-auto space-y-5">
          {/* Step dots */}
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
              第 {stepIndex + 1} / {questions.length} 关 · {KIND_LABELS[currentQuestion.kind] || currentQuestion.kind}
            </span>
            <div className="flex items-center gap-1.5">
              {questions.map((q, idx) => {
                const filled = Boolean((answers[q.id] || '').trim());
                return (
                  <button
                    key={q.id}
                    onClick={() => setStepIndex(idx)}
                    className={cn(
                      'h-2.5 rounded-full transition-all',
                      idx === stepIndex ? 'w-7 bg-emerald-500' : filled ? 'w-2.5 bg-emerald-300' : 'w-2.5 bg-slate-200',
                    )}
                    title={`跳到第 ${idx + 1} 题`}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xl font-black text-slate-800 leading-snug">{currentQuestion.prompt}</div>
            {currentQuestion.clue && <div className="text-xs text-slate-500">{currentQuestion.clue}</div>}
            {currentQuestion.audioText && speak && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void speak(currentQuestion.audioText!, 'US', 1)}
                  className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-blue-100"
                >
                  <Volume2 size={15} />
                  听发音
                </button>
                <button
                  type="button"
                  onClick={() => void speak(currentQuestion.audioText!, 'US', 0.78)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                >
                  慢速听
                </button>
              </div>
            )}
          </div>

          {/* Question Input Area */}
          {currentQuestion.options && currentQuestion.options.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((option) => {
                const selected = answers[currentQuestion.id] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }))}
                    className={cn(
                      'px-4 py-3.5 rounded-2xl border text-left text-sm font-bold transition-all',
                      selected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-white',
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : currentQuestion.kind === 'vocab-spell' ? (
            <input
              type="text"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && stepIndex < questions.length - 1) {
                  e.preventDefault();
                  setStepIndex((prev) => prev + 1);
                }
              }}
              placeholder="输入拼写的英文单词"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-center text-xl font-bold outline-none focus:border-emerald-500 focus:bg-white"
            />
          ) : (
            <div className="space-y-3">
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-emerald-500 focus:bg-white min-h-28"
                placeholder="可以直接打字，也可以点击下方按钮用英语说出来"
              />
              {onVoiceInput && (
                <button
                  type="button"
                  onClick={() => void handleVoiceSpeak(currentQuestion.id)}
                  disabled={isRecordingVoice}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all',
                    isRecordingVoice
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100',
                  )}
                >
                  <Mic2 size={15} />
                  {isRecordingVoice ? '正在听你说英文...' : '语音口述填入答案'}
                </button>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              上一题
            </button>

            <span className="text-xs text-slate-400">已答 {answeredCount} / {questions.length}</span>

            {stepIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => prev + 1)}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1 hover:bg-slate-800"
              >
                下一题
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2.5 rounded-2xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 shadow-sm"
              >
                交卷看成绩
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
