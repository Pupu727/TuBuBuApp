"""Generate TuBu tab bar PNG icons (81x81) — trail-energy line icons."""
import os
import struct
import zlib

SIZE = 81
OUT = os.path.dirname(os.path.abspath(__file__))

GRAY = (143, 148, 154, 255)
LIME = (185, 255, 47, 255)
CLEAR = (0, 0, 0, 0)
STROKE = 3
CAP = STROKE / 2.0


def new_canvas():
    return [[CLEAR for _ in range(SIZE)] for _ in range(SIZE)]


def blend(dst, x, y, color):
    if x < 0 or y < 0 or x >= SIZE or y >= SIZE:
        return
    dr, dg, db, da = dst[y][x]
    sr, sg, sb, sa = color
    if sa == 0:
        return
    if sa == 255 or da == 0:
        dst[y][x] = color
        return
    a = sa / 255.0
    dst[y][x] = (
        int(sr * a + dr * (1 - a)),
        int(sg * a + dg * (1 - a)),
        int(sb * a + db * (1 - a)),
        int(255 * (a + (1 - a) * (da / 255.0))),
    )


def fill_rect(canvas, x0, y0, x1, y1, color):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            blend(canvas, x, y, color)


def stroke_rect(canvas, x0, y0, x1, y1, width, color):
    for t in range(width):
        fill_rect(canvas, x0 + t, y0 + t, x1 - t, y0 + t + 1, color)
        fill_rect(canvas, x0 + t, y1 - t - 1, x1 - t, y1 - t, color)
        fill_rect(canvas, x0 + t, y0 + t, x0 + t + 1, y1 - t, color)
        fill_rect(canvas, x1 - t - 1, y0 + t, x1 - t, y1 - t, color)


def fill_circle(canvas, cx, cy, r, color):
    r2 = r * r
    for y in range(int(cy - r), int(cy + r + 1)):
        for x in range(int(cx - r), int(cx + r + 1)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(canvas, x, y, color)


def stroke_circle(canvas, cx, cy, r, width, color):
    for t in range(width):
        rr = r - t
        r2o = rr * rr
        r2i = max(0, rr - 1) ** 2
        for y in range(int(cy - rr), int(cy + rr + 1)):
            for x in range(int(cx - rr), int(cx + rr + 1)):
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if r2i < d2 <= r2o:
                    blend(canvas, x, y, color)


def line(canvas, x0, y0, x1, y1, width, color):
    steps = int(max(abs(x1 - x0), abs(y1 - y0), 1))
    hw = width / 2.0
    for s in range(steps + 1):
        x = x0 + (x1 - x0) * s / steps
        y = y0 + (y1 - y0) * s / steps
        fill_rect(canvas, x - hw, y - hw, x + hw + 1, y + hw + 1, color)


def draw_home(canvas, color):
    """首页：圆角仪表盘四格"""
    stroke_rect(canvas, 18, 18, 62, 62, STROKE, color)
    fill_rect(canvas, 39, 20, 42, 60, color)
    fill_rect(canvas, 20, 39, 60, 42, color)
    fill_circle(canvas, 29, 29, 4, color)
    fill_circle(canvas, 51, 29, 4, color)
    fill_circle(canvas, 29, 51, 4, color)
    fill_rect(canvas, 47, 47, 55, 55, color)


def draw_gear(canvas, color):
    """装备：简化背包"""
    for i in range(8):
        y = 22 + i
        half = 6 + i
        fill_rect(canvas, 40 - half, y, 41 + half, y + 1, color)
    stroke_rect(canvas, 24, 30, 56, 62, STROKE, color)
    line(canvas, 31, 22, 27, 31, STROKE, color)
    line(canvas, 49, 22, 53, 31, STROKE, color)
    stroke_rect(canvas, 30, 46, 50, 56, STROKE, color)


def draw_plans(canvas, color):
    """方案：折线路线"""
    stroke_rect(canvas, 16, 20, 58, 60, STROKE, color)
    line(canvas, 16, 20, 58, 60, STROKE, color)
    line(canvas, 24, 48, 36, 36, STROKE + 1, color)
    line(canvas, 36, 36, 48, 42, STROKE + 1, color)
    line(canvas, 48, 42, 54, 30, STROKE + 1, color)
    fill_circle(canvas, 24, 48, 3, color)
    fill_circle(canvas, 36, 36, 3, color)
    fill_circle(canvas, 48, 42, 3, color)
    stroke_circle(canvas, 54, 30, 4, STROKE, color)


def draw_profile(canvas, color):
    """我的：头像轮廓"""
    stroke_circle(canvas, 40, 30, 11, STROKE, color)
    for y in range(48, 62):
        for x in range(20, 61):
            if y == 48 or y == 61 or x == 20 or x == 60:
                blend(canvas, x, y, color)


DRAWERS = {
    'home': draw_home,
    'gear': draw_gear,
    'plans': draw_plans,
    'profile': draw_profile,
}


def write_png(path, canvas):
    raw = bytearray()
    for row in canvas:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


for name, drawer in DRAWERS.items():
    c1 = new_canvas()
    drawer(c1, GRAY)
    write_png(os.path.join(OUT, f'{name}.png'), c1)

    c2 = new_canvas()
    drawer(c2, LIME)
    write_png(os.path.join(OUT, f'{name}-active.png'), c2)

print('icons ok')
