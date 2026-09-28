#!/usr/bin/env python3
"""Copy the Concierge project's build (PROJECT/dist) into the site repo.

  deploy.py            -> concierge-assets/ synced (old hashes removed) + every module shell's
                          <script>/<link> asset lines rewritten from the matching dist/*.html.
                          Writes work/deploy_removed.txt (old asset files to delete on production).

Run `npm run build` in the project first. Every build changes hashes for ALL shells, so each
production deploy = all shells + new assets + removal of the old ones.
"""
import re, os, sys, shutil
sys.path.insert(0, os.path.dirname(__file__)); from _paths import SITE, PROJECT, MODULES, project_entry, site_shell, module_langs
os.chdir(SITE)
old = set(os.listdir('concierge-assets')); new = set(os.listdir(f'{PROJECT}/dist/assets'))
for f in old - new: os.remove(f'concierge-assets/{f}')
for f in new: shutil.copyfile(f'{PROJECT}/dist/assets/{f}', f'concierge-assets/{f}')
work = os.path.join(os.path.dirname(__file__), 'work'); os.makedirs(work, exist_ok=True)
open(os.path.join(work, 'deploy_removed.txt'), 'w').write(''.join(f'concierge-assets/{f}\n' for f in sorted(old - new)))
print('removed', sorted(old - new)); print('added', sorted(new - old))
FONT = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap">\n')
for lang in module_langs():
    for mod in MODULES:
        shell = site_shell(lang, mod)
        if not os.path.exists(shell): sys.exit(f'missing site shell {shell} -- run pages.py {lang} first')
        d = open(f'{PROJECT}/dist/{project_entry(lang, mod)}', encoding='utf-8').read()
        lines = re.findall(r'<(?:script type="module" crossorigin src|link rel="modulepreload" crossorigin href|link rel="stylesheet" crossorigin href)="\./assets/[^"]+"[^>]*>(?:</script>)?', d)
        prefix = './concierge-assets/' if '/' not in shell else '../concierge-assets/'
        lines = [l.replace('./assets/', prefix) for l in lines]
        c = open(shell, encoding='utf-8').read()
        c = '\n'.join(l for l in c.split('\n') if 'concierge-assets/' not in l)
        block = '\n'.join(lines)
        if 'fonts.googleapis.com/css2?family=Inter' not in c: block = FONT + block
        c = c.replace('</head>', block + '\n</head>', 1)
        open(shell, 'w', encoding='utf-8').write(c)
print('shells updated for', module_langs())
