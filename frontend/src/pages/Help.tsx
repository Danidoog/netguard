import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleMinus,
  Clock3,
  Factory,
  Globe,
  HeartPulse,
  History,
  KeyRound,
  LayoutDashboard,
  Monitor,
  Network,
  List,
  Plug,
  Radio,
  RefreshCw,
  RotateCcw,
  Router,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Smartphone,
  Tag,
  TriangleAlert,
  UserPlus,
} from 'lucide-react';
import { HELP_CATEGORIES, HELP_TERMS, type HelpTerm } from '../constants/helpTerms';

const ICONS = {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Circle,
  CircleCheck,
  CircleMinus,
  Clock3,
  Factory,
  Globe,
  HeartPulse,
  History,
  KeyRound,
  LayoutDashboard,
  Monitor,
  Network,
  List,
  Plug,
  Radio,
  RefreshCw,
  RotateCcw,
  Router,
  ShieldCheck,
  ShieldQuestion,
  Smartphone,
  Tag,
  TriangleAlert,
  UserPlus,
} satisfies Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

const CATEGORY_ORDER: HelpTerm['category'][] = ['status', 'trust', 'identify', 'security', 'history'];

const FAQS = [
  {
    question: '¿Por qué un dispositivo aparece y desaparece?',
    answer: 'Puede estar apagado o fuera de la red. También puede ser que tu PC esté en otra red o que el WiFi haya fallado durante un escaneo.',
  },
  {
    question: '¿Qué hago con un dispositivo que no reconozco?',
    answer: [
      'Mira su fabricante y su nombre: muchos celulares y TV se reconocen así.',
      'Apágalo o desconéctalo del WiFi y escanea de nuevo: si desaparece, era ese.',
      'Si sigue sin ser tuyo, cambia la clave del WiFi desde tu router.',
    ],
  },
  {
    question: '¿Qué significa que un puerto sea «sensible»?',
    answer: 'Son puertos que conviene revisar (SMB, Telnet, RDP) porque pueden exponer el dispositivo. Comprueba que sea un servicio que tú reconoces.',
  },
  {
    question: '¿Qué diferencia hay entre alias y hostname?',
    answer: 'El alias lo pones tú (por ejemplo «TV de la sala») y el hostname lo anuncia el propio dispositivo. El alias tiene prioridad.',
  },
  {
    question: '¿Qué significa «MAC privada/aleatoria»?',
    answer: 'El dispositivo está ocultando su MAC real por privacidad. NetGuard no puede identificar el fabricante en esos casos.',
  },
];

const badgeColors: Record<NonNullable<HelpTerm['badge']>['color'], string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-amber-500/30 bg-amber-500/10 text-warning-text',
  muted: 'border-surface-border bg-surface-lighter text-text-muted',
  danger: 'border-danger/30 bg-danger/10 text-danger-text',
};

function navigateToView(view: 'dashboard' | 'devices', filter?: 'unverified') {
  if (filter) sessionStorage.setItem('netguard-devices-initial-filter', filter);
  window.dispatchEvent(new CustomEvent('netguard:navigate-view', { detail: { view } }));
}

