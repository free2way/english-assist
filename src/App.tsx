/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import Markdown from 'react-markdown';
import { 
  LayoutDashboard, 
  Mic2, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Bell, 
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Play,
  Clock,
  Star,
  Trophy,
  MessageSquare,
  Headphones,
  Zap,
  Check,
  X,
  RotateCw,
  Volume2,
  Lock,
  User,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  School,
  GraduationCap,
  PencilLine,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- Mock Data ---
const MOCK_TASKS = [
  { id: '1', title: '短文朗读：The Future of AI', type: 'reading', category: 'exam', status: 'completed', time: '19:00 - 19:30', description: '中考模拟题，重点练习连读与重音', score: 92 },
  { id: '2', title: 'AI 情景对话：School Life', type: 'dialogue', category: 'ai', status: 'ongoing', time: '19:30 - 20:00', description: '与 AI 外教讨论你的理想学校', score: 0 },
  { id: '3', title: '视频配音：Zootopia Clip', type: 'dubbing', category: 'fun', status: 'pending', time: '20:00 - 20:30', description: '模仿 Judy 的语气，练习情感表达', score: 0 },
  { id: '4', title: '听后转述：A Trip to London', type: 'retelling', category: 'exam', status: 'pending', time: '20:30 - 21:00', description: '高考模拟题，练习信息提取与整合', score: 0 },
];

const CHART_DATA = [
  { name: '11/16', tasks: 10, completed: 2 },
  { name: '11/17', tasks: 24, completed: 3 },
  { name: '11/18', tasks: 18, completed: 5 },
  { name: '11/19', tasks: 22, completed: 4 },
  { name: '11/20', tasks: 5, completed: 1 },
  { name: '11/21', tasks: 12, completed: 6 },
  { name: '11/22', tasks: 15, completed: 8 },
];

const PIE_DATA = [
  { name: '口语', value: 45, color: '#3b82f6' },
  { name: '听力', value: 30, color: '#8b5cf6' },
  { name: '词汇', value: 25, color: '#10b981' },
];

const FLTRP_VOCAB = [
  // 7年级上 (Grade 7 Semester 1)
  { id: 'v7u1_1', word: 'Pencil', phonetic: '/ˈpensl/', definition: '铅笔', example: 'Can I borrow your pencil?', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v7u1_2', word: 'Eraser', phonetic: '/ɪˈreɪzə(r)/', definition: '橡皮', example: 'I need an eraser.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v7u2_1', word: 'Classroom', phonetic: '/ˈklɑːsruːm/', definition: '教室', example: 'The classroom is clean.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v7u2_2', word: 'Student', phonetic: '/ˈstjuːdnt/', definition: '学生', example: 'He is a good student.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v7u3_1', word: 'English', phonetic: '/ˈɪŋɡlɪʃ/', definition: '英语', example: 'I like English.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v7u3_2', word: 'Teacher', phonetic: '/ˈtiːtʃə(r)/', definition: '老师', example: 'My teacher is very kind.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v7u4_1', word: 'Family', phonetic: '/ˈfæməli/', definition: '家庭', example: 'I love my family.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v7u4_2', word: 'Father', phonetic: '/ˈfɑːðə(r)/', definition: '父亲', example: 'My father is a doctor.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v7u5_1', word: 'Friend', phonetic: '/frend/', definition: '朋友', example: 'He is my best friend.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 5' },
  { id: 'v7u6_1', word: 'School', phonetic: '/skuːl/', definition: '学校', example: 'I go to school every day.', mastered: false, grade: '7年级', semester: '上学期', unit: 'Unit 6' },
  
  // 7年级下 (Grade 7 Semester 2)
  { id: 'v7d1_1', word: 'Library', phonetic: '/ˈlaɪbrəri/', definition: '图书馆', example: 'I often go to the library.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
  { id: 'v7d1_2', word: 'Subject', phonetic: '/ˈsʌbdʒɪkt/', definition: '科目；主题', example: 'What is your favorite subject?', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 1' },
  { id: 'v7d2_1', word: 'History', phonetic: '/ˈhɪstri/', definition: '历史', example: 'History is interesting.', mastered: false, grade: '7年级', semester: '下学期', unit: 'Unit 2' },

  // 8年级上 (Grade 8 Semester 1)
  { id: 'v8u1_1', word: 'Literature', phonetic: '/ˈlɪtrətʃə(r)/', definition: '文学；文学作品', example: 'She is a student of English literature.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v8u1_2', word: 'Culture', phonetic: '/ˈkʌltʃə(r)/', definition: '文化；文明', example: 'We should respect different cultures.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v8u2_1', word: 'Achievement', phonetic: '/əˈtʃiːvmənt/', definition: '成就；成绩', example: 'It was a remarkable achievement.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v8u3_1', word: 'Experience', phonetic: '/ɪkˈspɪəriəns/', definition: '经验；经历', example: 'He has a lot of experience.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v8u3_2', word: 'Journey', phonetic: '/ˈdʒɜːni/', definition: '旅行；旅程', example: 'The journey was long.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v8u4_1', word: 'Nature', phonetic: '/ˈneɪtʃə(r)/', definition: '自然', example: 'We should protect nature.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v8u5_1', word: 'Science', phonetic: '/ˈsaɪəns/', definition: '科学', example: 'Science is my favorite subject.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 5' },
  { id: 'v8u6_1', word: 'Future', phonetic: '/ˈfjuːtʃə(r)/', definition: '未来', example: 'I am excited about the future.', mastered: false, grade: '8年级', semester: '上学期', unit: 'Unit 6' },
  
  // 8年级下 (Grade 8 Semester 2)
  { id: 'v8d1_1', word: 'Challenge', phonetic: '/ˈtʃælɪndʒ/', definition: '挑战；艰巨任务', example: 'He accepted the challenge with a smile.', mastered: false, grade: '8年级', semester: '下学期', unit: 'Unit 1' },
  { id: 'v8d1_2', word: 'Opportunity', phonetic: '/ˌɒpəˈtjuːnəti/', definition: '机会；时机', example: 'Don\'t miss this opportunity.', mastered: false, grade: '8年级', semester: '下学期', unit: 'Unit 1' },
  { id: 'v8d2_1', word: 'Development', phonetic: '/dɪˈveləpmənt/', definition: '发展', example: 'The development of technology is fast.', mastered: false, grade: '8年级', semester: '下学期', unit: 'Unit 2' },

  // 9年级上 (Grade 9 Semester 1)
  { id: 'v9u1_1', word: 'Environment', phonetic: '/ɪnˈvaɪrənmənt/', definition: '环境', example: 'We must protect the environment.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v9u1_2', word: 'Pollution', phonetic: '/pəˈluːʃn/', definition: '污染', example: 'Air pollution is a serious problem.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v9u2_1', word: 'Resource', phonetic: '/rɪˈsɔːs/', definition: '资源', example: 'Water is a precious resource.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v9u3_1', word: 'Energy', phonetic: '/ˈenədʒi/', definition: '能量；能源', example: 'Solar energy is clean.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v9u4_1', word: 'Technology', phonetic: '/tekˈnɒlədʒi/', definition: '技术', example: 'New technology is everywhere.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v9u5_1', word: 'Space', phonetic: '/speɪs/', definition: '空间；太空', example: 'Space exploration is exciting.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 5' },
  { id: 'v9u6_1', word: 'Universe', phonetic: '/ˈjuːnɪvɜːs/', definition: '宇宙', example: 'The universe is vast.', mastered: false, grade: '9年级', semester: '上学期', unit: 'Unit 6' },

  // 10年级上 (Grade 10 Semester 1)
  { id: 'v10u1_1', word: 'Philosophy', phonetic: '/fəˈlɒsəfi/', definition: '哲学', example: 'He is studying Greek philosophy.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v10u1_2', word: 'Psychology', phonetic: '/saɪˈkɒlədʒi/', definition: '心理学', example: 'She has a degree in psychology.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v10u2_1', word: 'Civilization', phonetic: '/ˌsɪvəlaɪˈzeɪʃn/', definition: '文明', example: 'Ancient civilizations are fascinating.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v10u3_1', word: 'Literature', phonetic: '/ˈlɪtrətʃə(r)/', definition: '文学', example: 'I love classical literature.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v10u4_1', word: 'Architecture', phonetic: '/ˈɑːkɪtektʃə(r)/', definition: '建筑', example: 'The architecture is beautiful.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v10u5_1', word: 'Economy', phonetic: '/ɪˈkɒnəmi/', definition: '经济', example: 'The global economy is complex.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 5' },
  { id: 'v10u6_1', word: 'Politics', phonetic: '/ˈpɒlətɪks/', definition: '政治', example: 'He is interested in politics.', mastered: false, grade: '10年级', semester: '上学期', unit: 'Unit 6' },

  // 11年级上 (Grade 11 Semester 1)
  { id: 'v11u1_1', word: 'Technology', phonetic: '/tekˈnɒlədʒi/', definition: '技术；科技', example: 'Technology is changing our lives.', mastered: false, grade: '11年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v11u2_1', word: 'Innovation', phonetic: '/ˌɪnəˈveɪʃn/', definition: '创新', example: 'Innovation is key to success.', mastered: false, grade: '11年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v11u3_1', word: 'Communication', phonetic: '/kəˌmjuːnɪˈkeɪʃn/', definition: '沟通', example: 'Communication is vital.', mastered: false, grade: '11年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v11u4_1', word: 'Globalization', phonetic: '/ˌɡləʊbəlaɪˈzeɪʃn/', definition: '全球化', example: 'Globalization has many effects.', mastered: false, grade: '11年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v11u5_1', word: 'Sustainability', phonetic: '/səˌsteɪnəˈbɪləti/', definition: '可持续性', example: 'Sustainability is a goal.', mastered: false, grade: '11年级', semester: '上学期', unit: 'Unit 5' },
  { id: 'v11u6_1', word: 'Diversity', phonetic: '/daɪˈvɜːsəti/', definition: '多样性', example: 'Cultural diversity is rich.', mastered: false, grade: '11年级', semester: '上学期', unit: 'Unit 6' },

  // 12年级上 (Grade 12 Semester 1)
  { id: 'v12u1_1', word: 'University', phonetic: '/ˌjuːnɪˈvɜːsəti/', definition: '大学', example: 'He wants to go to a top university.', mastered: false, grade: '12年级', semester: '上学期', unit: 'Unit 1' },
  { id: 'v12u2_1', word: 'Graduation', phonetic: '/ˌɡrædʒuˈeɪʃn/', definition: '毕业', example: 'Graduation is a big milestone.', mastered: false, grade: '12年级', semester: '上学期', unit: 'Unit 2' },
  { id: 'v12u3_1', word: 'Career', phonetic: '/kəˈrɪə(r)/', definition: '职业', example: 'She is planning her career.', mastered: false, grade: '12年级', semester: '上学期', unit: 'Unit 3' },
  { id: 'v12u4_1', word: 'Ambition', phonetic: '/æmˈbɪʃn/', definition: '雄心；抱负', example: 'He has high ambitions.', mastered: false, grade: '12年级', semester: '上学期', unit: 'Unit 4' },
  { id: 'v12u5_1', word: 'Leadership', phonetic: '/ˈliːdəʃɪp/', definition: '领导力', example: 'Leadership is a skill.', mastered: false, grade: '12年级', semester: '上学期', unit: 'Unit 5' },
  { id: 'v12u6_1', word: 'Responsibility', phonetic: '/rɪˌspɒnsəˈbɪləti/', definition: '责任', example: 'With power comes responsibility.', mastered: false, grade: '12年级', semester: '上学期', unit: 'Unit 6' },
];

const MOCK_SENTENCES = [
  // 7年级
  { id: 's7u1', text: 'Practice makes perfect.', translation: '熟能生巧。', grade: '7年级', semester: '上学期', unit: 'Unit 1' },
  { id: 's7u2', text: 'The early bird catches the worm.', translation: '早起的鸟儿有虫吃。', grade: '7年级', semester: '上学期', unit: 'Unit 2' },
  { id: 's7d1', text: 'Where there is a will, there is a way.', translation: '有志者事竟成。', grade: '7年级', semester: '下学期', unit: 'Unit 1' },
  
  // 8年级
  { id: 's8u1', text: 'Actions speak louder than words.', translation: '行动胜于言语。', grade: '8年级', semester: '上学期', unit: 'Unit 1' },
  { id: 's8u2', text: 'Knowledge is power.', translation: '知识就是力量。', grade: '8年级', semester: '上学期', unit: 'Unit 2' },
  { id: 's8d1', text: 'A journey of a thousand miles begins with a single step.', translation: '千里之行始于足下。', grade: '8年级', semester: '下学期', unit: 'Unit 1' },

  // 9年级
  { id: 's9u1', text: 'Honesty is the best policy.', translation: '诚实是上策。', grade: '9年级', semester: '上学期', unit: 'Unit 1' },
  { id: 's9u2', text: 'Better late than never.', translation: '亡羊补牢，未为晚也。', grade: '9年级', semester: '上学期', unit: 'Unit 2' },

  // 10年级
  { id: 's10u1', text: 'A friend in need is a friend indeed.', translation: '患难见真情。', grade: '10年级', semester: '上学期', unit: 'Unit 1' },
  { id: 's10u2', text: 'Every cloud has a silver lining.', translation: '黑暗中总有一线光明。', grade: '10年级', semester: '上学期', unit: 'Unit 2' },

  // 11年级
  { id: 's11u1', text: 'Time and tide wait for no man.', translation: '岁月不待人。', grade: '11年级', semester: '上学期', unit: 'Unit 1' },
  
  // 12年级
  { id: 's12u1', text: 'Failure is the mother of success.', translation: '失败是成功之母。', grade: '12年级', semester: '上学期', unit: 'Unit 1' },
];

const GRADES = ['7年级', '8年级', '9年级', '10年级', '11年级', '12年级'];
const SEMESTERS = ['上学期', '下学期'];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6'];

interface AppUser {
  id: string;
  username: string;
  password: string;
  grade: string;
  semester: string;
  school: string;
  role: 'admin' | 'user';
}

interface AIConfig {
  provider: 'gemini' | 'openai';
  model: string;
  apiKey: string;
  baseURL?: string;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1'
};

// --- Components ---

const StatCard = ({ label, value, icon: Icon, colorClass }: any) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[100px] flex-1">
    <span className="text-slate-400 text-xs mb-1">{label}</span>
    <div className={cn("text-xl font-bold mb-1", colorClass)}>{value}</div>
    {Icon && <Icon size={16} className="text-slate-300" />}
  </div>
);

const TaskCard = ({ task }: any) => {
  const isCompleted = task.status === 'completed';
  const isOngoing = task.status === 'ongoing';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all"
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        task.category === 'exam' ? "bg-blue-50 text-blue-500" : 
        task.category === 'ai' ? "bg-purple-50 text-purple-500" : "bg-emerald-50 text-emerald-500"
      )}>
        {task.type === 'reading' && <Mic2 size={24} />}
        {task.type === 'dialogue' && <MessageSquare size={24} />}
        {task.type === 'dubbing' && <Play size={24} />}
        {task.type === 'retelling' && <Headphones size={24} />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-slate-800 truncate">{task.title}</h3>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            isCompleted ? "bg-emerald-100 text-emerald-600" : 
            isOngoing ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
          )}>
            {isCompleted ? '已完成' : isOngoing ? '进行中' : '待开始'}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate mb-2">{task.description}</p>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Clock size={12} /> {task.time}</span>
          {isCompleted && <span className="flex items-center gap-1 text-orange-500 font-bold"><Star size={12} fill="currentColor" /> {task.score} 分</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button className={cn(
          "px-4 py-2 rounded-full text-xs font-bold transition-all",
          isCompleted ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
        )}>
          {isCompleted ? '查看报告' : isOngoing ? '继续练习' : '开始任务'}
        </button>
      </div>
    </motion.div>
  );
};

