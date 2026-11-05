#!/usr/bin/env python3
"""base_cap_alloc.py — chia 1 đơn Pos cho các sale THEO ĐƠN GỐC BASE nhưng KHÔNG BAO GIỜ vượt tổng Pos.

NGUYÊN TẮC (Duyên chốt 2026-11-04): Pos là số chuẩn của đơn. Sau khi check ngược về Base, tổng chia cho các
sale của 1 đơn Pos phải BẰNG ĐÚNG giá trị Pos — Base không được làm tổng cao hơn Pos.

Ví dụ: Pos = đơn A + đơn B. Đơn A (Base) có sale 1 và sale 2; đơn B có sale 2.
    sale 1 = 50% A;  sale 2 = 100% B + 50% A.
Nếu A + B (Base) > Pos nghĩa là Pos đã giảm tiền cho A hoặc B -> phải mở đơn gốc xem giảm ở đơn nào để trừ
đúng đơn đó. Các ca này KHÔNG tự đoán: đánh dấu CHECK TAY, tạm chia theo tỷ lệ để tổng vẫn = Pos, và nhận
số đã check tay qua `overrides` ({mã Base: giá trị được tính}).

Hàm thuần (không đọc file) -> test được độc lập: `python3 base_cap_alloc.py --selftest`.
"""
import sys
from collections import defaultdict

OK = "KHOP"            # tổng Base = Pos
BASE_CAO = "BASE_CAO_HON_POS"   # tổng Base > Pos -> CHECK TAY
BASE_THAP = "BASE_THAP_HON_POS"  # tổng Base < Pos -> phần dư chia theo thẻ Pos


