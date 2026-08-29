# workflow-voice —— 语音配套（模块 3/4）

为全部讲稿合成音频（`audio/` + `voice.lock.yaml`），改稿后**只重合成被改的句子**。

## 密钥与配置（一律走环境变量，不进 course.yaml）

```bash
export MAIC_TTS_PROVIDER=doubao        # doubao | openai-compatible | platform | edge
export MAIC_TTS_API_KEY=ark-…          # 豆包 Agent Plan 单 key 或 "appId:accessKey"
export MAIC_TTS_VOICE=zh_male_liufei_uranus_bigtts
export MAIC_TTS_SPEED=1.0              # 可选
# openai-compatible 另需：MAIC_TTS_BASE_URL（代理地址）+ MAIC_TTS_MODEL
# platform 另需：MAIC_TTS_PLATFORM_URL（默认 http://localhost:3000）
```

豆包 key 解析顺序：`MAIC_TTS_API_KEY` → arkcli 当前激活 profile（本机已登录
`arkcli` 即免配置）。**同一把 key 平台与 skill 通用**（请求契约逐字节对齐平台的
`generateDoubaoTTS`：key 形态决定端点+鉴权头，`seed-tts-2.0`，mp3/24kHz）。

## 流程

### 0. 连通检查（首次/换环境必跑）

```bash
node scripts/tts.mjs doctor     # 真实试合成一句 + ffprobe 检查
```

### 1. 门3 —— 讲稿终审（合成花钱花时间，先把文本定死）

- 协作模式：向用户呈现讲稿全文（或 preview 文本部分），确认措辞后才合成
- 自动模式：跑一遍 content 审查（C1-C6）代替人工终审，blocker 清零即视为过门
- 前置：`check.mjs` 无 error；无 TODO 残留

### 2. dry-run 成本清单

```bash
node scripts/tts.mjs <courseDir> --dry-run
# → 待合成 N 句（M 字），缓存命中 K 句 | 全课音频总长 ≈ X min
```

### 3. 合成（幂等、增量、可中断续跑）

```bash
node scripts/tts.mjs <courseDir> [--scenes 3-5] [--voice …] [--speed …] [--force]
```

- 缓存键 = `hash(文本|音色|语速)`——同句不改不重合成；改一句只重合成一句
- 每句合成即写盘+入 lock，中断后重跑自动跳过已完成的
- 时长用 ffprobe 实测写进 voice.lock（编译时进 mediaIndex）
- 豆包并发限额自动退避重试（≤4 次）

### 4. 卫生与验证

```bash
node scripts/tts.mjs prune <courseDir>       # 清理改稿残留的死音频（先 --dry-run 看）
node scripts/preview.mjs <courseDir>         # 审片：逐句带音频播放
node scripts/build.mjs <courseDir>           # 出包（讲稿无音频会有 L2 warning）
```

preview 里逐句点听；音色/语速不满意 → 改 course.yaml 的 voice 或 env →
`--force` 全量重合成（缓存键含音色，天然不会误命中旧音频）。

## 音色参考（豆包 Seed-TTS 2.0，中文授课）

| id | 风格 |
|---|---|
| `zh_male_liufei_uranus_bigtts` | 沉稳男声（00.Agent 系列同款） |
| `zh_male_m191_uranus_bigtts` | 云舟，叙事男声 |
| `zh_female_vv_uranus_bigtts` | Vivi，清晰女声（平台默认） |
| `zh_female_xiaohe_uranus_bigtts` | 小何，柔和女声 |

多讲师课：agents.json 里每个 agent 带 `voiceDesign`（identity/texture/delivery
三层声纹描述）随文档进平台；本模块按 course.yaml 单音色合成主线讲稿，
分角色合成属于后续扩展（voice 模块按 lock 键扩展即可，不需改管线）。
