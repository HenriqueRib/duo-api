require('dotenv').config();
// const schedule = require('node-schedule');
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
// const baseUrlApi = 'http://localhost:8080';
const baseUrlApi = 'http://api.duo.imb.br:21009'; 

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
    escreverLog('Conexão com o banco de dados estabelecida!');
    connection.release();
  }
});

async function consultarImovel(codigoImovel) {
  try {
    const url = `${baseUrlApi}/imo_imovel/${codigoImovel}`;
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
    const url = `${baseUrlApi}/imo_arquivo/${nomeArquivo}`;
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
    const titulo = imovelData.Edificio || (imovelData.Descricao ? imovelData.Descricao.substring(0, 50) : '');
    const imovel = {
      id_imovel: codigoImovel,
      titulo: titulo,
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
      sincronizado: 1,
      ativo: imovelData.ExibirNoSite === 'Sim' ? 1 : 0, 
    };

    const imovelExistente = await consultarImovel(codigoImovel);
    if (imovelExistente != null) {
      if (imovelExistente.sincronizado === 1) {
        escreverLog(`Imóvel ${codigoImovel} já sincronizado. Pulando...`);
        return;  // Não sincroniza se já sincronizado
      }
      await pool.query('UPDATE imo_imovel SET ? WHERE id_imovel = ?', [imovel, codigoImovel]);
      await pool.query('COMMIT');
      escreverLog(`UPDATE Imóvel ${codigoImovel} atualizado na tabela imo_imovel.`);
      // escreverLog('Dados inseridos na tabela imo_imovel:', imovel);
    } else {
      // Gerar comando INSERT para imo_imovel - Ajuda a identificar campos que faltam
      // const camposImovel = Object.keys(imovel).join(', ');
      // const valoresImovel = Object.values(imovel)
      //   .map(valor => mysql.escape(valor))
      //   .join(', ');
      // // const sqlInsertImovel = `INSERT INTO imo_imovel (${camposImovel}) VALUES (${valoresImovel});`;
      // escreverLog('Comando INSERT para imo_imovel:', sqlInsertImovel); // Imprime o comando SQL
      await pool.query('INSERT INTO imo_imovel SET ?', [imovel]);
      await pool.query('COMMIT');
      escreverLog(`INSERT Imóvel ${codigoImovel} inserido na tabela imo_imovel.`);
      // escreverLog('Dados inseridos na tabela imo_imovel:', imovel);
    }
    await sincronizarImovelValor(imovelData, codigoImovel);
    await sincronizarImovelFotos(imovelData, codigoImovel, imovel);
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
    escreverLog(`Valor do imóvel ${codigoImovel} inserido na tabela imo_valor.`);
  } catch (error) {
    console.error(`Erro ao sincronizar valor do imóvel ${codigoImovel}:`, error);
    throw error;
  }
}

async function sincronizarImovelFotos(imovelData, codigoImovel, imovel) {
  try {
    if (!codigoImovel) {
      escreverLog(`Interrompe a função se codigoImovel for undefined ${codigoImovel}...`);
      return; // Interrompe a função se codigoImovel for undefined
    }
    escreverLog(`Iniciando sincronização de fotos para o imóvel ${codigoImovel}...`);
    // Crie a pasta se ela não existir
    const pastaImagens = path.join(__dirname, 'imagens', codigoImovel);
    if (!fs.existsSync(pastaImagens)) {
      fs.mkdirSync(pastaImagens, { recursive: true });
    }
    for (const key in imovelData.Foto) {
      const fotoData = imovelData.Foto[key];
      escreverLog(`Processando foto ${key}:`, fotoData);
      const nomeArquivo = new URL(fotoData.Foto).pathname.split('/').pop();
      escreverLog('Nome do arquivo:', nomeArquivo);
      const extensaoArquivo = path.extname(fotoData.Foto);
      const novoNomeArquivo = `${sanitizarNomeArquivo(imovel.titulo)}-${codigoImovel}-${key}${extensaoArquivo}`;
      escreverLog('Novo nome do arquivo:', novoNomeArquivo);
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
      escreverLog(`Imagem ${novoNomeArquivo} do imóvel ${codigoImovel} baixada para ${caminhoArquivo}.`);

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
          escreverLog(`Foto ${arquivo.arquivo} do imóvel ${codigoImovel} atualizada na tabela imo_arquivo.`);
        } else {
          escreverLog(`Foto ${arquivo.arquivo} do imóvel ${codigoImovel} já está atualizada.`);
        }
      } else {
        // const camposArquivo = Object.keys(arquivo).join(', ');
        // const valoresArquivo = Object.values(arquivo)
        //   .map(valor => mysql.escape(valor))
        //   .join(', ');
        // const sqlInsertArquivo = `INSERT INTO imo_arquivo (${camposArquivo}) VALUES (${valoresArquivo});`;
        // escreverLog('Comando INSERT para imo_arquivo:', sqlInsertArquivo);
        // Insere a foto (sem alterações)
        await pool.query('INSERT INTO imo_arquivo SET ?', [arquivo]);
      }
    }
    escreverLog(`Sincronização de fotos para o imóvel ${codigoImovel} concluída.`);
  } catch (error) {
    console.error(`Erro ao sincronizar fotos do imóvel ${codigoImovel}:`, error);
    throw error;
  }
}

