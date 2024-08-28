require('dotenv').config();
const schedule = require('node-schedule');
const axios = require('axios');
const mysql = require('mysql');
const path = require('path');
const apiKey = process.env.API_KEY;
const baseUrl = 'https://clie1076-rest.vistahost.com.br/imoveis';
const express = require('express');
const app = express();
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Configurações do banco de dados do .env
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool(dbConfig);

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conexão com o banco de dados estabelecida!');
    connection.release();
  }
});

async function consultarImovel(codigoImovel) {
  try {
    const url = `https://api.duo.imb.br/8080/imo_imovel/${codigoImovel}`;
    const response = await axios.get(url);
    if (response.status === 200) {
      return response.data;
    } else {
      // console.error(`Erro ao consultar imóvel ${codigoImovel}:`, response.status, response.statusText);
      return null;
    }
  } catch (error) {
    // console.error(`Erro ao consultar imóvel ${codigoImovel}:`, error);
    return null;
  }
}

async function consultarArquivo(nomeArquivo) {
  try {
    const url = `https://api.duo.imb.br/8080/imo_arquivo/${nomeArquivo}`;
    const response = await axios.get(url);
    if (response.status === 200) {
      return response.data;
    } else {
      // console.error(`Erro ao consultar arquivo ${nomeArquivo}:`, response.status, response.statusText);
      return null;
    }
  } catch (error) {
    // console.error(`Erro ao consultar arquivo ${nomeArquivo}:`, error);
    return null;
  }
}

// Funções para sincronizar tabelas
async function sincronizarImovel(imovelData) {
  try {
    const codigoImovel = imovelData.Codigo;
    const imovel = {
      id_imovel: codigoImovel,
      titulo: imovelData.Edificio || imovelData.Descricao.substring(0, 50),
      descricao: imovelData.Descricao,
      situacao: imovelData.Status,
      categoria: imovelData.Categoria,
      vagas: imovelData.Vagas,
      dormitorios: imovelData.Dormitorios,
      suites: null,
      area_privativa: imovelData.AreaPrivativa,
      endereco: imovelData.Endereco,
      uf: imovelData.UF,
      distancia_mar: imovelData.DistanciaMar || ' ',
      cidade: imovelData.Cidade,
      bairro: imovelData.Bairro,
      valor: imovelData.ValorVenda,
      valor_anterior: null,
      valor_anterior_date: null,
      valor_locacao: imovelData.ValorLocacao,
      valor_anterior_locacao: 0,
      valor_anterior_locacao_date: '0000-00-00 00:00:00',
      valor_iptu: imovelData.ValorIptu,
      valor_condominio: imovelData.ValorCondominio,
      gmaps_lat: imovelData.Latitude,
      gmaps_lng: imovelData.Longitude,
      lastmod: new Date().toISOString().slice(0, 10),
      //ativo: 1,
      //TODO:Indentificar COMO saber que deve mostrar ou não no site.
    };

    const imovelExistente = await consultarImovel(codigoImovel);
    //TODO: VOLTAR
    // if (imovelExistente != null) {
    //   await pool.query('UPDATE imo_imovel SET ? WHERE id_imovel = ?', [imovel, codigoImovel]);
    //   await pool.query('COMMIT');
    //   console.log(`UPDATE Imóvel ${codigoImovel} atualizado na tabela imo_imovel.`);
    //   // console.log('Dados inseridos na tabela imo_imovel:', imovel);
    // } else {
    //   // Gerar comando INSERT para imo_imovel - Ajuda a identificar campos que faltam
    //   // const camposImovel = Object.keys(imovel).join(', ');
    //   // const valoresImovel = Object.values(imovel)
    //   //   .map(valor => mysql.escape(valor))
    //   //   .join(', ');
    //   // // const sqlInsertImovel = `INSERT INTO imo_imovel (${camposImovel}) VALUES (${valoresImovel});`;
    //   // console.log('Comando INSERT para imo_imovel:', sqlInsertImovel); // Imprime o comando SQL
    //   await pool.query('INSERT INTO imo_imovel SET ?', [imovel]);
    //   await pool.query('COMMIT');
    //   console.log(`INSERT Imóvel ${codigoImovel} inserido na tabela imo_imovel.`);
    //   // console.log('Dados inseridos na tabela imo_imovel:', imovel);
    // }
    // await sincronizarImovelValor(imovelData, codigoImovel);
    // await sincronizarImovelFotos(imovelData, codigoImovel, imovel);
  } catch (error) {
    console.error(`Erro ao sincronizar imóvel ${imovelData.Codigo}:`, error);
    throw error;
  }
}

