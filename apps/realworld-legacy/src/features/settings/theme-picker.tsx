import { Component } from 'react'
import { type ThemeName, type WithThemeProps, withTheme } from '../../contexts/theme'

const THEMES: { value: ThemeName; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

class ThemePickerView extends Component<WithThemeProps> {
  render() {
    const { theme, setTheme } = this.props.theme
    return (
      <fieldset className="theme-picker">
        <legend>Theme</legend>
        {THEMES.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onChange={() => setTheme(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    )
  }
}

export const ThemePicker = withTheme(ThemePickerView)
