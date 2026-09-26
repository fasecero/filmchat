module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
  moduleDirectories: ['node_modules', 'functions/node_modules'],
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {
      presets: ['@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }],
  },
  transformIgnorePatterns: ['node_modules/(?!(firebase|@firebase)/)'],
};