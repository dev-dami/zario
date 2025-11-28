# Tini-Log Test Suite

This directory contains comprehensive unit tests for the tini-log library.

## Setup

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- FileTransport

# Run specific test suite
npm test -- --testNamePattern="Constructor"
```

## Test Structure