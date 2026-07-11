# Security policy

## Supported version

Only the latest version published from the `main` branch is supported. Older commits, forks and local copies may not include current safeguards.

## Security model

This portfolio is a static GitHub Pages site. It has no server-side application code, database, authentication, forms, analytics, advertising or third-party runtime scripts. It does not receive or store visitor-submitted data.

The site may store appearance, text-size and motion preferences in the visitor's own browser. These settings remain local and are not transmitted to the site owner. Language selection uses ordinary page links and does not require storage. GitHub Pages may retain standard service logs under GitHub's policies.

## Browser protections

The published pages use a restrictive Content Security Policy. The default is to load nothing, with narrow allowances for same-origin site resources and explicitly hashed structured data. Active mixed content is upgraded, objects are disabled, document base URLs cannot be replaced and form submission is blocked.

Because this is a static GitHub Pages site, the policy is delivered through an early HTML `meta` element rather than a response header. Browser support for a meta-delivered policy has important limits: it applies only to content that follows the element, and directives such as `frame-ancestors`, `sandbox` and CSP reporting cannot be enforced there. Framing protection therefore depends on headers supplied by the hosting platform and is not asserted by this repository.

The policy intentionally prevents arbitrary inline scripts and third-party scripts. A future feature that needs another origin must document the reason and update the policy narrowly. Do not weaken the policy with broad wildcards, `unsafe-inline` for scripts or `unsafe-eval`.

HTTPS is provided by GitHub Pages. Repository content must use HTTPS for public links and same-origin paths for executable assets.

## Deployment and workflow permissions

The quality workflow has read-only repository access and uses no repository secrets. GitHub Pages deployment permissions are controlled by the repository's Pages configuration. Workflow changes should receive the same review as application code.

Automated checks reduce common mistakes but do not prove the absence of vulnerabilities. Review Content Security Policy changes, redirects, external links and newly added executable files before publishing.

## Reporting a concern

Report a suspected vulnerability privately by email to `ahmad.mahmoud@tum.de` with:

- the affected public URL
- a concise description and expected impact
- safe reproduction steps
- browser and operating system details, when relevant

Do not include passwords, tokens, private keys or unrelated personal data. Do not open a public GitHub issue for an unpatched vulnerability.

You should receive an acknowledgment within seven days. Please allow reasonable time to investigate and deploy a correction before public disclosure.
