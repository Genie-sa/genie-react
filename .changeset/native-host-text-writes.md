---
"genie-react": patch
"@genie-react/cli": patch
---

On React Native, a render that changed text or other view props on screen was labeled `unnecessary` with `output-unchanged`, because Genie looked for React DOM's update flag and React Native's renderer never sets it. Genie now compares the host props too, so such a render reports `necessary` with `dom-changed` and lists its writes, and one that only replaced a callback reports `callbacks-changed`.
