"""
dual.py: Lập bài toán đối ngẫu (D) từ bài toán gốc (P) theo quy tắc dấu của môn Tối ưu hóa,
và (tùy chọn) giải cả hai bằng scipy để đối chiếu nghiệm, kiểm tra f(x*) = G(y*).

Quy tắc dấu:
  (P) min -> (D) max: RB chung >= -> y >= 0 ; <= -> y <= 0 ; = -> y k.h.c
                      x >= 0 -> RB <= ; x <= 0 -> RB >= ; x k.h.c -> RB =
  (P) max -> (D) min: RB chung <= -> y >= 0 ; >= -> y <= 0 ; = -> y k.h.c
                      x >= 0 -> RB >= ; x <= 0 -> RB <= ; x k.h.c -> RB =

Mô tả bài toán: (sense, c, A, rel, b, xs)
  sense: 'min' | 'max'     c: hệ số hàm mục tiêu     A: ma trận hệ số (list các hàng)
  rel: list '<=', '>=', '='   b: vế phải   xs: list '>=0', '<=0', 'khc'

Cách dùng:  python tools/dual.py           (chạy ví dụ 7 trong bài giảng)
Phần giải cần:  pip install scipy
"""
from fractions import Fraction

SIGN = {'>=0': '>= 0', '<=0': '<= 0', 'khc': 'k.h.c'}


def dual(p):
    sense, c, A, rel, b, xs = p
    m, n = len(b), len(c)
    At = [[A[i][j] for i in range(m)] for j in range(n)]
    if sense == 'min':
        ys = [{'>=': '>=0', '<=': '<=0', '=': 'khc'}[r] for r in rel]
        drel = [{'>=0': '<=', '<=0': '>=', 'khc': '='}[x] for x in xs]
        return ('max', list(b), At, drel, list(c), ys)
    ys = [{'<=': '>=0', '>=': '<=0', '=': 'khc'}[r] for r in rel]
    drel = [{'>=0': '>=', '<=0': '<=', 'khc': '='}[x] for x in xs]
    return ('min', list(b), At, drel, list(c), ys)


def show(p, var='x', name='f'):
    sense, c, A, rel, b, xs = p
    term = lambda row: ' '.join(f"{'+' if a >= 0 else '-'} {'' if abs(a) == 1 else abs(a)}{var}{j+1}" for j, a in enumerate(row) if a != 0).lstrip('+ ')
    lines = [f"{name}({var}) = {term(c)} -> {sense}"]
    lines += [f"   {term(row)} {r} {bi}" for row, r, bi in zip(A, rel, b)]
    lines.append('   ' + '; '.join(f"{var}{j+1} {SIGN[s]}" for j, s in enumerate(xs)))
    return '\n'.join(lines)


def solve(p):
    """Giải bằng scipy.optimize.linprog (HiGHS). Trả về (nghiệm dạng phân số, giá trị tối ưu) hoặc thông báo."""
    from scipy.optimize import linprog
    sense, c, A, rel, b, xs = p
    sgn = 1 if sense == 'min' else -1
    A_ub, b_ub, A_eq, b_eq = [], [], [], []
    for row, r, bi in zip(A, rel, b):
        if r == '<=':
            A_ub.append(row); b_ub.append(bi)
        elif r == '>=':
            A_ub.append([-v for v in row]); b_ub.append(-bi)
        else:
            A_eq.append(row); b_eq.append(bi)
    bounds = [(0, None) if s == '>=0' else (None, 0) if s == '<=0' else (None, None) for s in xs]
    res = linprog([sgn * v for v in c], A_ub=A_ub or None, b_ub=b_ub or None,
                  A_eq=A_eq or None, b_eq=b_eq or None, bounds=bounds, method='highs')
    if res.status != 0:
        return res.message, None
    frac = lambda v: str(Fraction(v).limit_denominator(1000))
    return [frac(v) for v in res.x], frac(sgn * res.fun)


if __name__ == '__main__':
    # Ví dụ 7, bài giảng Chương 2
    P = ('max', [6, 2, 5], [[2, 3, 1], [1, 0, 1], [1, 2, 5]], ['<=', '<=', '<='], [10, 6, 19], ['>=0'] * 3)
    D = dual(P)
    print(show(P), '\n')
    print(show(D, 'y', 'G'), '\n')
    try:
        print('(P):', solve(P))
        print('(D):', solve(D), '  <- giá trị tối ưu phải bằng (P)')
    except ImportError:
        print('Cài scipy để giải đối chiếu: pip install scipy')
