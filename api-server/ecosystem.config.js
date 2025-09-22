module.exports = {
  apps: [
    {
      name: 'api-server',
      script: './server.js',
      cwd: './api-server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './api-server/logs/err.log',
      out_file: './api-server/logs/out.log',
      log_file: './api-server/logs/combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'static-server',
      script: 'http-server',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      args: '. -p 3000 -a 0.0.0.0',
      max_memory_restart: '200M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/static-err.log',
      out_file: './logs/static-out.log',
      log_file: './logs/static-combined.log',
      time: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};