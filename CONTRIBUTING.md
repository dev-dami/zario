# Contributing to teeny-logger

We welcome contributions from the community! Please follow these guidelines to ensure a smooth development process.

## Development Setup

1.  Fork the repository on GitHub.
2.  Clone your fork locally:
    ```bash
    git clone https://github.com/Dev-Dami/tini-log.git
    ```

3.  Install the dependencies:

    ```bash
    npm install
    ```

4.  Build the project:

    ```bash
    npm run build
    ```

5.  Run the tests:

    ```bash
    npm test
    ```

## Project Structure

```
teeny-logger/
│           
├── docs                           # Documentation (library)
├── src/
│   ├── core/
│   │   ├── Logger.ts              # Main logger class
│   │   ├── LogLevel.ts            # constants for log levels
│   │   ├── Formatter.ts           # Handles timestamp & message formatting
│   │   └── Transport.ts           # Base interface for log output targets
│   │
│   ├── transports/
│   │   ├── ConsoleTransport.ts    # Handles console output (colorized or not
│   │   └── FileTransport.ts       # Handles file-based logging
│   │
│   ├── utils/
│   │   ├── TimeUtil.ts            # Helper for timestamp formatting
│   │   └── ColorUtil.ts           # Handles colorization logic
│   │
│   ├── types/
│   │   └── index.d.ts             # Shared TypeScript interfaces/types
│   │
│   └── index.ts                   # Entry point that exports Logger and setup
│
├── tests/
│   ├── core/Logger.test.ts             # Unit tests for the core logger
│   └── transports/FileTransport.test.ts      # Tests for file logging
│
├── examples/
│   ├── basic.ts                   # Simple usage example
│   └── structured-json.ts         # Example of structured JSON logging
│
├── package.json
├── tsconfig.json
├── .eslint.json
├── jest.config.js
├── esbuild.config.js
└── README.md
```

## Code Style

-   Write clean, readable, and well-documented code.
-   Follow the existing code style and conventions.
-   Use TypeScript for all new code.
-   Make sure your code passes the ESLint checks.

## Submitting a Pull Request

1.  Create a new branch for your feature or bug fix.
2.  Commit your changes with a clear and descriptive commit message.
3.  Push your branch to your fork on GitHub.
4.  Create a pull request to the `main` branch of the original repository.
5.  Provide a detailed description of your changes in the pull request.

Thank you for contributing to `teeny-logger`!
