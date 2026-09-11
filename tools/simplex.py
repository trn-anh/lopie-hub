"""
simplex.py: Giải bài toán QHTT bằng phương pháp đơn hình (ẩn giả M),
in bảng theo đúng mẫu đáp án môn Tối ưu hóa (HCMUTE):
cột c_i | ẩn CS | b_i | x_1..x_n (gồm ẩn phụ, KHÔNG gồm cột ẩn giả) | lambda,
hàng f(x) (phần hệ số tự do của Delta_j) và hàng M (phần hệ số của M).

Quy ước (khớp đáp án của giảng viên):
- RB có vế phải âm: nhân -1 và đổi chiều trước.
- RB <=: thêm ẩn phụ +x; RB >=: trừ ẩn phụ -x và thêm ẩn giả; RB =: thêm ẩn giả.
- Đánh số: ẩn phụ trước (theo thứ tự RB), ẩn giả sau.
- Hệ số ẩn giả: +M nếu min, -M nếu max.
- Delta_j = sum(c_i * a_ij) - c_j. Min: tối ưu khi mọi Delta <= 0, chọn Delta dương lớn nhất.
  Max: tối ưu khi mọi Delta >= 0, chọn Delta âm nhỏ nhất. So phần M trước, hòa thì so phần tự do.
- Ẩn ra: lambda = b_i / a_ik nhỏ nhất (a_ik > 0). Giữ nguyên thứ tự dòng ẩn cơ sở.

Cách dùng:  python tools/simplex.py      (chạy ví dụ đề cuối kỳ HK2 2022-23)
Chỉ dùng thư viện chuẩn của Python (fractions), không cần cài thêm.
"""
from fractions import Fraction as Fr
def fs(v):
    v=Fr(v); return str(v.numerator) if v.denominator==1 else f"{v.numerator}/{v.denominator}"
def fmtM(k0,kM):
    k0=Fr(k0);kM=Fr(kM)
    if kM==0: return fs(k0)
    m = ('' if abs(kM)==1 else fs(abs(kM)))+'M'
    s = ('-' if kM<0 else '')+m
    if k0==0: return s
    return s+(' + ' if k0>0 else ' − ')+fs(abs(k0))
