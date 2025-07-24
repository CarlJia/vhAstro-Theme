/*
 * @Author: CarlJia
 * @Date: 2025-07-24
 * @LastEditors: CarlJia
 * @LastEditTime: 2025-07-24
 * @Description: FTP部署脚本
 */
import FTP from 'basic-ftp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载配置文件
let sftpConfig;
try {
  const configPath = path.join(__dirname, '..', 'sftp-config.js');
  const configModule = await import(configPath);
  sftpConfig = configModule.default;
} catch (error) {
  console.error('❌ 加载配置文件失败:', error.message);
  console.log('💡 请确保 sftp-config.js 文件存在且格式正确');
  process.exit(1);
}

// 验证配置
function validateConfig() {
  const required = ['host', 'port', 'username', 'password', 'localPath', 'remotePath'];
  const missing = required.filter(key => !sftpConfig[key]);

  if (missing.length > 0) {
    console.error('❌ 配置缺失:', missing.join(', '));
    return false;
  }

  return true;
}

// 递归上传目录
async function uploadDirectory(client, localPath, remotePath) {
  const files = fs.readdirSync(localPath);
  for (const file of files) {
    const localFilePath = path.join(localPath, file);
    const remoteFilePath = path.posix.join(remotePath, file);
    const stat = fs.statSync(localFilePath);

    if (stat.isDirectory()) {
      // 确保远程目录存在
      await client.ensureDir(remoteFilePath);
      console.log(`✅ 确保远程目录存在: ${remoteFilePath}`);
      // 递归上传子目录
      await uploadDirectory(client, localFilePath, remoteFilePath);
    } else {
      // 上传文件
      await client.uploadFrom(localFilePath, remoteFilePath);
      if (sftpConfig.verbose) {
        console.log(`✅ 上传文件: ${remoteFilePath}`);
      }
    }
  }
}

// 主部署函数
async function deploy() {
  console.log('🚀 开始FTP部署...');
  console.log(`📁 本地路径: ${sftpConfig.localPath}`);
  console.log(`🌐 远程路径: ${sftpConfig.remotePath}`);
  console.log(`🔌 服务器: ${sftpConfig.host}:${sftpConfig.port}`);

  // 验证配置
  if (!validateConfig()) {
    process.exit(1);
  }

  // 检查本地路径
  if (!fs.existsSync(sftpConfig.localPath)) {
    console.error(`❌ 本地路径不存在: ${sftpConfig.localPath}`);
    process.exit(1);
  } else {
    console.log(`✅ 本地路径存在: ${sftpConfig.localPath}`);
  }

  const client = new FTP.Client();
  client.ftp.verbose = sftpConfig.verbose;

  try {
    console.log('🔌 连接到FTP服务器...');
    await client.access({
      host: sftpConfig.host,
      port: sftpConfig.port,
      user: sftpConfig.username,
      password: sftpConfig.password,
      secure: sftpConfig.secure,
      utf8: false // 禁用 UTF - 8 编码
    });
    console.log('✅ FTP连接成功');

    // 清理远程目录
    if (sftpConfig.clean) {
      console.log('🗑️ 清理远程目录...');
      await client.removeDir(sftpConfig.remotePath);
      await client.ensureDir(sftpConfig.remotePath);
      console.log('✅ 远程目录清理完成');
    }

    // 上传目录
    console.log('📤 开始上传文件...');
    await uploadDirectory(client, sftpConfig.localPath, sftpConfig.remotePath);
    console.log('✅ 文件上传完成');
  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    process.exit(1);
  } finally {
    client.close();
    console.log('🔌 FTP连接已关闭');
  }
}

// 运行部署
deploy().catch(error => {
  console.error('❌ 部署脚本执行失败:', error.message);
  process.exit(1);
});
