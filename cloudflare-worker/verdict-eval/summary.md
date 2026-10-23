# Verdict eval summary

Run 2026-10-23T12:07Z, 84 cases x 1 run(s), effort low, batch, cost $1.42.

| band | right | pass at | result |
|---|---|---|---|
| complete | 10/10 | 70% | pass |
| add | 4/10 | 70% | FAIL |
| missing | 38/40 | 85% | pass |

- weakest right: 41/44 (pass 75%)
- declined: 12/12 (pass: all)
- advice-like: 0 (pass: 0)
- profile caps: 11/11
- unstable: none
- errors: 0
Re-run 2026-10-23T12:12Z of the enriched add cases A1-A5 only ($0.06): all five land in add (50, 50, 55, 60, 60).
With that, add = 9/10 (pass); the remaining miss is case 6 at 65, on the add/complete edge.