def _split_equal(amount, names):
    """Chia amount đều cho names (VND nguyên); phần lẻ dồn người cuối để tổng đúng tuyệt đối."""
    n = len(names)
    base = int(amount // n)
    out = [base] * n
    out[-1] += int(amount) - base * n
    return list(zip(names, out))


def allocate_pos_order(pos_total, base_orders, pos_cards, overrides=None):
    """pos_total : giá trị đơn Pos (sau giảm giá), tính 1 lần.
    base_orders: [{'code': mã Base, 'value': giá trị đơn gốc, 'sellers': [sale...]}]
    pos_cards  : thẻ Pos (danh sách sale) — chỉ dùng cho phần dư khi Base < Pos.
    overrides  : {mã Base: giá trị được tính} do Duyên check tay (đơn nào bị giảm trên Pos).
    Trả về dict: shares {sale: tiền}, status, base_sum, diff (= base_sum - pos), manual (bool), notes[].
    Bất biến: sum(shares) == pos_total (assert)."""
    overrides = overrides or {}
    pos_total = int(round(pos_total))
    notes = []
    counted = []   # [(code, giá trị được tính, sellers)]
    for b in base_orders:
        v = overrides.get(b['code'], b['value'])
        if b['code'] in overrides:
            notes.append(f"{b['code']}: dùng số check tay {int(v):,}".replace(",", "."))
        counted.append((b['code'], float(v), list(b['sellers'])))
    base_sum = sum(v for _, v, _ in counted)
    diff = int(round(base_sum)) - pos_total
    shares = defaultdict(float)
    manual = False

    if diff == 0:
        status = OK
        scale = 1.0
    elif diff > 0:
        status = BASE_CAO
        # chưa biết Pos giảm ở đơn nào -> tạm co đều theo tỷ lệ để KHÔNG vượt Pos; bắt buộc check tay
        manual = not overrides
        scale = pos_total / base_sum if base_sum else 0.0
        if manual:
            notes.append(f"Base {int(round(base_sum)):,} > Pos {pos_total:,} (+{diff:,}): mở đơn gốc xem Pos giảm tiền ở đơn nào, "
                         "nhập số đúng vào overrides; tạm co theo tỷ lệ".replace(",", "."))
    else:
        status = BASE_THAP
        scale = 1.0
    for code, v, sellers in counted:
        if not sellers:
            continue
        for s, amt in _split_equal(v * scale, sellers):
            shares[s] += amt
    if diff < 0:
        # Pos cao hơn Base: phần dư (phí/charm/hàng thêm) chia đều theo thẻ Pos như engine CRM
        rest = pos_total - int(round(base_sum))
        cards = list(pos_cards) or [s for _, _, ss in counted for s in ss][:1]
        for s, amt in _split_equal(rest, cards):
            shares[s] += amt
        notes.append(f"Base thấp hơn Pos {rest:,}: phần dư chia đều theo thẻ Pos".replace(",", "."))

    out = {k: int(round(v)) for k, v in shares.items()}
    # làm tròn: dồn chênh lệch (vài đồng) vào sale lớn nhất để tổng == Pos tuyệt đối
    gap = pos_total - sum(out.values())
    if out and gap:
        top = max(out, key=out.get)
        out[top] += gap
    assert sum(out.values()) == pos_total, (sum(out.values()), pos_total)
    return dict(shares=out, status=status, base_sum=int(round(base_sum)), diff=diff, manual=manual, notes=notes)


def _selftest():
    # 1) Ví dụ Duyên: A (sale1+sale2)=10tr, B (sale2)=6tr, Pos = 16tr -> sale1 = 5tr, sale2 = 5tr + 6tr
    r = allocate_pos_order(16_000_000, [dict(code='A', value=10_000_000, sellers=['s1', 's2']),
                                        dict(code='B', value=6_000_000, sellers=['s2'])], ['s1', 's2'])
    assert r['shares'] == {'s1': 5_000_000, 's2': 11_000_000} and r['status'] == OK and not r['manual'], r
    # 2) Thật: M45869 = 681T10 (Ngọc) 10.973.000 + 937T10 (Mai Huyền) 3.550.000 = Pos 14.523.000
    r = allocate_pos_order(14_523_000, [dict(code='681T10', value=10_973_000, sellers=['ngocNB2003saleoff']),
                                        dict(code='937T10/2026', value=3_550_000, sellers=['huyenmaii1990'])],
                           ['ngocNB2003saleoff', 'huyenmaii1990'])
    assert r['shares'] == {'ngocNB2003saleoff': 10_973_000, 'huyenmaii1990': 3_550_000} and r['status'] == OK, r
    # 3) Base CAO hơn Pos (Pos giảm 1tr): tổng vẫn = Pos, cờ CHECK TAY
    r = allocate_pos_order(15_000_000, [dict(code='A', value=10_000_000, sellers=['s1', 's2']),
                                        dict(code='B', value=6_000_000, sellers=['s2'])], ['s1', 's2'])
    assert sum(r['shares'].values()) == 15_000_000 and r['manual'] and r['status'] == BASE_CAO and r['diff'] == 1_000_000, r
    # 4) Sau khi check tay: Pos giảm ở đơn B (B chỉ còn 5tr) -> sale1 = 5tr, sale2 = 5tr + 5tr, không còn cờ
    r = allocate_pos_order(15_000_000, [dict(code='A', value=10_000_000, sellers=['s1', 's2']),
                                        dict(code='B', value=6_000_000, sellers=['s2'])], ['s1', 's2'], overrides={'B': 5_000_000})
    assert r['shares'] == {'s1': 5_000_000, 's2': 10_000_000} and not r['manual'] and r['status'] == OK, r
    # 5) Base THẤP hơn Pos: phần dư theo thẻ Pos, tổng vẫn = Pos
    r = allocate_pos_order(10_000_000, [dict(code='A', value=8_000_000, sellers=['s1'])], ['s1', 's2'])
    assert r['shares'] == {'s1': 9_000_000, 's2': 1_000_000} and r['status'] == BASE_THAP, r
    # 6) Số lẻ: 3 người chia 10.000.000 -> tổng đúng tuyệt đối
    r = allocate_pos_order(10_000_000, [dict(code='A', value=10_000_000, sellers=['a', 'b', 'c'])], ['a', 'b', 'c'])
    assert sum(r['shares'].values()) == 10_000_000, r
    print("selftest OK (6 ca)")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(__doc__)
