"""Render tab icons from SVG specs (stdlib only, true transparent PNG)."""
import math
import os
import struct
import zlib

SIZE = 192
SCALE = SIZE / 1024.0
OUT = os.path.dirname(os.path.abspath(__file__))

LIME = (185, 255, 47, 255)
GRAY = (198, 204, 212, 255)
DETAIL = (17, 19, 24, 255)
CLEAR = (0, 0, 0, 0)

ICONS = ['plans', 'home', 'gear', 'profile']


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


def fill_disc(canvas, cx, cy, radius, color):
    r2 = radius * radius
    y0 = max(0, int(cy - radius - 1))
    y1 = min(SIZE, int(cy + radius + 2))
    x0 = max(0, int(cx - radius - 1))
    x1 = min(SIZE, int(cx + radius + 2))
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(canvas, x, y, color)


def stroke_segment(canvas, x0, y0, x1, y1, width, color):
    steps = int(max(abs(x1 - x0), abs(y1 - y0), 1))
    half = width / 2.0
    for step in range(steps + 1):
        t = step / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        y_start = int(y - half)
        y_end = int(y + half + 1)
        x_start = int(x - half)
        x_end = int(x + half + 1)
        for py in range(y_start, y_end):
            for px in range(x_start, x_end):
                blend(canvas, px, py, color)


def stroke_round_rect(canvas, x, y, width, height, radius, stroke, color):
    inner_w = max(0, width - stroke)
    inner_h = max(0, height - stroke)
    inner_r = max(0, radius - stroke / 2)
    inset = stroke / 2.0
    x0 = x + inset
    y0 = y + inset

    left = x0
    right = x0 + inner_w
    top = y0
    bottom = y0 + inner_h

    stroke_segment(canvas, left + inner_r, top, right - inner_r, top, stroke, color)
    stroke_segment(canvas, left + inner_r, bottom, right - inner_r, bottom, stroke, color)
    stroke_segment(canvas, left, top + inner_r, left, bottom - inner_r, stroke, color)
    stroke_segment(canvas, right, top + inner_r, right, bottom - inner_r, stroke, color)

    for corner_x, corner_y, start, end in (
        (left + inner_r, top + inner_r, math.pi, 1.5 * math.pi),
        (right - inner_r, top + inner_r, 1.5 * math.pi, 2 * math.pi),
        (right - inner_r, bottom - inner_r, 0, 0.5 * math.pi),
        (left + inner_r, bottom - inner_r, 0.5 * math.pi, math.pi),
    ):
        steps = max(8, int(inner_r))
        for i in range(steps + 1):
            t = start + (end - start) * i / steps
            px = corner_x + math.cos(t) * inner_r
            py = corner_y + math.sin(t) * inner_r
            fill_disc(canvas, px, py, stroke / 2, color)


