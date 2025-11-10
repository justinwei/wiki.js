#!/bin/bash

# Wiki.js Docker 快速部署脚本
# 使用方法: ./deploy.sh [postgres|sqlite]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}    Wiki.js Docker 部署脚本${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: 未检测到 Docker,请先安装 Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: 未检测到 docker-compose,请先安装 docker-compose${NC}"
    exit 1
fi

# 选择部署方式
DEPLOY_TYPE=${1:-postgres}

if [ "$DEPLOY_TYPE" != "postgres" ] && [ "$DEPLOY_TYPE" != "sqlite" ]; then
    echo -e "${RED}错误: 部署类型必须是 'postgres' 或 'sqlite'${NC}"
    echo "使用方法: ./deploy.sh [postgres|sqlite]"
    exit 1
fi

echo -e "${YELLOW}部署类型: $DEPLOY_TYPE${NC}"
echo ""

# 检查配置文件
if [ ! -f "config.yml" ]; then
    echo -e "${YELLOW}未找到 config.yml,从 config.sample.yml 复制...${NC}"
    cp config.sample.yml config.yml
    echo -e "${GREEN}已创建 config.yml,请根据需要修改配置${NC}"
fi

# 创建 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}未找到 .env 文件,从 .env.example 复制...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}已创建 .env 文件${NC}"
        echo -e "${YELLOW}⚠️  请编辑 .env 文件,修改数据库密码等敏感信息${NC}"
        read -p "按回车键继续..."
    fi
fi

# 停止旧容器
echo -e "${YELLOW}停止旧容器...${NC}"
if [ "$DEPLOY_TYPE" = "postgres" ]; then
    docker-compose down 2>/dev/null || true
else
    docker-compose -f docker-compose.sqlite.yml down 2>/dev/null || true
fi

# 构建镜像
echo ""
echo -e "${YELLOW}构建 Docker 镜像(这可能需要几分钟)...${NC}"
docker-compose build --no-cache

# 启动服务
echo ""
echo -e "${YELLOW}启动服务...${NC}"
if [ "$DEPLOY_TYPE" = "postgres" ]; then
    docker-compose up -d
else
    docker-compose -f docker-compose.sqlite.yml up -d
fi

# 等待服务启动
echo ""
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 10

# 检查服务状态
echo ""
if [ "$DEPLOY_TYPE" = "postgres" ]; then
    docker-compose ps
else
    docker-compose -f docker-compose.sqlite.yml ps
fi

# 显示日志
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}    部署完成!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "访问地址: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "查看日志:"
if [ "$DEPLOY_TYPE" = "postgres" ]; then
    echo -e "  ${YELLOW}docker-compose logs -f wiki${NC}"
else
    echo -e "  ${YELLOW}docker-compose -f docker-compose.sqlite.yml logs -f${NC}"
fi
echo ""
echo -e "停止服务:"
if [ "$DEPLOY_TYPE" = "postgres" ]; then
    echo -e "  ${YELLOW}docker-compose stop${NC}"
else
    echo -e "  ${YELLOW}docker-compose -f docker-compose.sqlite.yml stop${NC}"
fi
echo ""
echo -e "${YELLOW}正在显示实时日志(按 Ctrl+C 退出):${NC}"
echo ""
sleep 2

if [ "$DEPLOY_TYPE" = "postgres" ]; then
    docker-compose logs -f wiki
else
    docker-compose -f docker-compose.sqlite.yml logs -f
fi
