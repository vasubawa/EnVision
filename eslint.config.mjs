import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Static assets — vendored/minified files (e.g. the pdf.js worker) aren't source.
    'public/**',
    // Local dev artifacts.
    'temp/**',
  ]),
  {
    rules: {
      // Warn on console.log so you notice debug logs, but don't block commits.
      // Use  // eslint-disable-next-line no-console  for intentional logging.
      'no-console': 'warn',
      // Allow unused vars prefixed with _ (convention for "intentionally unused").
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])

export default eslintConfig
