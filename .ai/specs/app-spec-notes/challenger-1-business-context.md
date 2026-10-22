# Challenger findings — §1 Business Context (Execution: sequential fallback)

Inputs received: this section, the ubiquitous-language glossary (§1.3), this instruction.
Author mode resumed afterwards; CRITICAL findings fixed before proceeding.

## Findings

### CRITICAL
1. **WF1 ROI is not a metric.** §3.1 `**ROI:**` reads "measurable: time-to-running reduced to single command; safety: untrusted agent code isolated without Docker" — per `references/quality-gates.md`, a workflow without a specific measurable outcome is a demo, not a feature. The §1.2 "primary measurable goal" carries the target (≤2 min, boot <100 ms) but the workflow-level ROI must repeat it.
   - **Fix applied:** §3.1 WF1 ROI now cites the concrete targets (≤2 min to running for typical stack; <100 ms boot per sandbox).

2. **Glossary ambiguity: "source of data" for compose project.** §1.3 defines compose project as directory name by default; compose actually sources it from the top-level `name:` key or the directory name. One term, two sources — a terminology drift the challenger would keep hunting.
   - **Fix applied:** glossary row now says source = top-level `name:` key or directory name.

### WARNING
3. §1.4 invariant "No Docker anywhere" merged user-mandated wording into an invariant; invariants should be objectively checkable, decisions recorded separately. The decision is now mirrored in §2 Decision log and §10 — accepted, flagged for consistency in future revisions.

4. §1.1 flywheel omits the "user pays / org pays" loop nuance for the future commercial tier; recorded as open question in §10 (none open yet).

## Verdict
Section sound after fixes. Proceeded to §2 with the corrected ROI and glossary.