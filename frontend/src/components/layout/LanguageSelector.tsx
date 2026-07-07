import { useTranslation } from 'react-i18next'

import { supportedLanguages, type SupportedLanguage } from '../../i18n'

export function LanguageSelector() {
  const { i18n } = useTranslation()
  const currentLanguage = i18n.language.split('-')[0] as SupportedLanguage

  const changeLanguage = (language: SupportedLanguage) => {
    localStorage.setItem('factoryscribe-language', language)
    void i18n.changeLanguage(language)
  }

  return (
    <label className="language-selector">
      <select
        value={currentLanguage}
        aria-label="Language"
        onChange={(event) =>
          changeLanguage(event.target.value as SupportedLanguage)
        }
      >
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  )
}
