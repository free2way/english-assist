import express from 'express';
import {
  changePassword,
  cleanupExpiredSessions,
  createSessionForCredentials,
  createUser,
  deleteSession,
  deleteUser,
  getAIServiceConfig,
  getStudyState,
  getUserByToken,
  getTextbookContent,
  listStudyStates,
  upsertStudyState,
  importAllTextbookSamples,
  importTextbookSample,
  listUsers,
  listTextbookSamples,
  listTextbooks,
  updateAIServiceConfig,
  updateSelectedTextbookForUser,
  type AuthUser,
} from './db.js';

export const app = express();

app.use(express.json());

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY?.trim();
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION?.trim();

// Azure Speech STS tokens are valid for 10 minutes. The browser asks for a token
// before every TTS playback and every pronunciation assessment, so caching it
// here keeps a full STS round trip out of the critical path of each recording.
const SPEECH_TOKEN_TTL_MS = 9 * 60 * 1000;
const SPEECH_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
let speechTokenCache: { token: string; expiresAt: number } | null = null;
let speechTokenInflight: Promise<string> | null = null;

const requestSpeechToken = async (): Promise<string> => {
  const cached = speechTokenCache;
  if (cached && cached.expiresAt - Date.now() > SPEECH_TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }

  if (!speechTokenInflight) {
    speechTokenInflight = (async () => {
      const response = await fetch(`https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY as string,
          'Content-Length': '0',
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Azure Speech token 获取失败: ${message || response.statusText}`);
      }

      const token = await response.text();
      speechTokenCache = { token, expiresAt: Date.now() + SPEECH_TOKEN_TTL_MS };
      return token;
    })().finally(() => {
      speechTokenInflight = null;
    });
  }

  return speechTokenInflight;
};

const getBearerToken = (header?: string) => {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    await cleanupExpiredSessions();
    const token = getBearerToken(req.header('authorization'));
    if (!token) {
      res.status(401).json({ error: '未登录' });
      return;
    }

    const user = await getUserByToken(token);
    if (!user) {
      res.status(401).json({ error: '登录已失效，请重新登录' });
      return;
    }

    (req as express.Request & { user: AuthUser; token: string }).user = user;
    (req as express.Request & { user: AuthUser; token: string }).token = token;
    next();
  } catch {
    res.status(500).json({ error: '鉴权失败' });
  }
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as express.Request & { user: AuthUser }).user;
  if (user.role !== 'admin') {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, driver: 'turso-libsql' });
});

// Cheap brute-force guard for the login endpoint. In-memory means each
// serverless instance keeps its own window, which still stops sustained
// password guessing from a single client.
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const checkLoginRateLimit = (key: string) => {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
};

app.get('/api/speech-token', requireAuth, async (_req, res) => {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    res.status(503).json({ error: 'Azure Speech 未配置，请设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION' });
    return;
  }

  try {
    const token = await requestSpeechToken();
    const expiresInSeconds = speechTokenCache
      ? Math.max(60, Math.floor((speechTokenCache.expiresAt - Date.now()) / 1000))
      : 600;
    res.json({
      token,
      region: AZURE_SPEECH_REGION,
      expiresInSeconds,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Azure Speech token 获取失败',
    });
  }
});

const AI_TUTOR_SYSTEM_PROMPT =
  'You are a friendly English speaking tutor for Chinese middle school students. Keep answers concise, encouraging and useful for oral practice.';
const AI_COACH_SYSTEM_PROMPT = `${AI_TUTOR_SYSTEM_PROMPT}
Always answer with STRICT JSON only (no markdown fences, no extra text) in this shape:
{"reply":"<1-3 short English sentences>","corrections":[{"original":"<the exact problematic phrase from the student>","corrected":"<fixed English>","reason":"<short Chinese reason>"}],"followUp":"<one short English follow-up question>"}
Rules: at most 2 corrections and only for real grammar / word-choice / tense problems; if the sentence is fine return an empty corrections array; never invent text the student did not write; keep every string short and age-appropriate.`;

const AI_MAX_MESSAGE_LENGTH = 2000;

/** Upstream providers wrap failures differently - OpenAI sends {error:{...}}
 *  while Google's OpenAI-compatible endpoint sends [{error:{...}}]. Surface the
 *  real cause (e.g. "Please pass a valid API key") instead of a bare status. */
