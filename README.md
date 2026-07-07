# chaoxing-signin

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/fnOS-third--party-orange)

超星学习通签到 Web 服务，支持普通、位置、二维码、拍照等签到方式。适用于飞牛 fnOS NAS。

## 功能特性

- 支持多种签到方式：普通签到、位置签到、二维码签到、拍照签到
- Web 界面管理，操作简便
- 支持自动签到
- 数据持久化存储

## 安装

### 手动安装

1. 从 [Releases](https://github.com/E7G/chaoxing-signin/releases) 页面下载最新 `.fpk` 文件
2. 在 fnOS 应用中心选择「手动安装」
3. 上传 `.fpk` 文件并完成安装

### 依赖

- 需要安装 `nodejs_v22` 运行时

## 使用

安装完成后，通过 fnOS 桌面启动「超星签到」应用，默认端口为 `5000`。

## 配置

应用数据存储在 fnOS 的 var 目录中，配置文件位于 `configs/` 子目录。

## 开发

### 本地构建

```bash
# 构建 FPK 包
./build.sh

# 指定版本和平台
./build.sh 4.3.6 arm
```

### 项目结构

```
chaoxing-signin/
├── app/                    # 应用代码
│   ├── server/             # Node.js 服务端
│   └── ui/                 # Web UI
├── cmd/                    # 服务管理脚本
├── config/                 # 配置文件
├── manifest                # 应用元数据
├── wizard/                 # 卸载向导
├── app.tgz                 # 应用归档
├── build.sh                # 本地构建脚本
└── .github/workflows/      # GitHub Actions CI/CD
```

## CI/CD

本项目使用 GitHub Actions 自动构建和发布：

- 推送 `v*` 标签时自动构建并发布 Release
- 支持手动触发构建
- 自动检测版本号并生成 FPK 包

### 创建发布

```bash
# 更新 manifest 中的版本号
# 提交更改
git add .
git commit -m "bump version to 4.3.6"

# 创建标签
git tag v4.3.6

# 推送标签触发自动构建
git push origin v4.3.6
```

## 许可证

MIT License

## 致谢

- [fnOS](https://www.fnnas.com/) - 飞牛 NAS 操作系统
- [超星学习通签到](https://github.com/sweetcornna/chaoxing-signin) - 原始项目
