# Access Control & Branch Protection Guide

This guide establishes the security baseline for repository access management and branch protection rules for **Reliable-jewellery**.

---

## 1. Branch Protection Rules for `main`

To prevent unauthorized, unreviewed, or destructive changes from reaching the production branch, enforce branch protection rules on GitHub:

### How to Configure in GitHub:
1. Navigate to: **Settings** > **Branches** (or **Rules** > **Rulesets**).
2. Click **"Add branch ruleset"** or **"Add rule"**.
3. Set **Branch name pattern** to `main`.
4. Enable the following protections:

| Rule | Recommended Setting | Purpose |
| :--- | :--- | :--- |
| **Require a pull request before merging** | **Checked** (Min: 1 approval) | Ensures all code is peer-reviewed prior to deployment. |
| **Require status checks to pass before merging** | **Checked** | Ensures automated CI checks (e.g. `gitleaks`, `codeql`) pass before merge. |
| **Require branches to be up to date before merging** | **Checked** | Prevents race conditions and regression issues. |
| **Require conversation resolution before merging** | **Checked** | Ensures all comments and security concerns are resolved. |
| **Do not allow bypassing the above settings** | **Checked** (or restrict to Admins) | Prevents accidental direct commits to `main`. |
| **Restrict force pushes** | **Checked** (Block force push) | Prevents history rewrites or accidental deletion of commits. |
| **Restrict deletions** | **Checked** (Block branch deletion) | Protects the production `main` branch from accidental removal. |

---

## 2. Contributor Access Control (Principle of Least Privilege)

Review repository collaborators regularly to ensure that individuals have only the minimum level of access required to perform their roles:

### Standard Permission Roles:
- **Read (Viewer)**: Recommended for external stakeholders, trainees, or contractors who only need to inspect code without write permissions.
- **Triage**: Recommended for QA and issue trackers who need to label, assign, and manage issues/PRs without commit permissions.
- **Write**: Recommended for active software developers submitting features via pull requests and branches.
- **Admin**: Restricted strictly to primary repository owners. Admins can alter repository visibility, branch rules, and secret variables.

### Recommended Access Auditing Checklist:
- [ ] Ensure **Two-Factor Authentication (2FA)** is required for all organization members and collaborators.
- [ ] Remove inactive contributors and former team members.
- [ ] Audit connected **GitHub Apps** and **OAuth Authorizations** under *Settings > Integrations*. Remove any untrusted third-party integrations with repository read/write scopes.
- [ ] Ensure personal access tokens (PATs) are fine-grained, short-lived, and adhere to least-privilege permissions.

---

## 3. Automated Pre-Commit & Secret Verification

The repository includes a git pre-commit hook in `.githooks/pre-commit`.
Ensure all developers enable the hook locally:
```bash
git config core.hooksPath .githooks
```
This hook automatically scans staged diffs prior to every commit, preventing accidental commits of `.env` files, private keys, or cloud credentials.