const describeUpstreamAiError = (data: any, rawText: string, status: number) => {
  const candidate = Array.isArray(data) ? data[0] : data;
  const message = candidate?.error?.message || candidate?.message;
  if (typeof message === 'string' && message.trim()) {
    return `AI 服务调用失败：${message.trim()}`;
  }
  const snippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 200);
  return snippet ? `AI 服务调用失败 (${status})：${snippet}` : `AI 服务调用失败 (${status})`;
};

const extractJsonObject = (raw: string): any | null => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

const normalizeCorrections = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item: any) => ({
      original: typeof item.original === 'string' ? item.original.trim().slice(0, 300) : '',
      corrected: typeof item.corrected === 'string' ? item.corrected.trim().slice(0, 300) : '',
      reason: typeof item.reason === 'string' ? item.reason.trim().slice(0, 300) : '',
    }))
    .filter((item) => item.original && item.corrected)
    .slice(0, 2);
};

app.get('/api/study/state', requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user;
  const textbookId = typeof req.query?.textbookId === 'string' ? req.query.textbookId.trim() : '';
  if (!textbookId) {
    res.status(400).json({ error: '缺少 textbookId' });
    return;
  }

  const record = await getStudyState(user.id, textbookId);
  res.json({ state: record?.state ?? null, updatedAt: record?.updatedAt ?? null });
});

app.put('/api/study/state', requireAuth, async (req, res) => {
  const user = (req as express.Request & { user: AuthUser }).user;
  const textbookId = typeof req.body?.textbookId === 'string' ? req.body.textbookId.trim() : '';
  const state = req.body?.state;
  if (!textbookId || typeof state !== 'object' || state === null) {
    res.status(400).json({ error: '缺少 textbookId 或 state' });
    return;
  }

  const serialized = JSON.stringify(state);
  if (serialized.length > 200_000) {
    res.status(413).json({ error: '学习数据过大，已拒绝同步' });
    return;
  }

  const updatedAt = typeof req.body?.updatedAt === 'string' && req.body.updatedAt
    ? req.body.updatedAt
    : new Date().toISOString();
  const saved = await upsertStudyState(user.id, textbookId, state, updatedAt);
  res.json({ ok: true, updatedAt: saved.updatedAt });
});

app.get('/api/admin/study-states', requireAuth, requireAdmin, async (_req, res) => {
  res.json({ states: await listStudyStates() });
});

app.post('/api/ai/chat', requireAuth, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    res.status(400).json({ error: '请输入要发送给 AI 的内容' });
    return;
  }
  if (message.length > AI_MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `单次发送内容过长（上限 ${AI_MAX_MESSAGE_LENGTH} 字）` });
    return;
  }

  // Structured mode: the tutor also returns corrections so the client can feed
  // them into the mistake book instead of leaving the chat without feedback.
  const wantCorrections = req.body?.corrections === true;
  const context = typeof req.body?.context === 'string' ? req.body.context.slice(0, 800) : '';
  const task = typeof req.body?.task === 'string' ? req.body.task.slice(0, 40) : 'chat';

  const config = await getAIServiceConfig({ includeSecret: true });
  if (!config.apiKey) {
    res.status(503).json({ error: 'AI 服务未配置，请管理员在系统管理中配置 API Key' });
    return;
  }

  const systemContent = wantCorrections
    ? task === 'model-answer'
      ? `${AI_COACH_SYSTEM_PROMPT}
The student asked for a model answer: put the model answer itself in "reply" (2-4 sentences), leave corrections empty.`
      : AI_COACH_SYSTEM_PROMPT
    : AI_TUTOR_SYSTEM_PROMPT;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemContent },
            ...(context ? [{ role: 'system', content: `Lesson context: ${context}` }] : []),
            { role: 'user', content: message },
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const rawText = await response.text().catch(() => '');
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      res.status(502).json({
        error: describeUpstreamAiError(data, rawText, response.status),
      });
      return;
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      res.status(502).json({ error: 'AI 服务返回内容为空' });
      return;
    }

    if (!wantCorrections) {
      res.json({ message: String(reply) });
      return;
    }

    const parsed = extractJsonObject(String(reply));
    if (!parsed) {
      // The provider ignored the JSON instruction - degrade to plain chat.
      res.json({ message: String(reply), corrections: [] });
      return;
    }

    res.json({
      message: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : String(reply),
      followUp: typeof parsed.followUp === 'string' ? parsed.followUp.trim().slice(0, 300) : '',
      corrections: normalizeCorrections(parsed.corrections),
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'AI 服务调用失败',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const sessionHours = typeof req.body?.sessionHours === 'number' ? req.body.sessionHours : undefined;

  if (!username.trim() || !password.trim()) {
    res.status(400).json({ error: '请输入用户名和密码' });
    return;
  }

  const loginKey = `${req.ip}|${username.trim().toLowerCase()}`;
  const limit = checkLoginRateLimit(loginKey);
  if (!limit.allowed) {
    res.status(429).json({ error: `登录尝试过于频繁，请 ${limit.retryAfterSeconds} 秒后再试` });
    return;
  }

  const session = await createSessionForCredentials(username, password, sessionHours);
  if (!session) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }
  loginAttempts.delete(loginKey);

  res.json(session);
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: (req as express.Request & { user: AuthUser }).user });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await deleteSession((req as express.Request & { token: string }).token);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const sessionHours = typeof req.body?.sessionHours === 'number' ? req.body.sessionHours : undefined;
  const user = (req as express.Request & { user: AuthUser }).user;

  if (!currentPassword.trim() || !newPassword.trim()) {
    res.status(400).json({ error: '请输入当前密码和新密码' });
    return;
  }

  try {
    const session = await changePassword(user.id, currentPassword, newPassword, sessionHours);
    res.json(session);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '修改密码失败',
    });
  }
});

