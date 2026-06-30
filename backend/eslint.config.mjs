import eslint from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 1. Global ignores
  { ignores: ['eslint.config.mjs', 'dist/'] },

  // 2. Base ESLint and TypeScript recommended rules
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // 3. Custom configuration object for your project
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      // Use a modern ECMAScript version
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Your project-specific rules for code quality (not style) go here.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // The 'semi' rule has been removed from here.
    },
  },

  // 3b. Disable unbound-method for test files only
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // 3c. Standalone scripts (infrastructure/) — use dedicated tsconfig to avoid
  //     "TSConfig does not include this file" errors from typed-linting
  {
    files: ['infrastructure/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.scripts.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 4. Prettier configuration. THIS MUST BE THE LAST ELEMENT IN THE ARRAY.
  // It disables any ESLint style rules that would conflict with Prettier.
  eslintPluginPrettierRecommended,
)