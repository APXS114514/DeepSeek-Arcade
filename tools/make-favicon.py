#!/usr/bin/env python3
"""把鲸鱼娘 App 图标（1254x1254 大图）派生成运行时用的 favicon.png。

为什么需要它：
  assets/favicon.png 曾经是 1.03 MB / 1254x1254 —— 浏览器实际只用到 16~32px，
  却成了全仓库最大的单文件。favicon 只出现在 <link rel="icon"> 里，
  屏幕上最大也就是 180px（apple-touch-icon），256x256 留足余量。

不引入构建步骤：这是**一次性 / 按需**的素材派生脚本，
  Python + Pillow 只在本机跑，产物 assets/favicon.png 直接进仓库。

原始大图的来源（三选一，优先级从上到下）：
  1. --src 显式指定；
  2. 本机保留的主副本 ../Game-Miscellaneous/_arcade-assets-src/favicon-master-1254.png；
  3. git 历史：git show 6eee1d2:assets/favicon.png > master.png

用法（在工作区根目录 /Users/apxs/Documents/DSH 下执行）：
  <python> Game/tools/make-favicon.py
  <python> Game/tools/make-favicon.py --src /path/to/master.png --size 256
"""
import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：本机用 DSH 自带 python 即可（见 Game/AGENT-NOTES.md 第四节）")

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
DEFAULT_SRC = os.path.join(GAME, "..", "Game-Miscellaneous", "_arcade-assets-src",
                           "favicon-master-1254.png")
DEFAULT_OUT = os.path.join(GAME, "assets", "favicon.png")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--size", type=int, default=256)
    args = ap.parse_args()

    src = os.path.abspath(args.src)
    if not os.path.exists(src):
        sys.exit("找不到原始大图：%s\n（见本脚本 docstring 的三种来源）" % src)

    img = Image.open(src)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")
    # 主图本身就是圆角方图标，白底；缩放时用 Lanczos 保边缘干净。
    out = img.resize((args.size, args.size), Image.LANCZOS)
    out.save(args.out, format="PNG", optimize=True)

    before = os.path.getsize(src)
    after = os.path.getsize(args.out)
    print("src  %s  %dx%d  %d bytes" % (src, img.width, img.height, before))
    print("out  %s  %dx%d  %d bytes  (%.1f%% of src)" % (
        args.out, out.width, out.height, after, 100.0 * after / before))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
