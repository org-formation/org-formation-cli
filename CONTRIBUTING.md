[![License MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/org-formation/org-formation-cli/issues)

## How to contribute to Org-formation

### **Need to ask questions?**

Org-formation discussions are done through chat, [join the slack channel](https://join.slack.com/t/org-formation/shared_invite/enQtOTA5NjM3Mzc4ODUwLTMxZjYxYzljZTE5YWUzODE2MTNmYjM5NTY5Nzc3MzljNjVlZGQ1ODEzZDgyMWVkMDg3Mzk1ZjQ1ZjM4MDhlOGM)
then start a conversation.

### **Did you find a bug?**

* **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/org-formatio/org-formation-cli/issues).

* If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/org-formatio/org-formation-cli/issues/new).

### **Did you write a patch that fixes a bug?**

* Open a new GitHub pull request with the patch.

* Ensure the PR description clearly describes the problem and solution. Include the relevant issue number if applicable.

### **Do you intend to add a new feature or change an existing one?**

* Suggest your change in the [org-formation slack channel](https://org-formation.slack.com)
  to make sure the community is aware of your approach otherwise you may have
  a difficult time getting your changes approved.

## Development Environment

We recommend setting up the following development environment:
* An AWS Master (or management) account
* Two organization OUs (dev and prod)
* Two AWS member accounts
* An [org-formation project](https://github.com/org-formation/org-formation-reference)

### Testing
While developing your PR you may find these tasks useful.

Building:
```bash
npm run build
```

Linting:
```bash
npm run lint:fix
```

Run unit tests:
```bash
npm run test
```

To run the local version execute `npm link` then you can run with `ofn` command from any directory.
To uninstall execute `npm unlink -g`.


To preview templates from your project execute:

```bash
ofn print-tasks organization-tasks.yaml --output yaml --max-concurrent-stacks 100 --max-concurrent-tasks 100
```
Note: output are in `.printed-stacks` folder

To validate the generated templates execute:

```bash
ofn validate-tasks organization-tasks.yaml --failed-tasks-tolerance 0  --max-concurrent-stacks 100 --max-concurrent-tasks 100
```

### Debugging

The general way to run org-formation using your IDE is to setup a npm configuration and execute one of the
scripts in the `scripts` section of the [package.json](./package.json) file.

Example scripts:
* "start:print-tasks": "npx --quiet ts-node cli.ts print-tasks /Users/jsmith/my-ofn-project/organization-tasks.yaml --output yaml"
* "start:validate-tasks": "npx --quiet ts-node cli.ts validate-tasks /Users/jsmith/my-ofn-project/organization-tasks.yaml --failed-tasks-tolerance 0"
