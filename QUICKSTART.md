# Wiki.js Docker 快速部署

## 🚀 快速开始

### 1. 克隆项目 (或上传到服务器)

```bash
# 如果从 Git 仓库部署
git clone <your-repo-url>
cd wiki.js

# 如果是上传文件,解压后进入目录
cd wiki.js
```

### 2. 选择部署方式

#### 方式 A: 使用自动部署脚本 (推荐)

```bash
# PostgreSQL 版本 (推荐)
./deploy.sh postgres

# SQLite 版本 (单机简单部署)
./deploy.sh sqlite
```

脚本会自动:
- 检查 Docker 环境
- 创建配置文件
- 构建镜像
- 启动服务
- 显示访问地址

#### 方式 B: 手动部署

**PostgreSQL 版本:**

```bash
# 1. 复制配置文件
cp config.sample.yml config.yml

# 2. 编辑配置(可选)
vim config.yml

# 3. 构建并启动
docker-compose build
docker-compose up -d

# 4. 查看日志
docker-compose logs -f wiki
```

**SQLite 版本:**

```bash
# 使用 SQLite 配置文件
docker-compose -f docker-compose.sqlite.yml build
docker-compose -f docker-compose.sqlite.yml up -d
docker-compose -f docker-compose.sqlite.yml logs -f
```

### 3. 访问应用

打开浏览器访问: `http://your-server-ip:3000`

首次访问会进入安装向导,按提示完成初始化。

### 4. 配置管理员账号

在安装向导中:
1. 选择管理员邮箱和密码
2. 完成初始化设置
3. 登录后台进行详细配置

## 📋 常用命令

### 服务管理

```bash
# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f wiki

# 重启服务
docker-compose restart wiki

# 停止服务
docker-compose stop

# 启动服务
docker-compose start

# 完全停止并删除容器
docker-compose down
```

### 数据备份

```bash
# 备份数据库 (PostgreSQL)
docker exec wikijs-db pg_dump -U wikijs wiki > backup.sql

# 备份数据目录
docker run --rm -v wikijs_wiki-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/wiki-data-backup.tar.gz /data
```

## 🔧 配置修改

### 修改端口

编辑 `docker-compose.yml`:

```yaml
services:
  wiki:
    ports:
      - "8080:3000"  # 改为使用 8080 端口
```

### 修改数据库密码

1. 编辑 `.env` 文件 (或创建):
   ```
   POSTGRES_PASSWORD=your_new_password
   DB_PASS=your_new_password
   ```

2. 重新部署:
   ```bash
   docker-compose down -v  # ⚠️ 会删除现有数据
   docker-compose up -d
   ```

### 使用 Nginx 反向代理

创建 Nginx 配置 `/etc/nginx/sites-available/wiki`:

```nginx
server {
    listen 80;
    server_name wiki.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    client_max_body_size 50M;
}
```

启用配置:
```bash
sudo ln -s /etc/nginx/sites-available/wiki /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 配置 SSL (Let's Encrypt)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d wiki.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

## 🔍 故障排查

### 容器无法启动

```bash
# 查看详细错误
docker-compose logs wiki

# 检查配置文件语法
docker-compose config
```

### 端口被占用

```bash
# 检查端口占用
sudo lsof -i :3000

# 或使用其他端口(修改 docker-compose.yml)
```

### 数据库连接失败

```bash
# 检查数据库是否启动
docker-compose ps db

# 测试数据库连接
docker-compose exec db pg_isready -U wikijs

# 进入数据库
docker-compose exec db psql -U wikijs wiki
```

## 📦 更新部署

### 更新代码

```bash
# 拉取最新代码
git pull

# 重新构建
docker-compose build --no-cache

# 重启服务
docker-compose up -d

# 清理旧镜像
docker image prune -f
```

### 仅更新配置

```bash
# 修改 config.yml 后
docker-compose restart wiki
```

## 🔐 安全建议

1. ✅ **修改默认密码** - 修改数据库密码和管理员密码
2. ✅ **启用 HTTPS** - 配置 SSL 证书
3. ✅ **配置防火墙** - 只开放必要端口 (80, 443)
4. ✅ **定期备份** - 设置自动备份任务
5. ✅ **更新系统** - 定期更新 Docker 镜像和系统包

## 📚 更多文档

- [完整部署文档](./DEPLOYMENT.md)
- [官方文档](https://docs.requarks.io)
- [GitHub 仓库](https://github.com/Requarks/wiki)

## 💬 获取帮助

遇到问题?
- 查看日志: `docker-compose logs -f wiki`
- 查阅文档: `./DEPLOYMENT.md`
- GitHub Issues: https://github.com/Requarks/wiki/issues
