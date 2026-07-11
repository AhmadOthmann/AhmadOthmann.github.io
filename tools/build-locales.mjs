import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://ahmadothmann.github.io";

const locales = {
  en: { path: "/", output: "index.html", dir: "ltr", short: "EN", og: "en_US" },
  de: { path: "/de/", output: "de/index.html", dir: "ltr", short: "DE", og: "de_DE" },
  ar: { path: "/ar/", output: "ar/index.html", dir: "rtl", short: "AR", og: "ar_EG" }
};

const projectDefinitions = [
  { key: "atlas", category: "ai", code: "AI-07", image: "/assets/project-logos/sofia-atlas-compass.webp", repo: "https://github.com/AhmadOthmann/Sofia-Atlas-Travel" },
  { key: "ackermann", category: "robotics", code: "ROB-01", image: "/assets/project-logos/ackermann-vehicle.webp" },
  { key: "abs", category: "control", code: "CTL-02", image: "/assets/project-logos/ev-abs-mpc.webp" },
  { key: "manipulator", category: "robotics", code: "ROB-03", image: "/assets/project-logos/multi-manipulator.webp" },
  { key: "tensegrity", category: "robotics", code: "ROB-04", image: "/assets/project-logos/tensegrity-robot.webp" },
  { key: "irrigation", category: "embedded", code: "EMB-05", image: "/assets/project-logos/autonomous-irrigation.webp" },
  { key: "connectFour", category: "ai", code: "AI-06", image: "/assets/project-logos/connect-four-ai.webp" }
];

