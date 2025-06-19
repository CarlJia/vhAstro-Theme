/*
 * @Author: Han
 * @Date: 2025-01-27 10:00:00
 * @LastEditors: Han
 * @LastEditTime: 2025-01-27 10:00:00
 * @Description: SFTP连接诊断脚本
 * 
 */
import SftpClient from 'ssh2-sftp-client';
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

// 检测私钥格式
function detectKeyFormat(keyContent) {
  if (keyContent.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) {
    return 'openssh';
  } else if (keyContent.includes('PuTTY-User-Key-File')) {
    return 'ppk';
  } else if (keyContent.includes('-----BEGIN RSA PRIVATE KEY-----') || 
             keyContent.includes('-----BEGIN DSA PRIVATE KEY-----') || 
             keyContent.includes('-----BEGIN EC PRIVATE KEY-----')) {
    return 'pem';
  }
  return 'unknown';
}

// 加载私钥
function loadPrivateKey(privateKeyPath) {
  try {
    if (!fs.existsSync(privateKeyPath)) {
      console.error(`❌ 私钥文件不存在: ${privateKeyPath}`);
      return undefined;
    }
    
    const keyContent = fs.readFileSync(privateKeyPath, 'utf8');
    const format = detectKeyFormat(keyContent);
    
    console.log(`✅ 检测到${format.toUpperCase()}格式私钥`);
    return keyContent;
  } catch (error) {
    console.error('❌ 读取私钥文件失败:', error.message);
    return undefined;
  }
}

// 诊断函数
async function diagnose() {
  console.log('🔍 SFTP连接诊断开始...\n');
  
  // 1. 检查配置文件
  console.log('📋 1. 检查配置文件...');
  const required = ['host', 'port', 'username', 'localPath', 'remotePath'];
  const missing = required.filter(key => !sftpConfig[key]);
  
  if (missing.length > 0) {
    console.error(`❌ 配置缺失: ${missing.join(', ')}`);
    return;
  }
  
  if (!sftpConfig.password && !sftpConfig.privateKey) {
    console.error('❌ 需要提供密码或私钥');
    return;
  }
  
  console.log('✅ 配置文件检查通过');
  console.log(`   服务器: ${sftpConfig.host}:${sftpConfig.port}`);
  console.log(`   用户: ${sftpConfig.username}`);
  console.log(`   本地路径: ${sftpConfig.localPath}`);
  console.log(`   远程路径: ${sftpConfig.remotePath}`);
  
  // 2. 检查本地路径
  console.log('\n📁 2. 检查本地路径...');
  if (!fs.existsSync(sftpConfig.localPath)) {
    console.error(`❌ 本地路径不存在: ${sftpConfig.localPath}`);
    return;
  }
  
  const localFiles = fs.readdirSync(sftpConfig.localPath);
  console.log(`✅ 本地路径存在，包含 ${localFiles.length} 个文件/目录`);
  
  // 3. 检查私钥文件（如果使用私钥认证）
  if (sftpConfig.privateKey) {
    console.log('\n🔑 3. 检查私钥文件...');
    const privateKey = loadPrivateKey(sftpConfig.privateKey);
    if (!privateKey) {
      return;
    }
  }
  
  // 4. 测试连接
  console.log('\n🔌 4. 测试SFTP连接...');
  const sftp = new SftpClient();
  
  try {
    const connectConfig = {
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      readyTimeout: sftpConfig.timeout || 20000,
      retries: 1, // 诊断时只重试一次
      retry_factor: 2,
      retry_minTimeout: 2000
    };
    
    if (sftpConfig.password) {
      connectConfig.password = sftpConfig.password;
    } else if (sftpConfig.privateKey) {
      connectConfig.privateKey = loadPrivateKey(sftpConfig.privateKey);
    }
    
    console.log('   正在连接...');
    await sftp.connect(connectConfig);
    console.log('✅ SFTP连接成功');
    
    // 5. 测试远程目录访问
    console.log('\n📂 5. 测试远程目录访问...');
    try {
      const list = await sftp.list(sftpConfig.remotePath);
      console.log(`✅ 远程目录访问成功，包含 ${list.length} 个项目`);
      
      if (list.length > 0) {
        console.log('\n📋 远程目录内容:');
        const directories = list.filter(item => item.type === 'd');
        const files = list.filter(item => item.type === '-');
        
        if (directories.length > 0) {
          console.log('\n📂 目录:');
          directories.forEach(item => {
            console.log(`   📁 ${item.name}`);
          });
        }
        
        if (files.length > 0) {
          console.log('\n📄 文件:');
          files.slice(0, 10).forEach(item => { // 只显示前10个文件
            const size = (item.size / 1024).toFixed(1);
            console.log(`   📄 ${item.name} (${size}KB)`);
          });
          if (files.length > 10) {
            console.log(`   ... 还有 ${files.length - 10} 个文件`);
          }
        }
      }
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`⚠️  远程目录不存在: ${sftpConfig.remotePath}`);
        console.log('   这通常不是问题，部署时会自动创建');
      } else {
        console.error(`❌ 远程目录访问失败: ${err.message}`);
      }
    }
    
    // 6. 测试文件上传权限
    console.log('\n📤 6. 测试文件上传权限...');
    const testFile = 'test-upload-permission.txt';
    const testContent = 'This is a test file for upload permission check.';
    
    try {
      await sftp.put(Buffer.from(testContent), path.posix.join(sftpConfig.remotePath, testFile));
      console.log('✅ 文件上传权限测试成功');
      
      // 清理测试文件
      try {
        await sftp.delete(path.posix.join(sftpConfig.remotePath, testFile));
        console.log('✅ 测试文件清理成功');
      } catch (cleanErr) {
        console.warn('⚠️  无法清理测试文件，但不影响部署');
      }
      
    } catch (err) {
      console.error(`❌ 文件上传权限测试失败: ${err.message}`);
      console.log('💡 可能的原因:');
      console.log('   1. 用户没有写入权限');
      console.log('   2. 磁盘空间不足');
      console.log('   3. 目录权限设置问题');
    }
    
  } catch (error) {
    console.error('❌ SFTP连接失败:', error.message);
    
    // 提供详细的错误诊断
    if (error.message.includes('Timed out')) {
      console.log('💡 连接超时诊断:');
      console.log('   1. 检查服务器地址是否正确');
      console.log('   2. 检查端口是否正确');
      console.log('   3. 检查网络连接');
      console.log('   4. 检查服务器防火墙设置');
      console.log('   5. 检查SSH服务是否运行');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 连接被拒绝诊断:');
      console.log('   1. 服务器可能未运行SSH服务');
      console.log('   2. 端口可能被防火墙阻止');
      console.log('   3. 服务器可能不允许外部连接');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('💡 主机名解析失败:');
      console.log('   1. 检查服务器地址是否正确');
      console.log('   2. 检查DNS设置');
      console.log('   3. 尝试使用IP地址');
    } else if (error.message.includes('authentication')) {
      console.log('💡 认证失败诊断:');
      console.log('   1. 检查用户名是否正确');
      console.log('   2. 验证密码是否正确');
      console.log('   3. 确认私钥格式和权限');
      console.log('   4. 检查服务器是否允许密码/密钥认证');
    }
    
  } finally {
    if (sftp) {
      await sftp.end();
      console.log('\n🔌 SFTP连接已关闭');
    }
  }
  
  console.log('\n🎉 诊断完成！');
}

// 运行诊断
diagnose().catch(error => {
  console.error('❌ 诊断脚本执行失败:', error.message);
  process.exit(1);
}); 