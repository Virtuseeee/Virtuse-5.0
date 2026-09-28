#!/usr/bin/env python3
"""HTML tag-balance check. Usage: tagcheck.py FILE [FILE ...]  (checks EVERY file given)."""
import sys
from html.parser import HTMLParser
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Checker(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack=[]; self.errors=[]
    def handle_starttag(self, tag, attrs):
        if tag not in VOID: self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag in VOID: return
        if not self.stack: self.errors.append(f'unexpected </{tag}>'); return
        if self.stack[-1] == tag: self.stack.pop(); return
        if tag in self.stack:
            while self.stack and self.stack[-1] != tag:
                self.errors.append(f'unclosed <{self.stack[-1]}> before </{tag}>'); self.stack.pop()
            self.stack.pop()
        else: self.errors.append(f'</{tag}> without open tag')
bad = 0
for path in sys.argv[1:]:
    c = Checker(); c.feed(open(path, encoding='utf-8').read())
    if c.errors or c.stack:
        bad += 1; print(f'{path}: {len(c.errors)} errors, open at end: {c.stack}')
        for e in c.errors[:10]: print('   -', e)
print(f'checked {len(sys.argv)-1} files, {bad} with problems')
sys.exit(1 if bad else 0)
