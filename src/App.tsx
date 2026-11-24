/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  Mic2,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { AITutorModule } from './components/AITutorModule';
import { GrowthPanel } from './components/GrowthPanel';
import { ManagementModule } from './components/ManagementModule';
import { Statistics } from './components/Statistics';
import { StudentDashboard } from './components/StudentDashboard';
import { TextbookModule, type StudySectionKey } from './components/textbook/TextbookModule';
import { createTaskId, getStageLabel, normalizeGrammarAnswer } from './components/textbook/helpers';
import type { StudentFeedbackNote, StudentHomeworkItem } from './components/textbook/homework';
import { recognizeSpeechFromMicrophone, speakTextWithAzure } from './lib/azureSpeech';
import {
  DEFAULT_AI_CONFIG,
  MISTAKE_REASON_LABELS,
  SESSION_DURATION_OPTIONS,
  STAGE_META,
  apiFetch,
  appendAgentEvent,
  buildAgentOrchestration,
  buildChallengeQuestions,
  buildReviewPack,
  buildSevenDayTrend,
  buildUnitBundlesFromTextbook,
  classifyDictationIssue,
  createInitialStudyState,
  getAuthToken,
  getChallengeHistoryForUnit,
  getCheckinStreak,
  getOrCreateDailyCheckin,
  getSavedSessionHours,
  getSelectedTextbookStorageKey,
  getStudyStorageKey,
  getStudyUpdatedAtKey,
  getTodayKey,
  getTodayLearningSignals,
  getUnitChallengeStatus,
  getWeaknessSummary,
  isStudyStateEmpty,
  loadStudyStateForUser,
  normalizeStudyState,
  scoreChallengeAnswer,
  setAuthToken,
  setSavedSessionHours,
  type AppTabKey,
  type AppUser,
  type DailyCheckinRecord,
  type LessonStageKey,
  type MistakeCategory,
  type MistakeReason,
  type MistakeRecord,
  type PronunciationAssessmentRecord,
  type SpeechTokenResponse,
  type StudyState,
  type TextbookContent,
  type TextbookSummary,
} from './lib/study';
import { cn } from './lib/utils';

const GRADES = ['7年级', '8年级', '9年级', '10年级', '11年级', '12年级'];
const SEMESTERS = ['上学期', '下学期'];

const playBrowserTTS = (text: string, accent: 'US' | 'UK', rate = 1.0): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const lang = accent === 'US' ? 'en-US' : 'en-GB';
      utterance.lang = lang;
      utterance.rate = rate;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoices = accent === 'US'
        ? ['Google US English', 'Samantha', 'Alex', 'Microsoft Zira', 'Microsoft David']
        : ['Google UK English Female', 'Google UK English Male', 'Daniel', 'Serena', 'Microsoft Hazel'];

      let selectedVoice = null;
      for (const name of preferredVoices) {
        selectedVoice = voices.find((v) => v.name.includes(name));
        if (selectedVoice) break;
      }
      if (!selectedVoice) {
        selectedVoice = voices.find((v) => v.lang === lang) || voices[0];
      }
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
};

