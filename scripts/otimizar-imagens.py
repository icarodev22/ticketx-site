#!/usr/bin/env python3
"""Gera versões leves dos flyers e as imagens de compartilhamento (opcional).

Uso:  pip install pillow   (uma vez)
      python3 scripts/otimizar-imagens.py

Para cada assets/events/<slug>.jpg cria:
  assets/events/opt/<slug>-480.webp, -640.webp, -960.webp, <slug>-960.jpg
  assets/og/<slug>.jpg   (1200x630, prévia do WhatsApp/Instagram)
Se você não rodar este script, o site continua funcionando: usa o flyer
original e a prévia padrão (assets/brand/og-share.jpg).
"""
import pathlib
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance

RAIZ = pathlib.Path(__file__).resolve().parent.parent
EVENTOS = RAIZ / 'assets' / 'events'
OPT = EVENTOS / 'opt'
OG = RAIZ / 'assets' / 'og'
BRAND = RAIZ / 'assets' / 'brand'
OPT.mkdir(exist_ok=True)
OG.mkdir(exist_ok=True)


def redimensionar(im, largura):
    if im.width <= largura:
        return im.copy()
    return im.resize((largura, round(im.height * largura / im.width)), Image.LANCZOS)


def flyers():
    for f in sorted(EVENTOS.glob('*.jpg')):
        if f.stem.endswith('-destaque'):
            continue
        im = Image.open(f).convert('RGB')
        for w in (480, 640, 960):
            redimensionar(im, w).save(OPT / f'{f.stem}-{w}.webp', 'WEBP', quality=72, method=6)
        redimensionar(im, 960).save(OPT / f'{f.stem}-960.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
        og(f.stem, im)
        print('ok', f.name)


def og(slug, im):
    W, H = 1200, 630
    fundo = im.copy()
    escala = max(W / fundo.width, H / fundo.height)
    fundo = fundo.resize((round(fundo.width * escala), round(fundo.height * escala)), Image.LANCZOS)
    x, y = (fundo.width - W) // 2, (fundo.height - H) // 2
    fundo = fundo.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(28))
    fundo = ImageEnhance.Brightness(fundo).enhance(0.45)
    # flyer inteiro centralizado, com cantos arredondados
    alt = H - 60
    fl = im.resize((round(im.width * alt / im.height), alt), Image.LANCZOS)
    mask = Image.new('L', fl.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fl.width, fl.height), 22, fill=255)
    sombra = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle(((W - fl.width) // 2 + 6, 42, (W + fl.width) // 2 + 6, 42 + alt), 22, fill=(0, 0, 0, 150))
    sombra = sombra.filter(ImageFilter.GaussianBlur(14))
    base = fundo.convert('RGBA')
    base.alpha_composite(sombra)
    base.paste(fl, ((W - fl.width) // 2, 30), mask)
    # selo TicketX no canto
    logo = Image.open(BRAND / 'icon.png').convert('RGBA')
    logo = logo.resize((round(logo.width * 84 / logo.height), 84), Image.LANCZOS)
    base.alpha_composite(logo, (W - logo.width - 34, H - logo.height - 30))
    base.convert('RGB').save(OG / f'{slug}.jpg', 'JPEG', quality=84, optimize=True, progressive=True)


def icones():
    ic = Image.open(BRAND / 'icon.png').convert('RGBA')
    def quadrado(tam, fundo=None):
        lado = max(ic.size)
        tela = Image.new('RGBA', (lado, lado), fundo or (0, 0, 0, 0))
        tela.alpha_composite(ic, ((lado - ic.width) // 2, (lado - ic.height) // 2))
        return tela.resize((tam, tam), Image.LANCZOS)
    quadrado(32).save(BRAND / 'favicon-32.png', optimize=True)
    quadrado(192).save(BRAND / 'icon-192.png', optimize=True)
    quadrado(512).save(BRAND / 'icon-512.png', optimize=True)
    # iOS não aceita transparência no ícone: fundo escuro da marca
    p = Image.new('RGBA', (180, 180), (11, 7, 22, 255))
    p.alpha_composite(quadrado(150), (15, 15))
    p.convert('RGB').save(BRAND / 'apple-touch-icon.png', optimize=True)
    # logo em webp para o cabeçalho
    Image.open(BRAND / 'logo.png').save(BRAND / 'logo.webp', 'WEBP', lossless=True)


if __name__ == '__main__':
    flyers()
    icones()
