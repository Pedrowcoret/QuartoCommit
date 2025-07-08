const express = require('express');
const { query } = require('../../config/database');
const { adminAuth } = require('../../middlewares/adminAuth');

const router = express.Router();

// Dashboard principal com estatísticas
router.get('/stats', adminAuth, async (req, res) => {
  try {
    // Estatísticas gerais de usuários
    const userStatsQuery = `
      SELECT 
        COUNT(*) as total_usuarios,
        SUM(CASE WHEN status_detalhado = 'ativo' THEN 1 ELSE 0 END) as usuarios_ativos,
        SUM(CASE WHEN status_detalhado = 'suspenso' THEN 1 ELSE 0 END) as usuarios_suspensos,
        SUM(CASE WHEN status_detalhado = 'expirado' THEN 1 ELSE 0 END) as usuarios_expirados,
        SUM(CASE WHEN data_cadastro >= CURDATE() - INTERVAL 30 DAY THEN 1 ELSE 0 END) as novos_usuarios_mes,
        SUM(CASE WHEN data_cadastro >= CURDATE() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as novos_usuarios_semana,
        SUM(CASE WHEN ultimo_acesso_data >= CURDATE() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as usuarios_ativos_semana
      FROM revendas
    `;

    // Estatísticas de transmissões
    const transmissionStatsQuery = `
      SELECT 
        COUNT(*) as total_transmissoes,
        SUM(CASE WHEN status = 'ativa' THEN 1 ELSE 0 END) as transmissoes_ativas,
        SUM(CASE WHEN data_inicio >= CURDATE() - INTERVAL 30 DAY THEN 1 ELSE 0 END) as transmissoes_mes,
        SUM(CASE WHEN data_inicio >= CURDATE() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as transmissoes_semana,
        AVG(viewers_pico) as media_viewers,
        SUM(duracao_segundos) as tempo_total_transmissao
      FROM transmissoes
    `;

    // Estatísticas de recursos
    const resourceStatsQuery = `
      SELECT 
        SUM(espaco) as espaco_total_alocado,
        SUM(espaco_usado_mb) as espaco_total_usado,
        AVG(espectadores) as media_espectadores_limite,
        SUM(espectadores) as total_espectadores_limite,
        SUM(CASE WHEN espectadores_ilimitado = 1 THEN 1 ELSE 0 END) as usuarios_espectadores_ilimitados,
        AVG(bitrate) as media_bitrate,
        MAX(bitrate_maximo) as maior_bitrate_maximo
      FROM revendas 
      WHERE status_detalhado = 'ativo'
    `;

    // Estatísticas de plataformas
    const platformStatsQuery = `
      SELECT 
        p.nome as plataforma_nome,
        p.codigo_plataforma,
        COUNT(up.codigo) as usuarios_configurados,
        COUNT(CASE WHEN up.ativo = 1 THEN 1 END) as usuarios_ativos
      FROM plataformas p
      LEFT JOIN user_platforms up ON p.codigo = up.platform_id
      GROUP BY p.codigo, p.nome, p.codigo_plataforma
      ORDER BY usuarios_configurados DESC
    `;

    // Usuários mais ativos (por transmissões)
    const activeUsersQuery = `
      SELECT 
        r.nome, r.email, r.id,
        COUNT(t.codigo) as total_transmissoes,
        MAX(t.data_inicio) as ultima_transmissao,
        SUM(t.duracao_segundos) as tempo_total,
        AVG(t.viewers_pico) as media_viewers
      FROM revendas r
      LEFT JOIN transmissoes t ON r.codigo = t.codigo_stm
      WHERE r.status_detalhado = 'ativo'
      GROUP BY r.codigo, r.nome, r.email, r.id
      HAVING total_transmissoes > 0
      ORDER BY total_transmissoes DESC
      LIMIT 10
    `;

    // Crescimento mensal de usuários
    const growthQuery = `
      SELECT 
        DATE_FORMAT(data_cadastro, '%Y-%m') as mes,
        COUNT(*) as novos_usuarios
      FROM revendas
      WHERE data_cadastro >= CURDATE() - INTERVAL 12 MONTH
      GROUP BY DATE_FORMAT(data_cadastro, '%Y-%m')
      ORDER BY mes ASC
    `;

    // Transmissões por dia (últimos 30 dias)
    const dailyTransmissionsQuery = `
      SELECT 
        DATE(data_inicio) as data,
        COUNT(*) as total_transmissoes,
        SUM(CASE WHEN status = 'ativa' THEN 1 ELSE 0 END) as transmissoes_ativas,
        AVG(viewers_pico) as media_viewers
      FROM transmissoes
      WHERE data_inicio >= CURDATE() - INTERVAL 30 DAY
      GROUP BY DATE(data_inicio)
      ORDER BY data ASC
    `;

    // Executar todas as queries
    const [
      userStats,
      transmissionStats,
      resourceStats,
      platformStats,
      activeUsers,
      growth,
      dailyTransmissions
    ] = await Promise.all([
      query(userStatsQuery),
      query(transmissionStatsQuery),
      query(resourceStatsQuery),
      query(platformStatsQuery),
      query(activeUsersQuery),
      query(growthQuery),
      query(dailyTransmissionsQuery)
    ]);

    // Calcular estatísticas derivadas
    const stats = {
      usuarios: userStats[0],
      transmissoes: transmissionStats[0],
      recursos: resourceStats[0],
      plataformas: platformStats,
      usuarios_ativos: activeUsers,
      crescimento_mensal: growth,
      transmissoes_diarias: dailyTransmissions,
      resumo: {
        taxa_crescimento_usuarios: growth.length > 1 ? 
          ((growth[growth.length - 1].novos_usuarios - growth[growth.length - 2].novos_usuarios) / growth[growth.length - 2].novos_usuarios * 100).toFixed(1) : 0,
        utilizacao_espaco: resourceStats[0].espaco_total_alocado > 0 ? 
          (resourceStats[0].espaco_total_usado / resourceStats[0].espaco_total_alocado * 100).toFixed(1) : 0,
        tempo_medio_transmissao: transmissionStats[0].total_transmissoes > 0 ?
          Math.round(transmissionStats[0].tempo_total_transmissao / transmissionStats[0].total_transmissoes / 60) : 0
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar estatísticas'
    });
  }
});

