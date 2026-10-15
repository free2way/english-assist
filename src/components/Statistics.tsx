import React, { useState } from 'react';
import { CheckCircle2, Undo2, Volume2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { StatCard } from './StatCard';
import { cn } from '../lib/utils';
import { createTaskId, getStageLabel } from './textbook/helpers';
import type {
  LessonStage,
  LessonStageKey,
  MistakeReason,
  MistakeRecord,
  ReviewPackItem,
  StudyState,
  UnitBundle,
  WeaknessSummaryItem,
} from './textbook/types';

interface StatisticsProps {
  studyState: StudyState;
  currentUnit: UnitBundle | null;
  onRetryMistake: (mistake: MistakeRecord) => void;
  onResolveMistake: (mistake: MistakeRecord) => void;
  mistakeReasonLabels: Record<MistakeReason, string>;
  getWeaknessSummary: (studyState: StudyState) => WeaknessSummaryItem[];
  buildReviewPack: (studyState: StudyState) => ReviewPackItem[];
  stageMeta: LessonStage[];
  onPracticeWeakWord: (word: string) => void;
}

const CATEGORY_LABELS: Record<MistakeRecord['category'], string> = {
  vocab: '词汇',
  dictation: '听写',
  speaking: '口语',
  grammar: '语法',
};

export function Statistics({
  studyState,
  currentUnit,
  onRetryMistake,
  onResolveMistake,
  mistakeReasonLabels,
  getWeaknessSummary,
  buildReviewPack,
  stageMeta,
  onPracticeWeakWord,
}: StatisticsProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | MistakeRecord['category']>('all');
  const [stageFilter, setStageFilter] = useState<'all' | LessonStageKey>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);

  const unresolvedMistakes = studyState.mistakes.filter((mistake) => !mistake.resolved);
  const resolvedCount = studyState.mistakes.length - unresolvedMistakes.length;

  const unit = currentUnit;
  const completedStagesInUnit = unit
    ? unit.stages.filter((stage) => studyState.completedTaskIds.includes(createTaskId(unit.id, stage.key))).length
    : 0;

  const dictationAttempts = (unit
    ? studyState.dictationAttempts.filter((attempt) => attempt.unitId === unit.id)
    : studyState.dictationAttempts).slice(0, 5);
  const dictationTotals = dictationAttempts.reduce(
    (acc, attempt) => ({ correct: acc.correct + attempt.correct, total: acc.total + attempt.total }),
    { correct: 0, total: 0 },
  );
  const dictationAccuracy = dictationTotals.total > 0
    ? Math.round((dictationTotals.correct / dictationTotals.total) * 100)
    : null;

  const challengeAttempts = unit
    ? studyState.challengeAttempts.filter((attempt) => attempt.unitId === unit.id)
    : studyState.challengeAttempts;
  const latestChallenge = challengeAttempts[0];
  const challengeRate = latestChallenge
    ? Math.round((latestChallenge.score / Math.max(1, latestChallenge.total)) * 100)
    : null;

  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 6);
  const weeklyProgress = studyState.dailyCheckins
    .filter((record) => new Date(`${record.date}T00:00:00`) >= new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()))
    .reduce((sum, record) => sum + record.completedTaskIds.length + record.recommendationIds.length + (record.challengeCompleted ? 1 : 0), 0);

  const weaknessSummary = getWeaknessSummary(studyState);
  const filteredMistakes = studyState.mistakes.filter((mistake) => {
    if (!showResolved && mistake.resolved) return false;
    if (categoryFilter !== 'all' && mistake.category !== categoryFilter) return false;
    if (stageFilter !== 'all' && mistake.stage !== stageFilter) return false;
    if (unitFilter !== 'all' && mistake.unitId !== unitFilter) return false;
    return true;
  });
  const unitOptions = Array.from(new Set(studyState.mistakes.map((mistake) => mistake.unitId)));
  const reviewPack = buildReviewPack(studyState);
  const topWeakness = [...weaknessSummary].sort((a, b) => b.count - a.count)[0];
  const pronunciationRecords = currentUnit
    ? studyState.pronunciationAssessments.filter((item) => item.unitId === currentUnit.id)
    : studyState.pronunciationAssessments;
  const latestPronunciation = pronunciationRecords[0];
  const pronunciationAverage = pronunciationRecords.length > 0
    ? Math.round(pronunciationRecords.reduce((sum, item) => sum + item.pronunciationScore, 0) / pronunciationRecords.length)
    : null;
  const topActions = [
    reviewPack[0] ? `先复练：${reviewPack[0].reasonLabel}` : '当前没有到期的错题，可以继续推进主线',
    topWeakness?.count
      ? topWeakness.hint
      : '当前弱项压力不大，可以进入下一个课时',
    currentUnit
      ? `当前单元建议优先完成 ${getStageLabel(currentUnit.stages.find((stage) => !studyState.completedTaskIds.includes(createTaskId(currentUnit.id, stage.key)))?.key || studyState.currentStage)}`
      : '暂无当前单元',
  ];
  const progressChart = stageMeta.map((stage) => ({
    name: stage.title.replace('课时', '').slice(0, 6),
    completed: studyState.completedTaskIds.filter((id) => id.endsWith(`:${stage.key}`)).length,
    target: 1,
  }));
  const pieData = [
    { name: '词汇', value: studyState.masteredWordIds.length, color: '#10b981' },
    { name: '跟读', value: studyState.followedSentenceIds.length, color: '#3b82f6' },
    { name: '语法', value: studyState.completedGrammarQuestionIds.length, color: '#8b5cf6' },
    { name: '已销账错题', value: resolvedCount, color: '#f97316' },
  ];
  const pieTotal = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">成长报告</h2>
            <p className="text-sm text-slate-500 mt-1">
              {currentUnit ? `当前跟踪单元：${currentUnit.unit} · ${currentUnit.title}` : '暂无当前单元'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatCard
              label="已完成课时"
              value={currentUnit ? `${completedStagesInUnit}/${currentUnit.stages.length}` : String(studyState.completedTaskIds.length)}
              colorClass="text-blue-500"
            />
            <StatCard
              label="听写正确率"
              value={dictationAccuracy === null ? '--' : `${dictationAccuracy}%`}
              colorClass="text-emerald-500"
            />
            <StatCard
              label="最近闯关"
              value={challengeRate === null ? '--' : `${challengeRate}%`}
              colorClass="text-violet-500"
            />
            <StatCard label="待复盘错题" value={String(unresolvedMistakes.length)} colorClass="text-rose-500" />
            <StatCard label="近 7 天完成任务" value={String(weeklyProgress)} colorClass="text-amber-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-6">课时推进情况</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip />
                <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-6">学习成果分布</h3>
          {pieTotal > 0 ? (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-slate-500">{item.name} {item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              还没有积累到可展示的数据，先完成一次词汇预习或跟读吧。
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-slate-800">发音报告</h3>
            <p className="text-sm text-slate-500 mt-1">展示当前单元最近的 Azure 发音评测结果。</p>
          </div>
          <div className="flex gap-3">
            <StatCard label="评测次数" value={String(pronunciationRecords.length)} colorClass="text-blue-500" />
            <StatCard label="平均发音分" value={pronunciationAverage ? String(pronunciationAverage) : '--'} colorClass="text-violet-500" />
          </div>
        </div>

        {latestPronunciation ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Latest Assessment</div>
              <div className="font-bold text-slate-800">{latestPronunciation.sentenceText}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                <div className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="text-xs text-slate-400">发音</div>
                  <div className="text-xl font-black text-slate-800 mt-1">{latestPronunciation.pronunciationScore}</div>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="text-xs text-slate-400">准确度</div>
                  <div className="text-xl font-black text-slate-800 mt-1">{latestPronunciation.accuracyScore}</div>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="text-xs text-slate-400">流利度</div>
                  <div className="text-xl font-black text-slate-800 mt-1">{latestPronunciation.fluencyScore}</div>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 p-4">
                  <div className="text-xs text-slate-400">完整度</div>
                  <div className="text-xl font-black text-slate-800 mt-1">{latestPronunciation.completenessScore}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">待优先回练词（点一下听发音）</div>
              {latestPronunciation.weakWords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {latestPronunciation.weakWords.map((word) => (
                    <button
                      key={word}
                      onClick={() => onPracticeWeakWord(word)}
                      className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold inline-flex items-center gap-1.5 hover:bg-rose-100 transition-colors"
                    >
                      <Volume2 size={14} />
                      {word}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">最近一次评测里没有明显低分词，可以继续提高流利度和语音自然度。</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm text-slate-500">
            还没有 Azure 发音评测记录。去教材页的“课文朗读训练”里点一次“开始录音朗读”，这里就会开始累计数据。
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">今天最该补什么</h3>
          <div className="space-y-3">
            {topActions.map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">弱项分析</h3>
          <div className="space-y-4">
            {weaknessSummary.map((item) => {
              const total = Math.max(unresolvedMistakes.length, 1);
              const value = Math.min(100, Math.round((item.count / total) * 100));
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="text-slate-400">{item.count} 条 · {value}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${value}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 md:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-800">
              错题本
              <span className="ml-2 text-xs font-normal text-slate-400">
                待复盘 {unresolvedMistakes.length} 条 · 已销账 {resolvedCount} 条
              </span>
            </h3>
            <button
              onClick={() => setShowResolved((prev) => !prev)}
              className="self-start px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
            >
              {showResolved ? '只看待复盘' : '显示已销账'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as 'all' | MistakeRecord['category'])} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="all">全部类型</option>
              <option value="vocab">词汇</option>
              <option value="dictation">听写</option>
              <option value="speaking">口语</option>
              <option value="grammar">语法</option>
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as 'all' | LessonStageKey)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="all">全部课时</option>
              <option value="preview">课时1 预习</option>
              <option value="reading">课时2 跟读</option>
              <option value="dictation">课时3 听写</option>
              <option value="speaking">课时4 口语</option>
            </select>
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs outline-none">
              <option value="all">全部单元</option>
              {unitOptions.map((unitId) => (
                <option key={unitId} value={unitId}>{unitId.split('-').slice(-1)[0]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filteredMistakes.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700 xl:col-span-2">
                当前筛选条件下没有待复盘错题，可以切换筛选或继续推进课时。
              </div>
            ) : (
              filteredMistakes.slice(0, 8).map((mistake) => (
                <div
                  key={mistake.id}
                  className={cn(
                    'rounded-2xl border p-4',
                    mistake.resolved ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-100',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-400">
                      {CATEGORY_LABELS[mistake.category]}
                      {mistake.retryCount ? ` · 已复练 ${mistake.retryCount} 次` : ''}
                    </div>
                    {mistake.resolved && (
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2 size={14} />
                        已销账
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-1">{mistake.prompt}</div>
                  <div className="text-xs text-slate-500 mt-1">你的答案：{mistake.answer || '未作答'}</div>
                  <div className="text-xs text-rose-600 mt-1">正确内容：{mistake.expected}</div>
                  {mistake.reason && (
                    <div className="text-xs text-amber-600 mt-1">错误类型：{mistakeReasonLabels[mistake.reason]}</div>
                  )}
                  {mistake.hint && (
                    <div className="text-xs text-slate-500 mt-1">复习建议：{mistake.hint}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => onRetryMistake(mistake)}
                      className="px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
                    >
                      立即复练
                    </button>
                    {!mistake.resolved && (
                      <button
                        onClick={() => onResolveMistake(mistake)}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Undo2 size={13} />
                        标记已解决
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
