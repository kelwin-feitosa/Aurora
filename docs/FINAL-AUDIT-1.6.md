# Aurora 1.6 — LEIA PRIMEIRO

**Classificação de entrega:** `VERSAO_FINAL_TECNICA_PRONTA_PARA_HOMOLOGACAO` para o escopo interno validado offline. **NÃO é produção homologada.** Em especial, ainda não foi comprovado OAuth Gmail/Outlook institucional, instalação em celulares/navegadores reais, quota gratuita Cloudflare, backup D1 de verdade nem auditoria online de dependências.

O diretório `aurora/` contém a aplicação TypeScript/PWA/Worker+D1 completa, migrations 0001–0010, testes (65 em última execução), instalador orientativo, scripts e benchmark. `REFERENCIA/` preserva o ZIP original da RC 1.5. `EVIDENCIAS/` contém logs locais sem dados reais. `RELATORIOS/` inclui checklist, comparativo, matriz e plano de homologação.

**Primeiros comandos (Node >= 22.10, npm e dependências instaladas em sua máquina):**

```bash
cd aurora
npm install  # somente em máquina com registry npm confiável
npm run setup
npm run dev
# verificar sem credenciais reais:
npm run verify
```

Se não tiver experiência com programação, leia `RELATORIOS/07-INSTALACAO-PARA-LEIGOS.md` e `aurora/INSTALAR_AURORA.html`. O instalador **não** contorna registros Google/Microsoft nem configura Cloudflare sem sua autorização.

Consulte `../../RELATORIOS/05-MATRIZ-DE-ACEITE.md` no pacote raiz (sem espaço no caminho) para os estados por jornada.
