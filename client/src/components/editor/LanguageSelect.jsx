import { LANGUAGES } from '../../utils/constants.js';

const LanguageSelect = ({ value, onChange }) => (
  <select
    className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-[#0f1413] dark:text-neutral-100 dark:focus:border-teal-300 dark:focus:ring-teal-300/20"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    aria-label="Language"
  >
    {LANGUAGES.map((language) => (
      <option key={language.value} value={language.value}>
        {language.label}
      </option>
    ))}
  </select>
);

export default LanguageSelect;