async function sincronizarImovelValor(imovelData, codigoImovel) {
  try {

    const dataAtual = new Date();
    const valor = {
      id_imovel: codigoImovel,
      data: dataAtual,
      valor: imovelData.ValorVenda,
      valor_locacao: imovelData.ValorLocacao,
      valor_iptu: imovelData.ValorIptu,
      valor_condominio: imovelData.ValorCondominio
    };
    // A regra na tabela não precisa verificar pois nela contem a data do ultima
    await pool.query('INSERT INTO imo_valor SET ?', [valor]);
    console.log(`Valor do imóvel ${codigoImovel} inserido na tabela imo_valor.`);
  } catch (error) {
    console.error(`Erro ao sincronizar valor do imóvel ${codigoImovel}:`, error);
    throw error;
  }
}

async function sincronizarImovelFotos(imovelData, codigoImovel, imovel) {
  try {
    console.log(`Iniciando sincronização de fotos para o imóvel ${codigoImovel}...`);

    // Crie a pasta se ela não existir
    const pastaImagens = path.join(__dirname, 'imagens', codigoImovel);
    if (!fs.existsSync(pastaImagens)) {
      fs.mkdirSync(pastaImagens, { recursive: true });
    }

    for (const key in imovelData.Foto) {
      const fotoData = imovelData.Foto[key];
      console.log(`Processando foto ${key}:`, fotoData);

      const nomeArquivo = new URL(fotoData.Foto).pathname.split('/').pop();
      console.log('Nome do arquivo:', nomeArquivo);
      const extensaoArquivo = path.extname(fotoData.Foto);
      const novoNomeArquivo = `${imovel.titulo.replace(/ /g, '-').toLowerCase()}-${codigoImovel}-${key}${extensaoArquivo}`;
      console.log('Novo nome do arquivo:', novoNomeArquivo);

      const arquivo = {
        id_imovel: codigoImovel,
        arquivo: novoNomeArquivo,
        legenda: null,
        id_categoria: 1,
        principal: fotoData.Destaque === 'Sim' ? 'S' : 'N',
        id_importado: codigoImovel,
        ordem: key
      };


      const arquivoExistente = await consultarArquivo(novoNomeArquivo);
      // Faça o download da imagem
      const caminhoArquivo = path.join(pastaImagens, novoNomeArquivo);
      const response = await axios.get(fotoData.Foto, { responseType: 'stream' });
      response.data.pipe(fs.createWriteStream(caminhoArquivo));
      console.log(`Imagem ${novoNomeArquivo} do imóvel ${codigoImovel} baixada para ${caminhoArquivo}.`);


      if (arquivoExistente != null) {
        // 1. Verificar se há dados para atualizar (exemplo simplificado)
        let precisaAtualizar = false;
        for (const campo in arquivo) {
          if (campo !== 'id_arquivo' && String(arquivo[campo]) !== String(arquivoExistente[campo])) {
            precisaAtualizar = true;
            break;
          }
        }

        if (precisaAtualizar) {
          // 2. Executar o UPDATE apenas se houver dados diferentes
          await pool.query('UPDATE imo_arquivo SET ? WHERE id_arquivo = ?', [arquivo, arquivoExistente.id_arquivo]);
          console.log(`Foto ${arquivo.arquivo} do imóvel ${codigoImovel} atualizada na tabela imo_arquivo.`);
        } else {
          console.log(`Foto ${arquivo.arquivo} do imóvel ${codigoImovel} já está atualizada.`);
        }
      } else {
        // const camposArquivo = Object.keys(arquivo).join(', ');
        // const valoresArquivo = Object.values(arquivo)
        //   .map(valor => mysql.escape(valor))
        //   .join(', ');
        // const sqlInsertArquivo = `INSERT INTO imo_arquivo (${camposArquivo}) VALUES (${valoresArquivo});`;
        // console.log('Comando INSERT para imo_arquivo:', sqlInsertArquivo);
        // Insere a foto (sem alterações)
        await pool.query('INSERT INTO imo_arquivo SET ?', [arquivo]);
      }
    }
    console.log(`Sincronização de fotos para o imóvel ${codigoImovel} concluída.`);
  } catch (error) {
    console.error(`Erro ao sincronizar fotos do imóvel ${codigoImovel}:`, error);
    throw error;
  }
}

