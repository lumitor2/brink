import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'build/**', 'node_modules/**', 'coverage/**', '**/*.tsbuildinfo']
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Main / preload / shared / config → Node environment.
  {
    files: [
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'src/shared/**/*.ts',
      '*.config.{ts,js,mjs}'
    ],
    languageOptions: { globals: globals.node }
  },

  // Renderer → browser environment + React hooks rules.
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off'
    }
  },

  // Tests run under Node.
  { files: ['test/**/*.ts'], languageOptions: { globals: globals.node } },

  // CommonJS build scripts.
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },

  // Disable formatting-related rules that Prettier owns.
  prettier
)