// --- Views ---

const Dashboard = () => (
  <div className="space-y-6 pb-20">
    {/* Header Stats */}
    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
      <StatCard label="今日学习" value="1.5h" colorClass="text-blue-500" />
      <StatCard label="任务数量" value="2/5" colorClass="text-purple-500" />
      <StatCard label="完成率" value="40%" colorClass="text-emerald-500" />
      <StatCard label="积分成就" value="1280" icon={Trophy} colorClass="text-orange-500" />
    </div>

    {/* Calendar Section */}
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-blue-500" />
          <span className="font-bold text-slate-700">2026年3月第4周</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-full hover:bg-slate-50 text-slate-400"><ChevronLeft size={18} /></button>
          <button className="px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 text-xs font-bold">今天</button>
          <button className="p-1.5 rounded-full hover:bg-slate-50 text-slate-400"><ChevronRight size={18} /></button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, i) => (
          <div key={day} className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-slate-400">{day}</span>
            <div className={cn(
              "w-10 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
              i === 3 ? "bg-blue-500 text-white shadow-lg shadow-blue-200" : "bg-slate-50 text-slate-600"
            )}>
              <span className="text-xs font-bold">3/{23 + i}</span>
              <div className={cn("w-1.5 h-1.5 rounded-full", i === 3 ? "bg-white" : "bg-emerald-400")} />
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Task List */}
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <div className="w-1 h-5 bg-emerald-500 rounded-full" />
          我的学习计划
        </h2>
        <div className="flex gap-4 text-xs text-slate-400 font-medium">
          <button className="hover:text-blue-500">全部科目</button>
          <button className="hover:text-blue-500">完成优先</button>
        </div>
      </div>
      
      <div className="space-y-3">
        {MOCK_TASKS.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  </div>
);