// Rotas da API
app.get('/identificar-colunas', async (req, res) => {
  try {
    const tabelas = ['imo_arquivo', 'imo_bairro', 'imo_categoria', 'imo_cidade', 'imo_imovel', 'imo_internacional', 'imo_valor'];
    const resultados = {};
    for (const tabela of tabelas) {
      pool.query(`DESCRIBE ${tabela}`, (error, results, fields) => {
        if (error) {
          console.error(`Erro na consulta DESCRIBE para ${tabela}:`, error);
          resultados[tabela] = `Erro: ${error.message}`;
          return;
        }
        resultados[tabela] = results.map(row => row.Field);
      });
    }
    setTimeout(() => {
      res.json(resultados);
    }, 100);
  } catch (error) {
    console.error('Erro geral ao identificar colunas:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/imo_arquivo/:nome', async (req, res) => {
  try {
    const nomeArquivo = req.params.nome;
    pool.query(
      'SELECT * FROM imo_arquivo WHERE arquivo = ?',
      [nomeArquivo],
      (error, results) => {
        if (error) {
          console.error('Erro ao consultar imo_arquivo:', error);
          res.status(500).send('Erro interno no servidor');
          return;
        }
        if (results.length > 0) {
          res.json(results[0]);
        } else {
          res.status(404).send('imo_arquivo não encontrado');
        }
      }
    );
  } catch (error) {
    console.error('Erro ao consultar arquivo na rota:', error);
    res.status(500).send('Erro ao consultar arquivo');
  }
});

app.get('/imo_imovel/:id', async (req, res) => {
  try {
    const idImovel = req.params.id;
    pool.query(
      'SELECT * FROM imo_imovel WHERE id_imovel = ?',
      [idImovel],
      (error, results) => {
        if (error) {
          console.error('Erro ao consultar imo_imovel:', error);
          res.status(500).send('Erro interno no servidor');
          return;
        }
        if (results.length > 0) {
          res.json(results[0]);
        } else {
          res.status(404).send('Imovel não encontrado');
        }
      }
    );
  } catch (error) {
    console.error('Erro ao consultar imo_imovel:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/imoveis', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const pesquisa = {
      "fields": [
        "Edificio", "Categoria", "Descricao", "Status",
        "Dormitorios", "Vagas", "BanheiroSocialQtd", "AreaPrivativa",
        "Cidade", "UF", "Bairro", "Endereco", "TipoEndereco",
        "Latitude", "Longitude", "ValorVenda", "ValorLocacao",
        "Situacao", "Finalidade", "FotoDestaque", "DataAtualizacao",
        "Caracteristicas", "ValorIptu", "ValorCondominio", "DistanciaMar", "ExibirNoSite",
      ],
      "order": { "DataAtualizacao": "desc" },
      "paginacao": { "pagina": page, "quantidade": 50 }
    };
    const url = `${baseUrl}/listar?key=${apiKey}&pesquisa=${encodeURIComponent(JSON.stringify(pesquisa))}&showtotal=1`;
    const response = await axios.get(url);
    if (response.status === 200) {
      res.json(response.data);
    } else {
      res.status(response.status).send(response.statusText);
    }
  } catch (error) {
    console.error('Erro ao buscar imóveis:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/imoveis/:codigo', async (req, res) => {
  try {
    const codigoImovel = req.params.codigo;
    const pesquisa = {
      "fields": [
        "Codigo", "Edificio", "Categoria", "Descricao", "Status",
        "Dormitorios", "Vagas", "BanheiroSocialQtd", "AreaPrivativa",
        "Cidade", "UF", "Bairro", "Endereco", "TipoEndereco",
        "Latitude", "Longitude", "ValorVenda", "ValorLocacao",
        "Situacao", "Finalidade", "FotoDestaque", "DataAtualizacao",
        "Caracteristicas", "ValorIptu", "ValorCondominio", "DistanciaMar", "ExibirNoSite",
        { "Foto": ["Foto", "FotoPequena", "Destaque", "Codigo"] }
      ]
    };

    const url = `${baseUrl}/detalhes?key=${apiKey}&imovel=${codigoImovel}&pesquisa=${encodeURIComponent(JSON.stringify(pesquisa))}`;
    const response = await axios.get(url);

    if (response.status === 200) {
      //TODO: VOLTAR
      // await sincronizarImovel(response.data);
      res.json({ ...response.data });
    } else {
      const errorMessage = `Erro ao buscar detalhes do imóvel: ${response.status} - ${response.statusText}`;
      console.error(errorMessage);
      res.status(response.status).json({ error: errorMessage });
    }
  } catch (error) {
    console.error('Erro ao buscar detalhes do imóvel:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/imoveis_codigos', async (req, res) => {
  try {
    let pagina = 1;
    let todosCodigos = [];
    let continuarBuscando = true;

    while (continuarBuscando) {
      const pesquisa = {
        "fields": ["Codigo"],
        "order": { "DataAtualizacao": "desc" },
        "paginacao": { "pagina": pagina, "quantidade": 50 }
      };

      const url = `${baseUrl}/listar?key=${apiKey}&pesquisa=${encodeURIComponent(JSON.stringify(pesquisa))}&showtotal=1`;
      const response = await axios.get(url);

      if (response.status === 200) {
        const codigos = Object.values(response.data)
          .filter(imovel => typeof imovel === 'object' && imovel.Codigo)
          .map(imovel => imovel.Codigo);

        todosCodigos = todosCodigos.concat(codigos); // Adiciona os novos códigos ao array principal

        // Verifica se há mais páginas
        if (codigos.length < 50) {
          continuarBuscando = false; // Para a busca se a página atual tem menos de 50 códigos
        } else {
          pagina++; // Incrementa a página para a próxima requisição
        }
        console.log('Page ', pagina);
      } else {
        throw new Error(`Erro ao buscar imóveis da API externa: ${response.status} - ${response.statusText}`);
      }
    }

    console.log('Busca de todos os códigos de imóveis concluída!');
    res.json(todosCodigos);
  } catch (error) {
    console.error('Erro ao buscar códigos dos imóveis:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/sincronizar-todos', async (req, res) => {
  try {
    console.log('Iniciando sincronização de todos os imóveis...');

    // 1. Obter todos os códigos de imóveis
    const responseCodigos = await axios.get('https://api.duo.imb.br/8080/imoveis_codigos');
    const todosCodigos = responseCodigos.data;
    console.log('Códigos dos imóveis:', todosCodigos);

    // 2. Sincronizar cada imóvel
    for (const codigo of todosCodigos) {
      console.log(`Sincronizando imóvel ${codigo}...`);
      const urlImovel = `https://api.duo.imb.br/8080/imoveis/${codigo}`;
      const responseImovel = await axios.get(urlImovel);

      if (responseImovel.status === 200) {
        console.log(`Sincronização imóvel ${codigo} CONCLUIDO`);
      } else {
        console.error(`Erro ao buscar detalhes do imóvel ${codigo}:`, responseImovel.status, responseImovel.statusText);
      }
    }
    console.log('Sincronização de todos os imóveis concluída!');
    res.status(200).send('Sincronização concluída!');
  } catch (error) {
    console.error('Erro ao sincronizar todos os imóveis:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/campos', async (req, res) => {
  try {
    const url = `${baseUrl}/listarcampos?key=${apiKey}`;
    const response = await axios.get(url);
    if (response.status === 200) {
      res.json(response.data);
    } else {
      res.status(response.status).send(response.statusText);
    }
  } catch (error) {
    console.error('Erro ao listar campos:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

async function sincronizarTodosOsImoveis() {
  try {
    console.log('Iniciando sincronização de todos os imóveis...');
    // 1. Obter todos os códigos de imóveis
    const responseCodigos = await axios.get('https://api.duo.imb.br/8080/imoveis_codigos');
    const todosCodigos = responseCodigos.data;

    console.log('Códigos dos imóveis:', todosCodigos);
    // 2. Sincronizar cada imóvel
    for (const codigo of todosCodigos) {
      console.log(`Sincronizando imóvel ${codigo}...`);
      const urlImovel = `https://api.duo.imb.br/8080/imoveis/${codigo}`;
      const responseImovel = await axios.get(urlImovel);

      if (responseImovel.status === 200) {
        console.log(`Sincronização imóvel ${codigo} CONCLUIDO`);
      } else {
        console.error(`Erro ao buscar detalhes do imóvel ${codigo}:`, responseImovel.status, responseImovel.statusText);
      }
    }
    console.log('Sincronização de todos os imóveis concluída!');
  } catch (error) {
    console.error('Erro ao sincronizar todos os imóveis:', error);
  }
}

// Agendamento da Tarefa
// const job = schedule.scheduleJob('0 0 * * *', async () => {
//   console.log('Iniciando sincronização agendada...');
//   await sincronizarTodosOsImoveis();
//   console.log('Sincronização agendada concluída!');
// });

yargs(hideBin(process.argv))
  .command(
    '$0',
    'Inicia o servidor',
    () => { },
    async (argv) => {
    }
  )
  .command('sincronizar', 'Sincroniza todos os imóveis manualmente', () => { }, async (argv) => {
    console.log('Iniciando sincronização manual pelo terminal...');
    await sincronizarTodosOsImoveis();
    console.log('Sincronização manual concluída!');
    process.exit(0);
  })
  .demandCommand(1)
  .help()
  .argv;

  app.listen(21009, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${21009}`);
    console.log(`Servidor rodando em https://api.duo.imb.br:${21009}`); 
  });