// Atividade recente do sistema
router.get('/activity', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Logs administrativos recentes
    const adminLogsQuery = `
      SELECT 
        al.acao, al.tabela_afetada, al.created_at,
        a.nome as admin_nome,
        al.dados_novos
      FROM admin_logs al
      JOIN administradores a ON al.admin_id = a.codigo
      ORDER BY al.created_at DESC
      LIMIT ?
    `;

    // Novos usuários recentes
    const newUsersQuery = `
      SELECT nome, email, data_cadastro, status_detalhado
      FROM revendas
      ORDER BY data_cadastro DESC
      LIMIT 10
    `;

    // Transmissões recentes
    const recentTransmissionsQuery = `
      SELECT 
        t.titulo, t.status, t.data_inicio, t.viewers_pico,
        r.nome as usuario_nome
      FROM transmissoes t
      JOIN revendas r ON t.codigo_stm = r.codigo
      ORDER BY t.data_inicio DESC
      LIMIT 10
    `;

    const [adminLogs, newUsers, recentTransmissions] = await Promise.all([
      query(adminLogsQuery, [limit]),
      query(newUsersQuery),
      query(recentTransmissionsQuery)
    ]);

    res.json({
      success: true,
      data: {
        admin_logs: adminLogs,
        novos_usuarios: newUsers,
        transmissoes_recentes: recentTransmissions
      }
    });

  } catch (error) {
    console.error('Admin activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar atividades'
    });
  }
});

// Relatório de uso de recursos
router.get('/resources', adminAuth, async (req, res) => {
  try {
    // Uso de espaço por usuário
    const spaceUsageQuery = `
      SELECT 
        nome, email, id,
        espaco as limite_gb,
        espaco_usado_mb,
        ROUND(espaco_usado_mb / 1024, 2) as espaco_usado_gb,
        ROUND((espaco_usado_mb / 1024) / espaco * 100, 1) as percentual_usado
      FROM revendas
      WHERE status_detalhado = 'ativo' AND espaco > 0
      ORDER BY percentual_usado DESC
      LIMIT 20
    `;

    // Distribuição de espectadores
    const viewersDistributionQuery = `
      SELECT 
        CASE 
          WHEN espectadores_ilimitado = 1 THEN 'Ilimitado'
          WHEN espectadores <= 50 THEN '1-50'
          WHEN espectadores <= 100 THEN '51-100'
          WHEN espectadores <= 500 THEN '101-500'
          WHEN espectadores <= 1000 THEN '501-1000'
          ELSE '1000+'
        END as faixa_espectadores,
        COUNT(*) as quantidade_usuarios
      FROM revendas
      WHERE status_detalhado = 'ativo'
      GROUP BY faixa_espectadores
      ORDER BY quantidade_usuarios DESC
    `;

    // Distribuição de bitrate
    const bitrateDistributionQuery = `
      SELECT 
        CASE 
          WHEN bitrate <= 1000 THEN '≤ 1 Mbps'
          WHEN bitrate <= 2500 THEN '1-2.5 Mbps'
          WHEN bitrate <= 5000 THEN '2.5-5 Mbps'
          WHEN bitrate <= 10000 THEN '5-10 Mbps'
          ELSE '> 10 Mbps'
        END as faixa_bitrate,
        COUNT(*) as quantidade_usuarios,
        AVG(bitrate) as bitrate_medio
      FROM revendas
      WHERE status_detalhado = 'ativo'
      GROUP BY faixa_bitrate
      ORDER BY bitrate_medio ASC
    `;

    const [spaceUsage, viewersDistribution, bitrateDistribution] = await Promise.all([
      query(spaceUsageQuery),
      query(viewersDistributionQuery),
      query(bitrateDistributionQuery)
    ]);

    res.json({
      success: true,
      data: {
        uso_espaco: spaceUsage,
        distribuicao_espectadores: viewersDistribution,
        distribuicao_bitrate: bitrateDistribution
      }
    });

  } catch (error) {
    console.error('Admin resources error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar relatório de recursos'
    });
  }
});

module.exports = router;