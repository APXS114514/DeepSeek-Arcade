#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DeepSeek Arcade — 角色皮肤素材派生工具（dev-only，不是运行时的一部分）

把上游「鲸鱼娘」图集裁剪 / 归一化 / 重新编码成 DeepSeek Arcade 用的透明 WebP
帧序列。运行时不会调用本脚本，仓库里也不依赖 Python。

    python3 tools/derive-character-assets.py \
        --yunyue-src ../_arcade-skin-src/codex-deepseek-pet

上游（获取时的 commit 见 assets/whale-yunyue/ATTRIBUTION.md）：
  YunYue : https://github.com/YunYueSama/codex-deepseek-pet (大肥鱼项目署名许可 1.0)

做了什么（不改变配色、不重画角色）：
  * 帧号取自上游自己的动画定义（src/renderer/motion.js + app.js），不靠文件名猜；
  * 每个姿势组用「固定的裁剪窗口」缩放到底部对齐的统一画布，
    同组内帧与帧不抖动、跨组脚底基线一致；
  * 逐帧内容去重：上游图集里本来就是同一张图的重复姿势只存一份文件，
    动画顺序用 seq 索引还原；
  * 头像：从同一套帧里派生小尺寸 crop，供 Snake / Maze 使用。

输出目录里只保留本次生成的 .webp，避免残留旧文件名。
"""

import argparse
import hashlib
import os
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover - dev tool only
    sys.exit("需要 Pillow：pip install Pillow")

# --------------------------------------------------------------------------
# YunYue · codex-deepseek-pet
# --------------------------------------------------------------------------
# 所有图集都是「4 列 × N 行，正方形 cell」，cell 尺寸随图集不同（512 / 384 / 1024），
# 上游 src/renderer/app.js 直接按 cell 切片，所以这里统一按 512 基准归一化，
# 免得不同图集之间角色大小不一致。
CELL_BASE = 512
CANVAS = (192, 208)
MARGIN = {"l": 8, "r": 8, "t": 6, "b": 10}
HEAD_SIZE = 96

# 语义状态 -> (图集, cell, 帧号, 每帧毫秒)
GROUPS = {
    # motion-idle [0,1,2,3]：上游 clips.shift / clips.settle 用的轻微换重心
    "idle": ("motion-idle", 512, [0, 1, 2, 3], 260),
    # inbetween-walk ＝上游现在真正播放的整身步态：
    #   clips.right = inbetween-walk [0,1,3,2,4,5,6,7,8,9,11,10,12,13,14,15] @60ms
    # 按上游的播放顺序等间隔抽 8 帧，帧时长 ×2（120ms）＝ 保留上游 960ms 的步频。
    "walk": ("inbetween-walk", 512, [0, 3, 4, 6, 8, 11, 12, 14], 120),
    # dense-jump 属于 clips.jump 的腾空段。[7] 是其中侧身朝右、和步态同向的一帧；
    # 上游这一段里 9 / 13 的头发与尾鳍甩向另一侧，单独拿出来会看起来「面朝左」，
    # 在 Whale Runner 里会和走路的朝向打架，所以不用。
    "jump": ("dense-jump", 512, [7], 400),
    # dense-jump 21 ＝ clips.land 的落地压缩帧，低姿态也朝右
    "dive": ("dense-jump", 512, [21], 400),
    # story-token 0 ＝ clips.think 第一帧（低头看 token 的工作姿势）
    "think": ("story-token", 384, [0], 400),
    # actions 14 ＝ clips.surprise 用到的惊慌帧（带惊叹号）
    "startle": ("actions", 512, [14], 300),
    # expressions 14 ＝ clips.shock 用到的崩溃 / 委屈帧
    "blocked": ("expressions", 512, [14], 400),
}
STATE_ORDER = ["idle", "walk", "jump", "dive", "think", "startle", "blocked"]


def atlas_frame(path, cols, index):
    """按「cols 列、行优先」切出一格。"""
    im = Image.open(path).convert("RGBA")
    cell = im.width // cols
    row, col = divmod(index, cols)
    return im.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell))


def clean_alpha(im, threshold=8):
    """极低 alpha 的像素清成 0，避免缩放后出现鬼影边缘。只改 alpha，不动颜色。"""
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < threshold else v)
    return Image.merge("RGBA", (r, g, b, a))


def head_crop(canvas, size, resample, lo=0.20, hi=0.64):
    """从一张完整姿势图里裁出头像：取 alpha 包围盒的一段高度带，做成正方形。

    区间用「占整体身高的比例」表示，是因为 Q 版角色头很大、头顶还顶着呆毛和
    蕾丝，从包围盒顶端直接抠只会剩头发 —— 20%~64% 正好框住脸和耳朵。"""
    bbox = canvas.split()[3].getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    band_top = y0 + max(0, int(round((y1 - y0) * lo)))
    band_bottom = y0 + max(1, int(round((y1 - y0) * hi)))
    band = canvas.crop((x0, band_top, x1, band_bottom))
    hb = band.split()[3].getbbox()
    if not hb:
        return None
    hx0, hy0, hx1, hy1 = hb
    cx = (hx0 + hx1) / 2.0
    cy = (hy0 + hy1) / 2.0
    side = max(hx1 - hx0, hy1 - hy0) * 1.06
    out = Image.new("RGBA", (int(round(side)), int(round(side))), (0, 0, 0, 0))
    out.alpha_composite(band, (int(round(side / 2 - cx)), int(round(side / 2 - cy))))
    return out.resize((size, size), resample)


def save_webp(im, path, lossless=False, quality=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    if lossless:
        im.save(path, "WEBP", lossless=True, method=6)
    else:
        im.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def emit(images, prefix, out_dir, lossless, quality=88):
    """存帧并去重：返回 (files, seq)。

    files 是不重复的文件名，seq 是「第 i 帧用 files[seq[i]]」。
    上游图集里本来就重复的姿势只落一份文件，动画顺序靠 seq 还原。"""
    seen = {}
    files = []
    seq = []
    single = len(images) == 1
    for im in images:
        key = hashlib.sha1(im.tobytes()).hexdigest()
        idx = seen.get(key)
        if idx is None:
            idx = len(files)
            seen[key] = idx
            name = (prefix + ".webp") if single else ("%s-%d.webp" % (prefix, idx))
            save_webp(im, os.path.join(out_dir, name), lossless=lossless, quality=quality)
            files.append(name)
        seq.append(idx)
    return files, seq


def reset_dir(path):
    os.makedirs(path, exist_ok=True)
    for f in os.listdir(path):
        if f.endswith(".webp"):
            os.remove(os.path.join(path, f))


def derive(src, out_dir, verbose=True):
    whale = os.path.join(src, "assets", "whale")
    reset_dir(out_dir)

    # 1) 先把每个姿势组的原图裁出来，再算「统一缩放」——所有组共用一个 scale，
    #    这样换状态时角色大小不会变。
    groups = {}
    for state in STATE_ORDER:
        atlas, cell, frames, ms = GROUPS[state]
        path = os.path.join(whale, atlas + ".png")
        raw = [atlas_frame(path, 4, f) for f in frames]
        k = CELL_BASE / float(cell) if cell != CELL_BASE else 1.0   # 按 512 基准归一化
        bboxes = [im.split()[3].getbbox() for im in raw]
        if any(b is None for b in bboxes):
            raise SystemExit("空的帧: %s %s" % (state, atlas))
        uw = max(b[2] for b in bboxes) - min(b[0] for b in bboxes)
        uh = max(b[3] for b in bboxes) - min(b[1] for b in bboxes)
        groups[state] = {
            "raw": raw, "k": k, "ms": ms, "atlas": atlas,
            "group_bbox": (min(b[0] for b in bboxes), min(b[1] for b in bboxes),
                           max(b[2] for b in bboxes), max(b[3] for b in bboxes)),
            "size": (uw * k, uh * k),
        }

    cw, ch = CANVAS
    avail = (cw - MARGIN["l"] - MARGIN["r"], ch - MARGIN["t"] - MARGIN["b"])
    scale = min(min(avail[0] / g["size"][0], avail[1] / g["size"][1]) for g in groups.values())
    if verbose:
        print("统一缩放 %.4f（画布 %dx%d）" % (scale, cw, ch))

    baseline = ch - MARGIN["b"]
    info = {}
    for state in STATE_ORDER:
        g = groups[state]
        k, s = g["k"], scale
        gw = g["size"][0] * s
        gh = g["size"][1] * s
        ox = MARGIN["l"] + (avail[0] - gw) / 2.0
        oy = baseline - gh
        rendered = []
        for im in g["raw"]:
            tw = max(1, int(round(im.width * k * s)))
            th = max(1, int(round(im.height * k * s)))
            resized = im.resize((tw, th), Image.LANCZOS) if (tw, th) != im.size else im
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            canvas.alpha_composite(resized, (int(round(ox - g["group_bbox"][0] * k * s)),
                                             int(round(oy - g["group_bbox"][1] * k * s))))
            rendered.append(clean_alpha(canvas))
        files, seq = emit(rendered, state, out_dir, lossless=False)
        info[state] = {"files": files, "seq": seq, "ms": g["ms"], "atlas": g["atlas"]}
        if verbose:
            print("  %-8s %-16s %s seq=%s %dms" % (state, g["atlas"], ",".join(files), seq, g["ms"]))

    # 2) 头像：head 用上游 portrait.png（正面全身立绘），headThink 用 think 那一帧
    portrait = Image.open(os.path.join(whale, "portrait.png")).convert("RGBA")
    kk = CELL_BASE / 1024.0
    pw = max(1, int(round(portrait.width * kk * scale)))
    ph = max(1, int(round(portrait.height * kk * scale)))
    pim = portrait.resize((pw, ph), Image.LANCZOS)
    pbox = pim.split()[3].getbbox()
    pcanvas = Image.new("RGBA", (cw, ph), (0, 0, 0, 0))
    pcanvas.alpha_composite(pim, (int(round(pcanvas.width / 2 - (pbox[0] + pbox[2]) / 2.0)), 0))
    head = head_crop(pcanvas, HEAD_SIZE, Image.LANCZOS, lo=0.20, hi=0.64)
    save_webp(clean_alpha(head), os.path.join(out_dir, "head.webp"))
    info["head"] = {"files": ["head.webp"], "seq": [0], "ms": 1000, "atlas": "portrait.png"}

    tim = clean_alpha(Image.open(os.path.join(out_dir, info["think"]["files"][0])).convert("RGBA"))
    head_think = head_crop(tim, HEAD_SIZE, Image.LANCZOS, lo=0.20, hi=0.64)
    save_webp(clean_alpha(head_think), os.path.join(out_dir, "head-think.webp"))
    info["headThink"] = {"files": ["head-think.webp"], "seq": [0], "ms": 1000, "atlas": "story-token.png"}
    if verbose:
        print("  %-8s %-16s head.webp / head-think.webp" % ("head", "portrait.png"))
    return info


def print_registry(info):
    print("\n--- 可直接粘进 shared/character.js 的帧表 ---")
    for state in list(info.keys()):
        e = info[state]
        same = e["seq"] == list(range(len(e["seq"])))
        print("  %-9s files=[%s]%s frameMs=%d" % (
            state, ", ".join("'%s'" % f for f in e["files"]),
            "" if same else " seq=" + str(e["seq"]), e["ms"]))


def main():
    ap = argparse.ArgumentParser(description="派生 DeepSeek Arcade 角色皮肤素材")
    ap.add_argument("--yunyue-src", default="../_arcade-skin-src/codex-deepseek-pet")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "assets"))
    args = ap.parse_args()

    print("Whale Girl <- %s" % args.yunyue_src)
    info = derive(args.yunyue_src, os.path.join(args.out, "whale-yunyue"))

    d = os.path.join(args.out, "whale-yunyue")
    total = sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if f.endswith(".webp"))
    n = len([f for f in os.listdir(d) if f.endswith(".webp")])
    print("whale-yunyue: %d 个 WebP，共 %.1f KB" % (n, total / 1024.0))
    print_registry(info)


if __name__ == "__main__":
    main()