function sanitizarNomeArquivo(nome) {
  return nome
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\-]/gi, '-') // Substitui caracteres inválidos por hífen
    .toLowerCase();
}

function formatarDataParaLog() {
  const data = new Date();
  const dia = data.getDate().toString().padStart(2, '0');
  const mes = (data.getMonth() + 1).toString().padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}${mes}${ano}`;
}

function escreverLog(mensagem) {
  const nomeArquivo = path.join(__dirname, 'logs', `log-${formatarDataParaLog()}.log`);

  // Cria o diretório 'logs' se ele não existir
  if (!fs.existsSync(path.join(__dirname, 'logs'))) {
    fs.mkdirSync(path.join(__dirname, 'logs'));
  }

  // Anexa a mensagem ao arquivo de log
  fs.appendFile(nomeArquivo, `${mensagem}\n`, (err) => {
    if (err) {
      console.error('Erro ao escrever no arquivo de log:', err);
    }
  });
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
        "ExibirNoSite",
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
      await sincronizarImovel(response.data);
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
        escreverLog('Page ', pagina);
      } else {
        throw new Error(`Erro ao buscar imóveis da API externa: ${response.status} - ${response.statusText}`);
      }
    }
    escreverLog('Busca de todos os códigos de imóveis concluída!');
    res.json(todosCodigos);
  } catch (error) {
    console.error('Erro ao buscar códigos dos imóveis:', error);
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

// // Sincroniza todos de uma só vez
// async function sincronizarTodosOsImoveis() {
//   try {
//     escreverLog('Iniciando sincronização de todos os imóveis...');
//     // 1. Obter todos os códigos de imóveis
//     const responseCodigos = await axios.get('${baseUrlApi}/imoveis_codigos');
//     const todosCodigos = responseCodigos.data;
//     escreverLog('Códigos dos imóveis:', todosCodigos);
//     // 2. Sincronizar cada imóvel
//     for (const codigo of todosCodigos) {
//       escreverLog(`Sincronizando imóvel ${codigo}...`);
//       const urlImovel = `${baseUrlApi}/imoveis/${codigo}`;
//       const responseImovel = await axios.get(urlImovel);

//       if (responseImovel.status === 200) {
//         escreverLog(`Sincronização imóvel ${codigo} CONCLUIDO`);
//       } else {
//         console.error(`Erro ao buscar detalhes do imóvel ${codigo}:`, responseImovel.status, responseImovel.statusText);
//       }
//     }
//     escreverLog('Sincronização de todos os imóveis concluída!');
//   } catch (error) {
//     console.error('Erro ao sincronizar todos os imóveis:', error);
//   }
// }

// Sincroniza sem o timer . Pega todos os ids e depois chama a rota imoveis/codigo que é o fluxo de sincronizar
// app.get('/sincronizar-todos', async (req, res) => {
//   try {
//     escreverLog('Iniciando sincronização de todos os imóveis...');

//     // 1. Obter todos os códigos de imóveis
//     const responseCodigos = await axios.get('${baseUrlApi}/imoveis_codigos');
//     const todosCodigos = responseCodigos.data;
//     escreverLog('Códigos dos imóveis:', todosCodigos);

//     // 2. Sincronizar cada imóvel
//     for (const codigo of todosCodigos) {
//       escreverLog(`Sincronizando imóvel ${codigo}...`);
//       const urlImovel = `${baseUrlApi}/imoveis/${codigo}`;
//       const responseImovel = await axios.get(urlImovel);

//       if (responseImovel.status === 200) {
//         escreverLog(`Sincronização imóvel ${codigo} CONCLUIDO`);
//       } else {
//         console.error(`Erro ao buscar detalhes do imóvel ${codigo}:`, responseImovel.status, responseImovel.statusText);
//       }
//     }
//     escreverLog('Sincronização de todos os imóveis concluída!');
//     res.status(200).send('Sincronização concluída!');
//   } catch (error) {
//     console.error('Erro ao sincronizar todos os imóveis:', error);
//     res.status(500).send('Erro interno no servidor');
//   }
// });

// Sincronizar todos de 50 em 50 + o time de pausa 
app.get('/sincronizar-todos', async (req, res) => {
  try {
    let pagina = 1;
    let continuarSincronizando = true;
    while (continuarSincronizando) {
      escreverLog(`Sincronizando lote da página ${pagina}...`);
      const responseIds = await axios.get(`${baseUrlApi}/obter-ids-imoveis/${pagina}`);
      const codigos = responseIds.data;
      if (codigos.length === 0) {
        continuarSincronizando = false;
      } else {
        await sincronizarLoteDeImoveis(codigos);
        pagina++;
        escreverLog(`Aguardando 2 minutos antes de sincronizar o próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, 120000)); // Pausa de 2 minutos (120000 milissegundos)
        // await new Promise(resolve => setTimeout(resolve, 240000)); // Pausa de 4 minutos (240000 milissegundos)
      }
    }

    escreverLog('Sincronização de todos os imóveis concluída!');
    res.status(200).send('Sincronização concluída!');
  } catch (error) {
    console.error('Erro ao sincronizar todos os imóveis:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

app.get('/obter-ids-imoveis/:pagina', async (req, res) => {
  try {
    const pagina = parseInt(req.params.pagina) || 1;
    const codigos = await obterImoveisPorPagina(pagina);
    res.json(codigos);
  } catch (error) {
    console.error('Erro ao buscar IDs dos imóveis:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

async function sincronizarLoteDeImoveis(codigos) {
  for (const codigo of codigos) {
    escreverLog(`Sincronizando imóvel ${codigo}...`);
    console.log(`Sincronizando imóvel ${codigo}...`);
    const urlImovel = `${baseUrlApi}/imoveis/${codigo}`;
    const responseImovel = await axios.get(urlImovel);
    if (responseImovel.status === 200) {
      console.log(`Sincronização imóvel ${codigo} CONCLUIDO`);
      escreverLog(`Sincronização imóvel ${codigo} CONCLUIDO`);
    } else {
      console.error(`Erro ao buscar detalhes do imóvel ${codigo}:`, responseImovel.status, responseImovel.statusText);
    }
  }
}

async function obterImoveisPorPagina(pagina) {
  const pesquisa = {
    "fields": ["Codigo"],
    "order": { "DataAtualizacao": "desc" },
    "paginacao": { "pagina": pagina, "quantidade": 50 }
  };
  const url = `${baseUrl}/listar?key=${apiKey}&pesquisa=${encodeURIComponent(JSON.stringify(pesquisa))}&showtotal=1`;
  const response = await axios.get(url);

  if (response.status === 200) {
    return Object.values(response.data)
      .filter(imovel => typeof imovel === 'object' && imovel.Codigo)
      .map(imovel => imovel.Codigo);
  } else {
    throw new Error(`Erro ao buscar imóveis da API externa: ${response.status} - ${response.statusText}`);
  }
}

// Agendamento da Tarefa
// const job = schedule.scheduleJob('0 0 * * *', async () => {
//   escreverLog('Iniciando sincronização agendada...');
//   // Sincroniza todos de uma só vez
//   await sincronizarTodosOsImoveis();
//   escreverLog('Sincronização agendada concluída!');
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
    escreverLog('Iniciando sincronização manual pelo terminal...');
    // await sincronizarTodosOsImoveis();

    // Sincroniza de 50 em 50 + timer    let pagina = 1;
    let continuarSincronizando = true;
    while (continuarSincronizando) {
      escreverLog(`Sincronizando lote da página ${pagina}...`);
      const responseIds = await axios.get(`${baseUrlApi}/obter-ids-imoveis/${pagina}`);
      const codigos = responseIds.data;
      if (codigos.length === 0) {
        continuarSincronizando = false;
      } else {
        await sincronizarLoteDeImoveis(codigos);
        pagina++;
        escreverLog(`Aguardando 2 minutos antes de sincronizar o próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, 120000)); // Pausa de 2 minutos (120000 milissegundos)
        // await new Promise(resolve => setTimeout(resolve, 240000)); // Pausa de 4 minutos (240000 milissegundos)
      }
    }


    escreverLog('Sincronização manual concluída!');
    process.exit(0);
  })
  .demandCommand(1)
  .help()
  .argv;

// Configurar o diretório "imagens" para servir arquivos estáticos
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

app.listen(21009, '0.0.0.0', () => {
  escreverLog(`Servidor rodando em https://api.duo.imb.br:${21009}`);
  console.log(`Servidor rodando em https://api.duo.imb.br:${21009}`);
});

//local 
// app.listen(8080,() => {
//   escreverLog(`Servidor rodando em http://localhost:${8080}`);
//   console.log(`Servidor rodando em http://localhost:${8080}`);
// });