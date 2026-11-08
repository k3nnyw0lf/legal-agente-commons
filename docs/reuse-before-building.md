# Reuse before building

Before writing something new, check whether an open project already does it. This list was put together on 2026-11-08. **Before relying on any project, confirm it is still maintained and that its license is still the one listed here.** Nothing on this list is a dependency of this repo yet.

## How the license fits

This repo's code is licensed **AGPL-3.0** (counsel will confirm; see the [README](../README.md#license)).

- Under AGPL-3.0, everything below can live inside this repo. The MIT, BSD, MPL and Apache projects can be combined with AGPL code. GPL-3.0 and AGPL-3.0 code can also be combined. Each part keeps its own license file and notice, listed in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
- If the code license were ever changed to a permissive one like MIT, the AGPL and GPL items would have to run as **separate services**, not be copied into this repo.

## The list

| Project | What it could do here | License |
|---|---|---|
| [docassemble](https://github.com/jhpyle/docassemble) | Guided interviews that build documents. | MIT |
| [docassemble-AssemblyLine](https://github.com/SuffolkLITLab/docassemble-AssemblyLine) (Suffolk LIT Lab) | Ready parts for court-form interviews on docassemble. | MIT |
| [CASA volunteer management](https://github.com/rubyforgood/casa) (Ruby for Good) | Managing volunteers, their cases and their hours. | MIT |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (SYSTRAN) | Speech to text run on our own machine instead of a cloud service. | MIT |
| [eyecite](https://github.com/freelawproject/eyecite) (Free Law Project) | Finding legal citations in text, better than the simple finder in `src/index.js`. | BSD-2-Clause |
| [OCRmyPDF](https://github.com/ocrmypdf/OCRmyPDF) | Reading scanned papers on the server. | MPL-2.0 |
| [axe-core](https://github.com/dequelabs/axe-core) | Automatic accessibility checks (WCAG) in the tests. | MPL-2.0 |
| [Jitsi Meet](https://github.com/jitsi/jitsi-meet) | Video calls between a person and a helper. | Apache-2.0 |
| [CourtListener](https://github.com/freelawproject/courtlistener) (Free Law Project) | Case law search and citation checks. Already used through its public API. | AGPL-3.0 |
| [DocuSeal](https://github.com/docusealco/docuseal) | Signing documents and consent forms. | AGPL-3.0 |
| [Rallly](https://github.com/lukevella/rallly) | Finding a meeting time with a helper. | AGPL-3.0 |
| [A2J Author](https://github.com/CCALI/a2jauthor) (CALI) | Guided interviews for people without a lawyer. | AGPL-3.0 |
| [paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | Scanning, reading and filing paper that comes in by mail or at a partner desk. | GPL-3.0 |

## Ask permission first

- **Stanford Legal Issues Taxonomy** ([taxonomy.legal](https://taxonomy.legal)): ideal for the case-type codes used in matching. Its site says "All Rights Reserved" and states no license, so we must ask Stanford for permission before using it.
