/*
 * @Author: CarlJia
 * @Date: 2025-06-19
 * @LastEditors: CarlJia
 * @LastEditTime: 2025-06-19
 * @Description: SFTP配置文件示例
 * 
 * 使用方法：
 * 1. 复制此文件为 sftp-config.js
 * 2. 填入您的实际SFTP连接信息
 * 3. 运行 npm run deploy:sftp 进行部署
 * 
 * 私钥格式说明：
 * - 支持OpenSSH PEM格式和PuTTY PPK格式
 * - OpenSSH格式：文件内容包含 "-----BEGIN" 和 "-----END" 标记
 * - PPK格式：文件内容包含 "PuTTY-User-Key-File" 标记
 * - 如果使用PPK格式，需要安装PuTTY工具包（包含puttygen）
 * 
 * 常见私钥格式示例：
 * 
 * OpenSSH格式：
 * -----BEGIN OPENSSH PRIVATE KEY-----
 * [私钥内容]
 * -----END OPENSSH PRIVATE KEY-----
 * 
 * PPK格式：
 * PuTTY-User-Key-File-2: ssh-rsa
 * Encryption: none
 * Comment: rsa-key-20250127
 * Public-Lines: 6
 * [公钥内容]
 * Private-Lines: 14
 * [私钥内容]
 * Private-MAC: [MAC值]
 */

export default {
  // 服务器配置
  host: 'your-server.com',           // 服务器地址
  port: 22,                          // SSH端口
  username: 'your-username',         // 用户名
  
  // 认证方式 (二选一)
  password: 'your-password',         // 密码认证
  // privateKey: '/path/to/private/key', // 私钥认证 (推荐)
  
  // 路径配置
  localPath: './dist',               // 本地构建目录
  remotePath: '/var/www/html',       // 远程部署目录
  
  // 部署选项
  clean: false,                      // 是否清理远程目录 (谨慎使用!)
  verbose: true,                     // 详细日志输出
  
  // 连接配置
  timeout: 20000,                    // 连接超时时间 (毫秒)
  retries: 3,                        // 重试次数
  retry_factor: 2,                   // 重试因子
  retry_minTimeout: 2000,            // 最小重试间隔 (毫秒)
  
  // 忽略文件
  ignore: [
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    'node_modules/**',
    '.git/**',
    '.vscode/**',
    '*.tmp',
    '*.temp'
  ]
}; 