const careerGroups = [
  { key: "professional", headingKey: "professionalHeading", entries: ["robco", "gasco", "huawei", "aratronics", "mrs", "egyrobo"] },
  { key: "research", headingKey: "researchHeading", entries: ["robotum"] },
  { key: "education", headingKey: "educationHeading", entries: ["tum", "bachelors"] }
];
const currentCareerEntries = new Set(["robco", "robotum", "tum"]);
const languageOrder = ["en", "de", "ar"];
const nativeLanguageNames = { en: "English", de: "Deutsch", ar: "العربية" };

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function format(value, replacements) {
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function renderLanguageMenu(locale, translations) {
  const current = nativeLanguageNames[locale];
  const links = languageOrder.map((language) => {
    const config = locales[language];
    const label = nativeLanguageNames[language];
    const currentAttribute = language === locale ? ' aria-current="page"' : "";
    const check = language === locale ? "✓" : "";
    return `              <li><a href="${config.path}" hreflang="${language}" data-language-link${currentAttribute}><span class="language-name" lang="${language}" dir="${config.dir}">${escapeHtml(label)}</span><span class="language-code" aria-hidden="true">${config.short}</span><span class="language-check" aria-hidden="true">${check}</span></a></li>`;
  }).join("\n");

  return `<details class="tool-menu language-menu">
          <summary id="language-summary" aria-controls="language-options" aria-label="${escapeHtml(format(translations[locale].accessibility.currentLanguage, { language: current }))}">
            <span class="tool-badge" aria-hidden="true">${locales[locale].short}</span>
            <span class="summary-label">${escapeHtml(translations[locale].accessibility.languageLabel)}</span>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          <ul id="language-options">
${links}
          </ul>
        </details>`;
}

function renderAppearanceMenu(t) {
  return `<details class="tool-menu appearance-menu">
          <summary id="appearance-summary" aria-controls="appearance-options">
            <span class="display-icon tool-badge" aria-hidden="true">◐</span>
            <span class="summary-label">${escapeHtml(t.accessibility.appearanceLabel)}</span>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="appearance-panel" id="appearance-options" role="group" aria-labelledby="appearance-summary">
            <p class="panel-title">${escapeHtml(t.accessibility.settingsLabel)}</p>
            <label class="select-setting">
              <span>${escapeHtml(t.accessibility.appearanceLabel)}</span>
              <select id="theme-select" aria-label="${escapeHtml(t.accessibility.selectAppearance)}">
                <option value="system">${escapeHtml(t.accessibility.themes.system)}</option>
                <option value="light">${escapeHtml(t.accessibility.themes.light)}</option>
                <option value="dark">${escapeHtml(t.accessibility.themes.dark)}</option>
                <option value="contrast">${escapeHtml(t.accessibility.themes.highContrast)}</option>
              </select>
            </label>
            <button class="preference-toggle" id="text-size-toggle" type="button" aria-pressed="false">
              <span><strong>${escapeHtml(t.accessibility.largeText)}</strong><small>${escapeHtml(t.accessibility.largeTextDescription)}</small></span>
              <span class="toggle-state" data-enabled="${escapeHtml(t.accessibility.enabled)}" data-disabled="${escapeHtml(t.accessibility.disabled)}">${escapeHtml(t.accessibility.disabled)}</span>
            </button>
            <button class="preference-toggle" id="motion-toggle" type="button" aria-pressed="false">
              <span><strong>${escapeHtml(t.accessibility.reducedMotion)}</strong><small>${escapeHtml(t.accessibility.reducedMotionDescription)}</small></span>
              <span class="toggle-state" data-enabled="${escapeHtml(t.accessibility.enabled)}" data-disabled="${escapeHtml(t.accessibility.disabled)}">${escapeHtml(t.accessibility.disabled)}</span>
            </button>
            <button class="reset-preferences" id="reset-preferences" type="button">${escapeHtml(t.accessibility.reset)}</button>
          </div>
        </details>`;
}

function renderProject(definition, t) {
  const project = t.projects[definition.key];
  const category = t.filters[definition.category];
  const tags = project.stack.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("");
  const repository = definition.repo
    ? `<a class="repository-link" href="${definition.repo}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.modal.viewRepository)} <span aria-hidden="true">↗</span><span class="visually-hidden"> (${escapeHtml(t.accessibility.externalLink)})</span></a>`
    : "";

  return `        <article class="project-card" id="project-${definition.key}" data-category="${definition.category}">
          <div class="project-visual has-image">
            <img src="${definition.image}" alt="" width="640" height="640" loading="lazy" decoding="async">
          </div>
          <div class="card-meta"><span>${definition.code}</span><span>${escapeHtml(category)}</span></div>
          <h3>${escapeHtml(project.title)}</h3>
          <p class="project-summary">${escapeHtml(project.summary)}</p>
          <ul class="tags">${tags}</ul>
          <details class="project-more">
            <summary>${escapeHtml(t.modal.viewDetails)} <span aria-hidden="true">↘</span></summary>
            <div class="project-detail">
              <p>${escapeHtml(project.detail)}</p>
${repository ? `              ${repository}` : ""}
            </div>
          </details>
        </article>`;
}

function renderCareerItem(key, t) {
  const item = t.career[key];
  const isCurrent = currentCareerEntries.has(key);
  const classes = ["career-card", isCurrent ? "is-current" : ""].filter(Boolean).join(" ");
  const currentBadge = isCurrent ? `<span class="current-badge">${escapeHtml(t.sections.career.currentLabel)}</span>` : "";
  return `          <article class="${classes}">
            <div class="career-meta">
              <span class="career-period" dir="auto">${escapeHtml(item.period)}</span>
              <span class="career-location" dir="auto">${escapeHtml(item.location)}</span>
${currentBadge ? `              ${currentBadge}` : ""}
            </div>
            <div class="career-body">
              <h4 dir="auto">${escapeHtml(item.organization)}</h4>
              <p class="career-role" dir="auto">${escapeHtml(item.role)}</p>
              <p class="career-detail" dir="auto">${escapeHtml(item.detail)}</p>
            </div>
          </article>`;
}

function renderCareerGroup(group, index, t) {
  const cards = group.entries.map((entry) => renderCareerItem(entry, t)).join("\n");
  const headingId = `career-${group.key}-heading`;
  return `      <section class="career-group" aria-labelledby="${headingId}">
        <div class="career-group-heading">
          <span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <h3 id="${headingId}">${escapeHtml(t.sections.career[group.headingKey])}</h3>
        </div>
        <div class="career-list">
${cards}
        </div>
      </section>`;
}

function renderPage(locale, translations) {
  const config = locales[locale];
  const t = translations[locale];
  const canonical = `${origin}${config.path}`;
  const alternateLocales = languageOrder.filter((language) => language !== locale).map((language) => locales[language].og);
  const socialAlt = `${t.meta.siteName}: ${t.hero.title}`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${canonical}#profile-page`,
    url: canonical,
    name: t.meta.siteName,
    description: t.meta.description,
    inLanguage: locale,
    mainEntity: {
      "@type": "Person",
      "@id": `${origin}/#ahmed-othman`,
      name: "Ahmed Othman",
      url: `${origin}/`,
      jobTitle: t.hero.title,
      sameAs: [
        "https://github.com/AhmadOthmann",
        "https://www.linkedin.com/in/ahmedothman-"
      ],
      alumniOf: [
        { "@type": "CollegeOrUniversity", name: "German University in Cairo" },
        { "@type": "CollegeOrUniversity", name: "German International University Berlin" }
      ],
      knowsAbout: ["Robotics", "Physical AI", "Control systems", "Embedded systems", "Autonomy"]
    }
  });
  const jsonLdHash = createHash("sha256").update(jsonLd).digest("base64");
  const csp = `default-src 'none'; script-src 'self' 'sha256-${jsonLdHash}'; style-src 'self'; img-src 'self' data:; manifest-src 'self'; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests`;
  const projectCards = projectDefinitions.map((project) => renderProject(project, t)).join("\n");
  const career = careerGroups.map((group, index) => renderCareerGroup(group, index, t)).join("\n");
  const principles = t.about.principles.map((principle) => `<span>${escapeHtml(principle)}</span>`).join("");
  const initialCount = format(t.accessibility.projectCountMany, { count: projectDefinitions.length });

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${config.dir}" data-theme="system" data-text-size="normal" data-motion="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(t.meta.description)}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#f3f0e8">
  <meta name="color-scheme" content="light dark">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  <title>${escapeHtml(t.meta.title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="${origin}/">
  <link rel="alternate" hreflang="de" href="${origin}/de/">
  <link rel="alternate" hreflang="ar" href="${origin}/ar/">
  <link rel="alternate" hreflang="x-default" href="${origin}/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(t.meta.title)}">
  <meta property="og:description" content="${escapeHtml(t.meta.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="${escapeHtml(t.meta.siteName)}">
  <meta property="og:locale" content="${config.og}">
${alternateLocales.map((ogLocale) => `  <meta property="og:locale:alternate" content="${ogLocale}">`).join("\n")}
  <meta property="og:image" content="${origin}/assets/social-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(socialAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(t.meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(t.meta.description)}">
  <meta name="twitter:image" content="${origin}/assets/social-preview.png">
  <meta name="twitter:image:alt" content="${escapeHtml(socialAlt)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <script src="/theme-init.js"></script>
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${jsonLd}</script>
  <script src="/script.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(t.accessibility.skipToContent)}</a>
  <header class="site-header">
    <a class="monogram" href="${config.path}" aria-label="${escapeHtml(t.nav.homeLabel)}">AO</a>
    <nav aria-label="${escapeHtml(t.nav.label)}">
      <a href="#projects">${escapeHtml(t.nav.projects)}</a>
      <a href="#experience">${escapeHtml(t.nav.experience)}</a>
      <a href="#about">${escapeHtml(t.nav.about)}</a>
      <a href="#contact">${escapeHtml(t.nav.contact)}</a>
    </nav>
    <div class="header-tools" role="group" aria-label="${escapeHtml(t.accessibility.settingsLabel)}">
      ${renderLanguageMenu(locale, translations)}
      ${renderAppearanceMenu(t)}
    </div>
  </header>

  <main id="main-content">
    <section class="hero" id="top">
      <div class="hero-copy">
        <p class="status"><span aria-hidden="true"></span>${escapeHtml(t.hero.status)}</p>
        <p class="eyebrow">${escapeHtml(t.hero.eyebrow)}</p>
        <h1><span>${escapeHtml(t.hero.firstName)}</span><span>${escapeHtml(t.hero.lastName)}</span></h1>
        <h2>${escapeHtml(t.hero.title)}</h2>
        <p class="lede">${escapeHtml(t.hero.lede)}</p>
        <div class="actions">
          <a class="primary" href="#projects">${escapeHtml(t.hero.primaryAction)} <span aria-hidden="true">↘</span></a>
          <a class="secondary" href="#about">${escapeHtml(t.hero.secondaryAction)} <span aria-hidden="true">→</span></a>
        </div>
        <p class="stack-line"><strong>${escapeHtml(t.hero.coreStackLabel)}</strong><bdi>${escapeHtml(t.hero.coreStack)}</bdi></p>
      </div>
      <div class="hero-system" aria-hidden="true">
        <div class="system-grid"></div><div class="orbit o1"></div><div class="orbit o2"></div>
        <div class="joint j1"><i></i></div><div class="link l1"></div>
        <div class="joint j2"><i></i></div><div class="link l2"></div>
        <div class="effector"><i></i><i></i><i></i></div>
        <span class="telemetry t1">${escapeHtml(t.hero.telemetryJoint)}</span>
        <span class="telemetry t2">${escapeHtml(t.hero.telemetryControl)}</span>
        <span class="telemetry t3">${escapeHtml(t.hero.telemetryState)}</span>
      </div>
    </section>

    <section class="section projects" id="projects">
      <div class="section-head">
        <div><p class="eyebrow">${escapeHtml(t.sections.projects.eyebrow)}</p><h2>${escapeHtml(t.sections.projects.title)}</h2></div>
        <p>${escapeHtml(t.sections.projects.intro)}</p>
      </div>
      <fieldset class="filters">
        <legend class="visually-hidden">${escapeHtml(t.filters.label)}</legend>
        <button type="button" data-filter="all" aria-pressed="true">${escapeHtml(t.filters.all)}</button>
        <button type="button" data-filter="robotics" aria-pressed="false">${escapeHtml(t.filters.robotics)}</button>
        <button type="button" data-filter="control" aria-pressed="false">${escapeHtml(t.filters.control)}</button>
        <button type="button" data-filter="ai" aria-pressed="false">${escapeHtml(t.filters.ai)}</button>
        <button type="button" data-filter="embedded" aria-pressed="false">${escapeHtml(t.filters.embedded)}</button>
      </fieldset>
      <p class="filter-status" id="filter-status" role="status" aria-live="polite"
         data-count-one="${escapeHtml(t.accessibility.projectCountOne)}"
         data-count-many="${escapeHtml(t.accessibility.projectCountMany)}">${escapeHtml(initialCount)}</p>
      <div class="project-grid">
${projectCards}
      </div>
    </section>

    <section class="section career" id="experience">
      <div class="section-head">
        <div><p class="eyebrow">${escapeHtml(t.sections.career.eyebrow)}</p><h2>${escapeHtml(t.sections.career.title)}</h2></div>
        <p>${escapeHtml(t.sections.career.intro)}</p>
      </div>
      <div class="career-groups">
${career}
      </div>
    </section>

    <section class="section about" id="about">
      <div><p class="eyebrow">${escapeHtml(t.about.eyebrow)}</p><h2>${escapeHtml(t.about.title)}</h2></div>
      <div class="about-copy"><p>${escapeHtml(t.about.paragraphOne)}</p><p>${escapeHtml(t.about.paragraphTwo)}</p></div>
      <div class="principles">${principles}</div>
    </section>
  </main>

  <footer id="contact">
    <div><p class="eyebrow">${escapeHtml(t.footer.eyebrow)}</p><h2>${escapeHtml(t.footer.title)}</h2></div>
    <div class="footer-links">
      <a href="mailto:ahmad.mahmoud@tum.de">${escapeHtml(t.footer.email)} <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/AhmadOthmann" rel="me noopener noreferrer" target="_blank">${escapeHtml(t.footer.github)} <span aria-hidden="true">↗</span><span class="visually-hidden"> (${escapeHtml(t.accessibility.externalLink)})</span></a>
      <a href="https://www.linkedin.com/in/ahmedothman-" rel="me noopener noreferrer" target="_blank">${escapeHtml(t.footer.linkedin)} <span aria-hidden="true">↗</span><span class="visually-hidden"> (${escapeHtml(t.accessibility.externalLink)})</span></a>
    </div>
    <small>${escapeHtml(t.footer.copyright)}</small>
  </footer>
</body>
</html>
`;
}

const translations = Object.fromEntries(await Promise.all(languageOrder.map(async (locale) => {
  const source = await readFile(join(root, "i18n", `${locale}.json`), "utf8");
  return [locale, JSON.parse(source)];
})));

for (const locale of languageOrder) {
  const output = join(root, locales[locale].output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderPage(locale, translations), "utf8");
}

console.log("Generated English, German and Arabic portfolio pages.");
