import re,os,sys
SITE = os.environ.get('VIRTUSE_SITE') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
L=sys.argv[1]; f=sys.argv[2] if len(sys.argv)>2 else os.path.join(SITE,L,'index.html')
h=open(f).read(); bad=0; n=0
for u in re.findall(r'\b(?:href|src)="([^"]+)"',h):
    if re.match(r'(https?:|mailto:|#|data:|javascript:)',u): continue
    p=re.split(r'[?#]',u)[0]
    if not p: continue
    full=os.path.join(SITE,p.lstrip('/')) if p.startswith('/') else os.path.normpath(os.path.join(SITE,L,p))
    if os.path.isdir(full): full=os.path.join(full,'index.html')
    n+=1
    if not os.path.exists(full): bad+=1; print('MISSING',u)
print(L,n,'links',bad,'missing')
