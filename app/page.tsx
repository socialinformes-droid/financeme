import Link from 'next/link';
import {
  ArrowRight,
  Table,
  Calendar,
  Calculator,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Layers,
  Lock,
  Sparkles,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="min-h-svh bg-background text-foreground overflow-x-hidden">
      {/* Topbar */}
      <header className="px-6 md:px-10 py-5 flex items-center justify-between border-b border-rule/40">
        <div>
          <p className="eyebrow">Edição diária</p>
          <h1 className="headline text-xl leading-none italic font-light text-foreground/85">
            Caderno Financeiro
          </h1>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ size: 'sm' }), 'pill-cta px-4')}
        >
          Entrar
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <section className="relative px-6 md:px-10 pt-12 md:pt-20 pb-16 md:pb-24 mx-auto max-w-5xl">
        {/* Annotation top-right */}
        <span
          aria-hidden
          className="hidden md:block absolute top-12 right-12 handwritten--right text-accent-blue z-10"
        >
          ← grátis pra sempre
          <ArrowSquiggle className="inline-block ml-1 -mt-2 text-accent-blue rotate-12" />
        </span>

        <div className="text-center space-y-6 md:space-y-8">
          <span className="tag-pill tag-warm">
            <Sparkles className="h-3 w-3" />
            Almanaque pessoal · 2026
          </span>

          <h2 className="headline text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight font-light">
            Suas finanças
            <br />
            <span className="italic font-extralight text-foreground/70">
              em forma de caderno
            </span>
          </h2>

          <p className="text-base md:text-lg text-muted-foreground italic max-w-xl mx-auto leading-relaxed">
            Um almanaque pessoal pra acompanhar entradas e saídas mês a mês. Sem
            planilha, sem ruído visual — só o essencial, em papel cremoso e tinta
            firme.
          </p>

          <div className="relative flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: 'lg' }), 'pill-cta h-12 px-7')}
            >
              Abrir meu caderno
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <span className="text-xs italic text-muted-foreground">
              Login com Google · 5 segundos
            </span>

            {/* Annotation handwritten apontando pro CTA */}
            <span
              aria-hidden
              className="hidden md:inline-block absolute -bottom-12 left-1/2 -translate-x-[140%] handwritten--neg text-accent-magenta"
            >
              clica aqui
              <ArrowSquiggle className="inline-block ml-1 rotate-180 -mb-2 text-accent-magenta" />
            </span>
          </div>

          <p className="text-[11px] font-mono text-muted-foreground/60 lowercase first-letter:uppercase pt-2">
            {today}
          </p>
        </div>

        {/* Mockup placeholder — gradient card que evoca dashboard */}
        <div className="mt-20 md:mt-28 relative">
          <div className="absolute inset-x-0 -top-8 -bottom-8 mx-8 bg-foreground/5 rounded-[40px] blur-2xl pointer-events-none" />

          <div className="relative rounded-[24px] md:rounded-[32px] border border-rule/60 bg-card overflow-hidden shadow-[0_20px_80px_-30px_rgba(0,0,0,0.2)]">
            {/* Mock dashboard */}
            <div className="border-b border-rule/40 bg-paper-dark/40 px-6 py-4 flex items-center gap-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-money-down/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-accent-warm/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-money-up/60" />
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                financeme.app/dashboard
              </span>
            </div>
            <div className="p-6 md:p-10 space-y-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Volume 2026 · de</p>
                  <p className="headline text-4xl md:text-5xl tracking-tight">
                    <span className="italic font-extralight">de</span> abril
                  </p>
                </div>
                <span className="tag-pill tag-green">
                  saldo +R$ 30.133
                </span>
              </div>

              {/* Mini cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
                <MiniCard label="Entradas" value="R$ 4.750" tone="up" />
                <MiniCard label="Saídas" value="R$ 1.954" tone="down" />
                <MiniCard label="Saldo do mês" value="R$ 2.796" tone="up" />
                <MiniCard label="Acumulado" value="R$ 30.133" tone="up" />
              </div>

              {/* Mini pivot */}
              <div className="rounded-md border border-rule/60 overflow-hidden font-mono text-[10px] md:text-xs">
                <div className="grid grid-cols-7 bg-paper-dark/40 border-b-2 border-double border-rule/80 px-3 py-2 text-foreground/80">
                  <span>Motivo</span>
                  <span className="text-right">jan</span>
                  <span className="text-right">fev</span>
                  <span className="text-right">mar</span>
                  <span className="text-right">abr</span>
                  <span className="text-right">mai</span>
                  <span className="text-right">total</span>
                </div>
                <PivotRow cat="Salário" v={['3.425', '3.425', '3.425', '3.425', '3.425', '17.125']} tone="up" />
                <PivotRow cat="Cartão" v={['(1.975)', '(1.850)', '(1.947)', '(1.954)', '(944)', '(8.670)']} tone="down" />
                <PivotRow cat="Família" v={['(600)', '(1.250)', '(1.200)', '(1.169)', '(1.200)', '(5.419)']} tone="down" />
                <PivotRow cat="Saúde" v={['—', '—', '—', '(110)', '(110)', '(220)']} tone="down" />
                <div className="grid grid-cols-7 bg-paper-dark/50 border-t-2 border-double border-rule/80 px-3 py-2 font-medium">
                  <span className="font-display italic text-sm">Total</span>
                  <span className="text-right text-money-up">605</span>
                  <span className="text-right text-money-down">(46)</span>
                  <span className="text-right text-money-up">122</span>
                  <span className="text-right text-money-down">(62)</span>
                  <span className="text-right text-money-up">917</span>
                  <span className="text-right text-money-up">+30.133</span>
                </div>
              </div>
            </div>
          </div>

          {/* Annotation no mockup */}
          <span
            aria-hidden
            className="hidden md:block absolute -right-8 top-32 handwritten--tilt text-accent-purple"
          >
            tabela dinâmica
            <br />
            <span className="text-xs not-italic">(com crosshair)</span>
          </span>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-10 py-16 md:py-24 mx-auto max-w-6xl">
        <div className="text-center mb-12 md:mb-16">
          <span className="tag-pill tag-purple">Suplemento</span>
          <h3 className="headline text-3xl md:text-5xl font-light tracking-tight mt-3">
            Cada seção, <span className="italic">um capítulo</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature icon={Table} title="Tabela dinâmica" tag="categoria × mês" tagClass="tag-blue"
            description="Pivote por categoria × mês com totais cruzados. Hover faz crosshair de linha e coluna." />
          <Feature icon={Calendar} title="Multi-ano" tag="2023→2027" tagClass="tag-warm"
            description="Navegue entre anos com um clique. Cada volume preserva seu próprio histórico." />
          <Feature icon={CreditCard} title="Cartões" tag="3 cartões" tagClass="tag-purple"
            description="Grade editável de fatura por cartão × mês. Edita uma célula e o lançamento atualiza." />
          <Feature icon={Layers} title="Lançamento em massa" tag="N por mês" tagClass="tag-magenta"
            description="Cria várias linhas de uma vez — uma por mês, valores variáveis. Perfeito pra recorrentes." />
          <Feature icon={ShoppingBag} title="Lista de compras" tag="impacto orçamentário" tagClass="tag-warm"
            description="Wishlist com faixa de preço e impacto previsto no orçamento. Simulador de seleção." />
          <Feature icon={TrendingUp} title="Previsão" tag={'simulador "e se"'} tagClass="tag-green"
            description="Saldo até dezembro com simulador — variação de salário e gastos pontuais." />
          <Feature icon={Calculator} title="Calculadora flutuante" tag="cache local" tagClass="tag-blue"
            description="Cálculos auxiliares com cache local. Aceita expressões e nomeia cada linha." />
          <Feature icon={Lock} title="Privado por padrão" tag="RLS no banco" tagClass="tag-down"
            description="Cada pessoa vê só seu próprio caderno. RLS no banco garante isolamento." />
          <Link href="/login" className="block">
            <div className="rounded-[24px] border-2 border-foreground/85 bg-foreground text-background hover:bg-foreground/90 transition-colors px-6 py-8 h-full flex flex-col gap-3">
              <ArrowRight className="h-5 w-5" strokeWidth={1.5} />
              <h4 className="font-display text-lg leading-tight font-medium">
                Comece agora
              </h4>
              <p className="text-sm italic leading-relaxed text-background/80">
                Login com Google em 5 segundos. Seu caderno começa em branco.
              </p>
              <span className="mt-auto text-xs font-medium inline-flex items-center gap-1">
                Abrir meu caderno →
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative px-6 md:px-10 py-16 md:py-28 border-t border-rule/40 overflow-hidden">
        <span
          aria-hidden
          className="hidden md:block absolute top-12 left-12 handwritten--neg text-accent-blue text-xl"
        >
          coluna do editor →
        </span>

        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h3 className="headline text-3xl md:text-5xl font-light italic">
            "Quem registra,
            <br />
            governa."
          </h3>
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Não precisa ser bonito todo dia. Só precisa estar lá, fácil de
            consultar, com a verdade do mês passado e a estimativa do próximo.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: 'lg' }), 'pill-cta h-12 px-7')}
            >
              Abrir meu caderno
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        <span
          aria-hidden
          className="hidden md:block absolute bottom-12 right-12 handwritten--right text-accent-magenta text-xl"
        >
          ← seu primeiro lançamento
          <br />
          <span className="text-xs not-italic">leva 30s</span>
        </span>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule/40 px-6 md:px-10 py-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
          ❦ Almanaque pessoal · {new Date().getFullYear()} ❦
        </p>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  tag,
  tagClass,
}: {
  icon: typeof Table;
  title: string;
  description: string;
  tag: string;
  tagClass: string;
}) {
  return (
    <div className="rounded-[24px] border border-rule/60 bg-card hover:border-rule transition-colors px-6 py-8 h-full flex flex-col gap-3 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
        <span className={`tag-pill ${tagClass}`}>{tag}</span>
      </div>
      <div className="space-y-1.5">
        <h4 className="font-display text-lg leading-tight font-medium">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function MiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'up' | 'down';
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-1 font-mono text-sm md:text-base tabular-nums ${
          tone === 'up' ? 'text-money-up' : 'text-money-down'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PivotRow({
  cat,
  v,
  tone,
}: {
  cat: string;
  v: string[];
  tone: 'up' | 'down';
}) {
  const colorClass = tone === 'up' ? 'text-money-up/85' : 'text-money-down/85';
  return (
    <div className="grid grid-cols-7 px-3 py-1.5 border-b border-rule/30 hover:bg-paper-dark/15 transition-colors">
      <span className="text-foreground/80">{cat}</span>
      {v.map((val, i) => (
        <span
          key={i}
          className={`text-right tabular-nums ${val === '—' ? 'text-muted-foreground/40' : colorClass}`}
        >
          {val}
        </span>
      ))}
    </div>
  );
}

// Seta squiggly handwritten — SVG inline
function ArrowSquiggle({ className }: { className?: string }) {
  return (
    <svg
      width="36"
      height="20"
      viewBox="0 0 36 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M2 10 Q 8 4, 14 10 T 26 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 5 L 28 10 L 22 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
