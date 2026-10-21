#!/bin/zsh
set -e; cd "$(dirname "$0")"; U="file://$PWD/out/logo3d.html"; D=out/deliver3d; rm -rf $D; mkdir -p $D/web
R(){ node render3d.cjs "$@"; }
R "$U?variant=intro&size=0.46"  1080 1920 30 2500 frames/3d-intro-dark 0
R "$U?variant=intro&size=0.46&theme=light" 1080 1920 30 2500 frames/3d-intro-light 0
R "$U?variant=outro&size=0.46"  1080 1920 30 3600 frames/3d-outro-dark 0
R "$U?variant=intro&size=0.72"  1080 1080 30 2500 frames/3d-square-dark 0
R "$U?variant=intro&size=0.72&theme=light" 1080 1080 30 2500 frames/3d-square-light 0
R "$U?variant=intro&size=0.62"  1080 1350 30 2500 frames/3d-45-dark 0
R "$U?variant=intro&size=0.85"  1920 1080 30 2500 frames/3d-169-dark 0
R "$U?variant=intro&size=0.85&theme=transparent" 1920 1080 30 2500 frames/3d-overlay 1
R "$U?variant=loop&size=0.78"   512 512 20 3600 frames/3d-loop-dark 0
R "$U?variant=loop&size=0.78&theme=light" 512 512 20 3600 frames/3d-loop-light 0
R "$U?variant=static&size=0.8"  1024 1024 1 1000 frames/3d-avatar-1024 0
R "$U?variant=static&size=0.8"  512 512 1 1000 frames/3d-avatar-512 0
R "$U?variant=static&size=0.8&theme=transparent" 1024 1024 1 1000 frames/3d-mark-transparent 1
echo "== encode"
./encode frames/3d-intro-dark 30 $D/virtuse-logo-intro-1080x1920.mp4 h264 12
./encode frames/3d-intro-light 30 $D/virtuse-logo-intro-1080x1920-light.mp4 h264 12
./encode frames/3d-outro-dark 30 $D/virtuse-logo-outro-1080x1920.mp4 h264 12
./encode frames/3d-square-dark 30 $D/virtuse-logo-square-1080.mp4 h264 10
./encode frames/3d-square-light 30 $D/virtuse-logo-square-1080-light.mp4 h264 10
./encode frames/3d-45-dark 30 $D/virtuse-logo-feed-1080x1350.mp4 h264 10
./encode frames/3d-169-dark 30 $D/virtuse-logo-wide-1920x1080.mp4 h264 12
./encode frames/3d-overlay 30 $D/virtuse-logo-transparent-prores4444.mov prores4444
./encode frames/3d-overlay 30 $D/virtuse-logo-transparent-hevc-alpha.mov hevcAlpha 10
cp frames/3d-avatar-512/f0000.png $D/virtuse-logo-static-512.png; cp frames/3d-avatar-1024/f0000.png $D/virtuse-logo-static-1024.png; cp frames/3d-mark-transparent/f0000.png $D/virtuse-logo-mark-1024-transparent.png
/usr/bin/python3 - <<'PY'
from PIL import Image; import glob
for th in ('dark','light'):
    fs=sorted(glob.glob(f'frames/3d-loop-{th}/*.png')); ims=[Image.open(f).convert('RGB') for f in fs]
    pal=ims[len(ims)//2].quantize(colors=192, method=Image.Quantize.MEDIANCUT)
    q=[im.quantize(colors=192, palette=pal, dither=Image.Dither.FLOYDSTEINBERG) for im in ims]
    q[0].save(f'out/deliver3d/virtuse-logo-loop-512{"" if th=="dark" else "-light"}.gif', save_all=True, append_images=q[1:], duration=50, loop=0, optimize=False)
print('gifs ok')
PY
cp out/logo3d.html $D/web/virtuse-logo-3d.html
echo "== done"; ls -l $D
