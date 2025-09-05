/*
 * @Author: CarlJia
 * @Date: 2025-07-24
 * @LastEditors: CarlJia
 * @LastEditTime: 2025-07-24
 * @Description: FTP部署脚本 - 修复目录创建问题的最终版本
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
  const required = ['host', 'port', 'username', 'password', 'localPath'];
  const missing = required.filter(key => !sftpConfig[key]);

  if (missing.length > 0) {
    console.error('❌ 配置缺失:', missing.join(', '));
    return false;
  }

  return true;
}

// 等待函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查文件大小
function shouldSkipFile(localPath) {
  try {
    const stats = fs.statSync(localPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    const maxSizeInMB = sftpConfig.maxFileSizeMB || 10;

    if (fileSizeInMB > maxSizeInMB) {
      console.warn(`⚠️ 跳过大文件 (${fileSizeInMB.toFixed(2)}MB > ${maxSizeInMB}MB): ${path.basename(localPath)}`);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// 安全删除远程目录内容
async function clearRemoteDirectory(client) {
  try {
    console.log(`🗑️ 清理远程目录...`);
    const list = await client.list();

    // 先删除文件
    for (const item of list) {
      if (item.name === '.' || item.name === '..') continue;

      if (!item.isDirectory) {
        try {
          console.log(`🗑️ 删除文件: ${item.name}`);
          await client.remove(item.name);
          await delay(100);
        } catch (error) {
          console.warn(`⚠️ 删除文件失败 ${item.name}: ${error.message}`);
        }
      }
    }

    // 再删除目录
    const listAfterFiles = await client.list();
    for (const item of listAfterFiles) {
      if (item.name === '.' || item.name === '..') continue;

      if (item.isDirectory) {
        try {
          console.log(`🗂️ 删除目录: ${item.name}`);
          await client.removeDir(item.name);
          await delay(200);
        } catch (error) {
          console.warn(`⚠️ 删除目录失败 ${item.name}: ${error.message}`);
        }
      }
    }

    console.log('✅ 远程目录清理完成');
  } catch (error) {
    console.warn(`⚠️ 清理远程目录时出错: ${error.message}`);
  }
}

// 创建单个目录（使用原始MKD命令）
async function createSingleDirectory(client, dirName) {
  try {
    // 首先检查目录是否已存在
    const list = await client.list();
    const exists = list.find(item => item.name === dirName && item.isDirectory);

    if (exists) {
      console.log(`📁 目录已存在: ${dirName}`);
      return true;
    }

    // 使用原始MKD命令创建目录
    const response = await client.send(`MKD ${dirName}`);
    console.log(`📁 创建目录成功: ${dirName}`);
    await delay(300); // 等待目录创建完成

    // 验证目录是否创建成功
    const newList = await client.list();
    const created = newList.find(item => item.name === dirName && item.isDirectory);

    if (created) {
      return true;
    } else {
      console.error(`❌ 目录创建验证失败: ${dirName}`);
      return false;
    }

  } catch (error) {
    // 检查是否是"目录已存在"错误
    if (error.message.includes('File exists') ||
        error.message.includes('already exists') ||
        error.message.includes('550')) {
      console.log(`📁 目录可能已存在: ${dirName}`);
      return true;
    }

    console.error(`❌ 创建目录失败 ${dirName}: ${error.message}`);
    return false;
  }
}

// 确保目录路径存在（逐级创建）
async function ensureDirectoryPath(client, pathParts) {
  let createdPath = [];

  for (const part of pathParts) {
    if (!part) continue;

    createdPath.push(part);

    // 检查当前目录是否存在
    try {
      await client.cd(part);
      console.log(`📂 进入已存在目录: ${part}`);
    } catch (error) {
      // 目录不存在，需要创建
      console.log(`📁 需要创建目录: ${part}`);

      // 回到上一级目录
      if (createdPath.length > 1) {
        await client.cd('..');
        for (let i = 0; i < createdPath.length - 1; i++) {
          await client.cd(createdPath[i]);
        }
      } else {
        await client.cd('/');
      }

      // 创建目录
      const created = await createSingleDirectory(client, part);
      if (!created) {
        throw new Error(`无法创建目录: ${part}`);
      }

      // 进入刚创建的目录
      try {
        await client.cd(part);
        console.log(`📂 进入新创建目录: ${part}`);
      } catch (cdError) {
        console.error(`❌ 无法进入新创建的目录 ${part}: ${cdError.message}`);
        throw cdError;
      }
    }
  }

  return createdPath.join('/');
}

// 上传单个文件（带重试）
async function uploadFileWithRetry(client, localPath, fileName, maxRetries = 3) {
  if (shouldSkipFile(localPath)) {
    return { success: true, skipped: true };
  }

  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      await client.uploadFrom(localPath, fileName);
      if (sftpConfig.verbose) {
        console.log(`✅ 上传成功: ${fileName}`);
      }
      return { success: true, skipped: false };

    } catch (error) {
      console.error(`❌ 上传失败 ${fileName} (尝试 ${retry + 1}/${maxRetries}): ${error.message}`);

      if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        const waitTime = Math.min(5000 * (retry + 1), 15000);
        console.log(`⏳ 连接超时，等待 ${waitTime}ms 后重试...`);
        await delay(waitTime);
      } else {
        await delay(1000 * (retry + 1));
      }

      if (retry === maxRetries - 1) {
        if (sftpConfig.skipProblematicFiles) {
          console.warn(`⚠️ 跳过问题文件: ${fileName}`);
          return { success: false, skipped: true };
        } else {
          throw error;
        }
      }
    }
  }

  return { success: false, skipped: false };
}

// 主上传函数
async function uploadDirectoryFixed(client, localPath) {
  console.log(`📤 开始上传，使用固定的目录创建方法...`);

  // 收集所有文件和目录
  const allItems = [];

  function collectItems(currentLocalPath, relativePath = '') {
    const files = fs.readdirSync(currentLocalPath);

    for (const file of files) {
      const localFilePath = path.join(currentLocalPath, file);
      const relativeFilePath = relativePath ? path.posix.join(relativePath, file) : file;
      const stat = fs.statSync(localFilePath);

      // 跳过忽略的文件
      if (sftpConfig.ignore && sftpConfig.ignore.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return regex.test(file) || regex.test(localFilePath);
      })) {
        console.log(`⏭️ 跳过: ${relativeFilePath}`);
        continue;
      }

      if (stat.isDirectory()) {
        // 添加目录到列表
        allItems.push({
          type: 'directory',
          localPath: localFilePath,
          remotePath: relativeFilePath,
          depth: relativeFilePath.split('/').length
        });

        // 递归收集子项目
        collectItems(localFilePath, relativeFilePath);
      } else {
        // 添加文件到列表
        allItems.push({
          type: 'file',
          localPath: localFilePath,
          remotePath: relativeFilePath,
          depth: relativeFilePath.split('/').length - 1
        });
      }
    }
  }

  collectItems(localPath);

  // 分离目录和文件
  const directories = allItems.filter(item => item.type === 'directory')
    .sort((a, b) => a.depth - b.depth); // 按深度排序，先创建浅层目录

  const files = allItems.filter(item => item.type === 'file');

  console.log(`📊 统计: ${directories.length} 个目录, ${files.length} 个文件`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // 第一阶段：创建所有必需的目录
  console.log('📁 第一阶段：创建目录结构...');

  const createdDirectories = new Set();

  for (const dir of directories) {
    try {
      console.log(`📁 处理目录: ${dir.remotePath}`);

      // 回到根目录
      await client.cd('/');

      // 分解路径并逐级创建
      const pathParts = dir.remotePath.split('/').filter(part => part);
      let currentPath = '';

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const fullPath = pathParts.slice(0, i + 1).join('/');

        if (!createdDirectories.has(fullPath)) {
          // 创建这个目录
          const created = await createSingleDirectory(client, part);
          if (created) {
            createdDirectories.add(fullPath);
            console.log(`✅ 目录创建成功: ${fullPath}`);
          } else {
            throw new Error(`目录创建失败: ${part}`);
          }
        }

        // 进入目录
        await client.cd(part);
      }

    } catch (error) {
      console.error(`❌ 目录处理失败 ${dir.remotePath}: ${error.message}`);
      if (!sftpConfig.skipProblematicFiles) {
        throw error;
      }
    }
  }

  console.log(`✅ 目录结构创建完成，共创建 ${createdDirectories.size} 个目录`);

  // 第二阶段：上传所有文件
  console.log('📤 第二阶段：上传文件...');

  for (const file of files) {
    try {
      console.log(`📄 上传文件: ${file.remotePath}`);

      // 回到根目录
      await client.cd('/');

      // 进入文件所在目录
      const dirPath = path.dirname(file.remotePath);
      if (dirPath && dirPath !== '.') {
        const pathParts = dirPath.split('/').filter(part => part);
        for (const part of pathParts) {
          await client.cd(part);
        }
      }

      // 上传文件
      const fileName = path.basename(file.remotePath);
      const result = await uploadFileWithRetry(client, file.localPath, fileName);

      if (result.success) {
        successCount++;
      } else if (result.skipped) {
        skipCount++;
      } else {
        errorCount++;
      }

      // 适当延迟，避免服务器压力过大
      if ((successCount + skipCount + errorCount) % 10 === 0) {
        await delay(500);
      }

    } catch (error) {
      console.error(`❌ 文件处理失败 ${file.remotePath}: ${error.message}`);
      errorCount++;

      if (!sftpConfig.skipProblematicFiles) {
        throw error;
      }
    }
  }

  console.log(`📊 上传完成统计:`);
  console.log(`   ✅ 成功: ${successCount} 个文件`);
  console.log(`   ⏭️ 跳过: ${skipCount} 个文件`);
  console.log(`   ❌ 失败: ${errorCount} 个文件`);
}

// 主部署函数
async function deploy() {
  console.log('🚀 开始FTP部署...');
  console.log(`📁 本地路径: ${sftpConfig.localPath}`);
  console.log(`🌐 远程路径: ${sftpConfig.remotePath}`);
  console.log(`🔌 服务器: ${sftpConfig.host}:${sftpConfig.port}`);

  if (!validateConfig()) {
    process.exit(1);
  }

  if (!fs.existsSync(sftpConfig.localPath)) {
    console.error(`❌ 本地路径不存在: ${sftpConfig.localPath}`);
    console.log('💡 请先运行 npm run build 构建项目');
    process.exit(1);
  } else {
    console.log(`✅ 本地路径存在: ${sftpConfig.localPath}`);
  }

  const client = new FTP.Client();
  client.ftp.timeout = sftpConfig.timeout || 60000;
  client.ftp.ipFamily = 4;

  if (sftpConfig.verbose) {
    client.ftp.verbose = true;
  }

  let retries = sftpConfig.retries || 3;

  while (retries > 0) {
    try {
      console.log('🔌 连接到FTP服务器...');
      await client.access({
        host: sftpConfig.host,
        port: sftpConfig.port,
        user: sftpConfig.username,
        password: sftpConfig.password,
        secure: sftpConfig.secure || false,
      });
      console.log('✅ FTP连接成功');

      const currentDir = await client.pwd();
      console.log(`📍 当前工作目录: ${currentDir}`);

      if (sftpConfig.cleanRemote) {
        await clearRemoteDirectory(client);
      }

      console.log('📤 开始文件上传...');
      await uploadDirectoryFixed(client, sftpConfig.localPath);
      console.log('🎉 文件上传完成');

      // 验证结果
      console.log('🔍 验证上传结果...');
      const finalList = await client.list();
      const actualCount = finalList.filter(item => item.name !== '.' && item.name !== '..').length;
      console.log(`📊 远程文件和目录数量: ${actualCount}`);

      break;

    } catch (error) {
      retries--;
      console.error(`❌ 部署失败 (剩余重试次数: ${retries}):`, error.message);

      if (retries > 0) {
        const waitTime = (sftpConfig.retry_minTimeout || 3000) * Math.pow(sftpConfig.retry_factor || 2, sftpConfig.retries - retries);
        console.log(`⏳ ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('❌ 所有重试都失败了');
        process.exit(1);
      }
    } finally {
      try {
        client.close();
        console.log('🔌 FTP连接已关闭');
      } catch (closeError) {
        // 忽略关闭错误
      }
    }
  }
}

deploy().catch(error => {
  console.error('❌ 部署脚本执行失败:', error.message);
  console.error('调试信息:', error.stack);
  process.exit(1);
});