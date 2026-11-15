export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'sf-theme'

export const THEME_BOOTSTRAP_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.dataset.theme='dark'}catch(e){}`
