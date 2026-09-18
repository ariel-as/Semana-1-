import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ANCHOS = [320, 375, 768, 1024, 1440];

const HOSTS_YOUTUBE = [
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
];

test('HTML semántico: doctype, lang y estructura con landmarks', async ({ page }) => {
  await page.goto('/');

  const estructura = await page.evaluate(() => {
    const n = (sel) => document.querySelectorAll(sel).length;
    return {
      doctypeHTML5: document.doctype != null && document.doctype.name.toLowerCase() === 'html',
      lang: document.documentElement.getAttribute('lang'),
      h1: n('h1'),
      header: n('header'),
      nav: n('nav'),
      main: n('main'),
      section: n('section'),
      footer: n('footer'),
    };
  });

  expect(estructura.doctypeHTML5, 'Falta el DOCTYPE de HTML5').toBe(true);
  expect(estructura.lang, 'Falta el atributo lang').toBeTruthy();
  expect(estructura.h1, 'Debe existir al menos un <h1>').toBeGreaterThanOrEqual(1);
  expect(estructura.header, 'Falta <header>').toBeGreaterThanOrEqual(1);
  expect(estructura.nav, 'Falta <nav>').toBeGreaterThanOrEqual(1);
  expect(estructura.main, 'Falta <main>').toBeGreaterThanOrEqual(1);
  expect(estructura.section, 'Falta <section>').toBeGreaterThanOrEqual(1);
  expect(estructura.footer, 'Falta <footer>').toBeGreaterThanOrEqual(1);
});

test('Adaptabilidad: meta viewport configurado', async ({ page }) => {
  await page.goto('/');

  const ok = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const content = meta ? meta.getAttribute('content') || '' : '';
    return (
      /width\s*=\s*device-width/i.test(content) && /initial-scale\s*=/i.test(content)
    );
  });

  expect(
    ok,
    'El <meta name="viewport"> debe incluir width=device-width e initial-scale',
  ).toBe(true);
});

test('Responsividad: sin desbordamiento horizontal', async ({ page }) => {
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('load');

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      scrollWidth,
      `Desbordamiento horizontal a ${ancho}px (scrollWidth=${scrollWidth}, clientWidth=${clientWidth}). Revisa anchos fijos u overflow en el CSS.`,
    ).toBeLessThanOrEqual(clientWidth);
  }
});

test('Seguridad: enlaces externos y YouTube solo sobre HTTPS', async ({ page }) => {
  await page.goto('/');

  const enlaces = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      href: a.getAttribute('href') || '',
      absoluta: a.href,
      target: a.target || '',
      rel: a.rel || '',
    })),
  );

  const externos = enlaces.filter((l) => /^[a-z][a-z0-9+.-]*:\/\//i.test(l.href));

  for (const enlace of externos) {
    const url = new URL(enlace.absoluta);

    expect(url.protocol, `Enlace externo sin HTTPS: ${enlace.href}`).toBe('https:');

    if (/youtube\.com|youtu\.be/i.test(url.hostname)) {
      expect(
        HOSTS_YOUTUBE,
        `Host de YouTube no permitido: ${enlace.href}`,
      ).toContain(url.hostname.toLowerCase());

      expect(
        url.username || url.password,
        `Enlace de YouTube con credenciales en la URL: ${enlace.href}`,
      ).toBeFalsy();
    }

    if (enlace.target === '_blank') {
      const rel = enlace.rel.toLowerCase().split(/\s+/);
      expect(rel, `target="_blank" sin rel="noopener" en: ${enlace.href}`).toContain('noopener');
      expect(rel, `target="_blank" sin rel="noreferrer" en: ${enlace.href}`).toContain('noreferrer');
    }
  }
});

test('Criterios ARIA: atributos válidos y acceso a elementos visibles', async ({ page }) => {
  await page.goto('/');

  const info = await page.evaluate(() => {
    const atributosInvalidos = Array.from(document.querySelectorAll('*'))
      .flatMap((el) => Array.from(el.attributes))
      .map((a) => a.name)
      .filter((name) => /^aria-/i.test(name) && !/^aria-[a-z0-9-]+$/.test(name));

    const conAria = Array.from(
      document.querySelectorAll('[aria-hidden], [aria-label], [aria-labelledby]'),
    ).map((el) => {
      const rect = el.getBoundingClientRect();
      const estilos = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        oculto: el.getAttribute('aria-hidden'),
        tieneAria: el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby'),
        visible:
          estilos.display !== 'none' &&
          estilos.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0,
      };
    });

    return { atributosInvalidos, conAria };
  });

  expect(info.atributosInvalidos, 'Atributos aria-* mal formados').toEqual([]);

  for (const contexto of info.conAria) {
    if (contexto.oculto != null) {
      expect(contexto.oculto, `aria-hidden debe valer "true" en <${contexto.tag}>`).toBe('true');
    } else if (contexto.tieneAria) {
      expect(
        contexto.visible,
        `El elemento <${contexto.tag}> con ARIA no debe estar oculto para lectores de pantalla`,
      ).toBe(true);
    }
  }
});

test('Accesibilidad WCAG 2.x AA con axe-core', async ({ page }) => {
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('load');

    const resultados = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    const graves = resultados.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect(
      graves,
      `Violaciones WCAG AA graves a ${ancho}px:\n${JSON.stringify(graves, null, 2)}`,
    ).toEqual([]);
  }
});
