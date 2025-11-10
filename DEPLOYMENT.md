# Wiki.js Docker 部署指南

## 目录结构
```
wiki.js/
├── Dockerfile                      # Docker 镜像构建文件
├── docker-compose.yml              # PostgreSQL 版本
├── docker-compose.sqlite.yml       # SQLite 版本(单机简单部署)
├── .dockerignore                   # Docker 构建排除文件
└── config.yml                      # Wiki.js 配置文件
```

## 部署方式

### 方式一: 使用 PostgreSQL (推荐生产环境)

#### 1. 准备配置文件

确保 `config.yml` 存在并配置正确:

```bash
# 复制示例配置
cp config.sample.yml config.yml

# 编辑配置文件
vim config.yml
```

修改以下关键配置:
```yaml
port: 3000

db:
  type: postgres
  host: db
  port: 5432
  user: wikijs
  pass: wikijsrocks  # 请修改为强密码
  db: wiki
  ssl: false
```

#### 2. 修改 docker-compose.yml 中的敏感信息

```bash
vim docker-compose.yml
```

修改以下内容:
- `POSTGRES_PASSWORD`: 数据库密码
- `DB_PASS`: 数据库密码(与上面保持一致)
- `WIKI_ADMIN_EMAIL`: 管理员邮箱

#### 3. 构建并启动服务

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f wiki
```

#### 4. 访问应用

打开浏览器访问: `http://your-server-ip:3000`

首次访问会进入安装向导,按照提示完成初始化。

### 方式二: 使用 SQLite (适合小型部署)

```bash
# 使用 SQLite 版本启动
docker-compose -f docker-compose.sqlite.yml up -d

# 查看日志
docker-compose -f docker-compose.sqlite.yml logs -f
```

## 常用命令

### 查看运行状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有日志
docker-compose logs -f

# 只查看 wiki 日志
docker-compose logs -f wiki

# 查看最近 100 行
docker-compose logs --tail=100 wiki
```

### 停止服务
```bash
docker-compose stop
```

### 重启服务
```bash
docker-compose restart wiki
```

### 停止并删除容器
```bash
docker-compose down
```

### 停止并删除容器和数据卷(⚠️ 会删除所有数据)
```bash
docker-compose down -v
```

## 数据备份

### PostgreSQL 版本

```bash
# 备份数据库
docker exec wikijs-db pg_dump -U wikijs wiki > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i wikijs-db psql -U wikijs wiki < backup_20250110.sql
```

### SQLite 版本

```bash
# 备份数据库文件
docker cp wikijs-app:/wiki/data/database.sqlite ./backup_$(date +%Y%m%d).sqlite

# 恢复数据库
docker cp ./backup_20250110.sqlite wikijs-app:/wiki/data/database.sqlite
docker-compose restart wiki
```

### 备份上传文件

```bash
# 备份上传的文件
docker run --rm -v wikijs_wiki-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/wiki-data-backup_$(date +%Y%m%d).tar.gz /data

# 恢复上传的文件
docker run --rm -v wikijs_wiki-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/wiki-data-backup_20250110.tar.gz -C /
```

## 更新部署

### 方式一: 重新构建镜像

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build --no-cache

# 重启服务
docker-compose up -d

# 清理旧镜像
docker image prune -f
```

### 方式二: 仅重启(配置修改)

```bash
# 修改配置后重启
docker-compose restart wiki
```

## 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name wiki.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wiki.yourdomain.com;

    # SSL 证书配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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
        
        # 超时设置
        proxy_read_timeout 86400;
    }

    # 文件上传大小限制
    client_max_body_size 50M;
}
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_TYPE` | 数据库类型 (postgres/mysql/mariadb/mssql/sqlite) | - |
| `DB_HOST` | 数据库主机 | localhost |
| `DB_PORT` | 数据库端口 | 5432 |
| `DB_USER` | 数据库用户 | wikijs |
| `DB_PASS` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | wiki |
| `DB_FILEPATH` | SQLite 数据库文件路径 | - |
| `WIKI_ADMIN_EMAIL` | 管理员邮箱 | - |

## 故障排查

### 1. 容器无法启动

```bash
# 查看详细日志
docker-compose logs wiki

# 检查配置文件
docker-compose config
```

### 2. 数据库连接失败

```bash
# 检查数据库是否就绪
docker-compose exec db pg_isready -U wikijs

# 进入数据库容器
docker-compose exec db psql -U wikijs wiki
```

### 3. 端口被占用

```bash
# 检查端口占用
lsof -i :3000

# 修改 docker-compose.yml 中的端口映射
ports:
  - "3001:3000"  # 改用 3001 端口
```

### 4. 权限问题

```bash
# 检查数据卷权限
docker-compose exec wiki ls -la /wiki/data

# 修复权限
docker-compose exec -u root wiki chown -R node:node /wiki/data
```

## 安全建议

1. **修改默认密码**: 修改 docker-compose.yml 中的数据库密码
2. **使用环境变量文件**: 创建 `.env` 文件存储敏感信息
3. **启用 HTTPS**: 使用 Nginx/Caddy 配置 SSL 证书
4. **限制网络访问**: 配置防火墙规则,只开放必要端口
5. **定期备份**: 设置自动备份脚本
6. **更新镜像**: 定期更新基础镜像和依赖包

## 性能优化

1. **使用 PostgreSQL**: 生产环境推荐使用 PostgreSQL 而非 SQLite
2. **配置资源限制**: 在 docker-compose.yml 中添加资源限制
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
       reservations:
         cpus: '1'
         memory: 1G
   ```
3. **使用 CDN**: 配置 CDN 加速静态资源访问
4. **启用缓存**: 配置 Redis 缓存(需要额外配置)

## 支持

- 官方文档: https://docs.requarks.io
- GitHub: https://github.com/Requarks/wiki
- 问题反馈: https://github.com/Requarks/wiki/issues
