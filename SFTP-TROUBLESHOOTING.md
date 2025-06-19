# SFTP连接故障排除指南

## 🔍 连接超时问题

### 错误信息
```
❌ 连接错误: Error: Timed out while waiting for handshake
```

### 诊断步骤

1. **运行诊断脚本**：
   ```bash
   pnpm diagnose:sftp
   ```
   这个脚本会自动检测：
   - DNS解析是否正常
   - 端口是否可达
   - SSH连接是否成功

2. **手动检查网络连接**：
   ```bash
   # 测试ping
   ping your-server.com
   
   # 测试端口连通性
   telnet your-server.com 22
   
   # 或者使用nc
   nc -zv your-server.com 22
   ```

3. **检查SSH连接**：
   ```bash
   # 使用标准SSH客户端测试
   ssh username@your-server.com
   ```

### 常见原因和解决方案

#### 1. 服务器地址错误
**症状**：DNS解析失败
**解决**：
- 检查配置文件中的服务器地址
- 尝试使用IP地址替代域名
- 确认域名是否正确

#### 2. 端口错误
**症状**：端口连接被拒绝
**解决**：
- 确认SSH端口（通常是22）
- 检查服务器是否使用非标准端口
- 确认防火墙设置

#### 3. 网络问题
**症状**：连接超时
**解决**：
- 检查本地网络连接
- 检查服务器网络状态
- 尝试从其他网络环境连接

#### 4. 服务器SSH服务未运行
**症状**：端口连接被拒绝
**解决**：
- 联系服务器管理员
- 确认SSH服务是否启动
- 检查服务器状态

#### 5. 防火墙阻止
**症状**：连接超时或被拒绝
**解决**：
- 检查服务器防火墙设置
- 确认22端口是否开放
- 检查云服务商安全组设置

## 🔐 认证问题

### 密码认证失败
**错误信息**：
```
❌ 连接错误: All configured authentication methods failed
```

**解决方案**：
1. 检查用户名和密码是否正确
2. 确认服务器允许密码认证
3. 检查用户账户是否被锁定

### 私钥认证失败
**错误信息**：
```
❌ 私钥加载失败
```

**解决方案**：
1. 检查私钥文件路径是否正确
2. 确认私钥文件格式（PEM或PPK）
3. 检查私钥文件权限（应该是600）
4. 确认私钥与服务器公钥匹配

## ⚙️ 配置检查清单

### 基本配置
- [ ] 服务器地址正确
- [ ] 端口号正确（通常是22）
- [ ] 用户名正确
- [ ] 密码或私钥正确

### 网络配置
- [ ] 本地网络连接正常
- [ ] 服务器网络可达
- [ ] 防火墙允许22端口
- [ ] DNS解析正常

### 服务器配置
- [ ] SSH服务正在运行
- [ ] 用户账户有效
- [ ] 认证方式已启用
- [ ] 用户有SFTP访问权限

## 🛠️ 调试命令

### 1. 使用诊断脚本
```bash
pnpm diagnose:sftp
```

### 2. 使用标准SSH客户端测试
```bash
ssh -v username@your-server.com
```

### 3. 测试SFTP连接
```bash
sftp username@your-server.com
```

### 4. 检查端口连通性
```bash
# 使用telnet
telnet your-server.com 22

# 使用nc
nc -zv your-server.com 22

# 使用nmap
nmap -p 22 your-server.com
```

## 📋 配置文件示例

### 正确的配置
```javascript
export const sftpConfig = {
  host: 'example.com',           // 正确的服务器地址
  port: 22,                      // 正确的SSH端口
  username: 'webuser',           // 正确的用户名
  password: 'your-password',     // 正确的密码
  // 或者使用私钥
  // privateKey: '/path/to/private/key',
  remotePath: '/var/www/html',   // 正确的远程路径
  localPath: './dist'
};
```

### 常见错误配置
```javascript
export const sftpConfig = {
  host: 'example.com',           // ✅ 正确
  port: 2222,                    // ❌ 可能不是SSH端口
  username: 'webuser',           // ✅ 正确
  password: '',                  // ❌ 空密码
  privateKey: '/wrong/path',     // ❌ 错误的私钥路径
  remotePath: '/wrong/path'      // ❌ 不存在的远程路径
};
```

## 🆘 获取帮助

如果以上步骤都无法解决问题：

1. **检查服务器日志**：
   ```bash
   # 在服务器上查看SSH日志
   sudo tail -f /var/log/auth.log
   ```

2. **联系服务器管理员**：
   - 确认服务器状态
   - 检查SSH配置
   - 验证用户权限

3. **使用其他工具测试**：
   - FileZilla
   - WinSCP (Windows)
   - Cyberduck

4. **检查云服务商文档**：
   - AWS EC2安全组
   - 阿里云安全组
   - 腾讯云安全组

---

**记住**：大多数连接问题都是由于配置错误或网络问题引起的。使用诊断脚本可以帮助快速定位问题所在。 