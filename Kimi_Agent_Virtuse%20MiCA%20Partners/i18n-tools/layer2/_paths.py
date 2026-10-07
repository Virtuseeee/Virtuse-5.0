# Shared paths for the Layer 2 (Concierge modules) i18n tools.
import os
SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # Kimi_Agent_Virtuse%20MiCA%20Partners
# The module source lives in the repo at layer2-src/ (since 2026-10-07). VIRTUSE_LAYER2_SRC overrides it.
PROJECT = os.environ.get('VIRTUSE_LAYER2_SRC') or os.path.abspath(os.path.join(SITE, '..', 'layer2-src'))
def _find_ghpages():
    """Path of the checked-out gh-pages worktree (its /private/tmp path changes between sessions)."""
    import subprocess
    out = subprocess.run(['git', 'worktree', 'list', '--porcelain'], cwd=SITE, capture_output=True, text=True).stdout
    path = None
    for line in out.splitlines():
        if line.startswith('worktree '): path = line[9:]
        if line == 'branch refs/heads/gh-pages': return path
    return None  # none: git worktree add /private/tmp/gh-pages-wtN gh-pages
GHPAGES = _find_ghpages()
MODULES = ('concierge', 'stacking', 'loan', 'tax-agent')
# project entry file per module for EN (index.html = concierge) and per language (<lang>-<module>.html)
def project_entry(lang, mod):
    if lang == 'en':
        return 'index.html' if mod == 'concierge' else f'{mod}.html'
    return f'{lang}-{mod}.html'
def site_shell(lang, mod):
    return f'{mod}.html' if lang == 'en' else f'{lang}/{mod}.html'
def module_langs():
    """Languages that have module entries in the Concierge project (en first)."""
    langs = ['en']
    for f in sorted(os.listdir(PROJECT)):
        if f.endswith('-concierge.html'):
            langs.append(f.split('-')[0])
    return langs
