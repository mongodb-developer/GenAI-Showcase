# Contributing to our GenAI Showcase

Thank you for showing interest in contributing to this repo!

## General guidelines

Here are some things to keep in mind for contributions:

* Follow the ["fork and pull request"](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project#creating-your-own-copy-of-a-project) workflow when possible. Internal contributors may use ["branch and pull request"](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project#creating-a-branch-to-work-on).
* Look for duplicate PRs or issues that have already been opened before opening a new one.
* Ensure your PR passes [formatting and linting](#linting-and-formatting), as well as any testing checks before requesting a review.
    * If you would like comments or feedback, please open an issue or discussion and tag a maintainer.
* In the pull request description, link to any issues that the PR aims to resolve, and clearly specify the intent of the PR.
* Keep scope as isolated as possible.
* PRs should ideally be merged by PR authors. If for some reason you need to merge someone else's PR, please first check with the author.
* Merge your PR only after you have received atleast 1 approval from a code owner.

## Linting and Formatting

This repo uses [pre-commit](https://pypi.org/project/pre-commit/) for managing linting and formatting. `pre-commit` performs various
checks on the files and uses tools that help follow a consistent style within the repo.

To set up `pre-commit` locally, run:

```bash
brew install pre-commit
pre-commit install
```

To run `pre-commit` manually, run `pre-commit run --all-files`.

## Questions?

Reach out to the maintainers: [Richmond Alake](https://github.com/RichmondAlake), [Apoorva Joshi](https://github.com/ajosh0504), [Pavel Duchovny](https://github.com/Pash10g), [Jesse Hall](https://github.com/codeSTACKr), [Anaiya Raisinghani](https://github.com/anaiyaraisin)
