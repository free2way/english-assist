import React, { useMemo } from 'react';
import { Award, Flame, Sparkles } from 'lucide-react';

import { cn } from '../lib/utils';
import type { StudyState } from './textbook/types';
import {
  buildCheckinHeatmap,
  buildGrowthBadges,
  buildSevenDayProgress,
  buildWeeklyGoals,
} from './textbook/growth';

interface GrowthPanelProps {
  studyState: StudyState;
  streak: number;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function GrowthPanel({ studyState, streak }: GrowthPanelProps) {
  const badges = useMemo(() => buildGrowthBadges(studyState, streak), [studyState, streak]);
  const goals = useMemo(() => buildWeeklyGoals(studyState), [studyState]);
  const heatmap = useMemo(() => buildCheckinHeatmap(studyState), [studyState]);
  const week = useMemo(() => buildSevenDayProgress(studyState), [studyState]);

  const earned = badges.filter((item) => item.earned);
  const nextBadge = badges
    .filter((item) => !item.earned)
    .sort((a, b) => {
      const ratio = (progress: string) => {
        const match = /^(\d+)\/(\d+)/.exec(progress);
        return match ? Number(match[1]) / Number(match[2]) : 0;
      };
      return ratio(b.progress) - ratio(a.progress);
    })[0];
  const maxTasks = Math.max(1, ...week.map((item) => item.tasks));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              成长记录
            </h3>
            <p className="text-sm text-slate-500 mt-1">打卡日历、近 7 天投入与成就进度</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 font-bold">
              <Flame size={14} />
              连续 {streak} 天
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 font-bold">
              <Award size={14} />
              已获得 {earned.length}/{badges.length} 枚徽章
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-800">打卡日历</div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span>少</span>
                {['bg-slate-100', 'bg-emerald-200', 'bg-emerald-300', 'bg-emerald-500'].map((tone) => (
                  <span key={tone} className={cn('w-3 h-3 rounded-sm', tone)} />
                ))}
                <span>多</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col justify-between py-0.5 text-[9px] text-slate-300">
                {WEEKDAY_LABELS.map((label) => <span key={label} className="h-3 leading-3">{label}</span>)}
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {heatmap.map((column, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {column.map((cell, dayIndex) => (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        title={cell ? `${cell.date} · ${cell.checkedIn ? '已打卡' : '未打卡'} · ${cell.tasks} 个任务` : ''}
                        className={cn(
                          'w-3 h-3 rounded-sm',
                          !cell
                            ? 'bg-transparent'
                            : cell.tasks >= 3
                              ? 'bg-emerald-500'
                              : cell.tasks > 0 || cell.checkedIn
                                ? cell.tasks > 0 ? 'bg-emerald-400' : 'bg-emerald-300'
                                : 'bg-slate-100',
                          cell?.isToday && 'ring-1 ring-blue-400',
                        )}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-500">{goal.label}</span>
                  <span className={cn('text-xs font-bold', goal.done ? 'text-emerald-600' : 'text-slate-700')}>
                    {Math.min(goal.current, goal.target)}/{goal.target}
                  </span>
                  <div className="w-16 h-1.5 bg-white rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', goal.done ? 'bg-emerald-500' : 'bg-blue-400')}
                      style={{ width: `${Math.min(100, Math.round((goal.current / goal.target) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <div className="text-sm font-bold text-slate-800 mb-3">近 7 天投入</div>
            <div className="flex items-end gap-2 h-28">
              {week.map((point) => (
                <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center h-20">
                    <div
                      title={`${point.label} · ${point.tasks} 个任务`}
                      className={cn('w-full rounded-t-md', point.tasks > 0 ? 'bg-blue-400' : 'bg-slate-100')}
                      style={{ height: `${Math.max(6, Math.round((point.tasks / maxTasks) * 100))}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">{point.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {week.filter((item) => item.pronunciation !== null).length === 0 ? (
                <div className="text-xs text-slate-400">本周还没有发音评测，去朗读页试一次吧。</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {week.filter((item) => item.pronunciation !== null).map((item) => (
                    <span key={item.date} className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      {item.label} 发音 {item.pronunciation}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              成就徽章
            </h3>
            <p className="text-sm text-slate-500 mt-1">完成真实学习动作自动解锁，不需要手动领取</p>
          </div>
          {nextBadge && (
            <div className="text-xs text-slate-500">
              下一个：<span className="font-bold text-slate-700">{nextBadge.title}</span>（{nextBadge.progress}）
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={cn(
                'rounded-2xl border p-3 transition-all',
                badge.earned ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50 opacity-70',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-2xl', badge.earned ? '' : 'grayscale')}>{badge.icon}</span>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    badge.earned ? 'bg-amber-200 text-amber-800' : 'bg-white text-slate-400 border border-slate-100',
                  )}
                >
                  {badge.earned ? '已获得' : badge.progress}
                </span>
              </div>
              <div className="mt-2 text-sm font-bold text-slate-800">{badge.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{badge.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
