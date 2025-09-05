/*
 * @Author: CarlJia
 * @Date: 2025-09-05
 * @Description: FTP权限和功能诊断脚本
 */
import FTP from 'basic-ftp';
import path from 'path';
import fs from 'fs';
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
  process.exit(1);
}

async function diagnose() {
  console.log('🔍 开始FTP诊断...');
  console.log(`🔌 服务器: ${sftpConfig.host}:${sftpConfig.port}`);
  console.log(`👤 用户名: ${sftpConfig.username}`);

  const client = new FTP.Client();
  client.ftp.verbose = true;

  try {
    // 1. 连接测试
    console.log('\n=== 1. 连接测试 ===');
    await client.access({
      host: sftpConfig.host,
      port: sftpConfig.port,
      user: sftpConfig.username,
      password: sftpConfig.password,
      secure: false,
    });
    console.log('✅ FTP连接成功');

    // 2. 获取当前目录
    console.log('\n=== 2. 目录信息 ===');
    const currentDir = await client.pwd();
    console.log(`📍 当前工作目录: ${currentDir}`);

    // 3. 列出目录内容
    console.log('\n=== 3. 目录内容 ===');
    try {
      const list = await client.list();
      console.log('📁 目录内容:');
      list.forEach(item => {
        const type = item.isDirectory ? '📂' : '📄';
        const size = item.isDirectory ? '' : ` (${item.size} bytes)`;
        const permissions = item.permissions || 'unknown';
        console.log(`  ${type} ${item.name}${size} [权限: ${permissions}]`);
      });
    } catch (error) {
      console.error('❌ 无法列出目录内容:', error.message);
    }

    // 4. 检查客户端可用方法
    console.log('\n=== 4. 客户端方法检查 ===');
    const methods = [
      'mkdir', 'ensureDir', 'createDir', 'makeDirectory',
      'uploadFrom', 'downloadTo', 'remove', 'removeDir',
      'cd', 'pwd', 'list', 'send'
    ];

    console.log('🔧 可用方法:');
    methods.forEach(method => {
      const available = typeof client[method] === 'function';
      const status = available ? '✅' : '❌';
      console.log(`  ${status} ${method}`);
    });

    // 5. 权限测试
    console.log('\n=== 5. 权限测试 ===');

    // 5.1 创建测试目录 - 使用多种方法
    const testDirName = 'test_dir_' + Date.now();
    console.log(`🧪 测试创建目录: ${testDirName}`);

    let dirCreated = false;

    // 方法1: 使用 ensureDir
    if (typeof client.ensureDir === 'function') {
      try {
        await client.ensureDir(testDirName);
        console.log('✅ 目录创建成功 (ensureDir)');
        dirCreated = true;
      } catch (error) {
        console.error('❌ ensureDir 失败:', error.message);
      }
    }

    // 方法2: 使用原始命令
    if (!dirCreated) {
      try {
        const response = await client.send('MKD ' + testDirName);
        console.log('✅ 目录创建成功 (MKD):', response.message);
        dirCreated = true;
      } catch (error) {
        console.error('❌ MKD 命令失败:', error.message);
      }
    }

    if (dirCreated) {
      // 5.2 进入测试目录
      try {
        await client.cd(testDirName);
        console.log('✅ 可以进入目录');

        // 5.3 创建测试文件
        console.log('🧪 测试文件上传...');

        // 创建临时测试文件
        const tempFilePath = path.join(__dirname, 'temp_test.txt');
        const testContent = 'This is a test file created at ' + new Date().toISOString();

        try {
          fs.writeFileSync(tempFilePath, testContent);

          // 上传测试文件
          await client.uploadFrom(tempFilePath, 'test.txt');
          console.log('✅ 文件上传成功');

          // 清理临时文件
          fs.unlinkSync(tempFilePath);

          // 5.4 删除测试文件
          try {
            await client.remove('test.txt');
            console.log('✅ 文件删除成功');
          } catch (error) {
            console.error('❌ 文件删除失败:', error.message);
          }
        } catch (error) {
          console.error('❌ 文件操作失败:', error.message);
        }

        // 返回上级目录
        await client.cd('..');
        console.log('✅ 返回上级目录');
      } catch (error) {
        console.error('❌ 无法进入目录:', error.message);
      }

      // 5.5 删除测试目录
      try {
        const response = await client.send('RMD ' + testDirName);
        console.log('✅ 目录删除成功:', response.message);
      } catch (error) {
        console.error('❌ 目录删除失败:', error.message);
      }
    } else {
      console.error('❌ 无法创建目录，跳过后续测试');
      console.log('💡 可能的原因:');
      console.log('   - FTP用户没有写权限');
      console.log('   - 磁盘空间不足');
      console.log('   - 服务器配置限制');
      console.log('   - 目录已存在');
    }

    // 6. 系统信息
    console.log('\n=== 6. 系统信息 ===');
    try {
      const systemType = await client.send('SYST');
      console.log('🖥️ 系统类型:', systemType.message);
    } catch (error) {
      console.error('❌ 无法获取系统信息:', error.message);
    }

    // 7. 功能特性检测
    console.log('\n=== 7. 功能特性 ===');
    try {
      const features = await client.send('FEAT');
      console.log('🔧 服务器支持的功能:');
      console.log(features.message);
    } catch (error) {
      console.error('❌ 无法获取功能列表:', error.message);
    }

    // 8. 测试上传实际文件
    console.log('\n=== 8. 实际文件测试 ===');

    // 检查本地构建目录
    if (fs.existsSync(sftpConfig.localPath)) {
      console.log(`✅ 本地构建目录存在: ${sftpConfig.localPath}`);

      const files = fs.readdirSync(sftpConfig.localPath);
      console.log(`📁 本地文件数量: ${files.length}`);

      if (files.length > 0) {
        console.log('📄 前5个文件:');
        files.slice(0, 5).forEach(file => {
          const filePath = path.join(sftpConfig.localPath, file);
          const stat = fs.statSync(filePath);
          const type = stat.isDirectory() ? '📂' : '📄';
          console.log(`  ${type} ${file}`);
        });
      }
    } else {
      console.log(`❌ 本地构建目录不存在: ${sftpConfig.localPath}`);
      console.log('💡 请先运行 npm run build 构建项目');
    }

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
    console.error('详细错误:', error.stack);
  } finally {
    try {
      client.close();
      console.log('\n🔌 连接已关闭');
    } catch (closeError) {
      // 忽略关闭错误
    }
  }

  console.log('\n=== 诊断完成 ===');
  console.log('💡 如果创建目录失败，请检查:');
  console.log('   1. FTP用户是否有写权限');
  console.log('   2. 目标目录是否存在且可写');
  console.log('   3. 服务器是否限制了某些操作');
  console.log('   4. 磁盘空间是否充足');
  console.log('   5. FTP服务器是否支持相关命令');
}

// 运行诊断
diagnose().catch(error => {
  console.error('❌ 诊断脚本执行失败:', error.message);
  console.error('错误堆栈:', error.stack);
  process.exit(1);
});