export function Help() {
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [highlightedTerm, setHighlightedTerm] = useState<string | null>(null);

  useEffect(() => {
    let highlightTimer: number | undefined;
    let frame: number | undefined;
    const scrollToTerm = (termId: string) => {
      if (!termId) return;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const termElement = document.getElementById(termId);
        if (!termElement) return;
        termElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedTerm(termId);
        window.clearTimeout(highlightTimer);
        highlightTimer = window.setTimeout(() => setHighlightedTerm(null), 2000);
      });
    };
    const scrollToHashTerm = () => scrollToTerm(decodeURIComponent(window.location.hash.slice(1)));
    scrollToHashTerm();
    window.addEventListener('hashchange', scrollToHashTerm);

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.clearTimeout(highlightTimer);
      window.removeEventListener('hashchange', scrollToHashTerm);
    };
  }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase('es');
  const terms = HELP_TERMS.filter((term) => (
    !normalizedSearch
    || `${term.term} ${term.definition} ${HELP_CATEGORIES[term.category]}`
      .toLocaleLowerCase('es')
      .includes(normalizedSearch)
  ));

  return (
    <div className="min-h-screen bg-surface p-6 text-text sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-light">Centro de ayuda</p>
          <h1 className="text-3xl font-bold text-text">Glosario de NetGuard</h1>
          <p className="mt-2 max-w-2xl text-text-muted">
            Aprende qué significa cada dato y cómo usarlo para reconocer los dispositivos de tu red.
          </p>
        </header>

        <section aria-label="Buscar en el glosario" className="mb-10">
          <label htmlFor="help-search" className="sr-only">Buscar un término</label>
          <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-light px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
            <input
              id="help-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar un término (por ejemplo, «MAC privada»)"
              className="min-h-12 w-full bg-transparent py-3 text-sm text-text placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </section>

        <section aria-labelledby="getting-started-heading" className="mb-12">
          <h2 id="getting-started-heading" className="mb-4 text-xl font-semibold text-text">Empieza aquí</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'Escanea tu red', description: 'Pulsa «Iniciar escaneo» en el Dashboard.', link: 'Ir al Dashboard', view: 'dashboard' as const, icon: LayoutDashboard },
              { title: 'Revisa los sin verificar', description: 'Reconoce los que son tuyos y marca el resto.', link: 'Revisar ahora', view: 'devices' as const, filter: 'unverified' as const, icon: Router },
              { title: 'Ponles alias', description: 'Así los encuentras fácil, por ejemplo «TV de la sala».', link: 'Ir a Dispositivos', view: 'devices' as const, icon: Tag },
            ].map(({ title, description, link, view, filter, icon: Icon }, index) => (
              <article key={title} className="flex gap-4 rounded-xl border border-surface-border bg-surface-light p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-light">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-text">{title}</h3>
                  <p className="mt-1 text-sm leading-5 text-text-muted">{description}</p>
                  <button
                    type="button"
                    onClick={() => navigateToView(view, filter)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-light hover:underline"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {link} <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Glosario" className="mb-12 space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const categoryTerms = terms.filter((term) => term.category === category);
            if (!categoryTerms.length) return null;

            return (
              <section key={category} aria-labelledby={`category-${category}`}>
                <h2 id={`category-${category}`} className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {HELP_CATEGORIES[category]}
                </h2>
                <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface-light">
                  {categoryTerms.map((term) => {
                    const Icon = ICONS[term.icon as keyof typeof ICONS];
                    const BadgeIcon = term.badge?.icon ? ICONS[term.badge.icon as keyof typeof ICONS] : null;
                    return (
                      <article
                        id={term.id}
                        key={term.id}
                        className={`scroll-mt-8 p-4 transition-colors duration-500 sm:p-5 ${highlightedTerm === term.id ? 'rounded-lg bg-primary/10' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-text">{term.term}</h3>
                              {term.badge && (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeColors[term.badge.color]}`}>
                                  {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                                  {term.badge.text}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-text-muted">{term.definition}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {terms.length === 0 && (
            <p role="status" className="rounded-xl border border-surface-border bg-surface-light p-6 text-center text-sm text-text-muted">
              No se encontraron términos para «{search.trim()}»
            </p>
          )}
        </section>

        <section aria-labelledby="faq-heading" className="mb-8">
          <h2 id="faq-heading" className="mb-4 text-xl font-semibold text-text">Preguntas frecuentes</h2>
          <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface-light">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              const Chevron = isOpen ? ChevronDown : ChevronRight;
              return (
                <article key={faq.question}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left font-medium text-text hover:bg-surface-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <Chevron className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                      {faq.question}
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={`faq-answer-${index}`} className="px-5 pb-5 pl-12 text-sm leading-6 text-text-muted">
                      {Array.isArray(faq.answer) ? (
                        <ol className="list-decimal space-y-1 pl-4">
                          {faq.answer.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                      ) : <p>{faq.answer}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
