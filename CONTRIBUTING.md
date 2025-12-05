<div align="center">

<a id="top"></a>

# 🤝 Contributing to Zario

## We're thrilled you're here and excited to see you contribute!

</div>

<br/>

Welcome to the `Zario` community! We believe in the power of collaboration and appreciate every contribution, from a simple typo fix to a major new feature. This guide will help you get started and ensure a smooth and positive experience.

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 💬 How You Can Contribute

There are many ways to contribute to the project, and we welcome all of them!

<table>
<tr>
<td width="25%" align="center">
<strong>🐛 Report Bugs</strong><br/>
<sub>Found something broken?</sub><br/>
<a href="https://github.com/Dev-Dami/zario/issues/new?template=bug_report.md">Report it →</a>
</td>
<td width="25%" align="center">
<strong>💡 Request Features</strong><br/>
<sub>Have a great idea?</sub><br/>
<a href="https://github.com/Dev-Dami/zario/issues/new?template=feature_request.md">Suggest it →</a>
</td>
<td width="25%" align="center">
<strong>📖 Improve Docs</strong><br/>
<sub>Found a typo?</sub><br/>
<a href="https://github.com/Dev-Dami/zario/pulls">Submit PR →</a>
</td>
<td width="25%" align="center">
<strong>💻 Write Code</strong><br/>
<sub>Ready to get started?</sub><br/>
<a href="#-development-setup">Start here →</a>
</td>
</tr>
</table>

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 🛠️ Development Setup

Ready to start coding? Here’s how to set up `Zario` for local development.

1.  **Fork the Repository**
    Click the "Fork" button at the top right of the [main repository page](https://github.com/Dev-Dami/zario). This creates your own copy of the project.

2.  **Clone Your Fork**
    Clone your forked repository to your local machine.
    ```bash
    git clone https://github.com/<your-username>/zario.git
    cd zario
    ```

    Replace `<your-username>` with your GitHub username.

3.  **Install Dependencies**
    We use `npm` to manage project dependencies.
    ```bash
    npm install
    ```

4.  **Run the Build**
    The project is written in TypeScript and needs to be compiled into JavaScript.
    ```bash
    npm run build
    ```

5.  **Run Tests**
    Make sure everything is working as expected by running the test suite.
    ```bash
    npm test
    ```

<br/>

## 📂 Project Structure

Here's a map of the `Zario` codebase to help you find your way around.

```bash
/
├── docs/                # 📚 Documentation files for the library
├── src/                 # TypeScript source code
│   ├── core/            # Core logic: Logger, Formatter, etc.
│   ├── transports/      # Handles log output destinations (Console, File)
│   ├── utils/           # Helper utilities (e.g., color and time formatting)
│   ├── types/           # Shared TypeScript interfaces and type definitions
│   └── index.ts         # Main entry point that exports the public API
├── tests/               # ✅ Unit and integration tests
├── examples/            # 💡 Example usage scripts
├── package.json         # Project dependencies and scripts
└── tsconfig.json        # TypeScript compiler configuration
```

<br/>

## ✍️ Coding Guidelines

To keep the codebase consistent and easy to read, please follow these guidelines:

-   **TypeScript First**: All new code should be written in TypeScript with strong typing.
-   **Code Style**: We use ESLint for code linting. Please run `npm run lint` before committing to ensure your code matches the project's style.
-   **Comments**: Write comments for complex logic. Well-documented code is easier for everyone to understand and maintain.
-   **Tests**: All new features and bug fixes **must** be accompanied by tests. This ensures stability and prevents future regressions.

<br/>

## 🚀 Submitting a Pull Request

Ready to share your work? Follow these steps to submit a pull request (PR).

1.  **Create a Branch**: Start from the `main` branch and create a new, descriptive branch for your changes.
    ```bash
    # Example for a new feature
    git checkout -b feat/your-awesome-feature

    # Example for a bug fix
    git checkout -b fix/bug-description
    ```
2.  **Commit Your Changes**: Make your changes and commit them with a descriptive message. We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification, which helps us automate releases and generate changelogs.
    -   `feat:` for new features.
    -   `fix:` for bug fixes.
    -   `docs:` for documentation changes.
    -   `style:` for code style changes (formatting, etc.).
    -   `refactor:` for code refactoring without changing functionality.
    -   `test:` for adding or fixing tests.
    -   `chore:` for build process or auxiliary tool changes.

    ```bash
    git commit -m "feat: add support for custom log levels with colors"
    ```

3.  **Push to Your Fork**:
    ```bash
    git push origin feat/your-awesome-feature
    ```

4.  **Create the Pull Request**: Open a pull request from your fork's branch to the `main` branch of the Dev-Dami/zario repository.

5.  **Describe Your PR**: Provide a clear title and a detailed description of your changes. If your PR addresses an open issue, link to it (e.g., `Closes #123`).

Once submitted, we'll review your PR, provide feedback, and merge it when it's ready. Thank you for your contribution!

<br/>

![separator](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<br/>

## 💬 Community

Have questions or want to discuss ideas? Join the conversation on our [GitHub Discussions](https://github.com/Dev-Dami/zario/discussions) page!

---

By contributing, you agree that your contributions will be licensed under the **MIT License**.
