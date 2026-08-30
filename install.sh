#!/usr/bin/env bash
# maic-course 一键安装 —— skill 链接 + sub agent 注册 + DSL vendor + 环境体检
#
# 用法：
#   ./install.sh                  # 装进当前目录的项目（.claude/skills + .claude/agents）
#   ./install.sh <项目目录>        # 装进指定项目（如 /path/to/OpenMAIC）
#   ./install.sh --user           # 个人级：装进 ~/.claude（任意目录的会话可用）
#
# 幂等：重复执行覆盖旧链接。装完重启 Claude Code 会话（agent 类型启动时加载）。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$REPO_ROOT/maic-course"

MODE="project"
TARGET="$PWD"
if [[ "${1:-}" == "--user" ]]; then
  MODE="user"
  TARGET="$HOME/.claude"
elif [[ -n "${1:-}" ]]; then
  TARGET="$1"
fi

if [[ ! -f "$SKILL_DIR/SKILL.md" ]]; then
  echo "✗ 未找到 skill 本体：${SKILL_DIR}（请在仓库 checkout 根目录运行）" >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "✗ 需要 node ≥ 20（当前环境没有 node）" >&2
  exit 1
fi
if [[ "$MODE" == "project" && ! -d "$TARGET" ]]; then
  echo "✗ 目标目录不存在：$TARGET" >&2
  exit 1
fi

echo "→ 安装到：${TARGET}（${MODE} 模式）"
mkdir -p "$TARGET/.claude/skills" "$TARGET/.claude/agents"

# 1) skill 本体（symlink——仓库始终是单一事实源，升级 = git pull）
ln -sfn "$SKILL_DIR" "$TARGET/.claude/skills/maic-course"
echo "✓ skill  → .claude/skills/maic-course"

# 2) sub agent 注册（受限工具面类型；agents/ 下新增的自动带上）
for agent in "$SKILL_DIR"/agents/*.md; do
  name="$(basename "$agent" .md)"
  ln -sfn "$agent" "$TARGET/.claude/agents/$name.md"
  echo "✓ agent → .claude/agents/$name.md"
done

# 3) vendor DSL dist + 环境体检（zip/unzip/ffprobe）
node "$SKILL_DIR/scripts/setup.mjs"

echo
echo "安装完成。提醒：agent 类型在会话启动时加载——已开着的 Claude Code 会话需重启才生效。"
