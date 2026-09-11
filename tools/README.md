# tools: kiểm tra đáp án

Script Python nhỏ để **kiểm chứng** nội dung toán trước khi đưa lên trang (xem AI-HANDOFF.md, quy tắc 4).

| File | Làm gì | Cần cài |
|---|---|---|
| `simplex.py` | Giải QHTT bằng đơn hình có ẩn giả M, in từng bảng theo mẫu đáp án (cᵢ, ẩn CS, bᵢ, λ, hàng f(x), hàng M) | Không (chỉ thư viện chuẩn) |
| `dual.py` | Lập bài toán đối ngẫu theo quy tắc dấu; giải (P) và (D) để đối chiếu f(x*) = G(y*) | `pip install scipy` |

## Chạy thử

```bash
python tools/simplex.py   # đề cuối kỳ HK2 2022-23, Câu 1
python tools/dual.py      # ví dụ 7, bài giảng Chương 2
```

## Dùng cho bài khác

```python
from tools.simplex import print_result
print_result('max', [1, 4, 1], [[1, 0, 1], [2, 1, 6], [12, 12, 0]], ['<=', '>=', '='], [2, -1, 12])

from tools.dual import dual, show, solve
P = ('min', [2, 4, 3], [[1, 1, -2], [2, 1, 2], [1, 1, 2]], ['<=', '=', '<='], [12, 5, 16], ['>=0'] * 3)
print(show(dual(P), 'y', 'g'))
print(solve(P), solve(dual(P)))
```
