"""Import designer tab icons (inactive + active) without recoloring."""
import os
import struct
import zlib

SIZE = 192
OUT = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(OUT, 'sources')

TAB_ICONS = [
    ('plans', 'plans.png', 'plans-active.png'),
    ('home', 'home.png', 'home-active.png'),
    ('gear', 'gear.png', 'gear-active.png'),
    ('profile', 'profile.png', 'profile-active.png'),
]


def read_png_rgba(path: str):
    data = open(path, 'rb').read()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'not png: {path}')

    pos = 8
    idat = b''
    width = 0
    height = 0

    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        pos += 4
        chunk_type = data[pos:pos + 4]
        pos += 4
        chunk = data[pos:pos + length]
        pos += length + 4

        if chunk_type == b'IHDR':
            width, height = struct.unpack('>II', chunk[:8])
        elif chunk_type == b'IDAT':
            idat += chunk

    raw = zlib.decompress(idat)
    rows = []
    stride = width * 4
    index = 0

    for _ in range(height):
        index += 1
        row = raw[index:index + stride]
        index += stride
        rows.append([(row[i], row[i + 1], row[i + 2], row[i + 3]) for i in range(0, stride, 4)])

    return width, height, rows


def is_dark_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 12:
        return True
    return max(r, g, b) < 48


def clean_icon(rows):
    """Remove outer background and inner black fills for dark tab bars."""
    height = len(rows)
    width = len(rows[0]) if height else 0
    background = [[False] * width for _ in range(height)]
    stack = []

    for x in range(width):
        if is_dark_pixel(*rows[0][x]):
            stack.append((x, 0))
        if is_dark_pixel(*rows[height - 1][x]):
            stack.append((x, height - 1))

    for y in range(height):
        if is_dark_pixel(*rows[y][0]):
            stack.append((0, y))
        if is_dark_pixel(*rows[y][width - 1]):
            stack.append((width - 1, y))

    while stack:
        x, y = stack.pop()
        if background[y][x]:
            continue

        pixel = rows[y][x]
        if not is_dark_pixel(*pixel):
            continue

        background[y][x] = True

        if x > 0:
            stack.append((x - 1, y))
        if x < width - 1:
            stack.append((x + 1, y))
        if y > 0:
            stack.append((x, y - 1))
        if y < height - 1:
            stack.append((x, y + 1))

    cleaned = []
    for y, row in enumerate(rows):
        cleaned_row = []
        for x, pixel in enumerate(row):
            r, g, b, a = pixel
            if background[y][x] or is_dark_pixel(r, g, b, a):
                cleaned_row.append((0, 0, 0, 0))
            else:
                cleaned_row.append(pixel)
        cleaned.append(cleaned_row)

    return cleaned


def resize_rgba(rows, width, height, new_width, new_height):
    output = [[(0, 0, 0, 0) for _ in range(new_width)] for _ in range(new_height)]

    for oy in range(new_height):
        y0 = int(oy * height / new_height)
        y1 = max(y0 + 1, int((oy + 1) * height / new_height))

        for ox in range(new_width):
            x0 = int(ox * width / new_width)
            x1 = max(x0 + 1, int((ox + 1) * width / new_width))

            r_sum = g_sum = b_sum = 0.0
            weight_sum = 0.0

            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b, a = rows[y][x]
                    if a <= 0:
                        continue

                    weight = a / 255.0
                    r_sum += r * weight
                    g_sum += g * weight
                    b_sum += b * weight
                    weight_sum += weight

            if weight_sum <= 0:
                continue

            alpha = min(255, int(weight_sum / max(1, (y1 - y0) * (x1 - x0)) * 255))
            if alpha <= 0:
                continue

            output[oy][ox] = (
                min(255, int(r_sum / weight_sum)),
                min(255, int(g_sum / weight_sum)),
                min(255, int(b_sum / weight_sum)),
                alpha,
            )

    return output


def write_png(path, canvas, size):
    raw = bytearray()
    for row in canvas:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend((r, g, b, a))
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    with open(path, 'wb') as file:
        file.write(png)


def process_icon(source_path: str, output_path: str):
    width, height, rows = read_png_rgba(source_path)
    cleaned = clean_icon(rows)

    if width == SIZE and height == SIZE:
        canvas = cleaned
    else:
        canvas = resize_rgba(cleaned, width, height, SIZE, SIZE)

    write_png(output_path, canvas, SIZE)


def main():
    os.makedirs(SOURCE_DIR, exist_ok=True)

    for _, inactive_name, active_name in TAB_ICONS:
        inactive_source = os.path.join(SOURCE_DIR, inactive_name)
        active_source = os.path.join(SOURCE_DIR, active_name)

        if not os.path.isfile(inactive_source):
            raise FileNotFoundError(inactive_source)
        if not os.path.isfile(active_source):
            raise FileNotFoundError(active_source)

        process_icon(inactive_source, os.path.join(OUT, inactive_name))
        process_icon(active_source, os.path.join(OUT, active_name))
        print(f'ok: {inactive_name}, {active_name}')

    print('tab icons imported')


if __name__ == '__main__':
    main()
