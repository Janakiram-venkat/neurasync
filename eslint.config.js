import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Only src/tracking may read page visibility (see CLAUDE.md).
      'no-restricted-properties': [
        'error',
        {
          object: 'document',
          property: 'visibilityState',
          message: 'Only src/tracking/ may read visibility.',
        },
        {
          object: 'document',
          property: 'hidden',
          message: 'Only src/tracking/ may read visibility.',
        },
      ],
    },
  },
  {
    files: ['src/tracking/**'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // The engine is pure: no React, no Dexie, no browser APIs.
    files: ['src/engine/**'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['react', 'react-*', 'dexie', 'zustand', '*/db/*', '*/store/*', '*/tracking/*'],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'indexedDB',
      ],
    },
  },
);
