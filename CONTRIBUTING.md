# Contributing to Genbase

Thanks for considering contributing to Genbase! This document outlines the process for contributing to this project.

## Development Setup

The project structure has two main components:
- `genbase/app` - Frontend application
- `genbase/server` - Backend server


### Getting Started

1. Clone the repository
   ```
   git clone <your-repo-url>
   cd genbase
   ```

2. Run the setup script
   ```
   ./scripts/setup.sh
   ```

3. Start the development environment
   ```
   cd docker
   docker-compose up
   ```

## Contribution Workflow

1. Create a new branch from `main`
   ```
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test them

3. Commit your changes with descriptive messages
   ```
   git commit -m "Add feature: description of changes"
   ```

4. Push your branch
   ```
   git push origin feature/your-feature-name
   ```

5. Open a pull request against `main`

## Pull Request Guidelines

- Include a clear description of the changes
- Add tests for new functionality
- Ensure all tests pass
- Update documentation if necessary
- Follow the existing code style

## Code Style

- **Frontend**: Follow TypeScript/React best practices
- **Backend**: Follow PEP 8 guidelines for Python code


## Questions?

Feel free to open an issue if you have questions about contributing.

Thank you for helping improve Genbase!