#!/usr/bin/env bash
# Chay lai TOAN BO bang thuong T10 + hoa hong + lech don ghep tren file KT moi nhat.
# Dung: bash tools/bonus-t10/run_all.sh <file_KT.xlsx> <CheckNguocBase.xlsx> <thu_muc_work> <ra.xlsx>
set -e; KT="$1"; CNB="$2"; W="$3"; OUT="$4"; B="$(dirname "$0")"; mkdir -p "$W"
python3 $B/prepare_base.py "$KT" $W/KT_base.xlsx
python3 $B/extract_orders.py $W/KT_base.xlsx $W
node $B/calc_bonus.js $W
python3 $B/build_into_source.py $W/KT_base.xlsx $W $W/S1.xlsx
node $B/calc_commission.js $W
python3 $B/build_commission_sheet.py $W/S1.xlsx $W $W/S2.xlsx
python3 $B/diff_ghep_vs_pos.py "$CNB" "$KT" $W/LECH.xlsx
python3 $B/finalize_combined.py $W/S2.xlsx $W/LECH.xlsx "$OUT"
python3 /mnt/skills/public/xlsx/scripts/recalc.py "$OUT" 300 | head -8
python3 $B/fix_filters.py "$OUT"
