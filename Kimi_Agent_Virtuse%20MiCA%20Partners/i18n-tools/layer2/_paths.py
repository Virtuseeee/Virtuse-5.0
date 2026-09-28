# Shared paths for the Layer 2 (Concierge modules) i18n tools.
import os
SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # Kimi_Agent_Virtuse%20MiCA%20Partners
PROJECT = os.path.expanduser('~/Documents/virtuse-concierge-deploy/bitcoin-concierge')
GHPAGES = '/private/tmp/gh-pages-wt3'  # gh-pages worktree; recreate with `git worktree add /private/tmp/gh-pages-wt3 gh-pages`
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
