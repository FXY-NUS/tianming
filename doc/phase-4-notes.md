# Phase 4 Notes - Match Engine Finalization

## Current State

Phase 4 has moved from a scoring-engine foundation to an integrated match flow:

- `src/core/scoringEngine.ts` owns deterministic scoring.
- `src/core/matchEngine.ts` normalizes raw LLM evidence/narrative into `MatchScore` results.
- `services/matchPromptBuilder.ts` owns Gemini prompt and response schema assembly.
- `services/geminiService.ts` remains the Gemini transport boundary.
- Profile Modal now has a Persona tab and stores active Persona instances in `UserContext`.

## Scoring Boundary

The product rule is:

1. LLM extracts evidence and writes narrative explanations.
2. Code computes final score and final judgment.
3. Unknown evidence is not treated as zero.
4. Persona remains auxiliary; Ziwei stays opt-in and narrative-first unless explicitly weighted later.

Gemini audit schemas should not ask for an LLM-owned `score` or final `judgment`. The app may still expose `analysis.score` in UI, but that value must come from `MatchScore.overall`.

## Flow

Batch screen:

```text
Job[] + UserContext
  -> Gemini Flash evidence JSON
  -> scoreBatchScreenRecord()
  -> buildMatchScore(goal='triage')
  -> Job.flashScore / Job.matchScore
```

Deep audit:

```text
Job + UserContext
  -> Gemini Pro narrative + evidence JSON
  -> scoreDeepAuditRecord()
  -> buildMatchScore(goal='audit')
  -> Job.analysis.score / Job.analysis.matchScore
```

## Remaining Phase 4 Items

- Consider adding hard-filter UI toggles later; the scoring engine already supports the flags.
- Consider extracting chat prompts into the same prompt builder once chat becomes score-aware.
- Keep future Provider work behind service boundaries; do not put provider-specific SDK types into `src/core`.

## Validation Baseline

Before committing Phase 4 changes:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Known lint baseline currently allows warnings but no errors.
