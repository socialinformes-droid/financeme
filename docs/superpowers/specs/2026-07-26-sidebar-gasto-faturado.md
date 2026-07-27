# Sidebar Retraível + Filtro Gasto/Faturado

**Data:** 2026-07-26  
**Objetivo:** Melhorar usabilidade do dashboard permitindo maior foco nos dados, e diferenciar visualização entre lançamentos por data de gasto vs. data de fatura.

---

## 1. Sidebar Retraível

### Comportamento

A sidebar pode ser alternada entre dois estados via botão hamburger (≡):

- **Expandido**: Menu completo com ícones e labels, navegação clara
- **Retraído**: Apenas ícones (~64px de largura), labels ocultos, tooltips ao hover

### Implementação

**Botão Toggle:**
- Ícone hamburger posicionado no topo esquerdo da sidebar
- Sempre visível e clicável, independente do estado
- Animação suave na transição entre estados (~200ms)

**Armazenamento de Preferência:**
- Estado é salvo em `localStorage` (chave: `sidebarExpanded`)
- Restaurado ao recarregar a página
- Cada usuário mantém sua preferência

**Tooltips:**
- Quando retraída, tooltip aparece ao passar mouse sobre ícone
- Mostra o nome do item de navegação
- Tooltip desaparece em estado expandido

### Responsividade

- **Desktop**: Toggle funciona normalmente em qualquer tamanho
- **Mobile**: Sidebar mantém comportamento padrão (collapsa automático), sem mudanças no mecanismo de toggle

---

## 2. Filtro Gasto/Faturado na Aba de Lançamentos

### Conceito

Diferencia visualização de lançamentos com base em:
- **Gasto**: Lançamentos agrupados/filtrados por `mês_gasto` (quando efetivamente saiu)
- **Faturado**: Lançamentos agrupados/filtrados por `mês_fatura` (quando foi previsto/faturado)

Um lançamento pode ter `mês_fatura=Julho` mas `mês_gasto=Agosto`, refletindo quando foi planejado vs. quando realmente foi gasto.

### Implementação

**Componente Visual:**
- Dois botões estilo abas: `[Gasto] [Faturado]`
- Um sempre ativo (fundo destacado)
- Posicionado junto aos filtros existentes (categorias, tags, período, etc.)
- Estado padrão: **Gasto** (mantém comportamento atual)

**Comportamento ao Clicar:**
- Muda qual campo é usado para agrupar/filtrar os lançamentos
- Transition suave ao trocar de filtro
- Todos os outros filtros continuam funcionando normalmente

**Persistência:**
- Estado salvo em **URL params** (`?viewType=gasto` ou `?viewType=faturado`)
- Permite compartilhabilidade de links com a visualização correta
- Alternativa: localStorage se preferir não alterar URL

### Integração com Filtros Existentes

- O filtro Gasto/Faturado é **ortogonal** aos demais filtros
- Exemplo: Usuário pode ver "Faturado" + "Categoria: Saúde" + "Período: Julho-2026" simultaneamente
- Indicadores de carregamento existentes são reutilizados

---

## 3. Interações e Comportamentos

### Sidebar + Filtro: Independência

- Sidebar retraída não afeta o filtro Gasto/Faturado
- Filtro ativo não afeta o estado da sidebar
- Ambas as mudanças de estado são salvas independentemente

### Mobile

- Filtro Gasto/Faturado mantém os dois botões visíveis
- Se necessário, quebra em duas linhas para caber
- Sidebar em mobile continua com comportamento padrão

### Estados de Carregamento

- Ao trocar Gasto ↔ Faturado, se houver delay na API/computação, mostra indicador existente (spinner, skeleton, etc.)
- Usa-se padrão visual já estabelecido no app

### Casos Extremos

- **Sem dados em um dos meses**: Mostra mensagem "Nenhum lançamento" ou tabela vazia, conforme padrão do app
- **URL params inválidos**: Cai para padrão (Gasto) silenciosamente
- **localStorage corrompido**: Recupera para estado padrão sem erro

---

## 4. Arquitetura de Dados

Não há mudança na estrutura de dados. A aplicação já possui:
- Campo `mês_gasto` ou equivalente em cada lançamento
- Campo `mês_fatura` ou equivalente em cada lançamento

O filtro apenas muda qual campo é utilizado para:
- Agrupamento na tabela/grid
- Filtro de período (se aplicável)
- Cálculos de resumo/totalizações

---

## 5. Testing

### Casos de Teste

1. **Sidebar Toggle**
   - [ ] Clicar hamburger expande → retraia → expande
   - [ ] Estado persiste ao recarregar página
   - [ ] Tooltips aparecem quando retraída
   - [ ] Transição é suave

2. **Filtro Gasto/Faturado**
   - [ ] Clicar em "Faturado" muda visualização
   - [ ] Clicar em "Gasto" volta ao padrão
   - [ ] Dados mostram valores corretos para cada filtro
   - [ ] Outros filtros continuam funcionando com ambos os estados
   - [ ] URL params refletem estado (se usar URL)

3. **Integração**
   - [ ] Sidebar retraída não quebra filtro
   - [ ] Trocar filtro com sidebar retraída funciona normalmente

4. **Mobile**
   - [ ] Filtro Gasto/Faturado é responsivo
   - [ ] Sidebar mantém comportamento esperado em mobile

---

## 6. Escopo Fora

- Mudanças na estrutura de dados (não necessárias)
- Redesign dos filtros existentes
- Alterações em outras abas do app
- Analytics/tracking de uso dos filtros
