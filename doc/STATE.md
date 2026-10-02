# STATE · 当前状态快照

> **本文件是所有 agent session 的第一入口**（30 秒重入）。规则：≤50 行；每次合并 PR 后由
> `/handoff-sync` 技能（或手动）更新；只写"现在在哪 + 下一步 + 阻塞"，历史和决策依据一律
> 指向 HANDOFF/notes，不在这里复述。

## 当前位置（2026-10-02 · HANDOFF v2.0）

- **Milestone**：M1 ✅ Done（最后一项反通胀修复随 phase4-scoring-v2.1 合入），进入 M2。Phase 0–5.5 全部 ✅ Done。
- **2026-10-02 合入**：PR #36（`@types/react` + 修 2 个 tsc 错误 + GitHub Actions CI：typecheck / lint / format / test / build）、PR #38（侧栏「粘贴 JD」入口，D4 第二层兜底）、PR #39（反通胀 smoke + 简历切换 UX）、PR #40（后端代理雏形，见文末）、PR #41（文档与依赖清理）。
- **Phase 4.6**：数据层 ✅（PR #31）；最简文字 banner 已随 PR #34 占位；完整视觉 2f/2g 延后 M3。
- **反通胀缺口已修**（phase4-scoring-v2.1 / rubric-v1.2）：transferable 按完整需求进分母、只给半分、不按来源区分；简历适配对比只数 JD 直接要求，平手推荐更聚焦的简历；三处提示词共用 `SKILL_BUCKET_RULES`。"什么都会"简历技能分从反超（78.7 vs 71.3）变为持平（68.5），推荐回到专精简历。前后实测见 `doc/phase-4-6-notes.md` §4.1，口径见 `doc/scoring-rubric.md` §3。

## 下一步（重入锚点 · 按优先级）

1. **真实 Gemini 对比一次**（需 key，本地跑）：同一份 JD 跑初筛 + 深审，看新口径下 transferable 是否变少、三类之间有没有重复；顺手勾掉 `doc/phase-5-5-notes.md` §4 手动 smoke 四项。
2. M2 并行推进：后端代理（Phase 6.4）与 Track C 浏览器扩展（Phase 6.1–6.3）各由独立线程负责，进度见文末各自小节。
3. M2 之后的下一个功能：扩展角标评分（经已打开的 tianming 页面打分，守 D6）→ Phase 6.5 投递页侧栏复制助手。

## 阻塞 / 待用户拍板

- 暂无。4.6 完整视觉（2f/2g）按既定决策等 M3 + Claude Design，无需现在拍板。

## 快速读文指引（重复接手用）

- 状态类变更集中在：HANDOFF §2（状态）/ §5 Phase 4.6 & 5.5 / §11（接力）——v2.0 已同步到 PR #34 后事实。
- 首次接手仍按 `CLAUDE.md` §0 的必读链全量读；重复接手读完本文件 + 上面列的变更章节即可。
- 项目技能（任何 Claude session 可用）：`/brief-writer` `/adversarial-prompt-review` `/iron-rules-review` `/handoff-sync`（见 `.claude/skills/`）。

## 冬眠前必做（sprint 结束仪式）

结束一轮冲刺前，最后一个 commit 必须更新本文件的"下一步"为**具体到第一个动作**的描述
（坏例子："继续 Phase 6"；好例子："给 Codex 写 Phase 6 brief，先定 MV3 manifest 权限清单"）。

---
*STATE v1.2 · 2026-10-02 · 同步 PR #39 / #41 + 反通胀修复（phase4-scoring-v2.1）*

## 后端代理（Phase 6.4 · 并行线程 · 2026-10-02）

- 代理雏形在 `server/`（`contract.ts` 契约 / `handler.ts` 处理 / `worker.ts` Cloudflare 入口 /
  `vitePlugin.ts` 本地同端口）；前端经 `services/llmClient.ts` 走 `/api/generate`，Key 已不在浏览器。
- 接口契约 v1 与扩展对接要点见 `doc/backend-proxy.md` §2；扩展线程按它对接。
- 下一步：补 `wrangler.toml` 并真部署一次 Worker；上线前加限流（见 `doc/backend-proxy.md` §5）。

## M2 · 浏览器扩展（并行推进中）

- `extension/`：LinkedIn MV3 扩展骨架 + 卡片徽章 + 详情「送进天命」按钮（Phase 6.1–6.3），分支 `feat/linkedin-extension-foi2or`。
- 粗筛评分只留了 `extension/src/scoring.ts` 一个适配层，徽章暂时一律「未评分」。代理已合入，但 `scoreBatchScreenRecord` 要用户画像（在 Web App 的 IndexedDB 里），下一步让卡片经 bridge 交给打开着的天命页面打分，见 `extension/README.md`。
- 用法和结构见 `extension/README.md`。

## 代理部署准备（并行线程 · 2026-10-02）

- `wrangler.jsonc`：一个 Worker 托管网页 `dist/` 和 `/api/*`（同源）；按 IP 限流 20 次 / 分钟，超限 429 `RATE_LIMITED`。
- `npm run deploy` / `npm run deploy:dry-run`；密钥只走 `wrangler secret put`。
- 下一步（Flora 亲手）：按 `doc/backend-proxy.md` §7.2 登录 wrangler → 部署 → 设两个 secret → §7.3 验证。
