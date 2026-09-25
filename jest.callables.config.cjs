module.exports = {
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'functions/node_modules'],
  transform: {
    '\\.[jt]sx?$': ['babel-jest', {
      presets: ['@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }],
  },
  transformIgnorePatterns: ['node_modules/(?!(firebase|@firebase)/)'],
};