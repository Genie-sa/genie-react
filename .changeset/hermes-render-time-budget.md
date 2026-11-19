---
"genie-react": patch
"@genie-react/cli": patch
---

On React Native, a render window with the default budget ran out of time on an ordinary tap and skipped components, because the default time limits are measured in V8 and Hermes runs the analysis several times slower. An adaptive window on Hermes now gives commits eight times `timeLimitMs` and `targetTimeReserveMs`, `observationConfig` reports the limits in effect, and `budgetAdvice` still suggests a budget you can pass back unchanged.
