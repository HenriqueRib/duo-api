```markdown
# API de Imóveis - Duo Imóveis

Esta API Node.js sincroniza dados de imóveis de uma fonte externa ([vistahost]) com um banco de dados MySQL, disponibilizando endpoints para acesso aos dados.

## Funcionalidades

- **Sincronização:** Busca dados de imóveis da API externa e atualiza o banco de dados MySQL.
- **Endpoints:** 
    - `/imoveis`: Lista os imóveis.
    - `/imoveis/:codigo`: Retorna detalhes de um imóvel pelo código.
    - `/sincronizar-todos`: Dispara a sincronização manual de todos os imóveis.
    - `/campos`: Lista os campos disponíveis na API externa.
    - `/identificar-colunas`: Lista as colunas das tabelas do banco de dados.
    - `/imo_imovel/:id`: Retorna detalhes de um imóvel pelo ID no banco de dados.
    - `/imo_arquivo/:nome`: Retorna detalhes de um arquivo de imagem pelo nome.

## Pré-requisitos

- **Node.js (v20.15.0 recomendado):** Faça o download em [https://nodejs.org/](https://nodejs.org/).
- **MySQL:** Instale e configure um servidor MySQL.
- **Gerenciador de Pacotes:** npm

## Instalação

1. **Clone o repositório:**
   ```bash
   git clone [URL_DO_REPOSITORIO]
   ```
2. **Instale as dependências:**
   ```bash
   cd duo-api
   npm install
   ```
3. **Configure o arquivo `.env`:**
   ```
   API_KEY=[SUA_API_KEY]
   DB_HOST=[HOST_DO_BANCO_DE_DADOS]
   DB_USER=[USUARIO_DO_BANCO_DE_DADOS]
   DB_PASSWORD=[SENHA_DO_BANCO_DE_DADOS]
   DB_NAME=[NOME_DO_BANCO_DE_DADOS]
   ```
4. **Crie o banco de dados e as tabelas:**
    - Dunp do banco de dados no arquivo: `[duoimoveis.sql]`

## Utilização

1. **Inicie o servidor:**
   ```bash
   node index.js
   ```
2. **Acesse os endpoints da API em:**
   ```
   http://localhost:8080
   ```

## Comandos

- **Sincronização manual:**
   ```bash
   node index.js sincronizar
   ```

## Observações

- **API Externa:** Substitua `[nome_da_fonte/URL]` pelas informações reais da API de onde os dados são buscados.
- **Script SQL:**  Inclua o script SQL para criar o banco de dados e as tabelas ou forneça instruções claras sobre como configurá-los.
- **Agendamento:** O agendamento da sincronização está comentado no código. Remova os comentários para habilitar. 
- **Documentação da API:** Inclua a documentação completa da API (endpoints, parâmetros, exemplos de resposta) para facilitar o uso.

```