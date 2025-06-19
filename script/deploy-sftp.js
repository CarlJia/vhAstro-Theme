/*
 * @Author: Han
 * @Date: 2025-01-27 10:00:00
 * @LastEditors: Han
 * @LastEditTime: 2025-01-27 10:00:00
 * @Description: SFTP部署脚本
 */
import SftpClient from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 100;

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
  const required = ['host', 'port', 'username', 'localPath', 'remotePath'];
  const missing = required.filter(key => !sftpConfig[key]);

  if (missing.length > 0) {
    console.error('❌ 配置缺失:', missing.join(', '));
    return false;
  }

  if (!sftpConfig.password && !sftpConfig.privateKey) {
    console.error('❌ 需要提供密码或私钥');
    return false;
  }

  return true;
}

// 检测私钥格式
function detectKeyFormat(keyContent) {
  if (keyContent.startsWith('PuTTY-User-Key-File-')) {
    return 'ppk';
  }
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

// 转换PPK格式为OpenSSH格式
// 改进的PPK到OpenSSH转换函数
function convertPpkToOpenSsh(ppkContent) {
  try {
    console.log('🔄 开始转换PPK格式私钥...');

    // 解析PPK文件内容
    const lines = ppkContent.split(/\r?\n/);
    let keyType = '';
    let encryption = '';
    let comment = '';
    let privateKeyBase64 = '';
    let publicKeyBase64 = '';

    // 解析头部信息
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('PuTTY-User-Key-File-')) {
        keyType = line.split(':')[1].trim();
      } else if (line.startsWith('Encryption:')) {
        encryption = line.split(':')[1].trim();
      } else if (line.startsWith('Comment:')) {
        comment = line.split(':')[1].trim();
      } else if (line.startsWith('Public-Lines:')) {
        const count = parseInt(line.split(':')[1].trim());
        for (let j = 0; j < count; j++) {
          publicKeyBase64 += lines[++i].trim();
        }
      } else if (line.startsWith('Private-Lines:')) {
        const count = parseInt(line.split(':')[1].trim());
        for (let j = 0; j < count; j++) {
          privateKeyBase64 += lines[++i].trim();
        }
      }
    }

    // 检查是否有加密
    if (encryption !== 'none') {
      console.error('❌ 不支持加密的PPK文件');
      return null;
    }

    // 解码私钥数据
    const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');

    // 根据密钥类型构建OpenSSH格式私钥
    let opensshKey;

    if (keyType === 'ssh-rsa') {
      // RSA密钥转换逻辑
      opensshKey = buildRsaPrivateKey(privateKeyBuffer);
    } else if (keyType === 'ssh-ed25519') {
      // Ed25519密钥转换逻辑
      opensshKey = buildEd25519PrivateKey(privateKeyBuffer);
    } else {
      console.error(`❌ 不支持的密钥类型: ${keyType}`);
      return null;
    }

    if (opensshKey) {
      console.log('✅ PPK私钥转换成功');
      return opensshKey;
    } else {
      console.error('❌ PPK私钥转换失败');
      return null;
    }
  } catch (error) {
    console.error('❌ PPK转换失败:', error.message);
    return null;
  }
}

// 构建RSA私钥
function buildRsaPrivateKey(buffer) {
  // 解析RSA私钥组件
  // 这是一个简化的实现，实际解析可能需要更复杂的逻辑
  const components = parseRsaComponents(buffer);

  if (!components) {
    return null;
  }

  // 构建OpenSSH格式的RSA私钥
  return [
    '-----BEGIN RSA PRIVATE KEY-----',
    Buffer.concat([
      // 这里需要根据RSA组件构建正确的DER编码
      // 实际实现会更复杂，需要处理ASN.1格式
      // 这里仅作示例
      writeMpint(components.n),
      writeMpint(components.e),
      writeMpint(components.d),
      writeMpint(components.p),
      writeMpint(components.q),
      writeMpint(components.iqmp)
    ]).toString('base64').match(/.{1,64}/g).join('\n'),
    '-----END RSA PRIVATE KEY-----'
  ].join('\n');
}

