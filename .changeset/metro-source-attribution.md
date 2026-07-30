---
'genie-react': patch
---

Attribute React Native components to their real source files, including Expo/Hermes bundle URLs and framework-wrapped app roots. Metro frames are symbolicated through the dev server's `/symbolicate` endpoint with shared in-flight lookups and retryable failures. An unsymbolicated bundle remains visible as diagnostic source data but has unknown ownership, so `appOnly` never guesses that it belongs to the app. Folded library trees preserve valid parent links, and filtered reads warn only when no app-owned result survived the ownership filter.
