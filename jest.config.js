module.exports = {
  roots: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'jsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transformIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\.(ts|tsx)$': ['babel-jest', { configFile: './babel.config.jest.js' }],
  },
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
  moduleNameMapper: {
    '\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',
     // Handle module aliases (if you have them in tsconfig.json)
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1', // Adjusted for your app structure
    '^@/styles/(.*)$': '<rootDir>/src/app/styles/$1', // If you have a styles alias
     // Add any other aliases here
  },
  testEnvironment: 'jsdom',
   // If using Next.js an older version of Next.js (<12) or custom Babel config:
  // preset: 'next/babel',
   // If using Next.js 12+ with SWC:
   // You might need a specific SWC transform for Jest if not using Babel.
   // For most Next.js 12+ projects with TypeScript, ensuring your tsconfig.json is correctly
   // set up and using 'ts-jest' or 'babel-jest' (if you have a .babelrc) is often sufficient.
   // If 'babel-jest' is used, ensure you have a babel.config.js or .babelrc.
   // For simplicity with Next.js 12+ and SWC, sometimes just 'ts-jest' works directly
   // if your babel dependencies are correctly configured for Jest.
   // The provided configuration uses 'babel-jest', assuming a typical Next.js setup that might
   // still rely on Babel for Jest transformations or if you have custom Babel settings.
   // If you are purely on SWC and don't want Babel for tests, you might explore @swc/jest.
   // For now, 'babel-jest' is a common choice that works in many Next.js setups.
   // If you don't have a babel.config.js, you might need to create one or switch to 'ts-jest'.
}; 