const ProfileModule = ({
  currentUser,
  onPasswordChanged,
  onLogout,
}: {
  currentUser: AppUser;
  onPasswordChanged: (user: AppUser, token: string) => void;
  onLogout: () => void;
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionHours, setSessionHours] = useState<number>(() => getSavedSessionHours());
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('请完整填写密码信息');
      return;
    }
    if (newPassword.trim().length < 6) {
      setError('新密码至少需要 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: AppUser; expiresAt: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          sessionHours,
        }),
      });
      setSavedSessionHours(sessionHours);
      setAuthToken(data.token);
      onPasswordChanged(data.user, data.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccessMessage(`密码修改成功，当前登录已续期至 ${new Date(data.expiresAt).toLocaleString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败');
      setSuccessMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-3xl">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xl">
              {currentUser.username.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{currentUser.username}</h2>
              <p className="text-sm text-slate-500">
                {currentUser.school} · {currentUser.grade} {currentUser.semester}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 text-sm font-bold inline-flex items-center gap-2 hover:bg-rose-100 transition-all"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-xs text-slate-400">用户名</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5 truncate">{currentUser.username}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-xs text-slate-400">身份</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">{currentUser.role === 'admin' ? '教师 / 管理员' : '学生'}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-xs text-slate-400">年级学期</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5">{currentUser.grade} · {currentUser.semester}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5">
            <div className="text-xs text-slate-400">学校</div>
            <div className="font-bold text-slate-800 text-sm mt-0.5 truncate">{currentUser.school}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-5">修改登录密码</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
                placeholder="请输入当前密码"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
                placeholder="至少 6 位"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
                placeholder="再次输入新密码"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">免登录时长</label>
              <select
                value={sessionHours}
                onChange={(e) => setSessionHours(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white"
              >
                {SESSION_DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}（{option.description}）
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm font-bold text-rose-500">{error}</p>}
          {successMessage && <p className="text-sm font-bold text-emerald-600">{successMessage}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-500 text-white font-bold shadow-sm hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            {isSubmitting ? '提交中...' : '更新密码'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Login = ({ onLogin }: { onLogin: (user: AppUser) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    if (!trimmedUsername || !trimmedPassword) {
      setError('请输入用户名和密码');
      return;
    }

    const sessionHours = rememberMe ? 24 * 30 : 12;
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: AppUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: trimmedUsername,
          password: trimmedPassword,
          sessionHours,
        }),
      });
      setSavedSessionHours(sessionHours);
      setAuthToken(data.token);
      setError('');
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号或密码');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-blue-500/10 p-7 sm:p-10 border border-slate-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl blue-gradient flex items-center justify-center text-white shadow-lg shadow-blue-200 mx-auto mb-4">
            <Zap size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">AceEnglish</h1>
          <p className="text-slate-500 text-sm mt-1.5">初中英语同步听说练习伙伴</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">用户名 / 学号</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入你的用户名"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 ml-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-12 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none pl-1">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>在这台设备上记住登录（30 天免重复输入）</span>
          </label>

          {error && (
            <p className="text-rose-500 text-xs font-bold text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full blue-gradient py-3.5 rounded-2xl text-white font-black shadow-lg shadow-blue-200 hover:scale-[1.01] active:scale-95 transition-all"
          >
            {isSubmitting ? '登录中...' : '开始学习'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default function App() {
  const isPresentationCapture = new URLSearchParams(window.location.search).has('capture');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<AppTabKey>('dashboard');
  const [studySection, setStudySection] = useState<StudySectionKey>('preview');
  const [practiceSubMode, setPracticeSubMode] = useState<'dictation' | 'listening'>('dictation');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isTextbookLoading, setIsTextbookLoading] = useState(false);
  const [textbooks, setTextbooks] = useState<TextbookSummary[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState('');
  const [selectedTextbook, setSelectedTextbook] = useState<TextbookContent | null>(null);
  const [textbookError, setTextbookError] = useState('');
  const [studyState, setStudyState] = useState<StudyState>(createInitialStudyState([]));
  const studyStateRef = useRef<StudyState>(studyState);
  const baselineStateRef = useRef<string>('');
  const [remoteSynced, setRemoteSynced] = useState(false);
  const [studentHomework, setStudentHomework] = useState<StudentHomeworkItem[]>([]);
  const [teacherFeedback, setTeacherFeedback] = useState<StudentFeedbackNote[]>([]);
  const pushStudyStateRef = useRef<(() => Promise<void>) | null>(null);
  const [retryTarget, setRetryTarget] = useState<MistakeRecord | null>(null);
  const [checkinToast, setCheckinToast] = useState('');

  const requestSpeechToken = useCallback(() => apiFetch<SpeechTokenResponse>('/api/speech-token'), []);

  const loadStudentHomework = useCallback(async () => {
    if (!currentUser || currentUser.role === 'admin') {
      setStudentHomework([]);
      setTeacherFeedback([]);
      return;
    }
    const [homeworkResult, feedbackResult] = await Promise.allSettled([
      apiFetch<{ assignments: StudentHomeworkItem[] }>('/api/homework'),
      apiFetch<{ notes: StudentFeedbackNote[] }>('/api/feedback'),
    ]);
    setStudentHomework(
      homeworkResult.status === 'fulfilled' && Array.isArray(homeworkResult.value.assignments)
        ? homeworkResult.value.assignments
        : [],
    );
    setTeacherFeedback(
      feedbackResult.status === 'fulfilled' && Array.isArray(feedbackResult.value.notes)
        ? feedbackResult.value.notes
        : [],
    );
  }, [currentUser?.username, currentUser?.role]);

  useEffect(() => {
    void loadStudentHomework();
  }, [loadStudentHomework]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && activeTab === 'manage') {
      setActiveTab('dashboard');
    }
  }, [currentUser?.role, activeTab]);

  useEffect(() => {
    const restoreSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsAuthLoading(false);
        return;
      }
      try {
        const data = await apiFetch<{ user: AppUser }>('/api/auth/me');
        setCurrentUser(data.user);
      } catch {
        setAuthToken(null);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    void restoreSession();
  }, []);

  const loadTextbooks = useCallback(async () => {
    if (!currentUser) return;
    setIsTextbookLoading(true);
    try {
      const data = await apiFetch<{ textbooks: TextbookSummary[] }>('/api/textbooks');
      setTextbooks(data.textbooks);
      const savedId = localStorage.getItem(getSelectedTextbookStorageKey(currentUser.username));
      const preferred =
        data.textbooks.find((item) => item.id === currentUser.selectedTextbookId) ||
        data.textbooks.find((item) => item.id === savedId) ||
        data.textbooks.find((item) => item.grade === currentUser.grade && item.semester === currentUser.semester) ||
        data.textbooks[0];
      setSelectedTextbookId(preferred?.id || '');
      setTextbookError('');
    } catch (err) {
      setTextbookError(err instanceof Error ? err.message : '加载教材列表失败');
      setTextbooks([]);
      setSelectedTextbookId('');
    } finally {
      setIsTextbookLoading(false);
    }
  }, [currentUser]);

  const handleSelectedTextbookChange = (textbookId: string) => {
    setSelectedTextbookId(textbookId);
    if (!currentUser || !textbookId) return;
    localStorage.setItem(getSelectedTextbookStorageKey(currentUser.username), textbookId);
    apiFetch<{ user: AppUser }>('/api/users/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({ selectedTextbookId: textbookId }),
    })
      .then((data) => {
        setCurrentUser(data.user);
        setTextbookError('');
      })
      .catch((err) => {
        setTextbookError(err instanceof Error ? err.message : '保存当前教材失败');
      });
  };

  useEffect(() => {
    if (!currentUser) return;
    void loadTextbooks();
  }, [currentUser, loadTextbooks]);

  useEffect(() => {
    if (!currentUser || !selectedTextbookId) {
      setSelectedTextbook(null);
      return;
    }
    let cancelled = false;
    const loadSelectedTextbook = async () => {
      try {
        const data = await apiFetch<{ textbook: TextbookContent }>(`/api/textbooks/${selectedTextbookId}`);
        if (!cancelled) {
          setSelectedTextbook(data.textbook);
          localStorage.setItem(getSelectedTextbookStorageKey(currentUser.username), selectedTextbookId);
          setTextbookError('');
        }
      } catch (err) {
        if (!cancelled) {
          setSelectedTextbook(null);
          setTextbookError(err instanceof Error ? err.message : '加载教材内容失败');
        }
      }
    };
    void loadSelectedTextbook();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.username, selectedTextbookId]);

  const availableUnits = useMemo(() => buildUnitBundlesFromTextbook(selectedTextbook), [selectedTextbook]);
  const textbookContentReady = Boolean(selectedTextbook && selectedTextbook.id === selectedTextbookId);
  const currentUnit = useMemo(
    () => availableUnits.find((unit) => unit.id === studyState.currentUnitId) || availableUnits[0] || null,
    [availableUnits, studyState.currentUnitId],
  );

  useEffect(() => {
    if (!currentUser || !selectedTextbookId) {
      setStudyState(createInitialStudyState([]));
      baselineStateRef.current = '';
      return;
    }
    if (!textbookContentReady) return;
    const raw = localStorage.getItem(getStudyStorageKey(currentUser.username, selectedTextbookId));
    let loaded = createInitialStudyState(availableUnits);
    try {
      const parsed = raw ? (JSON.parse(raw) as Partial<StudyState>) : null;
      loaded = normalizeStudyState(parsed, availableUnits);
    } catch {
      loaded = createInitialStudyState(availableUnits);
    }
    baselineStateRef.current = JSON.stringify(loaded);
    studyStateRef.current = loaded;
    setStudyState(loaded);
  }, [currentUser?.username, selectedTextbookId, availableUnits, textbookContentReady]);

  // Cloud sync
  useEffect(() => {
    if (!currentUser || !selectedTextbookId || !textbookContentReady) {
      setRemoteSynced(false);
      return;
    }
    let cancelled = false;
    setRemoteSynced(false);

    (async () => {
      try {
        const data = await apiFetch<{ state: Partial<StudyState> | null; updatedAt: string | null }>(
          `/api/study/state?textbookId=${encodeURIComponent(selectedTextbookId)}`,
        );
        if (cancelled) return;

        const localUpdatedAt = localStorage.getItem(getStudyUpdatedAtKey(currentUser.username, selectedTextbookId));
        const serverTime = data.updatedAt ? Date.parse(data.updatedAt) : 0;
        const localTime = localUpdatedAt ? Date.parse(localUpdatedAt) : 0;
        const localState = studyStateRef.current;

        if (data.state && (isStudyStateEmpty(localState) || serverTime > localTime)) {
          const restored = normalizeStudyState(data.state, availableUnits);
          studyStateRef.current = restored;
          baselineStateRef.current = JSON.stringify(restored);
          setStudyState(restored);
          localStorage.setItem(getStudyStorageKey(currentUser.username, selectedTextbookId), JSON.stringify(restored));
          localStorage.setItem(getStudyUpdatedAtKey(currentUser.username, selectedTextbookId), new Date(serverTime || Date.now()).toISOString());
        } else if (!isStudyStateEmpty(localState) && (!data.state || localTime > serverTime)) {
          await pushStudyStateRef.current?.();
        }
        if (!cancelled) setRemoteSynced(true);
      } catch (err) {
        console.warn('[study] 服务端同步不可用，本次会话只使用本地数据', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.username, selectedTextbookId, availableUnits, textbookContentReady]);

  useEffect(() => {
    if (!remoteSynced || !currentUser || !selectedTextbookId) return;
    const timer = setTimeout(() => {
      void pushStudyStateRef.current?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [studyState, remoteSynced, currentUser?.username, selectedTextbookId]);

  const pushStudyState = async () => {
    const user = currentUser;
    const textbookId = selectedTextbookId;
    if (!user || !textbookId) return;
    if (isStudyStateEmpty(studyStateRef.current)) return;
    const updatedAt = new Date().toISOString();
    try {
      await apiFetch<{ ok: boolean; updatedAt: string }>('/api/study/state', {
        method: 'PUT',
        body: JSON.stringify({ textbookId, state: studyStateRef.current, updatedAt }),
      });
      localStorage.setItem(getStudyUpdatedAtKey(user.username, textbookId), updatedAt);
      void loadStudentHomework();
    } catch (err) {
      console.warn('[study] 学习进度同步失败，本地数据仍然保留', err);
    }
  };

  useEffect(() => {
    pushStudyStateRef.current = pushStudyState;
  });

  useEffect(() => {
    studyStateRef.current = studyState;
    if (!currentUser || !selectedTextbookId) return;
    const serialized = JSON.stringify(studyState);
    localStorage.setItem(getStudyStorageKey(currentUser.username, selectedTextbookId), serialized);
    if (serialized !== baselineStateRef.current && !isStudyStateEmpty(studyState)) {
      localStorage.setItem(getStudyUpdatedAtKey(currentUser.username, selectedTextbookId), new Date().toISOString());
      baselineStateRef.current = serialized;
    }
  }, [studyState, currentUser?.username, selectedTextbookId]);

  // Auto check-in whenever today's learning signals reach ready!
  useEffect(() => {
    if (!currentUser || !selectedTextbookId || !textbookContentReady) return;
    const today = getTodayKey();
    const todayRecord = getOrCreateDailyCheckin(studyState, today);
    if (todayRecord.checkedIn) return;
    const signals = getTodayLearningSignals(studyState);
    if (!signals.ready) return;

    setStudyState((prev) => {
      const rec = getOrCreateDailyCheckin(prev, today);
      if (rec.checkedIn) return prev;
      const updatedRec: DailyCheckinRecord = { ...rec, checkedIn: true };
      const nextCheckins = [updatedRec, ...prev.dailyCheckins.filter((item) => item.date !== today)].slice(0, 30);
      const nextStreak = getCheckinStreak(nextCheckins);
      setCheckinToast(`今日学习打卡已自动完成！已连续坚持 ${nextStreak} 天`);
      return {
        ...prev,
        dailyCheckins: nextCheckins,
        agentEvents: appendAgentEvent(prev.agentEvents, {
          agent: 'teacherInsight',
          type: 'teacher-insight',
          title: '今日学习闭环自动打卡',
          detail: '完成课时与有效练习后已自动记录今日打卡。',
          unitId: currentUnit?.id,
        }),
      };
    });
  }, [studyState, currentUser, selectedTextbookId, textbookContentReady, currentUnit?.id]);

  useEffect(() => {
    if (!checkinToast) return;
    const timer = setTimeout(() => setCheckinToast(''), 4000);
    return () => clearTimeout(timer);
  }, [checkinToast]);

  const handleLogout = async () => {
    try {
      await apiFetch<{ ok: true }>('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setAuthToken(null);
      setSelectedTextbookId('');
      setSelectedTextbook(null);
      setTextbooks([]);
      setCurrentUser(null);
    }
  };

  const handleSelectUnit = (unitId: string) => {
    setStudyState((prev) => ({
      ...prev,
      currentUnitId: unitId,
      currentStage: 'preview',
    }));
  };

  const handleSelectStage = (stage: LessonStageKey) => {
    setStudyState((prev) => ({
      ...prev,
      currentStage: stage,
    }));
  };

  const handleOpenStudySection = (section: StudySectionKey, unitId?: string) => {
    if (unitId) {
      setStudyState((prev) => ({ ...prev, currentUnitId: unitId }));
    }
    setStudySection(section);
    setActiveTab('study');
  };

  const handleOpenStage = (stage: LessonStageKey, unitId?: string) => {
    setStudyState((prev) => ({
      ...prev,
      ...(unitId ? { currentUnitId: unitId } : {}),
      currentStage: stage,
    }));
    if (stage === 'speaking') {
      setActiveTab('tutor');
      return;
    }
    if (stage === 'preview') {
      setStudySection('preview');
    } else if (stage === 'reading') {
      setStudySection('reading');
    } else {
      setStudySection('practice');
      setPracticeSubMode('dictation');
    }
    setActiveTab('study');
  };

  const updateTodayRecord = (
    prev: StudyState,
    updater: (record: DailyCheckinRecord) => DailyCheckinRecord,
  ): DailyCheckinRecord[] => {
    const today = getTodayKey();
    const existing = getOrCreateDailyCheckin(prev, today);
    const nextRecord = updater(existing);
    const rest = prev.dailyCheckins.filter((item) => item.date !== today);
    return [nextRecord, ...rest].slice(0, 30);
  };

  const handleCompleteStage = (stage: LessonStageKey) => {
    if (!currentUnit) return;
    const taskId = createTaskId(currentUnit.id, stage);
    setStudyState((prev) => ({
      ...prev,
      currentStage: stage,
      completedTaskIds: prev.completedTaskIds.includes(taskId)
        ? prev.completedTaskIds
        : [...prev.completedTaskIds, taskId],
      dailyCheckins: updateTodayRecord(prev, (record) => ({
        ...record,
        completedTaskIds: record.completedTaskIds.includes(taskId)
          ? record.completedTaskIds
          : [...record.completedTaskIds, taskId],
        recommendationIds: record.recommendationIds.includes(`stage:${stage}`)
          ? record.recommendationIds
          : [...record.recommendationIds, `stage:${stage}`],
      })),
      agentEvents: appendAgentEvent(prev.agentEvents, {
        agent: stage === 'speaking' ? 'speakingCoach' : 'orchestrator',
        type: stage === 'speaking' ? 'practice' : 'plan',
        title: `${getStageLabel(stage)}已完成`,
        detail: `${currentUnit.unit} ${getStageLabel(stage)}已完成。`,
        unitId: currentUnit.id,
        stage,
      }),
    }));
  };

  const handleMarkWord = (wordId: string, mastered: boolean) => {
    setStudyState((prev) => ({
      ...prev,
      masteredWordIds: mastered
        ? Array.from(new Set([...prev.masteredWordIds, wordId]))
        : prev.masteredWordIds.filter((id) => id !== wordId),
    }));
  };

  const handleMarkSentenceFollowed = (sentenceId: string, followed = true) => {
    setStudyState((prev) => ({
      ...prev,
      followedSentenceIds: followed
        ? Array.from(new Set([...prev.followedSentenceIds, sentenceId]))
        : prev.followedSentenceIds.filter((id) => id !== sentenceId),
    }));
  };

  const handleCompleteGrammarExercise = (exerciseId: string) => {
    setStudyState((prev) => ({
      ...prev,
      completedGrammarQuestionIds: prev.completedGrammarQuestionIds.includes(exerciseId)
        ? prev.completedGrammarQuestionIds
        : [...prev.completedGrammarQuestionIds, exerciseId],
      dailyCheckins: updateTodayRecord(prev, (record) => ({
        ...record,
        completedTaskIds: record.completedTaskIds.includes(`grammar:${exerciseId}`)
          ? record.completedTaskIds
          : [...record.completedTaskIds, `grammar:${exerciseId}`],
      })),
    }));
  };

  const handleAddPronunciationAssessment = (record: Omit<PronunciationAssessmentRecord, 'id' | 'createdAt'>) => {
    setStudyState((prev) => ({
      ...prev,
      pronunciationAssessments: [
        {
          ...record,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: new Date().toISOString(),
        },
        ...prev.pronunciationAssessments.filter((item) => item.sentenceId !== record.sentenceId),
      ].slice(0, 30),
      agentEvents: appendAgentEvent(prev.agentEvents, {
        agent: 'assessment',
        type: 'assessment',
        title: `发音评测 ${record.pronunciationScore} 分`,
        detail: `待提升词：${record.weakWords.slice(0, 3).join('、') || '暂无'}`,
        unitId: record.unitId,
        stage: 'speaking',
      }),
    }));
  };

  const handleAddMistake = useCallback((record: Omit<MistakeRecord, 'id' | 'createdAt'>) => {
    setStudyState((prev) => ({
      ...prev,
      mistakes: [
        {
          ...record,
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: new Date().toISOString(),
          resolved: false,
          retryCount: 0,
          dueAt: getTodayKey(),
        },
        ...prev.mistakes.filter((item) => !(item.prompt === record.prompt && item.stage === record.stage && item.reason === record.reason)),
      ].slice(0, 60),
      agentEvents: appendAgentEvent(prev.agentEvents, {
        agent: 'assessment',
        type: 'feedback',
        title: record.reason ? `记录${MISTAKE_REASON_LABELS[record.reason]}` : '新增错题记录',
        detail: record.hint || record.prompt,
        unitId: record.unitId,
        stage: record.stage,
      }),
    }));
  }, []);

  const resolveMistakes = (matcher: (mistake: MistakeRecord) => boolean, reasonLabel: string) => {
    setStudyState((prev) => {
      const targets = prev.mistakes.filter((item) => !item.resolved && matcher(item));
      if (targets.length === 0) return prev;
      const ids = new Set(targets.map((item) => item.id));
      const now = new Date().toISOString();
      return {
        ...prev,
        mistakes: prev.mistakes.map((item) => (ids.has(item.id) ? { ...item, resolved: true, lastRetriedAt: now } : item)),
        agentEvents: appendAgentEvent(prev.agentEvents, {
          agent: 'assessment',
          type: 'feedback',
          title: `错题复练通过，销账 ${targets.length} 条`,
          detail: `${reasonLabel}：${targets[0].prompt}`,
          unitId: targets[0].unitId,
          stage: targets[0].stage,
        }),
      };
    });
  };

  const handleResolveMistake = (mistake: MistakeRecord) => {
    resolveMistakes((item) => item.id === mistake.id, '错题销账');
  };

  const handleRetryMistake = (mistake: MistakeRecord) => {
    setStudyState((prev) => ({
      ...prev,
      currentUnitId: mistake.unitId,
      currentStage: mistake.stage,
      mistakes: prev.mistakes.map((item) => (
        item.id === mistake.id
          ? { ...item, retryCount: (item.retryCount || 0) + 1, lastRetriedAt: new Date().toISOString() }
          : item
      )),
    }));
    setRetryTarget(mistake);
    if (mistake.category === 'dictation') {
      setStudySection('practice');
      setPracticeSubMode('dictation');
    } else if (mistake.category === 'grammar') {
      setStudySection('grammar');
    } else if (mistake.category === 'vocab') {
      setStudySection('preview');
    } else {
      setStudySection('reading');
    }
    setActiveTab('study');
  };

  const handleDictationAttempt = (attempt: { mode: 'word' | 'sentence' | 'listening'; correct: number; total: number }) => {
    if (!currentUnit) return;
    setStudyState((prev) => ({
      ...prev,
      dictationAttempts: [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          unitId: currentUnit.id,
          mode: attempt.mode,
          correct: attempt.correct,
          total: attempt.total,
          completedAt: new Date().toISOString(),
        },
        ...prev.dictationAttempts,
      ].slice(0, 40),
      agentEvents: appendAgentEvent(prev.agentEvents, {
        agent: 'assessment',
        type: 'assessment',
        title: `${attempt.mode === 'listening' ? '听力训练' : '听写'}完成 ${attempt.correct}/${attempt.total}`,
        detail: attempt.total > 0 && attempt.correct === attempt.total ? '本轮全部答对！' : '错题已收录，可点「只练错题」巩固。',
        unitId: currentUnit.id,
        stage: 'dictation',
      }),
    }));
  };

  const handleChallengeSubmit = (payload: {
    score: number;
    total: number;
    details: Array<{ id: string; kind: string; prompt: string; answer: string; expected: string; correct: boolean }>;
  }) => {
    if (!currentUnit) return;
    const wrong = payload.details.filter((detail) => !detail.correct);
    const unitTitleFallback = currentUnit.title;
    setStudyState((prev) => {
      const now = new Date().toISOString();
      const challengeMistakes: MistakeRecord[] = wrong.map((detail) => {
        const category: MistakeCategory =
          detail.kind === 'vocab-spell'
            ? 'dictation'
            : detail.kind.startsWith('vocab') || detail.kind === 'meaning'
              ? 'vocab'
              : 'speaking';
        const reason: MistakeReason =
          detail.kind === 'vocab-spell'
            ? 'spelling'
            : detail.kind.startsWith('vocab') || detail.kind === 'meaning'
              ? 'unknown_vocab'
              : detail.kind.startsWith('sentence')
                ? 'sentence_structure'
                : 'too_short';
        return {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          unitId: currentUnit.id,
          category,
          stage: category === 'dictation' ? 'dictation' : category === 'vocab' ? 'preview' : 'speaking',
          prompt: `单元闯关：${detail.prompt}`,
          expected: detail.expected || unitTitleFallback,
          answer: detail.answer,
          reason,
          hint: '回到对应练习再练一遍即可销账。',
          createdAt: now,
          resolved: false,
          retryCount: 0,
          dueAt: getTodayKey(),
        };
      });

      return {
        ...prev,
        challengeAttempts: [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            unitId: currentUnit.id,
            score: payload.score,
            total: payload.total,
            completedAt: now,
            details: payload.details,
          },
          ...prev.challengeAttempts,
        ].slice(0, 20),
        mistakes: [...challengeMistakes, ...prev.mistakes].slice(0, 60),
        dailyCheckins: updateTodayRecord(prev, (record) => ({ ...record, challengeCompleted: true })),
        agentEvents: appendAgentEvent(prev.agentEvents, {
          agent: 'assessment',
          type: 'assessment',
          title: `单元闯关 ${payload.score}/${payload.total}`,
          detail: wrong.length === 0 ? '单元闯关满分通过！' : `${wrong.length} 题未通过，已收录至错题本。`,
          unitId: currentUnit.id,
          stage: 'speaking',
        }),
      };
    });
  };

  const resolveGrammarMistakesForExercise = (exerciseId: string) => {
    const exercise = currentUnit?.grammar.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    resolveMistakes(
      (item) => item.category === 'grammar'
        && normalizeGrammarAnswer(item.expected) === normalizeGrammarAnswer(exercise.answer)
        && item.prompt.includes(exercise.question),
      '语法复练通过',
    );
  };

  const speakWithAzure = useCallback(async (text: string, accent: 'US' | 'UK' = 'US', rate = 1): Promise<boolean> => {
    try {
      await speakTextWithAzure({
        getToken: requestSpeechToken,
        text,
        voiceName: accent === 'US' ? 'en-US-AvaMultilingualNeural' : 'en-GB-SoniaNeural',
        rate,
      });
      return true;
    } catch (error) {
      console.warn('神经语音播放失败，回退浏览器语音', error);
    }
    return playBrowserTTS(text, accent, rate);
  }, [requestSpeechToken]);

  const handleVoiceRecognize = useCallback(async (): Promise<string> => {
    return recognizeSpeechFromMicrophone({
      getToken: requestSpeechToken,
      language: 'en-US',
    });
  }, [requestSpeechToken]);

  // Streamlined 4 primary student tabs (+ teacher manage tab for admins)
  const navItems: Array<{ id: AppTabKey; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: '今日学习', icon: LayoutDashboard },
    { id: 'study', label: '同步课文', icon: BookOpen },
    { id: 'tutor', label: 'AI 外教', icon: Mic2 },
    { id: 'stats', label: '错题成长', icon: BarChart3 },
  ];

  const displayNavItems = currentUser?.role === 'admin'
    ? [...navItems, { id: 'manage' as AppTabKey, label: '教师管理', icon: ShieldCheck }]
    : navItems;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center text-slate-400">
        正在加载学习环境...
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={(user) => setCurrentUser(user)} />;
  }

  const showTextbookSelectors = activeTab !== 'manage' && activeTab !== 'profile';

  return (
    <div className="min-h-screen bg-bg-main flex flex-col lg:flex-row font-sans">
      {/* Desktop & Landscape Tablet Left Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-slate-100 flex-col p-5 sticky top-0 h-screen shrink-0">
        <div className="mb-8 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl blue-gradient flex items-center justify-center text-white shadow-sm">
              <Zap size={18} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none">AceEnglish</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">初中英语同步伙伴</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {displayNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all',
                activeTab === item.id
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
              )}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-2 pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              'w-full p-3 rounded-2xl flex items-center gap-3 text-left transition-all',
              activeTab === 'profile' ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-slate-50 hover:bg-slate-100',
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm shrink-0">
              {currentUser.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser.grade} {currentUser.semester}</p>
            </div>
          </button>

          <button
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
          >
            <LogOut size={16} />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Single Compact Top Header with Inline Textbook + Unit Switcher */}
        <header className="px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 sticky top-0 bg-bg-main/90 backdrop-blur-md z-40 border-b border-slate-100/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl blue-gradient flex items-center justify-center text-white">
                <Zap size={16} />
              </div>
              <span className="text-base font-black text-slate-800">AceEnglish</span>
            </div>

            {showTextbookSelectors && textbooks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="选择教材"
                  value={selectedTextbookId}
                  onChange={(e) => handleSelectedTextbookChange(e.target.value)}
                  disabled={isTextbookLoading}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 max-w-[200px] sm:max-w-[240px] truncate"
                >
                  {textbooks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.grade}{item.semester} · {item.title}
                    </option>
                  ))}
                </select>

                {availableUnits.length > 0 && (
                  <select
                    aria-label="选择单元"
                    value={currentUnit?.id || ''}
                    onChange={(e) => handleSelectUnit(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-blue-600 outline-none focus:border-blue-500 max-w-[200px] sm:max-w-[260px] truncate"
                  >
                    {availableUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit} · {unit.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role === 'admin' && activeTab !== 'manage' && (
              <button
                onClick={() => setActiveTab('manage')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100"
              >
                <ShieldCheck size={14} />
                教师管理
              </button>
            )}
            <button
              onClick={() => setActiveTab('profile')}
              className="lg:hidden w-9 h-9 rounded-xl bg-blue-100 text-blue-600 font-black text-xs flex items-center justify-center"
              title="我的账号"
            >
              {currentUser.username.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {/* Auto Check-in Celebration Toast */}
        <AnimatePresence>
          {checkinToast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed top-16 right-4 sm:right-8 z-50 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-lg flex items-center gap-2 text-xs sm:text-sm font-bold"
            >
              <Sparkles size={16} />
              <span>{checkinToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Scroll Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-5 max-w-6xl mx-auto w-full pb-24 lg:pb-10">
          {textbookError && (
            <div className="mb-4 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-bold text-rose-600">
              {textbookError}
            </div>
          )}

          <AnimatePresence mode={isPresentationCapture ? 'sync' : 'wait'}>
            <motion.div
              key={activeTab}
              initial={isPresentationCapture ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isPresentationCapture ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: isPresentationCapture ? 0 : 0.16 }}
              className="h-full"
            >
              {!selectedTextbook && activeTab !== 'manage' && activeTab !== 'profile' ? (
                <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-100 text-center">
                  <BookOpen size={44} className="mx-auto mb-3 text-slate-300" />
                  <h3 className="text-lg font-bold text-slate-800">还没有可用教材</h3>
                  <p className="text-sm text-slate-500 mt-1.5">
                    {currentUser.role === 'admin' ? '请先在教师管理页导入教材，再开始学习。' : '请联系老师为你配置教材。'}
                  </p>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => setActiveTab('manage')}
                      className="mt-5 px-5 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-bold"
                    >
                      前往导入教材
                    </button>
                  )}
                </div>
              ) : activeTab === 'dashboard' ? (
                <StudentDashboard
                  currentUser={currentUser}
                  currentUnit={currentUnit}
                  studyState={studyState}
                  homeworkItems={studentHomework}
                  teacherFeedback={teacherFeedback}
                  currentTextbookId={selectedTextbookId}
                  getUnitLabel={(unitId) => {
                    const unit = availableUnits.find((item) => item.id === unitId);
                    return unit ? `${unit.unit} ${unit.title}`.trim() : unitId;
                  }}
                  onOpenStudySection={handleOpenStudySection}
                  onOpenStage={handleOpenStage}
                  onSwitchTextbook={handleSelectedTextbookChange}
                  onRefreshHomework={() => void loadStudentHomework()}
                  onRetryMistake={handleRetryMistake}
                  onOpenStats={() => setActiveTab('stats')}
                />
              ) : activeTab === 'study' ? (
                <TextbookModule
                  currentUnit={currentUnit}
                  studyState={studyState}
                  activeSection={studySection}
                  onChangeSection={setStudySection}
                  practiceSubMode={practiceSubMode}
                  onChangePracticeSubMode={setPracticeSubMode}
                  onSelectStage={handleSelectStage}
                  onOpenDashboard={() => setActiveTab('dashboard')}
                  onMarkWord={handleMarkWord}
                  onMarkSentenceFollowed={handleMarkSentenceFollowed}
                  onCompleteStage={handleCompleteStage}
                  onCompleteGrammarExercise={(exerciseId) => {
                    handleCompleteGrammarExercise(exerciseId);
                    resolveGrammarMistakesForExercise(exerciseId);
                  }}
                  onAddPronunciationAssessment={handleAddPronunciationAssessment}
                  onAddMistake={handleAddMistake}
                  onResolveMistake={handleResolveMistake}
                  onRecordAttempt={handleDictationAttempt}
                  onSubmitChallenge={handleChallengeSubmit}
                  scoreChallengeAnswer={scoreChallengeAnswer}
                  buildChallengeQuestions={buildChallengeQuestions}
                  getUnitChallengeStatus={getUnitChallengeStatus}
                  getChallengeHistoryForUnit={getChallengeHistoryForUnit}
                  classifyDictationIssue={classifyDictationIssue}
                  mistakeReasonLabels={MISTAKE_REASON_LABELS}
                  retryTarget={retryTarget}
                  onRetryTargetHandled={() => setRetryTarget(null)}
                  speak={speakWithAzure}
                  onVoiceInput={handleVoiceRecognize}
                  fetchSpeechToken={requestSpeechToken}
                />
              ) : activeTab === 'tutor' ? (
                <AITutorModule
                  currentUnit={currentUnit}
                  onCompleteStage={handleCompleteStage}
                  onAddMistake={handleAddMistake}
                  apiFetch={apiFetch}
                  fetchSpeechToken={requestSpeechToken}
                  speak={speakWithAzure}
                />
              ) : activeTab === 'stats' ? (
                <div className="space-y-6 pb-16">
                  <Statistics
                    studyState={studyState}
                    currentUnit={currentUnit}
                    onRetryMistake={handleRetryMistake}
                    onResolveMistake={handleResolveMistake}
                    mistakeReasonLabels={MISTAKE_REASON_LABELS}
                    getWeaknessSummary={getWeaknessSummary}
                    buildReviewPack={buildReviewPack}
                    stageMeta={STAGE_META}
                    onPracticeWeakWord={(word) => {
                      void speakWithAzure(word, 'US', 0.85);
                    }}
                  />
                  <GrowthPanel studyState={studyState} streak={getCheckinStreak(studyState.dailyCheckins)} />
                </div>
              ) : activeTab === 'profile' ? (
                <ProfileModule
                  currentUser={currentUser}
                  onPasswordChanged={(user, token) => {
                    setAuthToken(token);
                    setCurrentUser(user);
                  }}
                  onLogout={() => void handleLogout()}
                />
              ) : activeTab === 'manage' ? (
                <ManagementModule
                  textbooks={textbooks}
                  onTextbooksChanged={loadTextbooks}
                  apiFetch={apiFetch}
                  gradeOptions={GRADES}
                  semesterOptions={SEMESTERS}
                  defaultAIConfig={DEFAULT_AI_CONFIG}
                  buildUnitBundlesFromTextbook={buildUnitBundlesFromTextbook}
                  loadStudyStateForUser={loadStudyStateForUser}
                  createInitialStudyState={createInitialStudyState}
                  normalizeStudyState={normalizeStudyState}
                  getUnitChallengeStatus={getUnitChallengeStatus}
                  getCheckinStreak={getCheckinStreak}
                  buildSevenDayTrend={buildSevenDayTrend}
                  buildAgentOrchestration={buildAgentOrchestration}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Single Clean Bottom Navigation for Portrait Tablet / Mobile (< lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-100 px-2 py-2 z-50">
        <div
          className="grid gap-1 max-w-lg mx-auto"
          style={{ gridTemplateColumns: `repeat(${displayNavItems.length}, minmax(0, 1fr))` }}
        >
          {displayNavItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all',
                  active ? 'text-blue-600 bg-blue-50/70' : 'text-slate-400',
                )}
              >
                <item.icon size={20} />
                <span className="text-[11px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
