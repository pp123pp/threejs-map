module.exports = {
    root: true,
    
    env: {
        node: true
    },
    extends: [
        'plugin:vue/vue3-essential',
        '@vue/standard',
        '@vue/typescript/recommended'
    ],
    parserOptions: {
        ecmaVersion: 2020,
        ignoreImports: true,
    },
    rules: {
            'camelcase': 'off',
        'semi': ["error", "always"],
        "indent": ["error", 4],
        "@typescript-eslint/no-this-alias": ["off"],
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    }
}