app.get('/api/users', requireAuth, requireAdmin, async (_req, res) => {
  res.json({ users: await listUsers() });
});

app.get('/api/textbooks', requireAuth, async (_req, res) => {
  res.json({ textbooks: await listTextbooks() });
});

app.get('/api/textbooks/:id', requireAuth, async (req, res) => {
  const textbook = await getTextbookContent(req.params.id);
  if (!textbook) {
    res.status(404).json({ error: '教材不存在' });
    return;
  }
  res.json({ textbook });
});

app.put('/api/users/me/preferences', requireAuth, async (req, res) => {
  const selectedTextbookId = typeof req.body?.selectedTextbookId === 'string' ? req.body.selectedTextbookId.trim() : '';
  const user = (req as express.Request & { user: AuthUser }).user;

  if (!selectedTextbookId) {
    res.status(400).json({ error: '缺少当前教材标识' });
    return;
  }

  try {
    const updatedUser = await updateSelectedTextbookForUser(user.id, selectedTextbookId);
    res.json({ user: updatedUser });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '保存当前教材失败',
    });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const grade = typeof req.body?.grade === 'string' ? req.body.grade : '';
  const semester = typeof req.body?.semester === 'string' ? req.body.semester : '';
  const school = typeof req.body?.school === 'string' ? req.body.school : '';

  if (!username.trim() || !password.trim()) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  try {
    const user = await createUser({ username, password, grade, semester, school });
    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '创建用户失败',
    });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const ok = await deleteUser(req.params.id);
  if (!ok) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json({ ok: true });
});

app.get('/api/admin/ai-config', requireAuth, requireAdmin, async (_req, res) => {
  res.json({ config: await getAIServiceConfig() });
});

app.put('/api/admin/ai-config', requireAuth, requireAdmin, async (req, res) => {
  const config = await updateAIServiceConfig({
    model: typeof req.body?.model === 'string' ? req.body.model : undefined,
    baseURL: typeof req.body?.baseURL === 'string' ? req.body.baseURL : undefined,
    apiKey: typeof req.body?.apiKey === 'string' ? req.body.apiKey : undefined,
  });
  res.json({ config });
});

app.get('/api/admin/textbook-samples', requireAuth, requireAdmin, async (_req, res) => {
  res.json({ samples: await listTextbookSamples() });
});

app.post('/api/admin/textbooks/import-sample', requireAuth, requireAdmin, async (req, res) => {
  const sampleId = typeof req.body?.sampleId === 'string' ? req.body.sampleId : '';
  if (!sampleId.trim()) {
    res.status(400).json({ error: '缺少教材样板标识' });
    return;
  }

  try {
    const textbook = await importTextbookSample(sampleId);
    res.status(201).json({ textbook });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '导入教材失败',
    });
  }
});

app.post('/api/admin/textbooks/import-all-samples', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const textbooks = await importAllTextbookSamples();
    res.status(201).json({ textbooks });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : '批量导入教材失败',
    });
  }
});
