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
    <main className="min-h-svh bg-background text-foreground">
      {/* Topbar */}
      <header className="px-6 md:px-10 py-5 flex items-center justify-between border-b border-rule/40">
        <div>
          <p className="eyebrow">Edição diária</p>
          <h1 className="headline text-xl leading-none italic font-light text-foreground/85">
            Caderno Financeiro
          </h1>
        </div>
        <Link href="/login" className={cn(buttonVariants({ size: 'sm' }))}>
          Entrar
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-16 md:pt-24 pb-20 md:pb-32 mx-auto max-w-5xl">
        <div className="text-center space-y-6 md:space-y-8">
          <p className="text-[11px] font-mono text-muted-foreground/80 lowercase first-letter:uppercase">
            {today}
          </p>

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

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-7')}
            >
              Abrir meu caderno
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <p className="text-xs italic text-muted-foreground">
              Login com Google · grátis
            </p>
          </div>
        </div>

        {/* Linha decorativa */}
        <div className="ornament-divider mt-16 md:mt-24">
          <span>❦</span>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-10 py-16 md:py-24 mx-auto max-w-6xl">
        <div className="text-center mb-12 md:mb-16">
          <p className="eyebrow">Suplemento</p>
          <h3 className="headline text-3xl md:text-5xl font-light tracking-tight mt-2">
            Cada seção, um capítulo
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
          <Feature
            icon={Table}
            title="Tabela dinâmica"
            description="Pivote por categoria × mês com totais cruzados. Hover faz crosshair de linha e coluna."
          />
          <Feature
            icon={Calendar}
            title="Multi-ano"
            description="Navegue entre anos com um clique. Cada volume preserva seu próprio histórico."
          />
          <Feature
            icon={CreditCard}
            title="Cartões de crédito"
            description="Grade editável de fatura por cartão × mês. Edita uma célula e o lançamento atualiza."
          />
          <Feature
            icon={Layers}
            title="Lançamento em massa"
            description="Cria várias linhas de uma vez — uma por mês, valores variáveis. Perfeito pra recorrentes."
          />
          <Feature
            icon={ShoppingBag}
            title="Lista de compras"
            description="Wishlist com faixa de preço e impacto previsto no orçamento. Simulador de seleção."
          />
          <Feature
            icon={TrendingUp}
            title="Previsão"
            description={'Saldo até dezembro com simulador "e se" — variação de salário e gastos pontuais.'}
          />
          <Feature
            icon={Calculator}
            title="Calculadora flutuante"
            description="Cálculos auxiliares com cache local. Aceita expressões e nomeia cada linha."
          />
          <Feature
            icon={Lock}
            title="Privado por padrão"
            description="Cada pessoa vê só seu próprio caderno. RLS no banco garante isolamento."
          />
          <Feature
            ghost
            icon={ArrowRight}
            title="Comece agora"
            description="Login com Google em 5 segundos. Seu caderno começa em branco."
            href="/login"
          />
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 md:px-10 py-16 md:py-24 border-t border-rule/40">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="eyebrow">Coluna do editor</p>
          <h3 className="headline text-3xl md:text-4xl font-light italic">
            "Quem registra, governa."
          </h3>
          <p className="text-sm text-muted-foreground italic max-w-md mx-auto">
            Não precisa ser bonito todo dia. Só precisa estar lá, fácil de
            consultar, com a verdade do mês passado e a estimativa do próximo.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 px-7')}
          >
            Abrir meu caderno
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
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
  href,
  ghost = false,
}: {
  icon: typeof Table;
  title: string;
  description: string;
  href?: string;
  ghost?: boolean;
}) {
  const inner = (
    <div className="bg-card hover:bg-paper-dark/30 transition-colors px-6 py-8 h-full flex flex-col gap-3">
      <Icon className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
      <div className="space-y-1.5">
        <h4 className="font-display text-lg leading-tight font-medium">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground italic leading-relaxed">
          {description}
        </p>
      </div>
      {ghost && href && (
        <span className="mt-auto text-xs font-medium text-foreground inline-flex items-center gap-1">
          Login com Google →
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
