const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../../config/database');
const { adminAuth, logAdminAction, JWT_SECRET } = require('../../middlewares/adminAuth');

const router = express.Router();

// Login administrativo
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    console.log('🔐 Tentativa de login admin:', { email, senhaLength: senha?.length });

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios'
      });
    }

    // Buscar administrador com alias para mapear os campos corretamente
    console.log('🔍 Buscando admin no banco...');
    const [admins] = await query(
      `
      SELECT 
        codigo AS id,
        nome,
        email,
        senha,
        ativo,
        nivel_acesso
      FROM administradores
      WHERE email = ? AND ativo = 1
      `,
      [email]
    );

    console.log('🧪 Resultado bruto do banco:', admins);

    if (admins.length === 0) {
      console.log('❌ Admin não encontrado ou inativo');
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    const admin = admins[0];
    console.log('👤 Admin encontrado:', {
      id: admin.id,
      email: admin.email,
      ativo: admin.ativo,
      senhaLength: admin.senha?.length
    });

    // Verificar se a senha existe
    if (!admin.senha) {
      console.log('❌ Senha não configurada para o admin');
      return res.status(500).json({
        success: false,
        error: 'Senha não configurada para este administrador'
      });
    }

    // Verificar senha
    console.log('🔑 Verificando senha...');
    const senhaValida = await bcrypt.compare(senha, admin.senha);
    console.log('🔑 Senha válida:', senhaValida);

    if (!senhaValida) {
      console.log('❌ Senha inválida');
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Gerar token de sessão
    const sessionToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas

    // Criar sessão
    await query(
      `
      INSERT INTO admin_sessions (admin_id, token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        admin.id,
        sessionToken,
        req.ip || req.connection.remoteAddress || 'unknown',
        req.get('User-Agent') || 'unknown',
        expiresAt
      ]
    );

    // Atualizar último acesso
    await query(
      'UPDATE administradores SET ultimo_acesso = NOW() WHERE codigo = ?',
      [admin.id]
    );

    // Log da ação
    await logAdminAction(admin.id, 'login', null, null, null, { ip: req.ip }, req);

    console.log('✅ Login admin realizado com sucesso');
    res.json({
      success: true,
      token: sessionToken,
      admin: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        nivel_acesso: admin.nivel_acesso
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
