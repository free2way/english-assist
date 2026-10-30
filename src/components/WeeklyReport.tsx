import React, { useMemo, useState } from 'react';
import { Copy, Printer, X } from 'lucide-react';

import { cn } from '../lib/utils';
import type { StudyState } from './textbook/types';
import { buildWeeklyReportText, buildWeeklyStats } from './textbook/weeklyStats';

interface WeeklyReportProps {
  student: { username: string; grade: string; semester: string; school: string };
  textbookTitle: string;
  currentUnitLabel: string;
  studyState: StudyState;
  homework: Array<{
    title: string;
    completed: boolean;
    dueAt: string | null;
    taskKeys: string[];
    tasks: Record<string, boolean>;
  }>;
  feedback: string[];
  suggestion: string;
  onClose: () => void;
}

const Metric = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
    <div className="text-[10px] text-slate-400">{label}</div>
    <div className="text-xl font-black text-slate-800 mt-1">{value}</div>
    {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
  </div>
);

export function WeeklyReport({
  student,
  textbookTitle,
  currentUnitLabel,
  studyState,
  homework,
  feedback,
  suggestion,
  onClose,
}: WeeklyReportProps) {
  const stats = useMemo(() => buildWeeklyStats(studyState), [studyState]);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const handleCopy = async () => {
    const text = buildWeeklyReportText({
      studentName: student.username,
      grade: student.grade,
      semester: student.semester,
      textbookTitle,
      stats,
      homework,
      feedback,
      suggestion,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('浏览器不允许自动复制，请改用"打印 / 存为 PDF"');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 no-print-overlay">
      <div className="weekly-report w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-6 my-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.3em]">Weekly Report</p>
            <h2 className="text-2xl font-black text-slate-800 mt-2">{student.username} 本周学习报告</h2>
            <p className="text-sm text-slate-500 mt-1">
              {[student.grade, student.semester, student.school].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {textbookTitle} · {currentUnitLabel} · {stats.rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
            >
              <Copy size={14} />
              {copied ? '已复制' : '复制文本'}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
            >
              <Printer size={14} />
              打印 / 存为 PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100" title="关闭">
              <X size={18} />
            </button>
          </div>
        </div>

        {copyError && <div className="mt-3 text-xs text-rose-500">{copyError}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Metric label="打卡天数" value={`${stats.checkinDays} 天`} hint={`练习 ${stats.activeDays} 天`} />
          <Metric label="完成任务" value={`${stats.tasksDone} 个`} hint="近 7 天累计" />
          <Metric
            label="听写正确率"
            value={stats.dictationAccuracy === null ? '--' : `${stats.dictationAccuracy}%`}
            hint={stats.dictationRounds > 0 ? `${stats.dictationRounds} 轮` : '本周未练习'}
          />
          <Metric
            label="发音平均分"
            value={stats.pronunciationAverage === null ? '--' : String(stats.pronunciationAverage)}
            hint={stats.pronunciationCount > 0 ? `${stats.pronunciationCount} 次评测` : '本周未评测'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-2xl border border-slate-100 p-4">
            <div className="text-sm font-bold text-slate-800 mb-2">错题复盘</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600">本周新增 {stats.newMistakes}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">待复盘 {stats.pendingMistakes}</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">已销账 {stats.resolvedMistakes}</span>
            </div>
            {stats.topWeakPoints.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.topWeakPoints.map((item) => (
                  <span key={item.label} className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 text-xs">
                    {item.label} ×{item.count}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-400">本周没有新的错题记录。</div>
            )}
            {stats.latestChallenge && (
              <div className="mt-3 text-xs text-slate-500">
                最近一次闯关：{stats.latestChallenge.score}/{stats.latestChallenge.total}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <div className="text-sm font-bold text-slate-800 mb-2">需重点复习的单词</div>
            {stats.weakestWords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.weakestWords.map((item) => (
                  <span key={item.word} className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold">
                    {item.word}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400">本周没有明显的发音弱词。</div>
            )}
            <div className="text-[10px] text-slate-400 mt-3">来自最近 7 天的发音评测结果</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 p-4 mt-4">
          <div className="text-sm font-bold text-slate-800 mb-2">作业</div>
          {homework.length === 0 ? (
            <div className="text-xs text-slate-400">本周没有布置作业。</div>
          ) : (
            <div className="space-y-2">
              {homework.map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">{item.title}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full font-bold',
                      item.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {item.completed ? '已完成' : '未完成'}
                  </span>
                  {item.dueAt && <span className="text-slate-400">截止 {item.dueAt}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {feedback.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 mt-4">
            <div className="text-sm font-bold text-amber-800 mb-1">老师评语</div>
            <div className="text-sm text-amber-900 whitespace-pre-wrap">{feedback[0]}</div>
          </div>
        )}

        {suggestion && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 mt-4">
            <div className="text-sm font-bold text-emerald-800 mb-1">下一步建议</div>
            <div className="text-sm text-emerald-900">{suggestion}</div>
          </div>
        )}

        <div className="mt-4 text-[10px] text-slate-400">
          数据来源：学生端学习记录（服务端快照）。生成时间 {new Date().toLocaleString('zh-CN', { hour12: false })}
        </div>
      </div>
    </div>
  );
}
