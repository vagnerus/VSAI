/**
 * NexusAI — PM2 Ecosystem Config
 * 
 * Uso:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      // ─── Backend (Express + WebSocket) ─────────────────────
      name: 'nexus-server',
      script: 'src/server/index.js',
      interpreter: 'node',
      interpreter_args: '--experimental-vm-modules',
      instances: 1,
      exec_mode: 'fork',

      // Env de produção
      env_production: {
        NODE_ENV: 'production',
        PORT: 3777,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3777,
      },

      // Restart automático
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: './logs/server-out.log',
      error_file: './logs/server-error.log',
      merge_logs: true,
    },
  ],
};
