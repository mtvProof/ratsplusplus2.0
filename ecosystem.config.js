module.exports = {
  apps: [{
    name: 'ratsplusplus',
    script: './index.ts',
    interpreter: 'node',
    interpreter_args: '--loader ts-node/esm',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1500M',  // Restart if memory exceeds 1.5GB
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=1536'  // Limit Node.js heap to 1.5GB
    },
    // Cron restart every day at 9:30 AM (after server reboot)
    cron_restart: '30 9 * * *'
  }]
};
