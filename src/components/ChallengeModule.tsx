import React, { useEffect, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { StudyState, UnitBundle } from './textbook/types';

interface ChallengeQuestion {
  id: string;
  prompt: string;
  expected: string;
  kind: string;
}

interface Props {
  currentUnit: UnitBundle | null;
  studyState: StudyState;
  onBack: () => void;
  onSubmitResult: (payload: {
    score: number;
    total: number;
    details: Array<{ id: string; kind: string; prompt: string; answer: string; correct: boolean }>;
  }) => void;
  scoreChallengeAnswer: (
    question: ChallengeQuestion,
    answer: string,
    unit: UnitBundle | null,
  ) => { correct: boolean; detail: string };
  buildChallengeQuestions: (unit: UnitBundle | null) => ChallengeQuestion[];
  getUnitChallengeStatus: (unit: UnitBundle | null, studyState: StudyState) => { ready: boolean; score: number; progress: number; challengeLabel: string };
  getChallengeHistoryForUnit: (studyState: StudyState, unitId: string) => Array<{ score: number; total: number }>;
}

export function ChallengeModule({
  currentUnit,
  studyState,
  onBack,
  onSubmitResult,
  scoreChallengeAnswer,
  buildChallengeQuestions,
  getUnitChallengeStatus,
  getChallengeHistoryForUnit,
}: Props) {
  const questions = buildChallengeQuestions(currentUnit);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Array<{ id: string; correct: boolean; detail: string }> | null>(null);
  const challengeStatus = getUnitChallengeStatus(currentUnit, studyState);
  const history = currentUnit ? getChallengeHistoryForUnit(studyState, currentUnit.id) : [];
  const latestAttempt = history[0] || null;

  useEffect(() => {
    setAnswers({});
    setResults(null);
  }, [currentUnit?.id]);

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
    // Stay on this page: the previous version jumped straight back to the
    // dashboard, so students never saw the reference answers.
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

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-[0.3em]">Unit Challenge</p>
            <h2 className="text-2xl font-black text-slate-800 mt-2">{currentUnit.unit} 单元闯关</h2>
            <p className="text-sm text-slate-500 mt-1">{currentUnit.title} · 词汇回忆 + 句子理解 + 口语输出</p>
          </div>
          <button onClick={onBack} className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold">
            返回学习中心
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">闯关准备度</div>
            <div className="text-xl font-bold text-emerald-600">{challengeStatus.progress}%</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">题目数</div>
            <div className="text-xl font-bold text-slate-800">{questions.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="text-[10px] text-slate-400 mb-1">
              {scorePercent !== null ? '本次得分' : '最近成绩'}
            </div>
            <div className="text-xl font-bold text-blue-600">
              {scorePercent !== null
                ? `${scorePercent}%（${score}/${results?.length}）`
                : latestAttempt
                  ? `${Math.round((latestAttempt.score / latestAttempt.total) * 100)}%`
                  : '--'}
            </div>
          </div>
        </div>
      </div>

      {results && (
        <div
          className={cn(
            'rounded-3xl border p-5 text-sm',
            score === results.length ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700',
          )}
        >
          {score === results.length
            ? '全部答对，闯关通过，可以去下一个单元了。'
            : `本次 ${score}/${results.length} 通过。未通过的题已经写入错题本，订正后可以再闯一次。`}
          <button onClick={handleRetry} className="ml-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold">
            <RotateCcw size={14} />
            再闯一次
          </button>
        </div>
      )}

      {!challengeStatus.ready && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-700">
          当前单元还没完全准备好，建议先完成首页推荐任务后再正式闯关。你现在也可以先试做，系统会照常记录成绩。
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => {
          const result = results?.find((item) => item.id === question.id);
          return (
            <div
              key={question.id}
              className={cn(
                'bg-white rounded-3xl p-6 shadow-sm border',
                result ? (result.correct ? 'border-emerald-200' : 'border-rose-200') : 'border-slate-100',
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Task {index + 1} · {question.kind}
                </div>
                {result && (
                  <div
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold',
                      result.correct ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                    )}
                  >
                    {result.correct ? <Check size={14} /> : <X size={14} />}
                    {result.correct ? '通过' : '未通过'}
                  </div>
                )}
              </div>
              <div className="font-bold text-slate-800 text-lg">{question.prompt}</div>
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                disabled={Boolean(results)}
                className="w-full mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none focus:border-emerald-500 min-h-28 disabled:opacity-70"
                placeholder="请输入你的答案、解释或口语表达要点"
              />
              {result && (
                <div
                  className={cn(
                    'mt-3 rounded-2xl border p-4',
                    result.correct ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100',
                  )}
                >
                  <div className={cn('text-xs font-bold mb-1', result.correct ? 'text-emerald-700' : 'text-rose-700')}>
                    {result.correct ? '判定' : '参考答案与建议'}
                  </div>
                  <div className={cn('text-sm', result.correct ? 'text-emerald-800' : 'text-rose-800')}>
                    {result.detail}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800">{results ? '本次闯关已记录' : '提交本次闯关'}</h3>
            <p className="text-sm text-slate-500 mt-1">
              {results
                ? '未通过的题已写入错题本，可在统计页一键复练。'
                : '按题型判分：词汇看要点、句子看解释覆盖、口语看完整表达。'}
            </p>
          </div>
          <button
            onClick={results ? onBack : handleSubmit}
            className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-bold"
          >
            {results ? '返回学习中心' : '提交并查看结果'}
          </button>
        </div>
      </div>
    </div>
  );
}
