import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { StatCard } from './StatCard';
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
  mistakeReasonLabels: Record<MistakeReason, string>;
  getWeaknessSummary: (studyState: StudyState) => WeaknessSummaryItem[];
  buildReviewPack: (studyState: StudyState) => ReviewPackItem[];
  stageMeta: LessonStage[];
}

export function Statistics({
  studyState,
  currentUnit,
  onRetryMistake,
  mistakeReasonLabels,
  getWeaknessSummary,
  buildReviewPack,
  stageMeta,
}: StatisticsProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | MistakeRecord['category']>('all');
  const [stageFilter, setStageFilter] = useState<'all' | LessonStageKey>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const totalTasks = studyState.completedTaskIds.length;
  const accuracy = studyState.mistakes.length + totalTasks > 0
    ? Math.round((totalTasks / (studyState.mistakes.length + totalTasks)) * 100)
    : 100;
  const weaknessSummary = getWeaknessSummary(studyState);
  const filteredMistakes = studyState.mistakes.filter((mistake) => {
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
    reviewPack[0] ? `先复练：${reviewPack[0].reasonLabel}` : '继续保持当前节奏',
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
    { name: '词汇', value: studyState.masteredWordIds.length || 1, color: '#10b981' },
    { name: '跟读', value: studyState.followedSentenceIds.length || 1, color: '#3b82f6' },
    { name: '语法', value: studyState.completedGrammarQuestionIds.length || 1, color: '#8b5cf6' },
    { name: '错题复盘', value: studyState.mistakes.length || 1, color: '#f97316' },
  ];

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
          <div className="flex gap-3">
            <StatCard label="已完成课时" value={`${totalTasks}/4`} colorClass="text-blue-500" />
            <StatCard label="综合准确率" value={`${accuracy}%`} colorClass="text-emerald-500" />
            <StatCard label="语法练习" value={String(studyState.completedGrammarQuestionIds.length)} colorClass="text-violet-500" />
            <StatCard label="待复盘错题" value={String(studyState.mistakes.length)} colorClass="text-rose-500" />
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
          <h3 className="font-bold text-slate-800 mb-6">学习投入结构</h3>
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
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-slate-500">{item.name}</span>
              </div>
            ))}
          </div>
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
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3">待优先回练词</div>
              {latestPronunciation.weakWords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {latestPronunciation.weakWords.map((word) => (
                    <span key={word} className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold">
                      {word}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">最近一次评测里没有明显低分词，可以继续提高流利度和语音自然度。</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-sm text-slate-500">
            还没有 Azure 发音评测记录。去教材页的“课文朗读训练”里点一次“Azure 发音评测”，这里就会开始累计数据。
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
              const total = Math.max(studyState.mistakes.length, 1);
              const value = Math.min(100, Math.round((item.count / total) * 100));
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 font-medium">{item.label}</span>
                    <span className="text-slate-400">{value}% 关注度</span>
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

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">错题本</h3>
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
          <div className="space-y-3">
            {filteredMistakes.length === 0 ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
                当前筛选条件下没有错题，可以切换筛选或继续推进课时。
              </div>
            ) : (
              filteredMistakes.slice(0, 6).map((mistake) => (
                <div key={mistake.id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-400 mb-1">
                    {mistake.stage === 'preview' ? '词汇预习' : mistake.stage === 'dictation' ? '听写巩固' : '口语表达'}
                  </div>
                  <div className="text-sm font-bold text-slate-800">{mistake.prompt}</div>
                  <div className="text-xs text-slate-500 mt-1">你的答案：{mistake.answer || '未作答'}</div>
                  <div className="text-xs text-rose-600 mt-1">正确内容：{mistake.expected}</div>
                  {mistake.reason && (
                    <div className="text-xs text-amber-600 mt-1">错误类型：{mistakeReasonLabels[mistake.reason]}</div>
                  )}
                  {mistake.hint && (
                    <div className="text-xs text-slate-500 mt-1">复习建议：{mistake.hint}</div>
                  )}
                  <button
                    onClick={() => onRetryMistake(mistake)}
                    className="mt-3 px-3 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold"
                  >
                    立即复练
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