def simplex(sense,c,A,rel,b,verbose=True):
    m=len(A); n=len(c)
    A=[[Fr(v) for v in r] for r in A]; b=[Fr(v) for v in b]; rel=list(rel)
    notes=[]
    for i in range(m):
        if b[i]<0:
            A[i]=[-v for v in A[i]]; b[i]=-b[i]; rel[i]={'<=':'>=','>=':'<=','=':'='}[rel[i]]
            notes.append(f"RB {i+1} có vế phải âm → nhân −1, đổi chiều thành {rel[i]}")
    # slack vars
    cols=[('x%d'%(j+1),Fr(c[j]),0) for j in range(n)]
    rows=[list(A[i]) for i in range(m)]
    basis=[None]*m
    k=n
    for i in range(m):
        if rel[i] in('<=','>='):
            k+=1
            for r in range(m): rows[r].append(Fr(0))
            rows[i][-1]=Fr(1 if rel[i]=='<=' else -1)
            cols.append(('x%d'%k,Fr(0),0))
            if rel[i]=='<=': basis[i]=len(cols)-1
    ncols=len(cols)
    art=[]
    for i in range(m):
        if basis[i] is None:
            k+=1
            art.append((i,'x%d'%k))
    # basis entries: ('col',idx) or ('art',name)
    B=[]
    for i in range(m):
        if basis[i] is not None: B.append(('col',basis[i]))
        else: B.append(('art',[a[1] for a in art if a[0]==i][0]))
    Msign = 1 if sense=='min' else -1
    def cb(e):
        if e[0]=='col': return (cols[e[1]][1],Fr(0))
        return (Fr(0),Fr(Msign))
    tables=[]
    it=0
    while True:
        # compute delta
        D=[]
        for j in range(ncols):
            d0=sum(cb(B[i])[0]*rows[i][j] for i in range(m))-cols[j][1]
            dM=sum(cb(B[i])[1]*rows[i][j] for i in range(m))
            D.append((d0,dM))
        f0=sum(cb(B[i])[0]*b[i] for i in range(m)); fM=sum(cb(B[i])[1]*b[i] for i in range(m))
        key=lambda d:(d[1],d[0])
        if sense=='min':
            cand=[j for j in range(ncols) if key(D[j])>(0,0)]
            enter=max(cand,key=lambda j:key(D[j])) if cand else None
        else:
            cand=[j for j in range(ncols) if key(D[j])<(0,0)]
            enter=min(cand,key=lambda j:key(D[j])) if cand else None
        lam=[None]*m; leave=None
        if enter is not None:
            best=None
            for i in range(m):
                if rows[i][enter]>0:
                    lam[i]=b[i]/rows[i][enter]
                    if best is None or lam[i]<best: best=lam[i]; leave=i
        t={'basis':[(fs(cb(e)[0]) if cb(e)[1]==0 else ('M' if cb(e)[1]>0 else '-M')) for e in B],
           'names':[cols[e[1]][0] if e[0]=='col' else e[1] for e in B],
           'b':[fs(v) for v in b],'rows':[[fs(v) for v in r] for r in rows],
           'lam':[fs(v) if v is not None else '–' for v in lam],
           'D0':[fs(d[0]) for d in D],'DM':[fs(d[1]) for d in D],'f0':fs(f0),'fM':fs(fM),
           'enter':cols[enter][0] if enter is not None else None,
           'leave':(t_:=None)}
        if enter is not None and leave is not None:
            t['leave']=t['names'][leave]; t['pivot']=[leave,enter]
        tables.append(t)
        if enter is None or leave is None: break
        pv=rows[leave][enter]
        rows[leave]=[v/pv for v in rows[leave]]; b[leave]/=pv
        for i in range(m):
            if i!=leave and rows[i][enter]!=0:
                fct=rows[i][enter]
                rows[i]=[a-fct*p for a,p in zip(rows[i],rows[leave])]; b[i]-=fct*b[leave]
        B[leave]=('col',enter)
        it+=1
        if it>10: break
    x=[Fr(0)]*ncols; artpos=False
    for i,e in enumerate(B):
        if e[0]=='col': x[e[1]]=b[i]
        elif b[i]!=0: artpos=True
    return {'notes':notes,'cols':[cc[0] for cc in cols],'c':[fs(cc[1]) for cc in cols],'tables':tables,
            'x':[fs(v) for v in x],'artpos':artpos,'art':[a[1] for a in art],'f':fs(sum(Fr(c[j])*x[j] for j in range(n)))}


def print_result(sense, c, A, rel, b):
    r = simplex(sense, c, A, rel, b)
    for note in r['notes']:
        print('Lưu ý:', note)
    print('Cột:', ' '.join(r['cols']), '| ẩn giả:', ', '.join(r['art']) or '(không có)')
    for k, t in enumerate(r['tables']):
        print(f"\n--- {'Bảng xuất phát' if k == 0 else 'Bảng ' + str(k)} ---")
        w = 7
        print('c_i'.ljust(5), 'CS'.ljust(4), 'b_i'.rjust(w), *[x.rjust(w) for x in r['cols']], 'lambda'.rjust(w))
        for ci, nm, bi, row, lam in zip(t['basis'], t['names'], t['b'], t['rows'], t['lam']):
            print(ci.ljust(5), nm.ljust(4), bi.rjust(w), *[v.rjust(w) for v in row], lam.rjust(w))
        print(''.ljust(5), 'f(x)'.ljust(4), t['f0'].rjust(w), *[v.rjust(w) for v in t['D0']])
        print(''.ljust(5), 'M'.ljust(4), t['fM'].rjust(w), *[v.rjust(w) for v in t['DM']])
        if t['enter']:
            print(f"Ẩn vào: {t['enter']}  ·  Ẩn ra: {t['leave']}")
        else:
            print('Điều kiện tối ưu thỏa (hoặc bài toán không giới nội).')
    print('\nx* (bài toán mở rộng, không gồm ẩn giả):', r['x'])
    print('f(x*) =', r['f'], '| còn ẩn giả dương trong cơ sở:', r['artpos'])
    return r


if __name__ == '__main__':
    # Đề cuối kỳ HK2 2022-23, Câu 1: f = 2x1 + 4x2 + 3x3 -> min
    print_result('min', [2, 4, 3],
                 [[1, 1, -2], [2, 1, 2], [1, 1, 2]],
                 ['<=', '=', '<='],
                 [12, 5, 16])
