# SFTP 部署指南

本指南介绍如何使用 SFTP 将 Astro 项目部署到远程服务器。

## 📋 功能特性

- ✅ **自动构建**: 构建项目并上传到服务器
- ✅ **递归上传**: 支持目录递归上传
- ✅ **远程清理**: 可选择清理远程目录
- ✅ **文件忽略**: 支持忽略特定文件和目录
- ✅ **私钥支持**: 支持 PEM 和 PPK 格式私钥
- ✅ **详细日志**: 提供详细的部署日志
- ✅ **错误诊断**: 智能错误诊断和建议
- ✅ **连接重试**: 自动重试机制
- ✅ **权限检查**: 自动检查上传权限

## 🚀 快速开始

### 1. 安装依赖

项目使用 `ssh2-sftp-client` 进行 SFTP 操作：

```bash
pnpm add -D ssh2-sftp-client
```

### 2. 配置部署

复制配置文件模板：

```bash
cp sftp-config.example.js sftp-config.js
```

编辑 `sftp-config.js` 文件，配置您的服务器信息：

```javascript
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
```

### 3. 运行部署

#### 完整部署（构建 + 上传）
```bash
npm run deploy:sftp
```

#### 仅上传（不构建）
```bash
npm run deploy:upload
```

#### 连接诊断
```bash
npm run diagnose:sftp
```

## 🔧 配置说明

### 服务器配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `host` | 服务器地址 | `'example.com'` 或 `'192.168.1.100'` |
| `port` | SSH端口 | `22` (默认) 或 `2222` |
| `username` | 用户名 | `'root'` 或 `'www-data'` |

### 认证配置

支持两种认证方式，选择其中一种：

#### 密码认证
```javascript
password: 'your-password'
```

#### 私钥认证（推荐）
```javascript
privateKey: '/path/to/private/key'
```

支持的私钥格式：
- **OpenSSH PEM**: `-----BEGIN OPENSSH PRIVATE KEY-----`
- **RSA/DSA/EC PEM**: `-----BEGIN RSA PRIVATE KEY-----`
- **PuTTY PPK**: `PuTTY-User-Key-File`

### 路径配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `localPath` | 本地构建目录 | `'./dist'` |
| `remotePath` | 远程部署目录 | `'/var/www/html'` |

### 部署选项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `clean` | 是否清理远程目录 | `false` |
| `verbose` | 详细日志输出 | `true` |

### 连接配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `timeout` | 连接超时时间（毫秒） | `20000` |
| `retries` | 重试次数 | `3` |
| `retry_factor` | 重试因子 | `2` |
| `retry_minTimeout` | 最小重试间隔（毫秒） | `2000` |

### 忽略文件

配置不需要上传的文件和目录：

```javascript
ignore: [
  '.DS_Store',           // macOS 系统文件
  'Thumbs.db',           // Windows 缩略图
  '*.log',               // 日志文件
  'node_modules/**',     // Node.js 依赖
  '.git/**',             // Git 目录
  '.vscode/**',          // VS Code 配置
  '*.tmp',               // 临时文件
  '*.temp'               // 临时文件
]
```

## 🔍 故障排除

### 常见问题

#### 1. 连接失败

**症状**: `ECONNREFUSED` 或 `Timed out`

**解决方案**:
- 检查服务器地址和端口是否正确
- 确认服务器 SSH 服务正在运行
- 检查防火墙设置
- 尝试使用其他 SSH 客户端测试连接

#### 2. 认证失败

**症状**: `authentication failed`

**解决方案**:
- 检查用户名和密码是否正确
- 确认私钥格式和权限
- 检查服务器是否允许密码/密钥认证
- 确认私钥文件权限（建议 600）

#### 3. 权限错误

**症状**: `Permission denied`

**解决方案**:
- 检查用户文件权限
- 确认用户有写入权限
- 检查目录权限设置
- 确认磁盘空间充足

#### 4. 远程目录不存在

**症状**: `ENOENT`

**解决方案**:
- 部署脚本会自动创建目录
- 确认用户有创建目录的权限
- 检查父目录是否存在

### 诊断工具

使用诊断脚本检查连接问题：

```bash
npm run diagnose:sftp
```

诊断脚本会检查：
- 配置文件完整性
- 本地路径存在性
- 私钥文件格式
- SFTP 连接
- 远程目录访问
- 文件上传权限

## 📝 使用示例

### 基本部署

```bash
# 1. 构建项目
npm run build

# 2. 部署到服务器
npm run deploy:sftp
```

### 清理部署

```javascript
// sftp-config.js
export default {
  // ... 其他配置
  clean: true,  // 启用清理模式
  // ...
};
```

### 静默部署

```javascript
// sftp-config.js
export default {
  // ... 其他配置
  verbose: false,  // 关闭详细日志
  // ...
};
```

### 自定义忽略规则

```javascript
// sftp-config.js
export default {
  // ... 其他配置
  ignore: [
    '*.log',
    'temp/**',
    'cache/**',
    '*.bak',
    'backup/**'
  ]
};
```

## 🔒 安全建议

1. **使用私钥认证**: 比密码认证更安全
2. **限制私钥权限**: 设置文件权限为 600
3. **使用非 root 用户**: 创建专门的部署用户
4. **限制 SSH 访问**: 配置防火墙和 SSH 配置
5. **定期更新密钥**: 定期更换私钥

## 📚 相关文档

- [ssh2-sftp-client 文档](https://github.com/theophilusx/ssh2-sftp-client)
- [SSH 密钥管理](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [SFTP 协议说明](https://tools.ietf.org/html/rfc4253) 