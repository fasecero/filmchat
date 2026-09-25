module.exports = {
  testEnvironment: 'node',
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {
      presets: ['@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }],
  },
  transformIgnorePatterns: ['node_modules/(?!(firebase|@firebase)/)'],
};