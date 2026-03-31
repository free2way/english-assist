import React, { useEffect, useState } from 'react';
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
  onCompleteChallenge: (score: number, total: number) => void;
  buildChallengeQuestions: (unit: UnitBundle | null) => ChallengeQuestion[];
  getUnitChallengeStatus: (unit: UnitBundle | null, studyState: StudyState) => { ready: boolean; score: number; progress: number; challengeLabel: string };
  getChallengeHistoryForUnit: (studyState: StudyState, unitId: string) => Array<{ score: number; total: number }>;
}

export function ChallengeModule({
  currentUnit,
  studyState,
  onBack,
  onCompleteChallenge,
  buildChallengeQuestions,
  getUnitChallengeStatus,
  getChallengeHistoryForUnit,
}: Props) {
  const questions = buildChallengeQuestions(currentUnit);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const challengeStatus = getUnitChallengeStatus(currentUnit, studyState);
  const history = currentUnit ? getChallengeHistoryForUnit(studyState, currentUnit.id) : [];
  const latestAttempt = history[0] || null;

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
  }, [currentUnit?.id]);

  const handleSubmit = () => {
    const score = questions.reduce((sum, question) => {
      const answer = (answers[question.id] || '').trim();
      return sum + (answer ? 1 : 0);
    }, 0);
    setSubmitted(true);
    onCompleteChallenge(score, questions.length);
  };

  if (!currentUnit) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center text-slate-500">
        暂无可用单元，暂时无法开始闯关。
      </div>
    );
  }

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
            <div className="text-[10px] text-slate-400 mb-1">最近成绩</div>
            <div className="text-xl font-bold text-blue-600">{latestAttempt ? `${Math.round((latestAttempt.score / latestAttempt.total) * 100)}%` : '--'}</div>
          </div>
        </div>
      </div>

      {!challengeStatus.ready && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-700">
          当前单元还没完全准备好，建议先完成首页推荐任务后再正式闯关。你现在也可以先试做，系统会照常记录成绩。
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
              Task {index + 1} · {question.kind}
            </div>
            <div className="font-bold text-slate-800 text-lg">{question.prompt}</div>
            <textarea
              value={answers[question.id] || ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
              className="w-full mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm outline-none focus:border-emerald-500 min-h-28"
              placeholder="请输入你的答案、解释或口语表达要点"
            />
            {submitted && (
              <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                <div className="text-xs font-bold text-emerald-700 mb-1">参考要点</div>
                <div className="text-sm text-emerald-800">{question.expected}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800">提交本次闯关</h3>
            <p className="text-sm text-slate-500 mt-1">当前按是否完成作答给出阶段成绩，适合小规模教学快速落地。</p>
          </div>
          <button onClick={handleSubmit} className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-bold">
            提交并记录成绩
          </button>
        </div>
      </div>
    </div>
  );
}
