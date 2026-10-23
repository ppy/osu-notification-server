// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
    plugins: {
      '@stylistic': stylistic,
      'import-x': importX,
      jsdoc,
    },
    rules: {
      '@stylistic/arrow-parens': 'error',
      '@stylistic/brace-style': 'error',
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': 'error',
      '@stylistic/max-len': 'off',
      '@stylistic/new-parens': 'error',
      '@stylistic/no-multiple-empty-lines': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/quote-props': ['error', 'as-needed'],
      '@stylistic/quotes': [
        'error',
        'single',
        { avoidEscape: true },
      ],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/space-before-function-paren': [
        'error',
        {
          anonymous: 'never',
          asyncArrow: 'always',
          named: 'never',
        },
      ],
      '@stylistic/spaced-comment': 'error',
      'arrow-body-style': 'error',
      complexity: 'off',
      curly: ['error', 'multi-line'],
      'dot-notation': 'error',
      eqeqeq: ['error', 'smart'],
      'guard-for-in': 'error',
      'id-blacklist': [
        'error',
        'any',
        'Number',
        'number',
        'String',
        'string',
        'Boolean',
        'boolean',
        'Undefined',
        'undefined',
      ],
      'id-match': 'error',
      'import-x/order': ['error', { alphabetize: { order: 'asc' } }],
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-indentation': 'error',
      'jsdoc/tag-lines': 'error',
      'max-classes-per-file': 'error',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-console': 'error',
      'no-empty-function': 'error',
      'no-eval': 'error',
      'no-invalid-this': 'error',
      'no-new-wrappers': 'error',
      'no-shadow': ['error', { hoist: 'all' }],
      'no-throw-literal': 'error',
      'no-undef-init': 'error',
      'no-unsafe-finally': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      radix: 'error',
      'sort-keys': ['error', 'asc', { caseSensitive: false }],
    },
  },
  {
    extends: [tseslint.configs.recommended, tseslint.configs.recommendedTypeChecked],
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      perfectionist,
    },
    rules: {
      '@stylistic/indent': [
        'error',
        2,
        {
          FunctionDeclaration: {
            parameters: 'first',
          },
          FunctionExpression: {
            parameters: 'first',
          },
          SwitchCase: 1,
        },
      ],
      '@stylistic/member-delimiter-style': 'error',
      '@stylistic/type-annotation-spacing': 'error',
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'array',
        },
      ],
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/consistent-type-definitions': 'error',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: {
            memberTypes: [
              'public-static-field',
              'protected-static-field',
              'private-static-field',

              'public-instance-field',
              'protected-instance-field',
              'private-instance-field',

              'public-constructor',
              'protected-constructor',
              'private-constructor',

              'public-static-method',
              'protected-static-method',
              'private-static-method',

              'public-instance-method',
              'protected-instance-method',
              'private-instance-method',
            ],
            order: 'alphabetically',
          },
        },
      ],
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-invalid-this': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/parameter-properties': 'off',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowBoolean: true,
          allowNullish: true,
          allowNumber: true,
        },
      ],
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/unified-signatures': 'error',
      'dot-notation': 'off',
      'no-invalid-this': 'off',
      'no-throw-literal': 'off',
      'perfectionist/sort-enums': [
        'error',
        {
          ignoreCase: true,
          order: 'asc',
          sortByValue: 'never',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-interfaces': [
        'error',
        {
          ignoreCase: true,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
    },
  },
]);
