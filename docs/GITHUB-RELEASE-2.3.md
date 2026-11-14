# Aurora 2.3 — Política de GitHub e publicação

- Repositório oficial: `kelwin-feitosa/Aurora`, **privado** até autorização explícita para abrir.
- Importar apenas código atual, scripts, migrações, testes e documentação útil. Não importar ZIPs anteriores, backups, artefatos de execução, credenciais ou dumps.
- `main`: baseline 2.2 preservado. Branch `feature/aurora-2.3`: implementação 2.3 para revisão. Abrir PR, **não mesclar automaticamente**.
- `package-lock.json` precisa ser criado pelo npm real, com acesso ao registry, e `npm ci`/`npm audit` validados antes de release público. Não fabricar lockfile com base em instalações antigas. Enquanto ausente, CI estrito é bloqueado; registrar NO-GO.
- Verificar `git log`, `git ls-files`, `git status`, scanning de segredos, licenças e direitos de terceiros antes de tornar o repositório público.
- Template Cloudflare via repositório público só depois de validação de deploy e OAuth. **Não mudar a visibilidade** por causa da conveniência do Deploy Button.
- Teste com estudantes exige autorização dos titulares e conformidade com regras da instituição.
