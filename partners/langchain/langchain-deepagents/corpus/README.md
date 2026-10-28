# Corpus: DOE Docket EERE-2021-BT-STD-0035

Energy Conservation Standards for Air Cleaners.
All files are US federal government publications (public domain).

## How to populate

Run `tools/fetch_docket.py` with a regulations.gov API key:

```bash
export REGULATIONS_GOV_API_KEY=your-key
python tools/fetch_docket.py
```

This downloads the full docket into the directory structure below.

## Expected structure

```
corpus/
├── rules/
│   ├── 88FR21752-final-rule.pdf    # Final rule (88 FR 21752)
│   ├── nopr.pdf                    # Simultaneous NOPR (FR doc 2023-06498)
│   └── confirmation.pdf            # Confirmation of dates (FR doc 2023-18860)
├── analysis/
│   ├── tsd.pdf                     # Technical Support Document
│   ├── lcc.xlsx                    # Life-Cycle Cost Analysis
│   ├── nia.xlsx                    # National Impact Analysis
│   ├── grim-joint.xlsx             # GRIM — Joint Proposal version
│   └── grim-dfr.xlsx               # GRIM — Direct Final Rule version
└── comments/
    ├── 0003-trane.pdf
    ├── 0005-miaq.pdf
    ├── 0006-electrolux.pdf
    ├── 0007-lennox.pdf
    ├── 0008-joint-commenters.pdf
    ├── 0009-ca-ious.pdf
    ├── 0010-blueair.pdf
    ├── 0011-molekule.pdf
    ├── 0012-daikin.pdf
    ├── 0013-neea.pdf
    ├── 0014-synexis.pdf
    ├── 0015-ahri.pdf
    └── 0016-joint-stakeholders.pdf
```

## Source

- Federal Register: https://www.federalregister.gov/documents/2023/04/11/2023-06499
- regulations.gov: https://www.regulations.gov/docket/EERE-2021-BT-STD-0035
