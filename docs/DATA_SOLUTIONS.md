# 外研版英语教材数据获取方案

## 方案一：使用 AI 自动生成（推荐，已实现）

### 特点
- ✅ 快速生成完整的词汇和句子数据
- ✅ 覆盖 7-12 年级上下学期所有单元
- ✅ 难度梯度合理
- ⚠️ 内容由 AI 生成，可能与真实教材有差异

### 使用方法

1. 确保已配置 Gemini API Key：
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```

2. 运行生成脚本：
   ```bash
   npx tsx scripts/generate-vocabulary.ts
   ```

3. 生成的文件将保存在 `src/data/` 目录：
   - `vocabulary.ts` - 完整词汇表
   - `sentences.ts` - 完整句子表

4. 修改 App.tsx 导入新数据：
   ```typescript
   import { FLTRP_VOCAB } from './data/vocabulary';
   import { FLTRP_SENTENCES } from './data/sentences';
   ```

---

## 方案二：从公开教育资源网站爬取

### 推荐数据源

| 来源 | 网址 | 说明 |
|------|------|------|
| 外研社官网 | https://www.fltrp.com/ | 官方资源 |
| 英语学科网 | https://www.zxxk.com/ | 教学资源 |
| 百度文库 | https://wenku.baidu.com/ | 搜索"外研版英语词汇" |
| 知乎/小红书 | 用户分享 | 搜索教材词汇整理 |

### 爬取脚本示例

```typescript
// scripts/crawl-vocabulary.ts
// 需要安装: npm install puppeteer cheerio

import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function crawlFromWebsite(url: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  
  // 根据具体网站结构调整选择器
  const vocab = await page.evaluate(() => {
    const words: any[] = [];
    document.querySelectorAll('.word-item').forEach((el, idx) => {
      words.push({
        word: el.querySelector('.word')?.textContent || '',
        phonetic: el.querySelector('.phonetic')?.textContent || '',
        definition: el.querySelector('.meaning')?.textContent || ''
      });
    });
    return words;
  });
  
  await browser.close();
  return vocab;
}
```

---

## 方案三：使用开源数据集

### 推荐的英语词汇数据集

| 数据集 | 来源 | 规模 | 说明 |
|--------|------|------|------|
| CEFR-J | 剑桥大学 | 按级别分类 | 欧洲语言共同参考框架 |
| NGSL | 通用词汇表 | 2800词 | 按频率排序 |
| AWL | 学术词汇表 | 570词 | 学术英语 |

### 按外研版主题映射

可以将通用词汇按外研版教材的主题进行重新分类：

```typescript
// 外研版教材主题对应表
const TEXTBOOK_THEMES = {
  '7年级-上学期': {
    'Unit 1': ['自我介绍', '问候', '数字'],
    'Unit 2': ['家庭', '人物关系'],
    'Unit 3': ['学校', '科目'],
    // ...
  },
  // ...
};

// 从通用词汇表中筛选对应主题的词汇
function mapWordsToThemes(words: any[], themes: string[]) {
  // 使用关键词匹配或 AI 分类
}
```

---

## 方案四：手动整理 + AI 辅助

### 步骤

1. **收集原始材料**
   - 拍照/扫描教材词汇页
   - 从 PDF 教材中提取
   - 使用 OCR 识别（如：百度OCR、腾讯OCR）

2. **AI 格式化**
   ```typescript
   // 将 OCR 结果发送给 AI 整理
   async function formatWithAI(rawText: string) {
     const prompt = `请将以下混乱的词汇表整理成标准格式：
     
     ${rawText}
     
     要求：
     1. 添加音标
     2. 添加英文例句
     3. 修正识别错误
     4. 返回 JSON 格式`;
     
     // 调用 AI API...
   }
   ```

3. **人工校对**
   - 教师或学生志愿者审核
   - 对比官方教材

---

## 方案五：社区众包（长期方案）

### 实施方式

1. 在应用中添加"贡献数据"功能
2. 用户可以提交单词/句子
3. 管理员审核后入库
4. 给予贡献者积分奖励

```typescript
// 数据贡献接口
interface Contribution {
  type: 'word' | 'sentence';
  data: any;
  contributor: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

---

## 推荐实施策略

### 短期（快速上线）
1. 使用方案一（AI 自动生成）快速填充数据
2. 应用可立即使用完整功能

### 中期（提升质量）
1. 使用方案三（开源数据集）验证 AI 生成内容的准确性
2. 教师/学生反馈错误词汇，逐步修正

### 长期（完善生态）
1. 使用方案四获取真实教材数据
2. 实施方案五社区众包，持续完善

---

## 数据质量保证

### 验证清单

- [ ] 单词拼写正确
- [ ] 音标准确（英式/美式）
- [ ] 释义符合教材
- [ ] 例句语法正确
- [ ] 难度梯度合理
- [ ] 无重复单词

### 自动化测试

```typescript
// 数据质量检查脚本
function validateVocabulary(vocab: any[]) {
  const errors: string[] = [];
  
  vocab.forEach((word, idx) => {
    if (!word.word || word.word.length < 2) {
      errors.push(`第${idx + 1}条: 单词无效`);
    }
    if (!word.phonetic || !word.phonetic.includes('/')) {
      errors.push(`${word.word}: 音标格式错误`);
    }
  });
  
  return errors;
}
```
