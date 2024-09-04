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
    - `/ativar-imovel/:id`: Força aparecer o imovel no site
    - `/desativar-imovel/:id`: Força retirar do site 
    - `/controle-sincronizar`: Mostra o status do fluxo de sincronização 
    - `/atualiza-controle-sincronizar`: Atualiza status do fluxo de sincronização
    

## Acesso às Imagens

As imagens dos imóveis são baixadas e salvas localmente. Você pode acessá-las utilizando a seguinte estrutura de URL:

```
http://api.duo.imb.br:21009/imagens/{ID_IMOVEL}/{Nome_do_Edificio-separado-por-hifens}-{ID_IMOVEL}-{ORDEM}.jpg
```

**Exemplo:**

```
http://api.duo.imb.br:21009/imagens/1599/balneario-moschen-1599-1.jpg
```

**Onde:**

- `{ID_IMOVEL}`: ID do imóvel no banco de dados.
- `{Nome_do_Edificio-separado-por-hifens}`: Nome do edifício com espaços substituídos por hifens.
- `{ORDEM}`: Número sequencial da imagem dentro do imóvel.


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
   # API Externa	
   BASE_URL=[SUA_ROTA_API]
   API_KEY=[SUA_API_KEY] 

   # Ambiente da Aplicação
   APP_ENV=local # ou APP_ENV=production

   # Banco de Dados
   DB_HOST=[HOST_DO_BANCO_DE_DADOS]
   DB_USER=[USUARIO_DO_BANCO_DE_DADOS]
   DB_PASSWORD=[SENHA_DO_BANCO_DE_DADOS]
   DB_NAME=[NOME_DO_BANCO_DE_DADOS]

   # Configuração do Servidor
   PORTA_PRODUCTION=21009
   PORTA_LOCAL=8080
   HOST_PRODUCTION='0.0.0.0'
   HOST_LOCAL='localhost'

   # Paginação
   QTD_POR_PAGINA=50 
   API_KEY=[SUA_API_KEY]
   DB_HOST=[HOST_DO_BANCO_DE_DADOS]
   DB_USER=[USUARIO_DO_BANCO_DE_DADOS]
   DB_PASSWORD=[SENHA_DO_BANCO_DE_DADOS]
   DB_NAME=[NOME_DO_BANCO_DE_DADOS]
   ```
4. **Crie o banco de dados e as tabelas:**
    - Dump do banco de dados no arquivo: `[duoimoveis.sql]`

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

## Comandos SQL 

- **Alteração banco de dados na tabela imo_imovel:**
   ```bash
   ALTER TABLE imo_imovel ADD COLUMN sincronizado TINYINT(1) DEFAULT 0;
   ```
   ```bash
   ALTER TABLE imo_imovel DROP COLUMN sincronizado; 
   ```
- **Alteração banco de dados na tabela imo_arquivo:**
   ```bash
   ALTER TABLE imo_arquivo ADD COLUMN name_arquivo_crm VARCHAR(255); 
   ```
   ```bash
   TRUNCATE TABLE imo_arquivo;
   ```
- **Alteração banco de dados criando tabela imo_controle_sincronizar:**
   ```bash
      CREATE TABLE imo_controle_sincronizar (
         id INT AUTO_INCREMENT PRIMARY KEY,
         dia DATE,
         pagina_atual INT,
         qtd_tentativa INT DEFAULT 0,
         status VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```
