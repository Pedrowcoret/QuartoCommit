const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'admin_secret_key_change_in_production';

// Middleware de autenticação para administradores
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token de acesso requerido' 
      });
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar se a sessão ainda é válida
    const sessionQuery = `
      SELECT s.*, a.codigo, a.nome, a.email, a.nivel_acesso, a.ativo
      FROM admin_sessions s
      JOIN administradores a ON s.admin_id = a.codigo
      WHERE s.token = ? AND s.expires_at > NOW() AND a.ativo = 1
    `;
    
    const sessions = await query(sessionQuery, [token]);
    
    if (sessions.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Sessão inválida ou expirada' 
      });
    }

    const session = sessions[0];
    
    // Atualizar última atividade
    await query(
      'UPDATE admin_sessions SET last_activity = NOW() WHERE token = ?',
      [token]
    );

    // Adicionar dados do admin à requisição
    req.admin = {
      id: session.codigo,
      nome: session.nome,
      email: session.email,
      nivel_acesso: session.nivel_acesso,
      session_id: session.id
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido' 
    });
  }
};

// Middleware para verificar nível de acesso
const requireLevel = (requiredLevel) => {
  const levels = {
    'suporte': 1,
    'admin': 2,
    'super_admin': 3
  };

  return (req, res, next) => {
    const userLevel = levels[req.admin.nivel_acesso] || 0;
    const required = levels[requiredLevel] || 0;

    if (userLevel < required) {
      return res.status(403).json({
        success: false,
        error: 'Nível de acesso insuficiente'
      });
    }

    next();
  };
};

// Função para registrar log de ação administrativa
const logAdminAction = async (adminId, acao, tabelaAfetada = null, registroId = null, dadosAnteriores = null, dadosNovos = null, req = null) => {
  try {
    const ip = req ? (req.ip || req.connection.remoteAddress || 'unknown') : 'system';
    const userAgent = req ? req.get('User-Agent') : 'system';

    await query(`
      INSERT INTO admin_logs (admin_id, acao, tabela_afetada, registro_id, dados_anteriores, dados_novos, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      acao,
      tabelaAfetada,
      registroId,
      dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
      dadosNovos ? JSON.stringify(dadosNovos) : null,
      ip,
      userAgent
    ]);
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

module.exports = {
  adminAuth,
  requireLevel,
  logAdminAction,
  JWT_SECRET
};