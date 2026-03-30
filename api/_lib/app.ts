import express from 'express';
import {
  changePassword,
  cleanupExpiredSessions,
  createSessionForCredentials,
  createUser,
  deleteSession,
  deleteUser,
  getUserByToken,
  getTextbookContent,
  importAllTextbookSamples,
  importTextbookSample,
  listUsers,
  listTextbookSamples,
  listTextbooks,
  type AuthUser,
} from './db.js';

export const app = express();

app.use(express.json());

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY?.trim();
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION?.trim();

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

app.get('/api/speech-token', requireAuth, async (_req, res) => {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    res.status(503).json({ error: 'Azure Speech 未配置，请设置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION' });
    return;
  }

  try {
    const response = await fetch(`https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Length': '0',
      },
    });

    if (!response.ok) {
      const message = await response.text();
      res.status(502).json({ error: `Azure Speech token 获取失败: ${message || response.statusText}` });
      return;
    }

    const token = await response.text();
    res.json({
      token,
      region: AZURE_SPEECH_REGION,
      expiresInSeconds: 600,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Azure Speech token 获取失败',
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

  const session = await createSessionForCredentials(username, password, sessionHours);
  if (!session) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

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
