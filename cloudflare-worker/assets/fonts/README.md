Inter (https://rsms.me/inter/, SIL Open Font License 1.1, see OFL.txt), from
@expo-google-fonts/inter 0.2.3, subset with fontTools pyftsubset to the
characters the paid Verdict PDF needs (src/features/verdict-pay/pdf.js):

  pyftsubset Inter_400Regular.ttf (and Inter_700Bold.ttf) \
    --unicodes="U+0020-007E,U+00A0-017F,U+0400-045F,U+2010-2027,U+2030-203A,U+20AC,U+2122,U+2190-2193,U+2212,U+2264,U+2265,U+25CF,U+2713" \
    --layout-features='kern,liga'

build.mjs inlines both files into src/generated/fonts.js (git-ignored).
