#!/bin/zsh
set -e
cd "$(dirname "$0")"
U="file://$PWD/out/logo-anim.html"
D=out/deliver; mkdir -p $D
R(){ node render.cjs "$@"; }
R "$U?variant=intro&layout=stacked&theme=dark"        1080 1920 30 2000 frames/intro-dark   0
R "$U?variant=intro&layout=stacked&theme=light"       1080 1920 30 2000 frames/intro-light  0
R "$U?variant=intro&layout=outro&theme=dark"          1080 1920 30 2600 frames/outro-dark   0
R "$U?variant=intro&layout=outro&theme=light"         1080 1920 30 2600 frames/outro-light  0
R "$U?variant=intro&layout=stacked&theme=dark&size=62vw"  1080 1080 30 2000 frames/square-dark  0
R "$U?variant=intro&layout=stacked&theme=light&size=62vw" 1080 1080 30 2000 frames/square-light 0
R "$U?variant=intro&layout=horizontal&theme=transparent&size=60vw" 1920 1080 30 2000 frames/overlay 1
R "$U?variant=loop&layout=stacked&theme=dark&sub=0&size=66vw"  512 512 20 3000 frames/loop-dark  0
R "$U?variant=loop&layout=stacked&theme=light&sub=0&size=66vw" 512 512 20 3000 frames/loop-light 0
R "$U?variant=static&layout=mark&theme=dark&size=56vw"        512 512 1 1000 frames/avatar-512  0
R "$U?variant=static&layout=mark&theme=dark&size=56vw"       1024 1024 1 1000 frames/avatar-1024 0
R "$U?variant=static&layout=mark&theme=transparent&size=90vw" 1024 1024 1 1000 frames/mark-transparent 1
R "$U?variant=static&layout=horizontal&theme=transparent&size=92vw" 2400 640 1 1000 frames/lockup-transparent 1
echo "== encode"
./encode frames/intro-dark   30 $D/virtuse-logo-intro-1080x1920.mp4 h264 12
./encode frames/intro-light  30 $D/virtuse-logo-intro-1080x1920-light.mp4 h264 12
./encode frames/outro-dark   30 $D/virtuse-logo-outro-1080x1920.mp4 h264 12
./encode frames/outro-light  30 $D/virtuse-logo-outro-1080x1920-light.mp4 h264 12
./encode frames/square-dark  30 $D/virtuse-logo-square-1080.mp4 h264 10
./encode frames/square-light 30 $D/virtuse-logo-square-1080-light.mp4 h264 10
./encode frames/overlay      30 $D/virtuse-logo-transparent-prores4444.mov prores4444
./encode frames/overlay      30 $D/virtuse-logo-transparent-hevc-alpha.mov hevcAlpha 10
cp frames/avatar-512/f0000.png $D/virtuse-logo-static-512.png
cp frames/avatar-1024/f0000.png $D/virtuse-logo-static-1024.png
cp frames/mark-transparent/f0000.png $D/virtuse-logo-mark-1024-transparent.png
cp frames/lockup-transparent/f0000.png $D/virtuse-logo-lockup-2400-transparent.png
/usr/bin/python3 - <<'PY'
from PIL import Image; import glob
for th in ('dark','light'):
    fs=sorted(glob.glob(f'frames/loop-{th}/*.png')); ims=[Image.open(f).convert('RGB') for f in fs]
    pal=ims[len(ims)//2].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    q=[im.quantize(colors=128, palette=pal, dither=Image.Dither.FLOYDSTEINBERG) for im in ims]
    name=f'out/deliver/virtuse-logo-loop-512{"" if th=="dark" else "-light"}.gif'
    q[0].save(name, save_all=True, append_images=q[1:], duration=50, loop=0, optimize=True)
    print('gif', name, len(q))
PY
echo "== done"; ls -l $D
