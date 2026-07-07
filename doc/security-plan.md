# Tianming · 安全加强计划（Security Plan）

> 由 blind spot pass（`doc/usage-analysis.md` 的后续）触发，D13 产品化拍板后的安全路线。
> 总原则一句话：**客户端零秘密、服务端管配额、对用户如实披露。**

---

## 0. 威胁模型速览（当前 BYOK 网页版）

| 资产 | 存放位置 | 主要威胁 | 现状 |
|---|---|---|---|
| 用户 Gemini API key | localStorage 明文 | XSS 窃取 → 盗刷用户账单 | 无防护 |
| 简历原文件 / 结构化数据 | 浏览器 IndexedDB | 共享电脑残留 / 恶意脚本读取 | 无防护 |
| Gemini 调用额度 | 用户自己的 key | 被盗后无上限刷 | 无上限 |
| 前端代码 | 公开可读 | 反编译 | ✅ 无秘密可偷 = 无风险 |

关于"反编译防护"先说结论：**前端和扩展代码天然公开，正解是"客户端不放任何秘密"，
而不是代码混淆**——混淆挡不住有心人，还增加调试成本。当前代码里没有硬编码 key，已合规。

## 1. 第一阶段 · BYOK 网页版加固（现在就能做，全部低成本）

1. **CSP 内容安全策略**（性价比最高的一条）：`index.html` 加
   `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; connect-src 'self' https://generativelanguage.googleapis.com">`
   效果：即使页面被 XSS，注入脚本也无法把 key 外传到攻击者的服务器。
2. **引导用户给 key 上保险**：key 设置界面加两行说明——
   (a) 建议为本应用单独创建一个 key；(b) 在 Google AI Studio 给该 key 设用量上限。
   被盗刷时损失自动封顶，**这两行文案比任何代码防护都有效**。
3. **付费层建议 + 隐私披露**（配合 D6 v2.1）：key 设置界面注明免费层数据条款；
   简历上传首次使用弹一次性告知（发送给谁 / 干什么 / 存不存）。
4. **依赖供应链**：锁定 lockfile；建最小 CI（GitHub Actions：lint + test + build +
   `npm audit --audit-level=high`）——当前仓库没有任何 CI，这也是 M1"Done=merged"漂移的技术根源之一。
5. **明确不做**：前端代码混淆（无秘密可保护）；localStorage"加密存储"（解密钥匙还是得放前端，自欺欺人）。
   BYOK 是过渡态，不过度投资。

## 2. 第二阶段 · Phase 6 后端代理安全设计（产品化必经）

**架构红线：后端只暴露业务 API，绝不做透明代理。**
最容易被忽略的盗刷向量：如果后端原样转发任意 prompt，你的 endpoint 就等于一个免费
Gemini，一定会被脚本薅到账单爆炸。因此：

1. 后端只提供业务端点（`/api/triage`、`/api/audit`、`/api/parse-resume`）；
   **prompt 在服务端拼装**，客户端只传 JD / 简历数据，不传 prompt。
2. **账号 + 配额**：邮箱 magic link 级别即可；每用户 日/月 调用上限（吸收 D13.4：
   配额是成本结构的控制阀，先于定价存在）。
3. **双保险**：应用层 rate limit（IP + 账号两级）+ Google Cloud budget alert（全局账单告警）。
4. **Key 管理**：环境变量 / secret manager，永不进代码库（现有红线延续到服务端）。
5. **日志红线**：后端不落盘简历原文与 JD 全文，只留 metadata（时间 / 用户 / token 用量）——
   D6 延伸到服务端，这条要写进 Phase 6 的 Codex brief 验收清单。
6. **JD 文本视为不可信输入**：prompt 注入的主防线已经存在（LLM 只出证据、代码算分、
   schema 约束），服务端拼装 prompt 后攻击面进一步收窄，保持即可。

## 3. 第三阶段 · 扩展 + 上架前 checklist（M2）

1. 扩展零秘密（D5 延续）：一切 LLM 调用走后端。
2. **权限最小化**：优先 `activeTab`，避免宽 `host_permissions`——直接影响
   Chrome Web Store 审核通过率。
3. content script 不注入远程代码（MV3 硬要求）。
4. 上架前一次过：隐私政策页（如实披露 Gemini 处理，D6 v2.1 措辞）· 本地数据一键清空入口 ·
   CSP 复查 · `npm audit` high 清零。

## 4. 执行顺序

| 时点 | 动作 | 工作量 |
|---|---|---|
| 现在（M1 收尾顺手）| §1.1 CSP + §1.2 key 配额引导 + §1.3 披露文案 | 一个小 PR |
| M1 收尾 | §1.4 最小 CI | 半天 |
| Phase 6 设计期 | §2 全部写进 Codex brief 验收清单 | 随 Phase 6 |
| M2 上架前 | §3 checklist 一次过 | 半天 |

---
*Security Plan v1.0 · 2026-07-07 · Claude Code（由盲区 H1/M4/H5 + D13 产品化触发）*
