// Gera uma pagina ESTATICA por empreendimento (emp-{slug}.html) a partir do Supabase.
// Por que estatico e nao só o empreendimento.html (client-side fetch)? Porque o crawler
// do WhatsApp/Facebook/Google que le og:title/og:image pra montar o preview do link NAO
// executa JavaScript — se os dados só chegam via fetch() depois do load, o preview do link
// compartilhado fica vazio/quebrado. Rodar este script sempre que os dados no Supabase
// mudarem (novo empreendimento, preço, foto) e comitar os HTMLs gerados.
//
// Uso:  node build-seo-pages.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://jbtnywgozszrhhzvwmob.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bdWQhN8xxY7zlWR6gcGA1g_x8gOYDAP';
const WHATSAPP_NUMBER = '5511975912060';
// TODO: troca pelo dominio real assim que o app estiver hospedado (Coolify).
// Sem isso, og:image/og:url/canonical/sitemap ficam com um endereco que nao existe —
// o preview do link no WhatsApp so funciona depois de preenchido corretamente.
const SITE_URL = 'https://SEU-DOMINIO-AQUI.com.br';

function waLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ICONS = {
  pin: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  bed: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 18v-7a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2"/><path d="M12 13h7a2 2 0 0 1 2 2v3"/><path d="M3 18h18"/><path d="M3 13v5"/><path d="M21 18v-3"/></svg>',
  coin: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.3c0-1.3-1.3-2.3-3-2.3s-3 .9-3 2.1c0 2.8 6 1.5 6 4.3 0 1.3-1.3 2.4-3 2.4s-3-1-3-2.3"/></svg>',
  check: '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  pool: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><path d="M3 21c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"/><path d="M7 13V5a2 2 0 0 1 4 0v8"/></svg>',
  leaf: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 21c0-9 5-15 14-16 0 10-5 15-14 16Z"/><path d="M5 21c3-3 6-6 9-11"/></svg>',
  dumbbell: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 9v6M2 10v4M20 9v6M22 10v4M7 12h10"/><path d="M7 9v6M17 9v6"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="8" r="2.4"/><path d="M17 5c1.5.2 2.7 1.4 2.7 3s-1.2 2.8-2.7 3"/></svg>',
  paw: '<svg class="icon" viewBox="0 0 24 24"><circle cx="6" cy="9" r="1.6"/><circle cx="10" cy="6" r="1.6"/><circle cx="14" cy="6" r="1.6"/><circle cx="18" cy="9" r="1.6"/><path d="M12 12c3 0 5.5 2 5.5 4.3 0 1.7-1.4 2.7-3 2.3-1-.3-1.7-.9-2.5-.9s-1.5.6-2.5.9c-1.6.4-3-.6-3-2.3C6.5 14 9 12 12 12Z"/></svg>',
  shirt: '<svg class="icon" viewBox="0 0 24 24"><path d="M8 3 4 6l2 3 2-1v13h8V8l2 1 2-3-4-3-2 2h-2L8 3Z"/></svg>',
  cart: '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
  playground: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M12 7v6M6 20l6-7 6 7M9 13h6"/></svg>',
  building: '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/></svg>',
};
function iconFor(name) {
  const n = name.toLowerCase();
  if (/piscina/.test(n)) return ICONS.pool;
  if (/horta|pomar|jardim|verde|zen/.test(n)) return ICONS.leaf;
  if (/fitness|academia|sauna|mini pista/.test(n)) return ICONS.dumbbell;
  if (/coworking|festa|social|sport bar|gourmet|lounge|convivência|lual/.test(n)) return ICONS.users;
  if (/pet/.test(n)) return ICONS.paw;
  if (/lavanderia/.test(n)) return ICONS.shirt;
  if (/market|mercado|delivery/.test(n)) return ICONS.cart;
  if (/playground|brinquedo|redário|baby/.test(n)) return ICONS.playground;
  if (/rooftop/.test(n)) return ICONS.building;
  return ICONS.check;
}

