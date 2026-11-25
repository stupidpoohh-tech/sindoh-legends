"""
art-src/ 의 원본 일러스트·스프라이트 시트를 게임용 스프라이트로 잘라 public/assets/game/ 에 저장합니다.
실행: python3 tools/build_sprites.py   (필요: pip install pillow numpy scipy)
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-src')
OUT = os.path.join(ROOT, 'public', 'assets', 'game')
os.makedirs(OUT, exist_ok=True)
manifest = {}

def load(name):
    im = Image.open(os.path.join(SRC, name)).convert('RGBA')
    a = np.array(im)
    a[:, :, 3][a[:, :, 3] < 30] = 0  # 시트의 미세 노이즈 제거
    return Image.fromarray(a)

def strip_labels(im):
    """시트 상단의 글자 라벨(가로로 긴 알약 모양)과 구분선을 제거"""
    arr = np.array(im)
    a = arr[:, :, 3] > 40
    lab, n = ndimage.label(a)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h = sl[0].stop - sl[0].start
        w = sl[1].stop - sl[1].start
        top = sl[0].start
        if top < im.height * 0.35 and h < 40 and w > h * 1.8:
            arr[:, :, 3][lab == i + 1] = 0
    return Image.fromarray(arr)

def largest(im, keep_all=False, dil=3):
    """영역 안의 가장 큰 덩어리(또는 전체)로 잘라냄"""
    a = np.array(im)[:, :, 3] > 40
    if not a.any():
        return im
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=dil))
    if keep_all:
        mask = lab > 0
    else:
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        mask = lab == (int(np.argmax(sizes)) + 1)
    arr = np.array(im)
    arr[:, :, 3] = np.where(mask, arr[:, :, 3], 0)
    out = Image.fromarray(arr)
    return out.crop(out.getbbox())

def anchor_x(im):
    """발 위치(하단 35% 불투명 픽셀 평균 x)"""
    a = np.array(im)[:, :, 3] > 80
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * 0.65):, :])
    return float(xs.mean()) if len(xs) else im.width / 2

def centered(im, ax=None):
    ax = anchor_x(im) if ax is None else ax
    half = int(max(ax, im.width - ax)) + 2
    c = Image.new('RGBA', (half * 2, im.height))
    c.paste(im, (int(half - ax), 0))
    return c

def feather(im, px=14):
    """가장자리 알파를 0으로 서서히 낮춰 사각 테두리 자국 제거 (이펙트용)"""
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    yy = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    xx = np.minimum(np.arange(w), np.arange(w)[None, ::-1].ravel())[None, :]
    m = np.clip(np.minimum(yy, xx) / px, 0, 1)
    a[:, :, 3] *= m
    return Image.fromarray(a.astype(np.uint8))

def save(key, im, scale=None, height=None, q=86, center=False):
    if key.startswith('fx_') or key.endswith('_ret'):
        # 투명 여백을 먼저 두르고 가장자리만 부드럽게 → 이펙트 본체는 잘리지 않음
        # 원래 경계에서 알파를 0까지 서서히 낮춘 뒤(잘린 글로우의 직선 자국 제거) 투명 여백을 두름
        im = feather(im, 34 if key.startswith('fx_w_') else 14)
        pad = 16
        padded = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2))
        padded.paste(im, (pad, pad))
        im = padded
    if center:
        im = centered(im)
    if height:
        scale = height / im.height
    if scale and scale != 1:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    path = os.path.join(OUT, key + '.webp')
    im.save(path, 'WEBP', quality=q, method=6)
    manifest[key] = [im.width, im.height]
    return im

def crop(im, x, y, w, h):
    return im.crop((x, y, x + w, y + h))

# ───────── 챔피언 (부장님) ─────────
ch = load('부장님 마법사의 스프라이트 시트2.png')
C = {
    'champ_idle': (48, 29, 202, 232), 'champ_idle_b': (264, 30, 184, 231),
    'champ_run_0': (201, 284, 215, 208), 'champ_run_1': (488, 283, 217, 206),
    'champ_run_2': (775, 281, 223, 207), 'champ_run_3': (1081, 279, 213, 210),
    'champ_atk_0': (217, 511, 193, 225), 'champ_atk_1': (488, 500, 178, 234),
    'champ_atk_2': (774, 518, 273, 216), 'champ_atk_3': (1091, 525, 281, 206),
    'champ_hit': (90, 768, 221, 228), 'champ_down': (712, 850, 288, 132),
    'champ_victory': (1157, 740, 228, 271),
}
CH_SCALE = 230 / 232  # 모든 프레임 동일 배율 (표시 높이 기준 2배 해상도)
for k, b in C.items():
    save(k, largest(crop(ch, *b), dil=6), scale=CH_SCALE, center=True)

# ───────── 아군 미니언 (팀별 2종) ─────────
mn = load('신도 레전드 미니언 스프라이트 시트.png')
ROWS = {'push': (50, 195), 'pushR': (245, 390), 'dev': (435, 575), 'devC': (575, 700), 'biz': (712, 872), 'bizC': (872, 1005)}
COLS = {'idle': (425, 565), 'run_0': (565, 686), 'run_1': (686, 800), 'run_2': (800, 930), 'atk': (930, 1160), 'hit': (1160, 1340), 'ret': (1345, 1515)}
MN_SCALE = 112 / 125
for kind, (y0, y1) in ROWS.items():
    idle = largest(strip_labels(crop(mn, COLS['idle'][0], y0, COLS['idle'][1] - COLS['idle'][0], y1 - y0)))
    for col, (x0, x1) in COLS.items():
        cell = strip_labels(crop(mn, x0, y0, x1 - x0, y1 - y0))
        if col == 'ret':
            if kind in ('dev', 'biz'):  # 블록 상단의 '퇴장(귀환)' 라벨 영역 제외
                cell = cell.crop((0, 52 if kind == 'dev' else 38, cell.width, cell.height))
            im = largest(cell, dil=10)  # 글로우 조각을 하나로 묶되 텍스트 라벨은 제외
            save(f'm_{kind}_{col}', im, scale=MN_SCALE)
            continue
        im = largest(cell)
        if col == 'atk':
            # 몸통만 사용 (투사체 이펙트 제외)
            im = im.crop((0, 0, min(im.width, idle.width + 6), im.height))
            im = im.crop(im.getbbox())
        save(f'm_{kind}_{col}', im, scale=MN_SCALE, center=True)

# ───────── 적 / 보스 ─────────
en = load('네온 글리치 보스와 적 유닛 스프라이트 시트.png')
E = {
    'e_bug_0': (30, 142, 172, 152), 'e_bug_1': (211, 141, 165, 153), 'e_bug_2': (377, 147, 175, 146),
    'e_phish_0': (585, 142, 203, 121), 'e_phish_1': (772, 143, 179, 122), 'e_phish_2': (938, 100, 197, 173),
    'e_ransom_0': (1183, 120, 183, 182), 'e_ransom_1': (1367, 119, 196, 180), 'e_ransom_2': (1561, 86, 186, 211),
}
for k, b in E.items():
    save(k, largest(crop(en, *b), keep_all=True), scale=0.62, center=True)
save('boss_main', largest(crop(en, 16, 343, 567, 492), keep_all=True), height=300, center=True)
for k, b in {'boss_idle': (600, 498, 256, 222), 'boss_punch': (883, 499, 272, 224), 'boss_slash': (1175, 496, 298, 224)}.items():
    save(k, largest(crop(en, *b), keep_all=True), scale=300 / 492 * (492 / 222) * 0.62, center=True)
save('fx_portal', largest(crop(en, 1495, 370, 240, 230), keep_all=True), height=150)
save('fx_warning', largest(crop(en, 1505, 620, 220, 145), keep_all=True), height=90)

# ───────── 구조물 ─────────
st = load('신도 레전드 구조물 스프라이트 시트.png')
save('s_ally_nexus', largest(load('download1.png')), height=340)
save('s_ally_turret', largest(load('구조물1.png')), height=300)
save('s_turret', largest(load('구조물2.png')), height=300)
save('s_inhib', largest(load('구조물3.png')), height=230)
save('s_nexus', largest(load('구조물4.png')), height=380)
save('s_firewall', largest(crop(st, 727, 2, 297, 343), keep_all=True), height=200)
save('s_turret_ruin', largest(crop(st, 687, 364, 339, 332), keep_all=True), height=210)
save('s_inhib_ruin', largest(crop(st, 1136, 398, 360, 299), keep_all=True), height=160)
save('s_nexus_ruin', largest(crop(st, 1580, 349, 514, 347), keep_all=True), height=260)
save('s_ally_nexus_ruin', largest(crop(st, 87, 356, 501, 361), keep_all=True), height=240)
save('deco_banner', largest(load('download3.png')), height=260)

# ───────── 이펙트 ─────────
fx = load('블루 골드 스킬 이펙트 시트.png')
cw, chh = 1774 / 5, 887 / 3
# W 보호막 프레임 실제 위치 (돔이 격자 칸 경계를 넘음)
# 넉넉한 영역에서 이펙트 덩어리만 추출(글로우가 자연스럽게 0까지 사라지도록) — 사각형 경계 잘림 방지
W_BOXES = {'w_0': (30, 390, 320, 210), 'w_1': (295, 340, 345, 250), 'w_2': (605, 285, 375, 330), 'w_3': (945, 265, 425, 292), 'w_icon': (1338, 318, 170, 245)}
names = [['q_0', 'q_1', 'q_2', 'q_3', 'q_hit'], ['w_0', 'w_1', 'w_2', 'w_3', 'w_icon'], ['r_0', 'r_1', 'r_2', 'r_3', 'r_trail']]
for r, row in enumerate(names):
    for c, n in enumerate(row):
        cell = fx.crop((int(c * cw), int(r * chh), int((c + 1) * cw), int((r + 1) * chh)))
        im = largest(cell, dil=10)
        if n in W_BOXES:  # W 보호막은 격자 칸보다 넓어 실제 위치로 잘라냄
            im = largest(crop(fx, *W_BOXES[n]), dil=3)
        save('fx_' + n, im, scale=0.75)
save('fx_purple_blast', largest(load('보랏빛 마법 충격파 폭발.png'), keep_all=True), height=300)
save('fx_red_strike', largest(load('붉은 번개 충격파 이펙트.png'), keep_all=True), height=320)

# ───────── 맵 소품 ─────────
d5 = load('download5.png')
pine = d5.crop((530, 48, 1236, 640))
save('deco_pine', largest(pine), height=140)
save('deco_group', largest(d5, keep_all=True), height=150)
tile = Image.open(os.path.join(SRC, '아기자기한 판타지 초원 타일.png')).convert('RGB')
patch = tile.crop((500, 200, 880, 450))
# 거울 반복으로 이음새 없는 타일 생성
w, h = patch.size
seam = Image.new('RGB', (w * 2, h * 2))
seam.paste(patch, (0, 0)); seam.paste(patch.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
seam.paste(patch.transpose(Image.FLIP_TOP_BOTTOM), (0, h)); seam.paste(patch.transpose(Image.ROTATE_180), (w, h))
seam = seam.resize((seam.width // 2, seam.height // 2), Image.LANCZOS)
seam.save(os.path.join(OUT, 'tile_grass.webp'), 'WEBP', quality=82)
manifest['tile_grass'] = list(seam.size)

# ───────── UI ─────────
hud = load('판타지 게임 HUD UI 스프라이트 시트.png')
U = {
    'ui_portrait': (28, 15, 361, 373), 'ui_frame_square': (1103, 1, 424, 447),
    'ui_q': (407, 454, 230, 229), 'ui_w': (649, 454, 230, 229), 'ui_r': (891, 454, 230, 229),
    'ui_frame_long': (57, 731, 938, 241), 'ui_frame_small': (1114, 808, 389, 117),
}
for k, b in U.items():
    save(k, largest(crop(hud, *b), keep_all=True), scale=0.6 if 'frame' in k else 0.55)
btns = largest(crop(hud, 1157, 502, 367, 124), keep_all=True)
bw = btns.width / 3
for i, n in enumerate(['ui_pause', 'ui_sound', 'ui_settings']):
    save(n, largest(btns.crop((int(i * bw), 0, int((i + 1) * bw), btns.height))), scale=0.6)

title = Image.open(os.path.join(SRC, '신도 레전드 판타지 시작 화면.png')).convert('RGB')
title.save(os.path.join(OUT, 'title_full.webp'), 'WEBP', quality=84)
manifest['title_full'] = list(title.size)
save('title_logo', Image.open(os.path.join(SRC, '신도 레전드 판타지 시작 화면.png')).convert('RGBA').crop((420, 10, 1300, 395)), scale=0.8, q=88)
save('title_champ', largest(load('download2.png')), height=900)
save('title_minions', largest(load('download4.png'), keep_all=True), height=300)
mm = Image.open(os.path.join(SRC, '삼각형 전장의 빛나는 미니맵.png')).convert('RGB')
mm.save(os.path.join(OUT, 'intro_map.webp'), 'WEBP', quality=80)
dio = Image.open(os.path.join(SRC, 'KakaoTalk_20261117_150731375.png')).convert('RGB')
dio.thumbnail((900, 900))
dio.save(os.path.join(OUT, 'diorama.webp'), 'WEBP', quality=82)

with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=0)
print(len(manifest), 'sprites')

# ───────── 팀장 NPC (추진·개발·사업) ─────────
def remove_light_bg(im, lo=232, sat=10):
    """흰/연회색 배경(투명 아님)을 투명으로: 테두리와 연결된 밝은 무채색 영역 + 큰 내부 배경 조각"""
    a = np.array(im.convert('RGBA')).astype(np.int32)
    rgb = a[:, :, :3]
    mx, mn = rgb.max(2), rgb.min(2)
    light = (mn >= lo) & (mx - mn <= sat)
    if lo < 232:
        # 잡티 섞인 배경: 작은 구멍을 메워 한 덩어리로
        light = ndimage.binary_closing(light, iterations=2) & (mn >= lo - 20)
    lab, n = ndimage.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndimage.sum(light, lab, range(1, n + 1))
    kill = np.zeros(n + 1, bool)
    for i in range(1, n + 1):
        if i in border or sizes[i - 1] > 900:
            kill[i] = True
    bg = kill[lab]
    edge = ndimage.binary_dilation(bg, iterations=1) & ~bg
    soft = edge & (mn >= lo - 32) & (mx - mn <= 18)
    alpha = np.where(bg, 0, 255)
    alpha = np.where(soft, ((255 - mn) * 255 / (255 - lo + 32)).clip(0, 255), alpha)
    a[:, :, 3] = np.minimum(a[:, :, 3], alpha)
    return Image.fromarray(a.astype(np.uint8))

def split4(x, y, w, h):
    q = w / 4
    return [(int(x + i * q), y, int(q), h) for i in range(4)]

CAPTAINS = {
    'push': ('추진팀장 스프라이트 시트2.png', True, {
        'idle': [(23, 10, 199, 245)], 'run': split4(1291, 39, 483, 190),
        'atk': [(24, 256, 185, 220), (220, 257, 192, 217), (418, 241, 226, 234), (626, 263, 239, 211)],
        'hit': (910, 476, 172, 209), 'down': (1070, 530, 222, 150), 'revive': (1285, 406, 215, 300),
        'victory': (1537, 465, 184, 222), 'icon': (60, 692, 194, 192), 'emblem': (1415, 685, 330, 202),
        'bolt': (1557, 290, 217, 120),
    }),
    'dev': ('개발팀장 스프라이트 시트.png', True, {
        'idle': [(9, 17, 213, 219)], 'run': split4(1285, 39, 486, 184),
        'atk': [(17, 249, 194, 197), (203, 245, 218, 200), (417, 238, 233, 207), (631, 253, 240, 192)],
        'hit': (895, 455, 180, 201), 'down': (1050, 505, 245, 160), 'revive': (1290, 393, 220, 290),
        'victory': (1520, 450, 199, 204), 'icon': (73, 671, 207, 206), 'emblem': (1422, 650, 277, 230),
        'bolt': (1542, 283, 214, 122),
    }),
    'biz': ('사업팀장 스프라이트 시트.png', False, {
        'idle': [(44, 14, 211, 248), (267, 14, 215, 247), (492, 15, 213, 247), (714, 14, 215, 247)],
        'run': [(1012, 27, 191, 236), (1199, 31, 186, 232), (1373, 35, 191, 228), (1564, 32, 188, 232)],
        'atk': [(32, 293, 200, 215), (268, 292, 203, 211), (470, 285, 200, 216), (671, 296, 234, 203)],
        'hit': (424, 530, 194, 189), 'down': (656, 551, 264, 168), 'revive': (967, 485, 322, 236),
        'victory': (1547, 506, 191, 214), 'icon': (60, 748, 141, 135), 'emblem': (1017, 736, 144, 144),
        'bolt': (1600, 345, 150, 125),
    }),
}
CAP_SCALE = 170 / 245  # 모든 프레임 동일 배율
for team, (fname, needs_bg, B) in CAPTAINS.items():
    sheet = Image.open(os.path.join(SRC, fname))
    if sheet.mode == 'RGBA' and needs_bg:
        # 반투명 밝은 배경 시트: 흰 바탕에 합친 뒤 배경 제거
        sheet = Image.alpha_composite(Image.new('RGBA', sheet.size, (255, 255, 255, 255)), sheet)
    white_sheet = sheet
    fx_sheet = None
    if needs_bg and fname.endswith('2.png'):
        # 같은 배치의 기존 시트(깨끗한 흰 배경)에서 얻은 외곽 마스크로 잡티 배경·글로우 주변 회색을 걷어냄
        sheet = remove_light_bg(sheet, 214, 9)
        ref = np.array(remove_light_bg(Image.open(os.path.join(SRC, fname.replace('2.png', '.png')))))[:, :, 3]
        ref = ndimage.maximum_filter(ref, size=7)
        a = np.array(sheet); a[:, :, 3] = np.minimum(a[:, :, 3], ref); sheet = Image.fromarray(a)
        # 하얀 심이 있는 번개 이펙트는 기본 기준으로 (안쪽 흰색 유지)
        fxa = np.array(remove_light_bg(white_sheet)); fxa[:, :, 3] = np.minimum(fxa[:, :, 3], ref); fx_sheet = Image.fromarray(fxa)
    elif needs_bg:
        sheet = remove_light_bg(sheet)
    else:
        sheet = sheet.convert('RGBA')
    a = np.array(sheet); a[:, :, 3][a[:, :, 3] < 30] = 0; sheet = Image.fromarray(a)
    fx_sheet = sheet if fx_sheet is None else fx_sheet
    for i, b in enumerate(B['idle']):
        save(f'cap_{team}_idle_{i}', largest(crop(sheet, *b)), scale=CAP_SCALE, center=True)
    for i, b in enumerate(B['run']):
        save(f'cap_{team}_run_{i}', largest(crop(sheet, *b)), scale=CAP_SCALE, center=True)
    for i, b in enumerate(B['atk']):
        save(f'cap_{team}_atk_{i}', largest(crop(sheet, *b)), scale=CAP_SCALE, center=True)
    for k in ('hit', 'victory'):
        save(f'cap_{team}_{k}', largest(crop(sheet, *B[k])), scale=CAP_SCALE, center=True)
    save(f'cap_{team}_down', largest(crop(sheet, *B['down'])), scale=CAP_SCALE)
    save(f'cap_{team}_revive', largest(crop(sheet, *B['revive']), keep_all=True, dil=8), scale=CAP_SCALE)
    save(f'cap_{team}_icon', largest(crop(sheet, *B['icon'])), height=96)
    save(f'cap_{team}_emblem', largest(crop(sheet, *B['emblem']), dil=8), height=72)
    save(f'fx_cap_{team}_bolt', largest(crop(fx_sheet, *B['bolt']), dil=8), height=60)
    if team == 'push':
        # 추진팀장 기본 서 있는 모습: 단독 일러스트(추진팀장2.png)를 시트 대기 프레임과 같은 키로 맞춤
        idle_h = round(largest(crop(sheet, *B['idle'][0])).height * CAP_SCALE)
        save('cap_push_idle_0', largest(load('추진팀장2.png')), height=idle_h, center=True)

# 게임 코드용 목록 갱신
keys = sorted(k for k in manifest if not k.startswith(('title_', 'tile_', 'intro_', 'diorama')))
with open(os.path.join(ROOT, 'src', 'config', 'spriteList.ts'), 'w') as f:
    f.write("/** tools/build_sprites.py 가 생성한 게임 스프라이트 목록 (public/assets/game/<key>.webp) */\n")
    f.write("export const SPRITE_KEYS = " + json.dumps(keys, indent=2).replace('"', "'") + " as const;\n")