def fill_round_rect(canvas, x, y, width, height, radius, color):
    x1 = x + width
    y1 = y + height
    for py in range(max(0, int(y)), min(SIZE, int(y1) + 1)):
        for px in range(max(0, int(x)), min(SIZE, int(x1) + 1)):
            cx = min(max(px, x + radius), x1 - radius)
            cy = min(max(py, y + radius), y1 - radius)
            in_rect = x <= px <= x1 and y <= py <= y1
            in_corner = False
            corners = (
                (x + radius, y + radius),
                (x1 - radius, y + radius),
                (x1 - radius, y1 - radius),
                (x + radius, y1 - radius),
            )
            if px < x + radius and py < y + radius:
                cx, cy = corners[0]
                in_corner = (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2
            elif px > x1 - radius and py < y + radius:
                cx, cy = corners[1]
                in_corner = (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2
            elif px > x1 - radius and py > y1 - radius:
                cx, cy = corners[2]
                in_corner = (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2
            elif px < x + radius and py > y1 - radius:
                cx, cy = corners[3]
                in_corner = (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2

            if in_rect and (in_corner or (x + radius <= px <= x1 - radius or y + radius <= py <= y1 - radius)):
                blend(canvas, px, py, color)


def s(value):
    return value * SCALE


def sp(x, y, boost=1.0, center_x=512, center_y=512):
    return (
        SIZE / 2 + (x - center_x) * SCALE * boost,
        SIZE / 2 + (y - center_y) * SCALE * boost,
    )


def sv(value, boost=1.0):
    return value * SCALE * boost


def draw_plans(canvas, color):
    stroke_round_rect(canvas, s(256), s(220), s(512), s(640), s(100), s(80), color)
    fill_disc(canvas, s(512), s(480), s(120), color)
    stroke_segment(canvas, s(380), s(680), s(644), s(680), s(80), color)
    stroke_segment(canvas, s(380), s(780), s(512), s(780), s(80), color)
    stroke_segment(canvas, s(650), s(220), s(768), s(338), s(80), color)


def draw_home(canvas, color):
    stroke_round_rect(canvas, s(256), s(448), s(512), s(384), s(80), s(80), color)
    stroke_segment(canvas, s(200), s(480), s(512), s(200), s(80), color)
    stroke_segment(canvas, s(512), s(200), s(824), s(480), s(80), color)
    fill_disc(canvas, s(512), s(640), s(80), color)


def draw_gear(canvas, color):
    boost = 1.4
    center_y = 494
    x, y = sp(320, 320, boost, 512, center_y)
    stroke_round_rect(
        canvas,
        x,
        y,
        sv(384, boost),
        sv(448, boost),
        sv(120, boost),
        sv(80, boost),
        color,
    )
    hx, hy = sp(416, 220, boost, 512, center_y)
    stroke_round_rect(
        canvas,
        hx,
        hy,
        sv(192, boost),
        sv(100, boost),
        sv(40, boost),
        sv(60, boost),
        color,
    )
    px, py = sp(448, 480, boost, 512, center_y)
    fill_round_rect(canvas, px, py, sv(128, boost), sv(60, boost), sv(30, boost), color)


def draw_profile(canvas, face_color, detail_color):
    fill_disc(canvas, s(512), s(512), s(350), face_color)
    fill_disc(canvas, s(400), s(450), s(45), detail_color)
    fill_disc(canvas, s(624), s(450), s(45), detail_color)

    steps = 36
    for i in range(steps):
        t0 = i / steps
        t1 = (i + 1) / steps
        x0 = (1 - t0) ** 2 * s(380) + 2 * (1 - t0) * t0 * s(512) + t0 ** 2 * s(644)
        y0 = (1 - t0) ** 2 * s(620) + 2 * (1 - t0) * t0 * s(750) + t0 ** 2 * s(620)
        x1 = (1 - t1) ** 2 * s(380) + 2 * (1 - t1) * t1 * s(512) + t1 ** 2 * s(644)
        y1 = (1 - t1) ** 2 * s(620) + 2 * (1 - t1) * t1 * s(750) + t1 ** 2 * s(620)
        stroke_segment(canvas, x0, y0, x1, y1, s(60), detail_color)


DRAWERS = {
    'plans': lambda canvas, color: draw_plans(canvas, color),
    'home': lambda canvas, color: draw_home(canvas, color),
    'gear': lambda canvas, color: draw_gear(canvas, color),
    'profile': lambda canvas, color: draw_profile(canvas, color, DETAIL),
}


def write_png(path, canvas):
    raw = bytearray()
    for row in canvas:
        raw.append(0)
        for pixel in row:
            raw.extend(pixel)
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    with open(path, 'wb') as file:
        file.write(png)


def main():
    for name in ICONS:
        drawer = DRAWERS[name]

        active = new_canvas()
        drawer(active, LIME)
        write_png(os.path.join(OUT, f'{name}-active.png'), active)

        inactive = new_canvas()
        drawer(inactive, GRAY)
        write_png(os.path.join(OUT, f'{name}.png'), inactive)

        print(f'ok: {name}.png, {name}-active.png')

    print('tab svg icons rendered')


if __name__ == '__main__':
    main()