const CSS = `
  :root {
    --ground: #100d08; --surface: #1b160d; --surface-2: #241d12; --card: #1f1a10;
    --ink: #f4eedd; --ink-soft: #b7ac90; --ink-faint: #8a8064;
    --accent: #ffc61a; --accent-ink: #17120a; --clay: #e67a3e;
    --ring: rgba(244, 238, 221, 0.12); --ring-strong: rgba(244, 238, 221, 0.24); --shadow: rgba(0, 0, 0, 0.6);
    --font-display: "Arial Black", "Helvetica Neue", Arial, sans-serif;
    --font-ui: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-mono: "SF Mono", "Consolas", "Menlo", "Liberation Mono", monospace;
    --measure: 62ch;
    color-scheme: dark;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; }
  body { background: var(--ground); color: var(--ink); font-family: var(--font-ui); line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  img { max-width: 100%; display: block; }
  a { color: inherit; }
  button { font: inherit; color: inherit; background: none; border: none; }
  svg.icon { width: 1em; height: 1em; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
  h1, h2, .display { font-family: var(--font-display); text-transform: uppercase; letter-spacing: -0.01em; text-wrap: balance; font-weight: 900; margin: 0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 20px; }
  .topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: color-mix(in srgb, var(--ground) 90%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ring); }
  .topbar .back { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--ink-soft); text-decoration: none; }
  .topbar .back svg.icon { width: 16px; height: 16px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-family: var(--font-display); text-transform: uppercase; letter-spacing: 0.02em; font-size: 0.86rem; padding: 13px 20px; border-radius: 100px; cursor: pointer; text-decoration: none; white-space: nowrap; }
  .btn-primary { background: var(--accent); color: var(--accent-ink); }
  .btn-ghost { background: var(--surface-2); color: var(--ink); border: 1.5px solid var(--ring-strong); }
  .eyebrow { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); display: flex; align-items: center; gap: 10px; }
  .eyebrow::before { content: ""; width: 20px; height: 2px; background: var(--accent); display: inline-block; flex-shrink: 0; }
  .hero { position: relative; aspect-ratio: 4/3; background: var(--surface); }
  .hero img { width: 100%; height: 100%; object-fit: cover; }
  .hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, var(--ground) 98%); }
  .hero-content { position: absolute; left: 0; right: 0; bottom: 0; padding: 24px 20px; z-index: 2; }
  .hero h1 { font-size: clamp(1.7rem, 5vw + 0.6rem, 2.6rem); margin-top: 8px; }
  .hero .bairro { font-family: var(--font-mono); font-size: 0.85rem; color: var(--ink-soft); margin-top: 8px; display: flex; gap: 6px; align-items: center; }
  .stat-strip { display: flex; gap: 10px; overflow-x: auto; padding: 18px 20px 4px; }
  .stat-strip .s { flex-shrink: 0; background: var(--card); border: 1px solid var(--ring); border-radius: 12px; padding: 12px 16px; }
  .stat-strip .s .n { font-family: var(--font-display); font-size: 1.25rem; color: var(--accent); }
  .stat-strip .s .l { font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); margin-top: 2px; }
  .cta-row { display: flex; gap: 10px; padding: 18px 20px 6px; flex-wrap: wrap; }
  .cta-row .btn { flex: 1; min-width: 150px; }
  section { padding: 36px 0; border-top: 1px solid var(--ring); }
  section:first-of-type { border-top: none; }
  section h2 { font-size: clamp(1.3rem, 2.4vw + 0.8rem, 1.7rem); margin-top: 10px; }
  section > .wrap > p.lede { color: var(--ink-soft); margin-top: 12px; max-width: var(--measure); }
  .fact-list { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
  .fact { display: flex; gap: 10px; align-items: flex-start; font-size: 0.94rem; color: var(--ink-soft); }
  .fact svg.icon { width: 17px; height: 17px; color: var(--accent); margin-top: 2px; }
  .fact b { color: var(--ink); }
  .amenity-grid { margin-top: 22px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .amenity-tile { background: var(--card); border: 1px solid var(--ring); border-radius: 10px; padding: 14px 10px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .amenity-tile svg.icon { width: 22px; height: 22px; color: var(--accent); }
  .amenity-tile span { font-size: 0.72rem; color: var(--ink-soft); line-height: 1.3; }
  .planta-grid { margin-top: 22px; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .planta-tile { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; overflow: hidden; cursor: pointer; }
  .planta-tile img { aspect-ratio: 4/3; object-fit: contain; background: #fff; padding: 6px; }
  .planta-tile .lbl { font-family: var(--font-mono); font-size: 0.68rem; color: var(--ink-soft); padding: 8px 10px 10px; text-align: center; }
  .faixa-cards { margin-top: 22px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .faixa-card { background: var(--card); border: 1px solid var(--ring); border-radius: 12px; padding: 16px; }
  .faixa-card .n { font-family: var(--font-mono); font-size: 1.6rem; color: var(--accent); font-variant-numeric: tabular-nums; }
  .faixa-card .l { font-family: var(--font-display); text-transform: uppercase; font-size: 0.82rem; margin-top: 6px; }
  .faixa-card .d { font-size: 0.76rem; color: var(--ink-faint); margin-top: 4px; }
  .steps { margin-top: 22px; display: flex; flex-direction: column; gap: 16px; }
  .step { display: flex; gap: 14px; align-items: flex-start; }
  .step .num { font-family: var(--font-display); font-size: 1.1rem; color: var(--accent-ink); background: var(--accent); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .step .txt b { display: block; margin-bottom: 2px; }
  .step .txt span { color: var(--ink-soft); font-size: 0.88rem; }
  .faq-list { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; }
  .faq-item { background: var(--card); border: 1px solid var(--ring); border-radius: 10px; overflow: hidden; }
  .faq-item summary { padding: 15px 18px; cursor: pointer; font-weight: 600; font-size: 0.92rem; list-style: none; display: flex; justify-content: space-between; gap: 10px; }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::after { content: "+"; color: var(--accent); font-family: var(--font-display); flex-shrink: 0; }
  .faq-item[open] summary::after { content: "\\2013"; }
  .faq-item p { padding: 0 18px 16px; margin: 0; color: var(--ink-soft); font-size: 0.88rem; }
  .final-cta { text-align: center; padding: 44px 0; }
  .final-cta h2 { font-size: clamp(1.5rem, 3vw + 0.8rem, 2rem); max-width: 16ch; margin: 10px auto 0; }
  .final-cta .btn { margin: 22px auto 0; max-width: 320px; }
  footer { padding: 24px 0 60px; }
  footer p { font-family: var(--font-mono); font-size: 0.68rem; color: var(--ink-faint); line-height: 1.7; max-width: var(--measure); }
  .lightbox { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .lightbox[hidden] { display: none; }
  .lightbox img { max-width: 100%; max-height: 82vh; background: #fff; border-radius: 6px; object-fit: contain; }
  .lightbox-close { position: absolute; top: 18px; right: 18px; width: 40px; height: 40px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--ring-strong); font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
  .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--ring-strong); font-size: 1.4rem; display: flex; align-items: center; justify-content: center; }
  .lightbox-nav.prev { left: 18px; } .lightbox-nav.next { right: 18px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

function pageHtml(d) {
  const url = `${SITE_URL}/emp-${d.slug}.html`;
  const ogImage = `${SITE_URL}/${d.imagens[0]}`;
  const metaDesc = `${d.destaque} Entrada facilitada a partir de R$ ${d.entrada_valor}. ${d.dorms}, ${d.bairro}, São Paulo — Cury Construtora.`.slice(0, 165);
  const plantas = d.plantas || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: d.nome,
    description: d.destaque,
    url,
    image: d.imagens.map((i) => `${SITE_URL}/${i}`),
    address: {
      '@type': 'PostalAddress',
      streetAddress: d.endereco,
      addressLocality: 'São Paulo',
      addressRegion: 'SP',
      addressCountry: 'BR',
    },
    ...(d.unidades_total ? { numberOfAccommodationUnits: d.unidades_total } : {}),
    amenityFeature: d.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
  };

  const faixaCards = d.faixa
    ? `<div class="faixa-cards">
        ${d.faixa.his1 ? `<div class="faixa-card"><div class="n">${d.faixa.his1}</div><div class="l">HIS-1</div><div class="d">Até 3 salários mínimos</div></div>` : ''}
        ${d.faixa.his2 ? `<div class="faixa-card"><div class="n">${d.faixa.his2}</div><div class="l">HIS-2</div><div class="d">3 a 6 salários mínimos</div></div>` : ''}
        ${d.faixa.r2v ? `<div class="faixa-card"><div class="n">${d.faixa.r2v}</div><div class="l">R2V</div><div class="d">Sem limite de renda</div></div>` : ''}
      </div>`
    : `<p class="lede" style="margin-top:16px">Faixas de unidades ainda não confirmadas para este empreendimento — me chama que eu confirmo na hora.</p>`;

  const faqHtml = (d.faq || []).map((f) => `
      <details class="faq-item">
        <summary>${esc(f.pergunta)}</summary>
        <p>${esc(f.resposta)}</p>
      </details>`).join('') || '<p class="lede">Ainda sem perguntas frequentes cadastradas — me chama no WhatsApp com qualquer dúvida.</p>';

  const faqJsonLd = (d.faq || []).length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: d.faq.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  } : null;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${esc(d.nome)} — ${esc(d.bairro)}, São Paulo | Matheus, Corretor Cury</title>
<meta name="description" content="${esc(metaDesc)}" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow" />

<meta property="og:type" content="website" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${esc(d.nome)} — ${esc(d.bairro)}, São Paulo" />
<meta property="og:description" content="${esc(metaDesc)}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="Matheus — Corretor Cury São Paulo" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(d.nome)} — ${esc(d.bairro)}, São Paulo" />
<meta name="twitter:description" content="${esc(metaDesc)}" />
<meta name="twitter:image" content="${ogImage}" />

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${faqJsonLd ? `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>` : ''}

<style>${CSS}</style>
</head>
<body>
<header class="topbar">
  <a class="back" href="index.html">
    <svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
    Catálogo
  </a>
  <a class="btn btn-primary" href="${waLink(`Vim de um anúncio, quero saber mais sobre o ${d.nome} (${d.bairro}).`)}" target="_blank" rel="noopener">Falar no WhatsApp</a>
</header>

<main>
  <div class="hero">
    <img src="${d.imagens[0]}" alt="Fachada do ${esc(d.nome)}, em ${esc(d.bairro)}, São Paulo" />
    <div class="hero-content">
      <span class="eyebrow">${esc(d.zona)}</span>
      <h1>${esc(d.nome)}</h1>
      <div class="bairro">${ICONS.pin} ${esc(d.endereco)}</div>
    </div>
  </div>

  <div class="stat-strip">
    ${d.unidades_total ? `<div class="s"><div class="n">${d.unidades_total}</div><div class="l">Unidades</div></div>` : ''}
    <div class="s"><div class="n">${esc(d.dorms)}</div><div class="l">Configuração</div></div>
    <div class="s"><div class="n">R$ ${d.entrada_valor}</div><div class="l">Entrada facilitada</div></div>
  </div>

  <div class="cta-row">
    <a class="btn btn-primary" href="${waLink(`Quero simular financiamento do ${d.nome}.`)}" target="_blank" rel="noopener">Simular financiamento</a>
    <a class="btn btn-ghost" href="${waLink(`Quero agendar uma visita ao ${d.nome}.`)}" target="_blank" rel="noopener">Agendar visita</a>
  </div>

  <section>
    <div class="wrap">
      <p class="eyebrow">Sobre o empreendimento</p>
      <h2>Por que esse endereço</h2>
      <p class="lede">${esc(d.destaque)}</p>
      <div class="fact-list">
        <div class="fact">${ICONS.pin}<span><b>Endereço:</b> ${esc(d.endereco)}</span></div>
        <div class="fact">${ICONS.bed}<span><b>Plantas:</b> ${esc(d.dorms)}</span></div>
        <div class="fact">${ICONS.coin}<span><b>Entrada facilitada:</b> a partir de R$ ${d.entrada_valor} (sujeito a aprovação)</span></div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <p class="eyebrow">Lazer</p>
      <h2>Áreas comuns</h2>
      <div class="amenity-grid">
        ${d.amenities.map((a) => `<div class="amenity-tile">${iconFor(a)}<span>${esc(a)}</span></div>`).join('')}
      </div>
    </div>
  </section>

  ${plantas.length ? `
  <section>
    <div class="wrap">
      <p class="eyebrow">Plantas</p>
      <h2>Configurações disponíveis</h2>
      <p class="lede">Toca numa planta pra ver em tela cheia.</p>
      <div class="planta-grid">
        ${plantas.map((p, i) => `
          <div class="planta-tile" data-i="${i}">
            <img src="${p.imagem}" alt="Planta — ${esc(p.label)} do ${esc(d.nome)}" loading="lazy" />
            <div class="lbl">${esc(p.label)}</div>
          </div>`).join('')}
      </div>
    </div>
  </section>` : ''}

  <section>
    <div class="wrap">
      <p class="eyebrow">Minha Casa Minha Vida</p>
      <h2>Faixas deste empreendimento</h2>
      ${faixaCards}
    </div>
  </section>

  <section>
    <div class="wrap">
      <p class="eyebrow">Como comprar</p>
      <h2>4 passos até as chaves</h2>
      <div class="steps">
        <div class="step"><div class="num">1</div><div class="txt"><b>Escolha a planta</b><span>Veja as configurações acima e me diga qual combina com você.</span></div></div>
        <div class="step"><div class="num">2</div><div class="txt"><b>Confirme sua faixa</b><span>Me manda sua renda mensal que eu já te digo se é HIS-1, HIS-2 ou R2V.</span></div></div>
        <div class="step"><div class="num">3</div><div class="txt"><b>Simule o financiamento</b><span>Faço a simulação com você, sem compromisso.</span></div></div>
        <div class="step"><div class="num">4</div><div class="txt"><b>Agende a visita</b><span>Marco o horário certo pra você conhecer o empreendimento.</span></div></div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <p class="eyebrow">Dúvidas</p>
      <h2>Perguntas frequentes</h2>
      <div class="faq-list">${faqHtml}</div>
    </div>
  </section>

  <div class="final-cta wrap">
    <p class="eyebrow" style="justify-content:center">Pronto pra dar o próximo passo?</p>
    <h2>Fala comigo agora sobre o ${esc(d.nome)}</h2>
    <a class="btn btn-primary" href="${waLink(`Vim da página do ${d.nome} e quero falar com você.`)}" target="_blank" rel="noopener">Falar no WhatsApp</a>
  </div>

  <footer class="wrap">
    <p>Matheus — consultor imobiliário parceiro Cury Construtora. Fotos e plantas ilustrativas, obtidas do site oficial da Cury (cury.net) em setembro de 2026 — disponibilidade e valores sujeitos a alteração. Entrada e condições sujeitas a aprovação de crédito e enquadramento MCMV.</p>
  </footer>
</main>

<div class="lightbox" id="lightbox" hidden>
  <button class="lightbox-close" id="lb-close">×</button>
  <button class="lightbox-nav prev" id="lb-prev">‹</button>
  <button class="lightbox-nav next" id="lb-next">›</button>
  <img id="lb-img" src="" alt="" />
</div>

<script>
  const plantas = ${JSON.stringify(plantas)};
  let lbIndex = 0;
  function openLightbox(i) { lbIndex = i; document.getElementById('lb-img').src = plantas[i].imagem; document.getElementById('lightbox').hidden = false; }
  function shift(d) { lbIndex = (lbIndex + d + plantas.length) % plantas.length; document.getElementById('lb-img').src = plantas[lbIndex].imagem; }
  document.querySelectorAll('.planta-tile').forEach((el) => el.addEventListener('click', () => openLightbox(Number(el.dataset.i))));
  document.getElementById('lb-close')?.addEventListener('click', () => { document.getElementById('lightbox').hidden = true; });
  document.getElementById('lb-prev')?.addEventListener('click', () => shift(-1));
  document.getElementById('lb-next')?.addEventListener('click', () => shift(1));
  document.getElementById('lightbox')?.addEventListener('click', (e) => { if (e.target.id === 'lightbox') e.target.hidden = true; });
</script>
</body>
</html>`;
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/empreendimentos?select=*&ativo=eq.true&order=nome`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const devs = await res.json();

  for (const d of devs) {
    const file = join(__dirname, `emp-${d.slug}.html`);
    writeFileSync(file, pageHtml(d), 'utf8');
    console.log('Gerado:', file);
  }

  const urls = ['', ...devs.map((d) => `emp-${d.slug}.html`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}/${u}</loc></url>`).join('\n')}
</urlset>`;
  writeFileSync(join(__dirname, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  writeFileSync(join(__dirname, 'robots.txt'), robots, 'utf8');

  console.log(`\nPronto: ${devs.length} páginas + sitemap.xml + robots.txt`);
  console.log(`Lembrete: troca SITE_URL (hoje "${SITE_URL}") pelo domínio real e roda de novo antes de publicar.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