// 构建Ed25519私钥
function buildEd25519PrivateKey(buffer) {
  // 解析Ed25519私钥组件
  // 同样，这是一个简化的实现
  const components = parseEd25519Components(buffer);

  if (!components) {
    return null;
  }

  // 构建OpenSSH格式的Ed25519私钥
  return [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    Buffer.concat([
      // 构建Ed25519私钥的编码
      // 实际实现会更复杂
      writeString('ssh-ed25519'),
      writeString(components.seed),
      writeString(components.publicKey),
      writeString(components.comment || '')
    ]).toString('base64').match(/.{1,70}/g).join('\n'),
    '-----END OPENSSH PRIVATE KEY-----'
  ].join('\n');
}

// 写入多精度整数
function writeMpint(data) {
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);
  return Buffer.concat([lengthBuffer, data]);
}

// 写入字符串
function writeString(data) {
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length);
  return Buffer.concat([lengthBuffer, data]);
}

// 加载私钥
// 修复后的loadPrivateKey函数
function loadPrivateKey(privateKeyPath) {
  try {
    if (!fs.existsSync(privateKeyPath)) {
      console.error(`❌ 私钥文件不存在: ${privateKeyPath}`);
      return undefined;
    }

    const keyContent = fs.readFileSync(privateKeyPath, 'utf8');
    const format = detectKeyFormat(keyContent);

    if (format === 'ppk') {
      console.log('🔄 检测到PPK格式私钥，尝试转换...');
      const convertedKey = convertPpkToOpenSsh(keyContent);
      if (convertedKey) {
        console.log('✅ PPK私钥转换成功');
        return convertedKey;
      } else {
        console.error('❌ PPK私钥转换失败');
        console.log('💡 解决方案:');
        console.log('   1. 使用PuTTYgen命令行: puttygen key.ppk -O private-openssh -o key_openssh');
        console.log('   2. 使用PuTTYgen GUI工具转换');
        console.log('   3. 使用在线转换工具');
        console.log('   4. 重新生成OpenSSH格式密钥: ssh-keygen -t ed25519 -f new_key');
        console.log('   5. 查看详细转换指南: PPK-CONVERSION.md');
        return undefined;
      }
    } else if (format === 'openssh' || format === 'pem') {
      console.log(`✅ 检测到${format.toUpperCase()}格式私钥`);
      return keyContent;
    } else {
      console.error('❌ 不支持的私钥格式');
      console.log('💡 支持的格式:');
      console.log('   - OpenSSH PEM格式 (-----BEGIN ...)');
      console.log('   - PuTTY PPK格式 (PuTTY-User-Key-File)');
      return undefined;
    }
  } catch (error) {
    console.error('❌ 读取私钥文件失败:', error.message);
    return undefined;
  }
}

// 递归上传目录，改为先压缩为zip再上传并解压
async function uploadDirectory(sftp, localPath, remotePath) {
  const zipFileName = path.basename(localPath) + '.zip';
  const zipFilePath = path.join(__dirname, zipFileName);
  const remoteZipPath = path.posix.join(remotePath, zipFileName);

  // 1. 压缩 localPath 为 zip 文件
  console.log(`📦 正在压缩目录: ${localPath} -> ${zipFilePath}`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(localPath, false);
    archive.finalize();
  });
  console.log(`✅ 压缩完成: ${zipFilePath}`);

  // 2. 上传 zip 文件到远程
  console.log(`📤 上传 zip 文件到远程: ${remoteZipPath}`);
  await sftp.put(zipFilePath, remoteZipPath);
  console.log(`✅ 上传完成: ${remoteZipPath}`);

  // 3. 远程解压 zip 文件并删除 zip
  if (typeof sftp.client.exec === 'function') {
    // ssh2-sftp-client 暴露底层 client
    console.log('🔓 正在远程解压 zip 文件...');
    await new Promise((resolve, reject) => {
      sftp.client.exec(
        `cd ${remotePath} && unzip -o ${zipFileName} && rm -f ${zipFileName}`,
        (err, stream) => {
          if (err) return reject(err);
          stream.on('close', resolve).on('data', () => {}).stderr.on('data', (data) => {
            console.error('远程解压错误:', data.toString());
          });
        }
      );
    });
    console.log('✅ 远程解压并清理完成');
  } else {
    console.warn('⚠️ 当前sftp库不支持远程命令执行，请手动解压');
  }

  // 4. 删除本地 zip 文件
  fs.unlinkSync(zipFilePath);
  console.log(`🗑️ 已删除本地 zip 文件: ${zipFilePath}`);
}

