[![License MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/org-formation/org-formation-cli/issues)

## How to contribute to Org-formation

### **Did you find a bug?**

* **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/org-formatio/org-formation-cli/issues).

* If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/org-formatio/org-formation-cli/issues/new).
  Be sure to include a **title and clear description**, as much relevant information as possible, and a **project sample**
  demonstrating the expected behavior that is not occurring.
  
### **Did you write a patch that fixes a bug?**

* Open a new GitHub pull request with the patch.

* Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable.

### **Do you intend to add a new feature or change an existing one?**

* Suggest your change in the [org-formation slack channel](https://org-formation.slack.com).

* Do not open an issue on GitHub until you have collected positive feedback about the change.
  GitHub issues are primarily intended for bug reports and fixes.

### **Do you have questions about the source code?**

* Ask any question about how to use org-formation in the the [org-formation slack channel](https://org-formation.slack.com).

## Development Environment

We recommend setting up the following development environment:
  1. An AWS Master (or management) account
  2. Root OU
  3. Two AWS member accounts
  4. An org-formation [project](https://github.com/org-formation/org-formation-reference)

## Testing
While developing your PR you may find these tasks useful.

Building:
```bash
npx npm run build
```

Linting:
```bash
npx eslint './src/**/*.ts'
```

Run unit tests:
```bash
npx npm run test:unit
```

To run the local version execute `npm link` then you can run with `ofn` command from any directory.
To uninstall execute `npm unlink -g`.


To preview templates from your project execute:

```bash
ofn org-formation print-tasks organization-tasks.yaml --profile my-profile --output yaml --failed-tasks-tolerance 0  --max-concurrent-stacks 100
```
Note: output are in `.printed-stacks` folder

To validate the generated templates execute:

```bash
ofn validatee-tasks organization-tasks.yaml --profile my-profile --output yaml --failed-tasks-tolerance 0  --max-concurrent-stacks 100
```

## Debugging

Add your script to `scripts` in [package.json](./package.json) and setup your debugger to run the script with npm.