const Statistics = () => (
  <div className="space-y-6 pb-20">
    <div className="flex gap-2 mb-4">
      <button className="px-4 py-1.5 rounded-full bg-blue-500 text-white text-xs font-bold">最近7天</button>
      <button className="px-4 py-1.5 rounded-full bg-white text-slate-500 text-xs font-bold border border-slate-100">最近30天</button>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">总任务数</div>
        <div className="text-xl font-bold text-blue-600">381</div>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">已完成</div>
        <div className="text-xl font-bold text-emerald-600">50</div>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-[10px] text-slate-400 mb-1">平均完成率</div>
        <div className="text-xl font-bold text-purple-600">13%</div>
      </div>
    </div>

    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
        <div className="w-1 h-4 bg-blue-500 rounded-full" />
        每日任务完成情况
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={CHART_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#f8fafc' }}
            />
            <Bar dataKey="tasks" fill="#bfdbfe" radius={[4, 4, 0, 0]} barSize={12} />
            <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
          分类时间占比
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={PIE_DATA}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {PIE_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {PIE_DATA.map(item => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-slate-500">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-1 h-4 bg-purple-500 rounded-full" />
          弱项诊断报告
        </h3>
        <div className="space-y-4">
          {[
            { label: '/θ/ 咬舌音', value: 65, color: 'bg-red-400' },
            { label: '连读技巧', value: 42, color: 'bg-orange-400' },
            { label: '重音节奏', value: 88, color: 'bg-emerald-400' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-600 font-medium">{item.label}</span>
                <span className="text-slate-400">{item.value}% 掌握</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const getAIConfig = (): AIConfig => {
  const savedConfig = localStorage.getItem('ace_ai_config');
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      // Ensure provider is set, default to gemini if missing from old saves
      if (!parsed.provider) {
        if (parsed.model && !parsed.model.startsWith('gemini')) {
          parsed.provider = 'openai';
        } else {
          parsed.provider = 'gemini';
        }
      }
      return { ...DEFAULT_AI_CONFIG, ...parsed };
    } catch (e) {
      console.error('Failed to parse AI config', e);
    }
  }
  return DEFAULT_AI_CONFIG;
};

const getBaseUrl = (url?: string) => {
  let baseUrl = (url || 'https://api.openai.com/v1').trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }
  return baseUrl.replace(/\/+$/, '');
};

const generateChatResponse = async (userText: string): Promise<string> => {
  const config = getAIConfig();
  if (!config.apiKey) throw new Error('请先在系统管理中配置 API Key');

  if (config.provider === 'openai') {
    const baseUrl = getBaseUrl(config.baseURL);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: "You are a friendly English tutor. Correct the student's grammar if necessary, but keep the conversation flowing. Use simple but natural English suitable for middle/high school students." },
          { role: 'user', content: `You are a friendly and professional English tutor. Help the student practice English. Keep responses concise and encouraging. Student says: ${userText}` }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch OpenAI response (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } else {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: [
        { role: 'user', parts: [{ text: `You are a friendly and professional English tutor. Help the student practice English. Keep responses concise and encouraging. Student says: ${userText}` }] }
      ],
      config: {
        systemInstruction: "You are a friendly English tutor. Correct the student's grammar if necessary, but keep the conversation flowing. Use simple but natural English suitable for middle/high school students."
      }
    });
    return response.text || 'Sorry, I encountered an error.';
  }
};

const generateTTS = async (text: string, accent: 'US' | 'UK'): Promise<boolean> => {
  const config = getAIConfig();
  if (!config.apiKey) return false;

  try {
    if (config.provider === 'openai') {
      const baseUrl = getBaseUrl(config.baseURL);
      const voice = accent === 'US' ? 'alloy' : 'onyx';
      const response = await fetch(`${baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice
        })
      });

      if (!response.ok) return false;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      return new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve(true);
        };
        audio.onerror = () => resolve(false);
        audio.play().catch(() => resolve(false));
      });
    } else {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const voiceName = accent === 'US' ? 'Zephyr' : 'Puck';
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) return false;

      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16Buffer = new Int16Array(bytes.buffer);
      const float32Buffer = new Float32Array(int16Buffer.length);
      for (let i = 0; i < int16Buffer.length; i++) {
        float32Buffer[i] = int16Buffer[i] / 32768.0;
      }

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const audioBuffer = audioContext.createBuffer(1, float32Buffer.length, 24000);
      audioBuffer.getChannelData(0).set(float32Buffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      return new Promise((resolve) => {
        source.onended = () => {
          audioContext.close();
          resolve(true);
        };
        source.start();
      });
    }
  } catch (error) {
    return false;
  }
};

const playBrowserTTS = (text: string, accent: 'US' | 'UK', rate: number = 1.0): Promise<boolean> => {
  return new Promise((resolve) => {
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
      selectedVoice = voices.find(v => v.name.includes(name));
      if (selectedVoice) break;
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang === lang) || voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    
    window.speechSynthesis.speak(utterance);
  });
};

const playDictationAudio = async (text: string, mode: 'word' | 'sentence', accent: 'US' | 'UK'): Promise<boolean> => {
  if (mode === 'word') {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`);
      if (response.ok) {
        const data = await response.json();
        const phonetics = data[0]?.phonetics || [];
        let audioUrl = '';
        
        const suffix = accent === 'US' ? '-us.mp3' : '-uk.mp3';
        const specificAudio = phonetics.find((p: any) => p.audio && p.audio.endsWith(suffix));
        
        if (specificAudio) {
          audioUrl = specificAudio.audio;
        } else {
          const anyAudio = phonetics.find((p: any) => p.audio);
          if (anyAudio) audioUrl = anyAudio.audio;
        }
        
        if (audioUrl) {
          const success = await new Promise<boolean>((resolve) => {
            const audio = new Audio(audioUrl);
            audio.onended = () => resolve(true);
            audio.onerror = () => resolve(false);
            audio.play().catch(() => resolve(false));
          });
          if (success) return true;
        }
      }
    } catch (e) {
      console.error('Dictionary API failed', e);
    }
  }

  try {
    const lang = accent === 'US' ? 'en-US' : 'en-GB';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
    const success = await new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => resolve(true);
      audio.onerror = () => resolve(false);
      audio.play().catch(() => resolve(false));
    });
    if (success) return true;
  } catch (e) {
    console.error('Google TTS failed', e);
  }

  return false;
};

const AITutor = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Hello! I am your AI English tutor. Today let\'s talk about your school life. What is your favorite subject and why?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [accent, setAccent] = useState<'US' | 'UK'>('US');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = accent === 'US' ? 'en-US' : 'en-GB';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许使用麦克风。');
        } else if (event.error === 'network') {
          alert('语音识别网络错误，请检查网络连接或尝试使用科学上网。');
        } else if (event.error !== 'no-speech') {
          alert(`语音识别发生错误: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [accent]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别功能，推荐使用 Chrome 或 Edge 浏览器。');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        alert('无法启动麦克风，请检查权限设置或刷新页面重试。');
        setIsListening(false);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const aiResponse = await generateChatResponse(userText);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
      
      // Auto-speak the AI response
      speakText(aiResponse, messages.length + 1);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${error.message || 'Something went wrong'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string, index: number) => {
    if (isSpeaking !== null) return;
    setIsSpeaking(index);

    try {
      const success = await generateTTS(text, accent);
      if (success) {
        setIsSpeaking(null);
        return;
      }
    } catch (error) {
      console.error('TTS Error:', error);
    }

    // Fallback to browser TTS if API TTS fails or no key
    await playBrowserTTS(text, accent);
    setIsSpeaking(null);
  };

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl blue-gradient flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Zap size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">AI 私人外教</h2>
              <p className="text-sm text-slate-500">正在讨论：School Life & Hobbies</p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setAccent('US')}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", accent === 'US' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
            >
              美式 (US)
            </button>
            <button 
              onClick={() => setAccent('UK')}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", accent === 'UK' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
            >
              英式 (UK)
            </button>
          </div>
        </div>
        
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 mb-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs",
                msg.role === 'ai' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
              )}>
                {msg.role === 'ai' ? 'AI' : '我'}
              </div>
              <div className="flex flex-col gap-1 max-w-[80%]">
                <div className={cn(
                  "p-4 rounded-2xl text-sm",
                  msg.role === 'ai' 
                    ? "bg-slate-50 rounded-tl-none text-slate-700" 
                    : "bg-blue-500 rounded-tr-none text-white shadow-md shadow-blue-100"
                )}>
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
                {msg.role === 'ai' && (
                  <button 
                    onClick={() => speakText(msg.text, idx)}
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-bold transition-all",
                      isSpeaking === idx ? "text-blue-500" : "text-slate-400 hover:text-blue-500"
                    )}
                  >
                    {isSpeaking === idx ? <RotateCw size={10} className="animate-spin" /> : <Volume2 size={10} />}
                    {isSpeaking === idx ? '正在播放...' : '播放音频'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">AI</div>
              <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none text-sm text-slate-400 flex items-center gap-2">
                <RotateCw size={14} className="animate-spin" />
                AI 正在思考中...
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button 
              onClick={toggleListening}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              )}
            >
              <Mic2 size={18} />
            </button>
          </div>
          <input 
            type="text" 
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "正在倾听..." : "用英语和外教聊聊吧..."}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-16 pr-14 text-sm outline-none focus:border-blue-500 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl blue-gradient text-white flex items-center justify-center shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            <Play size={18} />
          </button>
        </div>
      </div>

      {/* Scaffolding Tools */}
      <div className="grid grid-cols-3 gap-3">
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center hover:bg-slate-50 transition-all">
          <div className="text-[10px] text-slate-400 mb-1">关键词提示</div>
          <div className="text-xs font-bold text-blue-600">Literature, Culture</div>
        </button>
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center hover:bg-slate-50 transition-all">
          <div className="text-[10px] text-slate-400 mb-1">句式模板</div>
          <div className="text-xs font-bold text-purple-600">Not only... but also</div>
        </button>
        <button className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center hover:bg-slate-50 transition-all">
          <div className="text-[10px] text-slate-400 mb-1">参考范文</div>
          <div className="text-xs font-bold text-emerald-600">My School Life</div>
        </button>
      </div>
    </div>
  );
};

const VocabularyModule = () => {
  const [selectedGrade, setSelectedGrade] = useState('7年级');
  const [selectedSemester, setSelectedSemester] = useState('上学期');
  const [selectedUnit, setSelectedUnit] = useState('Unit 1');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);

  const filteredVocab = FLTRP_VOCAB.filter(v => 
    v.grade === selectedGrade && 
    v.semester === selectedSemester && 
    v.unit === selectedUnit
  );
  const currentWord = filteredVocab[currentIndex] || filteredVocab[0];

  const handleNext = (mastered: boolean) => {
    if (mastered) setMasteredCount(prev => prev + 1);
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredVocab.length);
    }, 150);
  };

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    setSelectedSemester('上学期');
    setSelectedUnit('Unit 1');
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredCount(0);
  };

  const handleSemesterChange = (semester: string) => {
    setSelectedSemester(semester);
    setSelectedUnit('Unit 1');
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredCount(0);
  };

  const handleUnitChange = (unit: string) => {
    setSelectedUnit(unit);
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredCount(0);
  };

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex flex-col mb-6 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">单词背记</h2>
            <p className="text-sm text-slate-500">外研社版 - {selectedGrade} {selectedSemester} {selectedUnit}</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold text-blue-600 shrink-0">
            已掌握: {masteredCount} / {filteredVocab.length}
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">年级:</span>
            {GRADES.map(grade => (
              <button
                key={grade}
                onClick={() => handleGradeChange(grade)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                  selectedGrade === grade 
                    ? "bg-blue-500 text-white shadow-md shadow-blue-100" 
                    : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {grade}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">学期:</span>
            {SEMESTERS.map(sem => (
              <button
                key={sem}
                onClick={() => handleSemesterChange(sem)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                  selectedSemester === sem 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" 
                    : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {sem}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">单元:</span>
            {UNITS.map(unit => (
              <button
                key={unit}
                onClick={() => handleUnitChange(unit)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                  selectedUnit === unit 
                    ? "bg-purple-500 text-white shadow-md shadow-purple-100" 
                    : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Flashcard */}

      <div className="flex-1 flex flex-col items-center justify-center perspective-1000">
        {filteredVocab.length > 0 ? (
          <motion.div 
            key={`${selectedGrade}-${currentIndex}`}
            className="relative w-full max-w-sm aspect-[3/4] cursor-pointer preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-4xl font-black text-slate-800 mb-4 tracking-tight">{currentWord.word}</div>
              <div className="text-slate-400 font-mono mb-8">{currentWord.phonetic}</div>
              <button className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-all">
                <Volume2 size={24} />
              </button>
              <div className="mt-auto text-[10px] text-slate-300 flex items-center gap-1">
                <RotateCw size={10} /> 点击翻转查看释义
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden bg-blue-600 rounded-[2rem] shadow-xl text-white flex flex-col p-8 rotate-y-180">
              <div className="text-xl font-bold mb-2 opacity-60">{currentWord.word}</div>
              <div className="h-px w-full bg-white/20 mb-6" />
              <div className="text-2xl font-bold mb-4">{currentWord.definition}</div>
              <div className="text-sm opacity-80 italic leading-relaxed">
                "{currentWord.example}"
              </div>
              <div className="mt-auto flex justify-center">
                <button className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center">
                  <Volume2 size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="text-slate-400 text-center">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p>该年级暂无单词数据</p>
          </div>
        )}
      </div>

      {/* Controls */}
      {filteredVocab.length > 0 && (
        <div className="mt-8 flex justify-center gap-6">
          <button 
            onClick={() => handleNext(false)}
            className="w-16 h-16 rounded-full bg-white border border-slate-100 shadow-lg flex items-center justify-center text-red-500 hover:scale-110 active:scale-95 transition-all"
          >
            <X size={32} />
          </button>
          <button 
            onClick={() => handleNext(true)}
            className="w-16 h-16 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all"
          >
            <Check size={32} />
          </button>
        </div>
      )}
    </div>
  );
};

const DictationModule = () => {
  const [grade, setGrade] = useState('7年级');
  const [semester, setSemester] = useState('上学期');
  const [unit, setUnit] = useState('Unit 1');
  const [mode, setMode] = useState<'word' | 'sentence'>('word');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showResult, setShowResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const currentData = mode === 'word' 
    ? FLTRP_VOCAB.filter(v => v.grade === grade && v.semester === semester && v.unit === unit)
    : MOCK_SENTENCES.filter(s => s.grade === grade && s.semester === semester && s.unit === unit);

  const currentItem = currentData[currentIndex];

  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = async () => {
    if (!currentItem || isSpeaking) return;
    setIsSpeaking(true);

    const text = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;

    try {
      // 1. Try high-quality dictation audio (Dictionary API / Google TTS)
      let success = await playDictationAudio(text, mode, 'US');
      
      // 2. Fallback to AI TTS if configured
      if (!success) {
        success = await generateTTS(text, 'US');
      }
      
      // 3. Fallback to improved Browser TTS
      if (!success) {
        await playBrowserTTS(text, 'US', 0.9); // slightly slower for dictation
      }
    } catch (error) {
      await playBrowserTTS(text, 'US', 0.9);
    } finally {
      setIsSpeaking(false);
    }
  };

  const checkAnswer = () => {
    if (!currentItem) return;
    const target = mode === 'word' ? (currentItem as any).word : (currentItem as any).text;
    
    // Simple normalization: trim and lower case for comparison
    const normalizedInput = userInput.trim().toLowerCase().replace(/[.,!?;:]/g, '');
    const normalizedTarget = target.trim().toLowerCase().replace(/[.,!?;:]/g, '');

    if (normalizedInput === normalizedTarget) {
      setShowResult('correct');
      setScore(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
    } else {
      setShowResult('wrong');
      setScore(prev => ({ ...prev, total: prev.total + 1 }));
    }
  };

  const nextItem = () => {
    setUserInput('');
    setShowResult('none');
    setCurrentIndex(prev => (prev + 1) % currentData.length);
  };

  const reset = () => {
    setCurrentIndex(0);
    setUserInput('');
    setShowResult('none');
    setScore({ correct: 0, total: 0 });
  };

  return (
    <div className="h-full flex flex-col pb-20">
      <div className="flex flex-col mb-6 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">听写训练</h2>
            <p className="text-sm text-slate-500">外研社版 - {grade} {semester} {unit}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">年级:</span>
            {GRADES.map(g => (
              <button
                key={g}
                onClick={() => { setGrade(g); setSemester('上学期'); setUnit('Unit 1'); reset(); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                  grade === g 
                    ? "bg-blue-500 text-white shadow-md shadow-blue-100" 
                    : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">学期:</span>
            {SEMESTERS.map(s => (
              <button
                key={s}
                onClick={() => { setSemester(s); setUnit('Unit 1'); reset(); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                  semester === s 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" 
                    : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">单元:</span>
            {UNITS.map(u => (
              <button
                key={u}
                onClick={() => { setUnit(u); reset(); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0",
                  unit === u 
                    ? "bg-purple-500 text-white shadow-md shadow-purple-100" 
                    : "bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex gap-2 mb-6">
          <button 
            onClick={() => { setMode('word'); reset(); }}
            className={cn(
              "flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              mode === 'word' ? "bg-blue-500 text-white shadow-lg shadow-blue-100" : "bg-slate-50 text-slate-500"
            )}
          >
            <BookOpen size={18} />
            单词听写
          </button>
          <button 
            onClick={() => { setMode('sentence'); reset(); }}
            className={cn(
              "flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              mode === 'sentence' ? "bg-purple-500 text-white shadow-lg shadow-purple-100" : "bg-slate-50 text-slate-500"
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
                  "w-24 h-24 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-inner",
                  isSpeaking ? "bg-blue-100 text-blue-500 animate-pulse" : "bg-blue-50 text-blue-500"
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
                  onChange={e => setUserInput(e.target.value)}
                  disabled={showResult !== 'none'}
                  className={cn(
                    "w-full bg-slate-50 border rounded-2xl p-6 text-center text-lg font-bold outline-none transition-all resize-none h-32",
                    showResult === 'correct' ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                    showResult === 'wrong' ? "border-red-500 bg-red-50 text-red-700" :
                    "border-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  )}
                  placeholder={mode === 'word' ? "Type the word here..." : "Type the sentence here..."}
                />
                <AnimatePresence>
                  {showResult !== 'none' && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -top-4 -right-4 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    >
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
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3"
                >
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <div>
                    <p className="text-xs font-bold text-red-800 mb-1">正确答案：</p>
                    <p className="text-sm text-red-700 font-mono">{mode === 'word' ? (currentItem as any).word : (currentItem as any).text}</p>
                    {mode === 'sentence' && <p className="text-[10px] text-red-500 mt-1">{(currentItem as any).translation}</p>}
                  </div>
                </motion.div>
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
                <button 
                  onClick={nextItem}
                  className="w-full bg-slate-800 py-4 rounded-2xl text-white font-bold shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  下一题
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-300">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p>该年级暂无{mode === 'word' ? '单词' : '句子'}听写数据</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">当前进度</div>
          <div className="font-bold text-slate-700">{currentIndex + 1} / {currentData.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">正确率</div>
          <div className="font-bold text-emerald-500">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</div>
        </div>
      </div>
    </div>
  );
};

const ManagementModule = () => {
  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('ace_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('ace_ai_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.provider) {
          if (parsed.model && !parsed.model.startsWith('gemini')) {
            parsed.provider = 'openai';
          } else {
            parsed.provider = 'gemini';
          }
        }
        return { ...DEFAULT_AI_CONFIG, ...parsed };
      } catch (e) {}
    }
    return DEFAULT_AI_CONFIG;
  });

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    grade: '7年级',
    semester: '上学期',
    school: ''
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;

    const user: AppUser = {
      id: Date.now().toString(),
      ...newUser,
      role: 'user'
    };

    const updatedUsers = [...users, user];
    setUsers(updatedUsers);
    localStorage.setItem('ace_users', JSON.stringify(updatedUsers));
    setNewUser({ username: '', password: '', grade: '7年级', semester: '上学期', school: '' });
  };

  const handleDeleteUser = (id: string) => {
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    localStorage.setItem('ace_users', JSON.stringify(updatedUsers));
  };

  const handleSaveAIConfig = () => {
    setSaveStatus('saving');
    localStorage.setItem('ace_ai_config', JSON.stringify(aiConfig));
    setTimeout(() => {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-100">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">系统管理</h2>
          <p className="text-sm text-slate-500">管理用户账号与 AI 配置</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Plus size={18} className="text-blue-500" />
              新增用户
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">用户名</label>
                  <input 
                    type="text" 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">密码</label>
                  <input 
                    type="password" 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="设置初始密码"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">年级</label>
                  <select 
                    value={newUser.grade}
                    onChange={e => setNewUser({...newUser, grade: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">学期</label>
                  <select 
                    value={newUser.semester}
                    onChange={e => setNewUser({...newUser, semester: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                  >
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">学校</label>
                  <input 
                    type="text" 
                    value={newUser.school}
                    onChange={e => setNewUser({...newUser, school: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="请输入学校名称"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all"
              >
                添加新用户
              </button>
            </form>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User size={18} className="text-blue-500" />
                用户列表
              </span>
              <span className="text-xs text-slate-400 font-normal">共 {users.length} 名用户</span>
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {users.length === 0 ? (
                <div className="text-center py-10 text-slate-300 italic text-sm">暂无普通用户</div>
              ) : (
                users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{user.username}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5"><GraduationCap size={10} /> {user.grade} · {user.semester}</span>
                          <span className="flex items-center gap-0.5"><School size={10} /> {user.school}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Configuration */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Zap size={18} className="text-purple-500" />
              AI 模型配置
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">选择模型提供商</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAiConfig({...aiConfig, provider: 'gemini', model: 'gemini-3-flash-preview'})}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                      aiConfig.provider === 'gemini' ? "bg-purple-500 text-white shadow-md shadow-purple-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    Google Gemini
                  </button>
                  <button
                    onClick={() => setAiConfig({...aiConfig, provider: 'openai', model: 'gpt-4o-mini', baseURL: 'https://api.openai.com/v1'})}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                      aiConfig.provider === 'openai' ? "bg-purple-500 text-white shadow-md shadow-purple-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    OpenAI 兼容接口
                  </button>
                </div>
              </div>

              {aiConfig.provider === 'gemini' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 ml-2">选择模型</label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (推荐)', desc: '低延迟，高效率' },
                      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: '更强的逻辑推理能力' },
                      { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', desc: '极速响应' }
                    ].map(model => (
                      <button
                        key={model.id}
                        onClick={() => setAiConfig({...aiConfig, model: model.id})}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          aiConfig.model === model.id 
                            ? "bg-purple-50 border-purple-200 ring-4 ring-purple-500/5" 
                            : "bg-slate-50 border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div>
                          <div className={cn("font-bold text-sm", aiConfig.model === model.id ? "text-purple-700" : "text-slate-700")}>
                            {model.name}
                          </div>
                          <div className="text-[10px] text-slate-400">{model.desc}</div>
                        </div>
                        {aiConfig.model === model.id && <Check size={18} className="text-purple-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 ml-2">Base URL</label>
                    <input 
                      type="text" 
                      value={aiConfig.baseURL || ''}
                      onChange={e => setAiConfig({...aiConfig, baseURL: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                      placeholder="例如: https://api.openai.com/v1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 ml-2">模型名称</label>
                    <input 
                      type="text" 
                      value={aiConfig.model}
                      onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
                      placeholder="例如: gpt-4o, deepseek-chat"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-2">API Key</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="password" 
                    value={aiConfig.apiKey}
                    onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-purple-500 transition-all"
                    placeholder={aiConfig.provider === 'gemini' ? "请输入您的 Gemini API Key" : "请输入您的 API Key"}
                  />
                </div>
                <p className="text-[10px] text-slate-400 ml-2">
                  * API Key 将仅保存在本地浏览器中
                </p>
              </div>

              <button 
                onClick={handleSaveAIConfig}
                disabled={saveStatus !== 'idle'}
                className={cn(
                  "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                  saveStatus === 'success' 
                    ? "bg-emerald-500 text-white" 
                    : "bg-purple-600 text-white shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-95"
                )}
              >
                {saveStatus === 'saving' ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : saveStatus === 'success' ? (
                  <>
                    <Check size={18} />
                    配置已保存
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    保存 AI 配置
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
            <h4 className="text-orange-800 font-bold text-sm mb-2 flex items-center gap-2">
              <Bell size={16} />
              管理提示
            </h4>
            <ul className="text-xs text-orange-700 space-y-2 opacity-80">
              <li>• 新增用户后，他们可以使用设置的密码登录。</li>
              <li>• AI 模型配置将影响全站的对话与辅导功能。</li>
              <li>• 默认管理员账号 (admin) 无法在此处删除。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const Login = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    
    // Check default admin
    if (trimmedUsername.toLowerCase() === 'admin' && trimmedPassword === 'admin1234') {
      onLogin({ username: 'admin', role: 'admin', grade: '管理员', semester: '全学期', school: '系统' });
      return;
    }

    // Check custom users
    const savedUsers = localStorage.getItem('ace_users');
    if (savedUsers) {
      const users: AppUser[] = JSON.parse(savedUsers);
      const foundUser = users.find(u => u.username.toLowerCase() === trimmedUsername.toLowerCase() && u.password === trimmedPassword);
      if (foundUser) {
        onLogin(foundUser);
        return;
      }
    }

    setError('用户名或密码错误');
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-blue-500/10 p-10 border border-slate-100"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl blue-gradient flex items-center justify-center text-white shadow-xl shadow-blue-200 mx-auto mb-6">
            <Zap size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">AceEnglish</h1>
          <p className="text-slate-400 text-sm">请输入管理员账号登录</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-4 uppercase tracking-wider">用户名</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-4 uppercase tracking-wider">密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs font-bold text-center"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            className="w-full blue-gradient py-4 rounded-2xl text-white font-black shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all mt-4"
          >
            登录系统
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
            AceEnglish Management System v1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: '首页', icon: LayoutDashboard },
    { id: 'vocab', label: '单词', icon: BookOpen },
    { id: 'dictation', label: '听写', icon: PencilLine },
    { id: 'tutor', label: 'AI外教', icon: Mic2, primary: true },
    { id: 'stats', label: '统计', icon: BarChart3 },
    { id: 'profile', label: '我的', icon: Settings },
  ];

  // Add management tab for admin
  const displayNavItems = currentUser?.role === 'admin' 
    ? [...navItems, { id: 'manage', label: '管理', icon: ShieldCheck }]
    : navItems;

  if (!currentUser) {
    return <Login onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-bg-main flex flex-col md:flex-row font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col p-6 sticky top-0 h-screen">
        <div className="mb-10">
          <h1 className="text-2xl font-black text-blue-600 tracking-tight">AceEnglish</h1>
          <p className="text-[10px] text-slate-400 mt-1">英语听说提分管家</p>
        </div>

        <nav className="flex-1 space-y-2">
          {displayNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all",
                activeTab === item.id 
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-100" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <item.icon size={20} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 overflow-hidden">
                <img src="https://picsum.photos/seed/user/100/100" alt="Avatar" referrerPolicy="no-referrer" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</p>
                <p className="text-[10px] text-slate-400">{currentUser.school} · {currentUser.grade} {currentUser.semester || '上学期'}</p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-3/4" />
            </div>
          </div>
          
          <button 
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-400 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Mobile & Desktop) */}
        <header className="p-6 flex items-center justify-between sticky top-0 bg-bg-main/80 backdrop-blur-md z-40">
          <div className="md:hidden">
            <h1 className="text-xl font-black text-blue-600 tracking-tight">AceEnglish</h1>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>学习中心</span>
              <ChevronRight size={14} />
              <span className="text-slate-800 font-bold">
                {displayNavItems.find(i => i.id === activeTab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center bg-white border border-slate-100 rounded-full px-4 py-2 shadow-sm">
              <Search size={16} className="text-slate-400 mr-2" />
              <input type="text" placeholder="搜索课程或单词..." className="bg-transparent text-xs outline-none w-32 lg:w-48" />
            </div>
            <button className="relative w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
              <Bell size={20} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 px-6 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'vocab' && <VocabularyModule />}
              {activeTab === 'dictation' && <DictationModule />}
              {activeTab === 'tutor' && <AITutor />}
              {activeTab === 'stats' && <Statistics />}
              {activeTab === 'manage' && <ManagementModule />}
              {(activeTab === 'exam' || activeTab === 'profile') && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                  <Mic2 size={64} className="mb-4 opacity-20" />
                  <p className="font-bold">{displayNavItems.find(i => i.id === activeTab)?.label}模块开发中</p>
                  <p className="text-xs">即将上线，敬请期待</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 py-3 flex justify-between items-center z-50">
        {displayNavItems.map((item) => (
          item.primary ? (
            <div key={item.id} className="relative -top-6">
              <button 
                onClick={() => setActiveTab(item.id)}
                className="w-14 h-14 rounded-full blue-gradient flex items-center justify-center text-white shadow-xl shadow-blue-200 active:scale-95 transition-all"
              >
                <item.icon size={28} />
              </button>
            </div>
          ) : (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn("flex flex-col items-center gap-1 transition-all", activeTab === item.id ? "text-blue-500" : "text-slate-400")}
            >
              <item.icon size={24} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          )
        ))}
      </nav>
    </div>
  );
}