// 批量删除远程目录下所有文件和子目录（并发删除）
async function deleteFilesInBatch(sftp) {
  const remotePath = sftpConfig.remotePath;
  async function recursiveDelete(pathToDelete) {
    try {
      const list = await sftp.list(pathToDelete);
      // 并发删除文件
      const fileDeletes = list
        .filter(item => item.type !== 'd')
        .map(async item => {
          const itemPath = path.posix.join(pathToDelete, item.name);
          await sftp.delete(itemPath);
          if (sftpConfig.verbose) console.log(`🗑️  删除文件: ${itemPath}`);
        });
      // 并发递归删除目录
      const dirDeletes = list
        .filter(item => item.type === 'd')
        .map(async item => {
          const itemPath = path.posix.join(pathToDelete, item.name);
          await recursiveDelete(itemPath);
          await sftp.rmdir(itemPath);
          if (sftpConfig.verbose) console.log(`🗑️  删除目录: ${itemPath}`);
        });
      await Promise.all([...fileDeletes, ...dirDeletes]);
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (sftpConfig.verbose) console.log(`ℹ️  远程目录不存在: ${pathToDelete}`);
        return;
      }
      throw err;
    }
  }
  await recursiveDelete(remotePath);
  if (sftpConfig.verbose) console.log(`✅ 远程目录清理完成: ${remotePath}`);
}

// 主部署函数
async function deploy() {
  console.log('🚀 开始SFTP部署...');
  console.log(`📁 本地路径: ${sftpConfig.localPath}`);
  console.log(`🌐 远程路径: ${sftpConfig.remotePath}`);
  console.log(`🔗 服务器: ${sftpConfig.host}:${sftpConfig.port}`);

  // 验证配置
  if (!validateConfig()) {
    process.exit(1);
  }

  // 检查本地路径
  if (!fs.existsSync(sftpConfig.localPath)) {
    console.error(`❌ 本地路径不存在: ${sftpConfig.localPath}`);
    process.exit(1);
  }

  const sftp = new SftpClient();

  try {
    // 连接配置
    const connectConfig = {
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      readyTimeout: sftpConfig.timeout || 20000,
      retries: sftpConfig.retries || 3,
      retry_factor: sftpConfig.retry_factor || 2,
      retry_minTimeout: sftpConfig.retry_minTimeout || 2000
    };

    // 添加认证方式
    if (sftpConfig.password) {
      connectConfig.password = sftpConfig.password;
    } else if (sftpConfig.privateKey) {
      const privateKey = loadPrivateKey(sftpConfig.privateKey);
      if (!privateKey) {
        process.exit(1);
      }
      connectConfig.privateKey = privateKey;
    } else {
      console.error('❌ 未提供密码或私钥，无法进行认证');
      process.exit(1);
    }

    console.log('🔌 连接到SFTP服务器...');
    await sftp.connect(connectConfig);
    console.log('✅ SFTP连接成功');

    // 批量删除远程目录下所有文件和子目录
    await deleteFilesInBatch(sftp);

    console.log('📤 开始上传文件...');
    await uploadDirectory(sftp, sftpConfig.localPath, sftpConfig.remotePath);

  } catch (error) {
    console.error('❌ 部署失败:', error.message);
    console.log('💡 建议解决方案:');
    console.log('   1. 确认用户有足够的权限执行操作');
    console.log('   2. 检查远程目录的权限设置');
    console.log('   3. 验证密码是否正确');
    console.log('   4. 确认私钥格式和权限');
    console.log('   5. 检查服务器是否允许密码/密钥认证');
    sftp.end();
    process.exit(1);
  } finally {
    await sftp.end();
    console.log('🔌 SFTP连接已关闭');
  }
}

// 运行部署
deploy().catch(error => {
  console.error('❌ 部署脚本执行失败:', error.message);
  process.exit(1);
});

// 导出转换函数供测试使用
export { convertPpkToOpenSsh };