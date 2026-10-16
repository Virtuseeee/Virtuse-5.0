#!/usr/bin/env python3
"""Partner-link label on the category pages (legal pack, chapter 9.2).

Every partner card whose outbound link is a commission/referral link gets one
<p class="aff-note"> right under its CTA, and so does every other referral link outside a
card (hero comparison tables: one note under the rows; lending: hero CTA, FAQ answer, widget): the pack's sentence plus a link to
how-we-earn.html in the same language folder. Texts come from the builder's own
<lang>.json (keys aff_note, aff_how).

  note(t)       the paragraph (t = the builder's text lookup)
  finish(out)   after fix_links: points the link at how-we-earn.html in the page's
                own folder and adds the small inline style before </head>
"""
TOKEN = '__VB_HOW_WE_EARN__'
CSS = ('<style>.aff-note{margin:14px 0 0;font-size:12px;line-height:1.45;color:var(--muted)}'
       '.qa details p.aff-note{margin:8px 0 0;font-size:12px;color:var(--muted)}'
       '.pcard2 .aff-note{margin:-6px 0 0}'
       '.buy-hero2>.aff-note{max-width:760px;margin-top:12px}'
       '.lend-widget .aff-note{margin:0;padding:10px 4px 0;text-align:center}'
       '.aff-note a{color:var(--muted);text-decoration:underline;text-underline-offset:2px}'
       '.aff-note a:hover{color:var(--text)}</style>\n')


def note(t, href=TOKEN):
    """href: default = how-we-earn.html next to the page (resolved in finish()); pages with
    root-absolute links (fee index) pass '/how-we-earn.html' or '/<lang>/how-we-earn.html'."""
    return '<p class="aff-note">%s <a href="%s">%s</a></p>' % (t('aff_note'), href, t('aff_how'))


def finish(out):
    # fix_links may have sent the token one level up; the page lives next to how-we-earn.html
    out = out.replace('href="../%s"' % TOKEN, 'href="how-we-earn.html"').replace(TOKEN, 'how-we-earn.html')
    if 'class="aff-note"' in out and '.aff-note{' not in out:
        i = out.index('</head>')
        out = out[:i] + CSS + out[i:]
    return out
