---
title: "Stalwart Mail 邮件服务器部署指南"
categories: VPS
tags: ['邮件']
id: "54d686d86022cc58"
date: 2025-10-29 11:48:00
cover: ""
---

### 搭建 Stalwart Mail 服务端

引用[Stalwart Mail Server | Stalwart Labs](https://stalw.art/mail-server/)官网的介绍

:::note

Welcome to **Stalwart**, an open-source mail and collaboration server designed for the modern internet. Stalwart supports a wide range of protocols including **JMAP**, **IMAP4**, **POP3**, **SMTP**, **CalDAV**, **CardDAV**, and **WebDAV**, making it a comprehensive solution for managing email, calendars, contacts, file storage, and more. Built in **Rust**, Stalwart is engineered to be **secure**, **fast**, **robust**, and **scalable**, capable of running everything from small personal mail servers to large, distributed enterprise deployments.

:::

#### 一、系统资源要求

5-10人使用，1c1g即可满足。空闲时应用占用约 100mb，cpu基本无波动。

#### 二、确保服务器 25 端口没有阻断

执行如下命令

```shell
root@localhost:~# telnet smtp.aol.com 25
```

正确返回

```shell
root@localhost:~# telnet smtp.aol.com 25
Trying 106.10.139.31...
Connected to smtp.aol.com.
Escape character is '^]'.
220 smtp.mail.yahoo.com ESMTP ready
```

按下 `ctrl+]` 退出，返回到 `telnet>`输入 `quit` 命令回车退出 `telnet`

错误返回

```shell
root@localhost:~# telnet smtp.aol.com 25
Trying 67.195.12.34...
telnet: Unable to connect to remote host: Connection timed out
```

如果返回如上超时，需要跟 vps 提供服务商申请开通 25 端口

#### 三、配置 DNS

请初步配置好您的DNS，这里以主机名*mx.domain.com*, IP地址*1.1.1.1*为例。请注意，这里我额外解析了一个子域名*mail.domain.com*, 这个子域名将用来搭建网页邮箱。如果您不需要网页邮箱（只用客户端），可以不添加这条记录。

| **记录类型** | **前缀（名称）** | **解析地址（值）**                                           | **主要用途**                   | **详解**                                                     |
| ------------ | ---------------- | ------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------ |
| **A**        | `mx`             | `1.1.1.1`                                                    | **指定邮件服务器 IP**          | 将您的邮件主机名 (`mx.domain.com`) 解析到您邮件服务器的实际公共 IP 地址 (`1.1.1.1`)。所有指向 `mx.domain.com` 的请求都会被导向这个 IP。 |
| **MX**       | `@`              | `mx.domain.com`                                              | **邮件路由/接收**              | 告知全球其他邮件服务器，当它们要发送邮件给 `@domain.com` 域名时，应该将邮件投递给 `mx.domain.com` 这个主机名。**优先级 10** 表示这是首选的或唯一的邮件服务器。 |
| **TXT**      | `@`              | `v=spf1 a mx -all`                                           | **SPF 身份验证**               | **Sender Policy Framework (SPF)**。这是一个安全记录，指定哪些 IP 地址或主机名（这里是 `A` 记录和 `MX` 记录所指向的 IP）被授权代表 `@domain.com` 发送邮件。`-all` 表示除列出的之外，所有其他 IP 均未授权。 |
| **TXT**      | `mx`             | `v=spf1 a -all`                                              | **SPF 身份验证（子域）**       | 针对子域 `mx.domain.com` 的 SPF 记录。与上一个类似，用于指定 `mx.domain.com` 自身的发送策略。 |
| **TXT**      | `_dmarc`         | `v=DMARC1; p=reject; rua=mailto:admin@domain.com; ruf=mailto:admin@domain.com` | **DMARC 策略**                 | **Domain-based Message Authentication, Reporting, and Conformance (DMARC)**。告诉接收方如何处理未通过 SPF 或 DKIM 检查的邮件： • `p=reject`: 拒绝投递未通过验证的邮件。 • `rua`/`ruf`: 指定接收 DMARC 报告的邮箱地址（用于监控邮件发送状况）。 |
| **CNAME**    | `mta-sts`        | `mx.domain.com`                                              | **邮件传输安全（可选）**       | **MTA-STS (Mail Transfer Agent Strict Transport Security)**。用于强制邮件服务器之间使用安全的 TLS 连接传输邮件，防止降级攻击。该记录指向您的邮件主机名。 |
| **CNAME**    | `autoconfig`     | `mx.domain.com`                                              | **邮件客户端自动配置（可选）** | 允许邮件客户端（如 Thunderbird, Outlook）通过访问 `autoconfig.domain.com` 自动发现 IMAP/SMTP 服务器设置。 |
| **CNAME**    | `autodiscover`   | `mx.domain.com`                                              | **邮件客户端自动配置（可选）** | 主要用于 Microsoft Outlook 和 Exchange，允许客户端通过访问 `autodiscover.domain.com` 自动发现配置信息。 |
| **CNAME**    | `mail`           | `mx.domain.com`                                              | **Webmail 访问（可选）**       | 创建一个易记的地址 (`mail.domain.com`)，让用户可以通过它访问您的 Webmail 界面（例如 SnappyMail）。 |

DKIM等其他记录需要在服务器搭建完毕之后才能添加。

你还需要给根域名设置一条任意的A记录或者ALIAS记录。根域名的A记录**是否有设定**与部分收件服务器的垃圾邮件判定有关。

同时，请在你的服务器面板或提供商处设置好 Reverse DNS（rDNS）, 将IP地址 *1.1.1.1* 解析到 mx.*domain.com*.

#### 四、Docker 安装 Stalwart Mail Server

Docker compose 文件参考如下：

```
services:
    stalwart-mail:
        container_name: stalwart-mail
        image: stalwartlabs/stalwart:v0.14.0-alpine
        ports:
            - ${HOST_IP}:${PANEL_APP_PORT_HTTPS}:443
            - ${HOST_IP}:${PANEL_APP_PORT_HTTP}:8080
            - ${HOST_IP}:${PORT_SMTP}:25
            - ${HOST_IP}:${PORT_SMTP_SUBMISSION}:587
            - ${HOST_IP}:${PORT_SMTP_SSL}:465
            - ${HOST_IP}:${PORT_IMAP}:143
            - ${HOST_IP}:${PORT_IMAP_SSL}:993
            - ${HOST_IP}:${PORT_POP3}:110
            - ${HOST_IP}:${PORT_POP3_SSL}:995
            - ${HOST_IP}:${PORT_MANAGESIEVE}:4190
        restart: always
        volumes:
            - ./data:/opt/stalwart-mail

```

服务启动后，查看容器日志，获取 admin 账号密码

`docker logs stalwart-mail`

```
✅ Configuration file written to /opt/stalwart/etc/config.toml
🔑 Your administrator account is 'admin' with password 'aTrc1kd7Kj'.
```

默认端口 8080 使用默认账号 admin 和密码 aTrc1kd7Kj 登录 Stalwart Mail。

按照以下步骤进行一些必要设置

1. 修改默认密码，路径登录后右上角个人信息 -> Account -> Change Password。

2. 修改邮局默认设置，点击右上角火箭，选择 Manage 左边菜单进入 Settings

* 左侧菜单找到 Server -> TLS -> Certificates，点击 Create Certificate。

Certificate Id 输入你的服务域名地址 *domain.com*，Certificate 和 Private Key 输入`%{file:/etc/ssl/mx.domain.com/fullchain.pem}%` 和 `%{file:/etc/ssl/mx.domain.com/privkey.pem}%` 保存

* 左侧菜单找到 Server -> Network，在 Hostname 中填入你的服务器名，我这里是mx.*domain.com*。这里填入的 hostname 将作为 EHLO 的 hostname。
* 左侧菜单找到 SMTP -> Reports -> Outbound，在 Default Domain 中填入你的域名 domain.com，避免发出的邮件进入对方垃圾箱。
* 左侧菜单找到 SMTP -> Outbound -> Routing，找到 id 为 mx，type 为 Remote Delivery（MX）。编辑 MX Resolutiion，改 IP Resolution 为 IPv4 Only。

重启Stalwart-mail服务`docker restart stalwart-mail`，使所有配置生效。

3. 左侧菜单找到 Directory -> Domains，创建一个邮箱域名，点击 Create Domain 按钮，输入 *domain.com*，保存。
4. 点击刚创建的 *domain.com* 记录右边三个点，选择第二个 View DNS records。

我们之前已经配置好了MX, SPF, DMARC, 剩下的只有DKIM和一些其他的可选记录。请根据系统生成的 DKIM Key 在域名 DNS 记录里配置好 DKIM 记录（Stalwart-Mail生成了两条DKIM记录，都需要配置）。

5. 左侧菜单找到 Directory -> Accounts，这里我们就可以创建邮箱用户了。

Login name 设置 admin@domain.com

Name 设置 admin

Email 设置 admin@domain.com

Aliases 可以填加一个 @domain.com

输入邮箱信息之后，**请切换到第二个Authentication栏，输入密码设置**。



### 搭建 WEB 客户端

Stalwart Mail 不包含网页邮件系统。如果您不想用客户端收发，就需要再安装一个网页邮件客户端。这里我将使用轻量且功能全面的SnappyMail作为演示。

Docker compose 文件参考如下：

```dockerfile
services:
  snappymail:
    image: djmaze/snappymail
    container_name: snappymail
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Shanghai
      - DEBUG=true
    volumes:
      - ./data:/var/lib/snappymail
    ports:
      - "8081:8888"
    restart: unless-stopped
  php-fpm-exporter:
    image: hipages/php-fpm_exporter:2.2.0
    ports:
      - 9253:9253
    environment:
      - PHP_FPM_SCRAPE_URI=tcp://snappymail:9000/status
```

1. 登录管理端，默认配置地址`http://127.0.0.1:8081/?admin` ，默认账号 admin，默认密码在映射目录 `data/_data_/_default_/admin_password.txt` 内。

2. 左侧菜单找到 Domains，点击 Add Domain，配置 IMAP 和 SMTP，Server 可以直接填写 mx.*domain.com*，Security 推荐选择 SSL/TLS。并开启 Require verification of SSL certificate。



### 验证邮局是否搭建成功及测试垃圾邮件匹配度

1. 发送邮件到 `https://www.mail-tester.com/` 

按照测试结果反馈调整我们的邮局配置

完结

参考：

[香菇肥牛的博客](https://qing.su/article/stalwart-mail-single-server-nginx.html)

[Stalwart Mail & Collaboration Server](https://stalw.art/)